import { ApiService } from "./ApiService";

/** Базовый URL демо-API (jsonplaceholder), используемого секциями users и tasks. */
const JSONPLACEHOLDER_URL = "https://jsonplaceholder.typicode.com/";

/** Общий экземпляр ApiService для jsonplaceholder — переиспользуется страницами и layout'ами. */
export const jsonPlaceholderApi = new ApiService(JSONPLACEHOLDER_URL);
