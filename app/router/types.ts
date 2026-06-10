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
	/** Рендерит страницу в контейнер; может вернуть функцию очистки перед уходом со страницы. */
	render(container: HTMLElement, data: TData, ctx: RouteContext): RenderResult;
}

export interface RouteDefinition {
	/** Путь маршрута, например "/tasks/:id". Специальное значение "*" — fallback (404). */
	path: string;
	/** Если задано — роутер сразу редиректит на этот путь. */
	redirectTo?: string;
	/** Ленивая загрузка модуля страницы (code splitting). */
	load: () => Promise<{ default: PageModule }>;
}

export interface NavigateOptions {
	replace?: boolean;
	state?: Record<string, unknown>;
}
