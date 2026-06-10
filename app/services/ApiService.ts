import axios from "axios";
import type { CancelTokenSource } from "axios";

export interface User {
	id: number;
	name: string;
	username: string;
	email: string;
}

/** Тонкая обёртка над axios для GET-запросов с автоматической отменой предыдущего запроса. */
export class ApiService {
	private url: string;
	private cancelToken: CancelTokenSource;

	constructor(url = "http://localhost:8081/") {
		this.url = url;
		this.cancelToken = axios.CancelToken.source();
	}

	/**
	 * Выполняет GET-запрос к `${url}${endpoint}`, отменяя предыдущий незавершённый запрос.
	 * Дополнительно можно передать `signal` (например, `ctx.signal` из роутера) — запрос
	 * будет отменён, если навигация перекрыта более новой до получения ответа.
	 */
	async httpGet<T>(endpoint = "", signal?: AbortSignal): Promise<T> {
		try {
			// Отменяем предыдущий запрос, если он существует
			this.cancelToken.cancel("Cancelled Ongoing Request");
			// Создаем новый токен отмены для следующего запроса
			this.cancelToken = axios.CancelToken.source();
			// Выполняем GET запрос
			const response = await axios.get<T>(`${this.url}${endpoint}`, {
				cancelToken: this.cancelToken.token,
				signal,
			});
			// Возвращаем данные ответа
			return response.data;
		} catch (error) {
			// Передаем ошибку в returnErr для обработки
			return this.returnErr(error);
		}
	}

	/** Логирует ошибку запроса (отдельно — отмену) и пробрасывает её дальше. */
	private returnErr(error: unknown): never {
		if (axios.isCancel(error)) {
			console.log("Request canceled:", error instanceof Error ? error.message : error);
		} else if (error instanceof Error) {
			console.error("An error occurred:", error.message);
		}
		// Перебрасываем ошибку дальше
		throw error;
	}

	/** Получает список пользователей с эндпоинта "users". */
	async getUsers(signal?: AbortSignal): Promise<User[]> {
		return this.httpGet<User[]>("users", signal);
	}
}
