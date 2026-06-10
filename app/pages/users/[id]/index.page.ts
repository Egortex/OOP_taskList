import "./index.scss";
import templateHTML from "./index.html?raw";
import { mountTemplate } from "../../../router/renderTemplate";
import { ApiService, type User } from "../../../services/ApiService";
import type { PageModule } from "../../../router/types";

const api = new ApiService("https://jsonplaceholder.typicode.com/");

interface UserRefs extends Record<string, HTMLElement> {
	heading: HTMLHeadingElement;
	name: HTMLElement;
	email: HTMLElement;
}

const userPage: PageModule<User> = {
	async loader(ctx): Promise<User> {
		// Пример работы с параметрами маршрута: /users/:id
		return api.httpGet<User>(`users/${ctx.params.id}`);
	},

	render(container, data, ctx): void {
		const refs = mountTemplate<UserRefs>(container, templateHTML);
		refs.heading.textContent = `Пользователь #${ctx.params.id}`;
		refs.name.textContent = data.name;
		refs.email.textContent = data.email;
	},
};

export default userPage;
