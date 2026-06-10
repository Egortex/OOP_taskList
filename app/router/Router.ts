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

interface MountedLayout {
	loader: LayoutLoader;
	result: LayoutRenderResult;
}

export type StatusListener = (status: NavigationStatus) => void;

/** Задержка перед prefetch по наведению — отменяется, если курсор уходит со ссылки раньше. */
const PREFETCH_HOVER_DELAY_MS = 120;

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
	private layoutChain: MountedLayout[] = [];
	private abortController: AbortController | null = null;
	private prefetchTimer: ReturnType<typeof setTimeout> | null = null;

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
		document.addEventListener("mouseout", this.onMouseOut);
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

	/**
	 * При наведении на внутреннюю ссылку откладывает prefetch на `PREFETCH_HOVER_DELAY_MS` —
	 * это отсеивает "пролётные" наведения (например, при быстром скролле мышью по списку ссылок).
	 */
	private onMouseOver = (event: MouseEvent): void => {
		const target = event.target;
		if (!(target instanceof Element)) return;

		const link = target.closest("a");
		if (!link) return;

		const url = new URL(link.href, location.href);
		if (url.origin !== location.origin) return;

		if (this.prefetchTimer) clearTimeout(this.prefetchTimer);
		const path = url.pathname + url.search;
		this.prefetchTimer = setTimeout(() => {
			this.prefetchTimer = null;
			void this.prefetch(path);
		}, PREFETCH_HOVER_DELAY_MS);
	};

	/** Отменяет отложенный prefetch, если курсор ушёл со ссылки до истечения задержки. */
	private onMouseOut = (): void => {
		if (this.prefetchTimer) {
			clearTimeout(this.prefetchTimer);
			this.prefetchTimer = null;
		}
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

			const ctx = this.buildContext(path, resolved.params, new AbortController().signal);
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

	/** Формирует контекст маршрута (путь, параметры, query-строка, сигнал отмены) для loader/guard/render. */
	private buildContext(path: string, params: Record<string, string>, signal: AbortSignal): RouteContext {
		const [pathname, search = ""] = path.split("?");
		return { path: pathname, params, query: new URLSearchParams(search), signal };
	}

	/** Приводит `RouteDefinition.layout` (одиночный layout, цепочка или его отсутствие) к массиву. */
	private toLayoutChain(layout: LayoutLoader | LayoutLoader[] | undefined): LayoutLoader[] {
		if (!layout) return [];
		return Array.isArray(layout) ? layout : [layout];
	}

	/**
	 * Выполняет обновление DOM через View Transitions API (`document.startViewTransition`),
	 * если браузер её поддерживает и пользователь не запросил отключение анимаций
	 * (`prefers-reduced-motion: reduce`). Иначе — просто выполняет `update()` напрямую.
	 */
	private runTransition(update: () => void): void {
		const doc = document as Document & { startViewTransition?: (callback: () => void) => unknown };
		if (!doc.startViewTransition || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
			update();
			return;
		}
		doc.startViewTransition(update);
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
		this.abortController?.abort();
		const abortController = new AbortController();
		this.abortController = abortController;

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

			const ctx = this.buildContext(path, resolved?.params ?? {}, abortController.signal);

			// Модуль страницы и модули новых (изменившихся) layout'ов цепочки грузятся параллельно
			const layoutChain = this.toLayoutChain(matched.layout);
			let common = 0;
			while (
				common < this.layoutChain.length &&
				common < layoutChain.length &&
				this.layoutChain[common].loader === layoutChain[common]
			) {
				common++;
			}
			const pageModulePromise = matched.load();
			const layoutModulePromises = new Map<LayoutLoader, ReturnType<LayoutLoader>>();
			for (let i = common; i < layoutChain.length; i++) {
				layoutModulePromises.set(layoutChain[i], layoutChain[i]());
			}

			const module = await pageModulePromise;
			const page = module.default;

			if (page.guard) {
				const allowed = await page.guard(ctx);
				if (!allowed) return; // guard сам инициирует редирект (например, на /login)
			}

			const cached = page.loader ? this.cache.get<unknown>(path) : undefined;

			if (navId !== this.navId) return; // перекрыто более новой навигацией

			const pageContainer = await this.mountLayout(layoutChain, common, ctx, layoutModulePromises);
			if (navId !== this.navId) return; // перекрыто более новой навигацией

			let data: unknown;
			let usedSkeleton = false;

			// Мгновенная часть: очистка предыдущей страницы и либо рендер из кэша,
			// либо skeleton, либо рендер страниц без loader'а — оборачивается в View
			// Transition для плавной смены содержимого между страницами.
			this.runTransition(() => {
				this.cleanupCurrentPage?.();
				pageContainer.innerHTML = "";

				if (page.loader && cached !== undefined) {
					data = cached.data;
					const cleanup = page.render(pageContainer, data, ctx);
					this.cleanupCurrentPage = typeof cleanup === "function" ? cleanup : null;
				} else if (page.loader && page.skeleton) {
					page.skeleton(pageContainer);
					document.body.classList.add("has-skeleton");
					usedSkeleton = true;
				} else if (!page.loader) {
					const cleanup = page.render(pageContainer, data, ctx);
					this.cleanupCurrentPage = typeof cleanup === "function" ? cleanup : null;
				}
			});

			if (page.loader) {
				if (cached !== undefined) {
					if (cached.stale) {
						void this.revalidate(page, ctx, path, navId);
					}
				} else {
					data = await page.loader(ctx);
					if (navId !== this.navId) return; // перекрыто более новой навигацией
					this.cache.set(path, data);

					if (usedSkeleton) {
						document.body.classList.remove("has-skeleton");
						pageContainer.innerHTML = "";
					}

					const cleanup = page.render(pageContainer, data, ctx);
					this.cleanupCurrentPage = typeof cleanup === "function" ? cleanup : null;
				}
			}

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

			const container = this.layoutChain[this.layoutChain.length - 1]?.result.outlet ?? this.container;
			this.cleanupCurrentPage?.();
			container.innerHTML = "";
			const cleanup = page.render(container, fresh, ctx);
			this.cleanupCurrentPage = typeof cleanup === "function" ? cleanup : null;
		} catch {
			// Фоновое обновление best-effort: оставляем устаревшие данные при ошибке
		}
	}

	/**
	 * Гарантирует, что в контейнере смонтирована нужная цепочка layout'ов, и возвращает
	 * `outlet` последнего из них — элемент, в который должна рендериться текущая страница.
	 *
	 * `common` — длина общего префикса текущей и новой цепочки (по ссылкам функций
	 * `LayoutLoader`). Layout'ы из общего префикса не пересоздаются — вызывается только
	 * их `update()` (например, для подсветки активной ссылки). Layout'ы за пределами
	 * префикса размонтируются (`cleanup()`), а новые монтируются по очереди, каждый —
	 * в `outlet` предыдущего.
	 */
	private async mountLayout(
		layoutChain: LayoutLoader[],
		common: number,
		ctx: RouteContext,
		layoutModulePromises: Map<LayoutLoader, ReturnType<LayoutLoader>>,
	): Promise<HTMLElement> {
		// Размонтируем "хвост" цепочки, который не совпал с предыдущей навигацией
		if (common < this.layoutChain.length) {
			this.cleanupCurrentPage?.();
			this.cleanupCurrentPage = null;
			for (let i = this.layoutChain.length - 1; i >= common; i--) {
				this.layoutChain[i].result.cleanup?.();
			}
			this.layoutChain.length = common;
			if (common === 0) this.container.innerHTML = "";
		}

		// Переиспользуемые layout'ы получают update() (например, подсветка активной ссылки)
		for (let i = 0; i < common; i++) {
			this.layoutChain[i].result.update?.(ctx);
		}

		let outlet = common > 0 ? this.layoutChain[common - 1].result.outlet : this.container;

		for (let i = common; i < layoutChain.length; i++) {
			outlet.innerHTML = "";
			const loader = layoutChain[i];
			const module = await layoutModulePromises.get(loader)!;
			const result = module.default.render(outlet, ctx);
			this.layoutChain.push({ loader, result });
			outlet = result.outlet;
		}

		return outlet;
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
