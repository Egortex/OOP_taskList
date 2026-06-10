import type { RouteParams } from "./types";

/**
 * Сопоставляет шаблон маршрута ("/tasks/:id") с реальным pathname.
 * Возвращает объект параметров либо null, если маршрут не подходит.
 */
export function matchPath(pattern: string, pathname: string): RouteParams | null {
	const patternParts = pattern.split("/").filter(Boolean);
	const pathParts = pathname.split("/").filter(Boolean);

	if (patternParts.length !== pathParts.length) return null;

	const params: RouteParams = {};
	for (let i = 0; i < patternParts.length; i++) {
		const patternPart = patternParts[i];
		const pathPart = pathParts[i];

		if (patternPart.startsWith(":")) {
			params[patternPart.slice(1)] = decodeURIComponent(pathPart);
		} else if (patternPart !== pathPart) {
			return null;
		}
	}

	return params;
}
