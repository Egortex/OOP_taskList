const TOKEN_KEY = "authToken";

/** Возвращает сохранённый токен авторизации либо null, если пользователь не вошёл. */
export function getAuthToken(): string | null {
	return localStorage.getItem(TOKEN_KEY);
}

/** Сохраняет токен авторизации в localStorage. */
export function setAuthToken(token: string): void {
	localStorage.setItem(TOKEN_KEY, token);
}

/** Удаляет токен авторизации (выход из системы). */
export function clearAuthToken(): void {
	localStorage.removeItem(TOKEN_KEY);
}

/** Проверяет, авторизован ли пользователь (есть ли сохранённый токен). */
export function isAuthenticated(): boolean {
	return getAuthToken() !== null;
}
