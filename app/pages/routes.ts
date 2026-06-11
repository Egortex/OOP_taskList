import type { LayoutLoader, RouteDefinition } from "@chepchik/spa-router";

/**
 * Общий layout приложения (шапка с навигацией). Объявлен как одна функция-ссылка
 * и переиспользуется во всех маршрутах, чтобы роутер не пересоздавал его при навигации
 * между страницами одной секции.
 */
const mainLayout: LayoutLoader = () => import("../layouts/main/index.layout");

/**
 * Layout секции /users (master-detail: список пользователей + outlet с деталями).
 * Тоже объявлен одной функцией-ссылкой, чтобы переиспользоваться между
 * /users и /users/:id без пересоздания.
 */
const usersLayout: LayoutLoader = () => import("../layouts/users/index.layout");

/**
 * Реестр маршрутов (аналог файловой маршрутизации Next.js, но явный).
 * Каждая страница лежит в своей папке pages/<route>/index.page.ts
 * и подгружается лениво — это даёт code splitting "из коробки".
 */
export const routes: RouteDefinition[] = [
	{ path: "/", load: () => import("./home/index.page"), layout: mainLayout, preload: true },
	{ path: "/tasks", load: () => import("./tasks/index.page"), layout: mainLayout, preload: true },
	{ path: "/about", load: () => import("./about/index.page"), layout: mainLayout },
	{ path: "/form-demo", load: () => import("./form-demo/index.page"), layout: mainLayout },
	{ path: "/users", load: () => import("./users/index.page"), layout: [mainLayout, usersLayout] },
	{ path: "/users/:id", load: () => import("./users/[id]/index.page"), layout: [mainLayout, usersLayout] },
	{ path: "/login", load: () => import("./login/index.page"), layout: mainLayout },
	{ path: "/profile", load: () => import("./profile/index.page"), layout: mainLayout },
	{ path: "*", load: () => import("./notFound/index.page"), layout: mainLayout },
];
