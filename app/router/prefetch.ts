import type { RouteDefinition } from "./types";

/** Задержка перед prefetch по наведению — отменяется, если курсор уходит со ссылки раньше. */
export const PREFETCH_HOVER_DELAY_MS = 120;

/** Сразу после старта подгружает JS-чанки маршрутов с `preload: true` (кроме текущего), не дожидаясь клика. */
export function preloadCriticalRoutes(routes: RouteDefinition[]): void {
	for (const route of routes) {
		if (!route.preload || route.path === location.pathname) continue;
		void route.load().catch(() => {
			// Предзагрузка best-effort: ошибки молча игнорируются
		});
	}
}

/**
 * Отслеживает наведение на внутренние ссылки и с задержкой `PREFETCH_HOVER_DELAY_MS`
 * вызывает `onPrefetch` с путём ссылки — это отсеивает "пролётные" наведения
 * (например, при быстром скролле мышью по списку ссылок). Отменяется при `mouseout`.
 */
export class HoverPrefetcher {
	private timer: ReturnType<typeof setTimeout> | null = null;

	constructor(private onPrefetch: (path: string) => void) {}

	/** Подписывается на `mouseover`/`mouseout` для перехвата наведений на ссылки. */
	attach(): void {
		document.addEventListener("mouseover", this.onMouseOver);
		document.addEventListener("mouseout", this.onMouseOut);
	}

	private onMouseOver = (event: MouseEvent): void => {
		const target = event.target;
		if (!(target instanceof Element)) return;

		const link = target.closest("a");
		if (!link) return;

		const url = new URL(link.href, location.href);
		if (url.origin !== location.origin) return;

		if (this.timer) clearTimeout(this.timer);
		const path = url.pathname + url.search;
		this.timer = setTimeout(() => {
			this.timer = null;
			this.onPrefetch(path);
		}, PREFETCH_HOVER_DELAY_MS);
	};

	private onMouseOut = (): void => {
		if (this.timer) {
			clearTimeout(this.timer);
			this.timer = null;
		}
	};
}
