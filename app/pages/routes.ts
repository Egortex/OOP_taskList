import type { LayoutLoader, RouteDefinition } from "../router/types";

/**
 * Общий layout приложения (шапка с навигацией). Объявлен как одна функция-ссылка
 * и переиспользуется во всех маршрутах, чтобы роутер не пересоздавал его при навигации
 * между страницами одной секции.
 */
const mainLayout: LayoutLoader = () => import("../layouts/main/index.layout");

/**
 * Реестр маршрутов (аналог файловой маршрутизации Next.js, но явный).
 * Каждая страница лежит в своей папке pages/<route>/index.page.ts
 * и подгружается лениво — это даёт code splitting "из коробки".
 */
export const routes: RouteDefinition[] = [
	{ path: "/", load: () => import("./home/index.page"), layout: mainLayout, preload: true },
	{ path: "/tasks", load: () => import("./tasks/index.page"), layout: mainLayout, preload: true },
	{ path: "/about", load: () => import("./about/index.page"), layout: mainLayout },
	{ path: "/users", load: () => import("./users/index.page"), layout: mainLayout },
	{ path: "/users/:id", load: () => import("./users/[id]/index.page"), layout: mainLayout },
	{ path: "/login", load: () => import("./login/index.page"), layout: mainLayout },
	{ path: "/profile", load: () => import("./profile/index.page"), layout: mainLayout },
	{ path: "*", load: () => import("./notFound/index.page"), layout: mainLayout },
];
