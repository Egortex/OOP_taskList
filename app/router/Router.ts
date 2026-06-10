import { matchPath } from "./match";
import { PageCache } from "./cache";
import type {
	LayoutLoader,
	LayoutRenderResult,
	NavigateOptions,
	NavigationStatus,
	PageModule,
	RouteContext,
	RouteDefinition,
} from "./types";

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
	private currentLayoutLoader: LayoutLoader | null = null;
	private currentLayout: LayoutRenderResult | null = null;

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
		this.preloadCriticalRoutes();
	}

	/** Сразу после старта подгружает JS-чанки маршрутов с `preload: true` (кроме текущего), не дожидаясь клика. */
	private preloadCriticalRoutes(): void {
		for (const route of this.routes) {
			if (!route.preload || route.path === location.pathname) continue;
			void route.load().catch(() => {
				// Предзагрузка best-effort: ошибки молча игнорируются
			});
		}
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

			const cached = page.loader ? this.cache.get<unknown>(path) : undefined;

			if (navId !== this.navId) return; // перекрыто более новой навигацией

			const pageContainer = await this.mountLayout(matched.layout ?? null, ctx);
			if (navId !== this.navId) return; // перекрыто более новой навигацией

			this.cleanupCurrentPage?.();
			pageContainer.innerHTML = "";

			let data: unknown;
			let usedSkeleton = false;
			if (page.loader) {
				if (cached !== undefined) {
					data = cached.data;
					if (cached.stale) {
						void this.revalidate(page, ctx, path, navId);
					}
				} else {
					if (page.skeleton) {
						page.skeleton(pageContainer);
						document.body.classList.add("has-skeleton");
						usedSkeleton = true;
					}
					data = await page.loader(ctx);
					if (navId !== this.navId) return; // перекрыто более новой навигацией
					this.cache.set(path, data);
				}
			}

			if (usedSkeleton) {
				document.body.classList.remove("has-skeleton");
				pageContainer.innerHTML = "";
			}

			const cleanup = page.render(pageContainer, data, ctx);
			this.cleanupCurrentPage = typeof cleanup === "function" ? cleanup : null;

			this.restoreScroll(path, options.isPopState ?? false);
			this.setStatus("success");
		} catch (error) {
			document.body.classList.remove("has-skeleton");
			if (navId !== this.navId) return;
			console.error("Navigation error:", error);
			this.setStatus("error");
		}
	}

	/**
	 * Фоновое обновление устаревших (stale) данных страницы: запрашивает свежие данные через
	 * `loader`, обновляет кэш и, если пользователь всё ещё на этой странице, перерисовывает её.
	 */
	private async revalidate(page: PageModule, ctx: RouteContext, path: string, navId: number): Promise<void> {
		if (!page.loader) return;
		try {
			const fresh = await page.loader(ctx);
			this.cache.set(path, fresh);
			if (navId !== this.navId) return; // ушли с этой страницы — перерисовывать не нужно

			const container = this.currentLayout?.outlet ?? this.container;
			this.cleanupCurrentPage?.();
			container.innerHTML = "";
			const cleanup = page.render(container, fresh, ctx);
			this.cleanupCurrentPage = typeof cleanup === "function" ? cleanup : null;
		} catch {
			// Фоновое обновление best-effort: оставляем устаревшие данные при ошибке
		}
	}

	/**
	 * Гарантирует, что в контейнере смонтирован нужный layout, и возвращает его outlet —
	 * элемент, в который должна рендериться текущая страница.
	 *
	 * Если у нового маршрута тот же `layoutLoader` (та же функция-ссылка), что и у текущего,
	 * layout не пересоздаётся — вызывается только его `update()` (например, для подсветки
	 * активной ссылки в навигации). Если layout сменился или его нет вовсе — текущий layout
	 * и страница очищаются, контейнер пересоздаётся.
	 */
	private async mountLayout(layoutLoader: LayoutLoader | null, ctx: RouteContext): Promise<HTMLElement> {
		if (layoutLoader === this.currentLayoutLoader && this.currentLayout) {
			this.currentLayout.update?.(ctx);
			return this.currentLayout.outlet;
		}

		this.cleanupCurrentPage?.();
		this.cleanupCurrentPage = null;
		this.currentLayout?.cleanup?.();
		this.currentLayout = null;
		this.container.innerHTML = "";
		this.currentLayoutLoader = layoutLoader;

		if (!layoutLoader) {
			return this.container;
		}

		const module = await layoutLoader();
		this.currentLayout = module.default.render(this.container, ctx);
		return this.currentLayout.outlet;
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
