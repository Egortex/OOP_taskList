import type { RouteDefinition } from "../router/types";

/**
 * Реестр маршрутов (аналог файловой маршрутизации Next.js, но явный).
 * Каждая страница лежит в своей папке pages/<route>/index.page.ts
 * и подгружается лениво — это даёт code splitting "из коробки".
 */
export const routes: RouteDefinition[] = [
	{ path: "/", load: () => import("./home/index.page") },
	{ path: "/tasks", load: () => import("./tasks/index.page") },
	{ path: "/about", load: () => import("./about/index.page") },
	{ path: "/users", load: () => import("./users/index.page") },
	{ path: "/users/:id", load: () => import("./users/[id]/index.page") },
	{ path: "/login", load: () => import("./login/index.page") },
	{ path: "/profile", load: () => import("./profile/index.page") },
	{ path: "*", load: () => import("./notFound/index.page") },
];
