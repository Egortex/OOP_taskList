import axios from "axios";
import type { CancelTokenSource } from "axios";

export interface User {
	id: number;
	name: string;
	username: string;
	email: string;
}

export class ApiService {
	private url: string;
	private cancelToken: CancelTokenSource;

	constructor(url = "http://localhost:8081/") {
		this.url = url;
		this.cancelToken = axios.CancelToken.source();
	}

	async httpGet<T>(endpoint = ""): Promise<T> {
		try {
			// Отменяем предыдущий запрос, если он существует
			this.cancelToken.cancel("Cancelled Ongoing Request");
			// Создаем новый токен отмены для следующего запроса
			this.cancelToken = axios.CancelToken.source();
			// Выполняем GET запрос
			const response = await axios.get<T>(`${this.url}${endpoint}`, {
				cancelToken: this.cancelToken.token,
			});
			// Возвращаем данные ответа
			return response.data;
		} catch (error) {
			// Передаем ошибку в returnErr для обработки
			return this.returnErr(error);
		}
	}

	private returnErr(error: unknown): never {
		if (axios.isCancel(error)) {
			console.log("Request canceled:", error instanceof Error ? error.message : error);
		} else if (error instanceof Error) {
			console.error("An error occurred:", error.message);
		}
		// Перебрасываем ошибку дальше
		throw error;
	}

	async getUsers(): Promise<User[]> {
		return this.httpGet<User[]>("users");
	}
}
