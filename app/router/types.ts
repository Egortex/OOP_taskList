export interface RouteParams {
	[key: string]: string;
}

export interface RouteContext {
	path: string;
	params: RouteParams;
	query: URLSearchParams;
}

export type NavigationStatus = "idle" | "loading" | "success" | "error";

export type RenderResult = void | (() => void);

/**
 * Контракт страницы: опциональный loader (GET-данные), опциональный guard
 * (доступ к маршруту) и обязательный render. Методы объявлены через
 * сокращённый синтаксис, чтобы параметры проверялись бивариантно — это
 * позволяет конкретным PageModule<T> подставляться туда, где роутер
 * ожидает PageModule<unknown>.
 */
export interface PageModule<TData = unknown> {
	/** Загружает данные страницы перед рендером (с поддержкой кэша и prefetch). */
	loader?(ctx: RouteContext): Promise<TData>;
	/** Проверяет доступ к маршруту; при false должен сам выполнить редирект. */
	guard?(ctx: RouteContext): Promise<boolean> | boolean;
	/**
	 * Рендерит временную skeleton-разметку сразу после монтирования layout'а,
	 * пока ожидается результат `loader` (только если данных ещё нет в кэше).
	 * Заменяется реальным содержимым после `render`.
	 */
	skeleton?(container: HTMLElement): void;
	/** Рендерит страницу в контейнер; может вернуть функцию очистки перед уходом со страницы. */
	render(container: HTMLElement, data: TData, ctx: RouteContext): RenderResult;
}

/** Результат монтирования layout'а: контейнер для страницы и опциональные хуки обновления/очистки. */
export interface LayoutRenderResult {
	/** Элемент, в который роутер будет рендерить текущую страницу. */
	outlet: HTMLElement;
	/** Вызывается при каждой навигации, если layout не пересоздаётся (например, для подсветки активной ссылки). */
	update?(ctx: RouteContext): void;
	/** Вызывается перед размонтированием layout'а (при переходе на маршрут с другим layout'ом). */
	cleanup?(): void;
}

/** Контракт layout'а: общая обвязка (шапка, навигация) вокруг страниц одной секции. */
export interface LayoutModule {
	render(container: HTMLElement, ctx: RouteContext): LayoutRenderResult;
}

/** Ленивая загрузка модуля layout'а. Должна быть одной и той же функцией для всех маршрутов одной секции,
 * чтобы роутер мог по ссылке определить, что layout не изменился, и не пересоздавать его. */
export type LayoutLoader = () => Promise<{ default: LayoutModule }>;

export interface RouteDefinition {
	/** Путь маршрута, например "/tasks/:id". Специальное значение "*" — fallback (404). */
	path: string;
	/** Если задано — роутер сразу редиректит на этот путь. */
	redirectTo?: string;
	/** Ленивая загрузка модуля страницы (code splitting). */
	load: () => Promise<{ default: PageModule }>;
	/** Ленивая загрузка общего layout'а для маршрута (шапка/навигация и т.п.). */
	layout?: LayoutLoader;
	/** Если true — модуль маршрута предзагружается сразу после старта роутера (для часто посещаемых страниц). */
	preload?: boolean;
}

export interface NavigateOptions {
	replace?: boolean;
	state?: Record<string, unknown>;
}
