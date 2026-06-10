import { matchPath } from "./match";
import { PageCache } from "./cache";
import type { NavigateOptions, NavigationStatus, RouteContext, RouteDefinition } from "./types";

interface ResolvedRoute {
	route: RouteDefinition;
	params: Record<string, string>;
}

export type StatusListener = (status: NavigationStatus) => void;

/**
 * Клиентский SPA-роутер: перехват ссылок, History API, матчинг маршрутов,
 * lazy-loading страниц, loaders, guards, кэш, prefetch и scroll restoration.
 */
export class Router {
	private cache = new PageCache();
	private cleanupCurrentPage: (() => void) | null = null;
	private statusListeners = new Set<StatusListener>();
	private scrollPositions = new Map<string, number>();
	private navId = 0;

	constructor(
		private routes: RouteDefinition[],
		private container: HTMLElement,
	) {
		history.scrollRestoration = "manual";
	}

	/** Запускает роутер: подписывается на popstate/click/mouseover и рендерит текущий маршрут. */
	start(): void {
		window.addEventListener("popstate", () => {
			void this.render({ isPopState: true });
		});
		document.addEventListener("click", this.onClick);
		document.addEventListener("mouseover", this.onMouseOver);
		void this.render();
	}

	/** Подписывается на изменения статуса навигации (loading/success/error). Возвращает функцию отписки. */
	onStatusChange(listener: StatusListener): () => void {
		this.statusListeners.add(listener);
		return () => this.statusListeners.delete(listener);
	}

	/** Переходит на указанный путь: обновляет History API и перерисовывает страницу. */
	navigate(path: string, options: NavigateOptions = {}): void {
		const current = location.pathname + location.search;
		if (path === current && !options.replace) return;

		this.scrollPositions.set(current, window.scrollY);

		if (options.replace) {
			history.replaceState(options.state ?? {}, "", path);
		} else {
			history.pushState(options.state ?? {}, "", path);
		}

		void this.render();
	}

	/** Перехватывает клики по внутренним ссылкам и выполняет SPA-навигацию вместо полной перезагрузки страницы. */
	private onClick = (event: MouseEvent): void => {
		if (event.defaultPrevented || event.button !== 0) return;
		if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

		const target = event.target;
		if (!(target instanceof Element)) return;

		const link = target.closest("a");
		if (!link) return;
		if (link.target && link.target !== "_self") return;
		if (link.hasAttribute("download")) return;
		if (link.dataset.noRouter !== undefined) return;

		const url = new URL(link.href, location.href);
		if (url.origin !== location.origin) return;

		event.preventDefault();
		this.navigate(url.pathname + url.search);
	};

	/** При наведении на внутреннюю ссылку запускает предзагрузку данных целевой страницы. */
	private onMouseOver = (event: MouseEvent): void => {
		const target = event.target;
		if (!(target instanceof Element)) return;

		const link = target.closest("a");
		if (!link) return;

		const url = new URL(link.href, location.href);
		if (url.origin !== location.origin) return;

		void this.prefetch(url.pathname + url.search);
	};

	/** Предзагрузка данных страницы по наведению на ссылку (Next.js-style). */
	private async prefetch(path: string): Promise<void> {
		if (this.cache.has(path)) return;

		const resolved = this.resolve(path.split("?")[0]);
		if (!resolved || resolved.route.redirectTo) return;

		try {
			const module = await resolved.route.load();
			const loader = module.default.loader;
			if (!loader) return;

			const ctx = this.buildContext(path, resolved.params);
			const data = await loader(ctx);
			this.cache.set(path, data);
		} catch {
			// Префетч best-effort: ошибки молча игнорируются, основная навигация повторит запрос
		}
	}

	/** Находит маршрут, соответствующий переданному pathname, и извлекает параметры из него. */
	private resolve(pathname: string): ResolvedRoute | null {
		for (const route of this.routes) {
			if (route.path === "*") continue;
			const params = matchPath(route.path, pathname);
			if (params) return { route, params };
		}
		return null;
	}

	/** Формирует контекст маршрута (путь, параметры, query-строка) для loader/guard/render. */
	private buildContext(path: string, params: Record<string, string>): RouteContext {
		const [pathname, search = ""] = path.split("?");
		return { path: pathname, params, query: new URLSearchParams(search) };
	}

	/** Оповещает всех подписчиков о смене статуса навигации. */
	private setStatus(status: NavigationStatus): void {
		this.statusListeners.forEach((listener) => listener(status));
	}

	/**
	 * Основной цикл рендера: матчит маршрут, выполняет guard и loader (с учётом кэша),
	 * затем монтирует страницу в контейнер и восстанавливает прокрутку.
	 */
	private async render(options: { isPopState?: boolean } = {}): Promise<void> {
		const navId = ++this.navId;
		const path = location.pathname + location.search;
		const resolved = this.resolve(location.pathname);
		const fallback = this.routes.find((route) => route.path === "*");
		const matched = resolved?.route ?? fallback;

		this.setStatus("loading");

		try {
			if (!matched) throw new Error("No route matched and no '*' fallback route is registered.");

			if (matched.redirectTo) {
				this.navigate(matched.redirectTo, { replace: true });
				return;
			}

			const ctx = this.buildContext(path, resolved?.params ?? {});
			const module = await matched.load();
			const page = module.default;

			if (page.guard) {
				const allowed = await page.guard(ctx);
				if (!allowed) return; // guard сам инициирует редирект (например, на /login)
			}

			let data: unknown;
			if (page.loader) {
				const cached = this.cache.get<unknown>(path);
				if (cached !== undefined) {
					data = cached;
				} else {
					data = await page.loader(ctx);
					this.cache.set(path, data);
				}
			}

			if (navId !== this.navId) return; // перекрыто более новой навигацией

			this.cleanupCurrentPage?.();
			this.container.innerHTML = "";
			const cleanup = page.render(this.container, data, ctx);
			this.cleanupCurrentPage = typeof cleanup === "function" ? cleanup : null;

			this.restoreScroll(path, options.isPopState ?? false);
			this.setStatus("success");
		} catch (error) {
			if (navId !== this.navId) return;
			console.error("Navigation error:", error);
			this.setStatus("error");
		}
	}

	/** Восстанавливает позицию прокрутки при переходе назад/вперёд или прокручивает наверх при обычной навигации. */
	private restoreScroll(path: string, isPopState: boolean): void {
		if (isPopState) {
			window.scrollTo(0, this.scrollPositions.get(path) ?? 0);
		} else {
			window.scrollTo(0, 0);
		}
	}
}
