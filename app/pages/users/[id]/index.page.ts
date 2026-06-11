import "./index.scss";
import templateHTML from "./index.html?raw";
import { mountTemplate } from "@chepchik/dom-template";
import type { User } from "../../../services/ApiService";
import { jsonPlaceholderApi as api } from "../../../services/container";
import type { PageModule } from "@chepchik/spa-router";

interface UserRefs extends Record<string, HTMLElement> {
	heading: HTMLHeadingElement;
	name: HTMLElement;
	email: HTMLElement;
}

const userPage: PageModule<User> = {
	async loader(ctx): Promise<User> {
		// Пример работы с параметрами маршрута: /users/:id
		return api.httpGet<User>(`users/${ctx.params.id}`, ctx.signal);
	},

	skeleton(container): void {
		const refs = mountTemplate<UserRefs>(container, templateHTML);
		refs.heading.textContent = "Загрузка...";
		refs.heading.classList.add("skeleton", "user-detail__skeleton-heading");
		refs.name.textContent = "Загрузка...";
		refs.name.classList.add("skeleton", "user-detail__skeleton-text");
		refs.email.textContent = "Загрузка...";
		refs.email.classList.add("skeleton", "user-detail__skeleton-text");
	},

	render(container, data, ctx): void {
		const refs = mountTemplate<UserRefs>(container, templateHTML);
		refs.heading.textContent = `Пользователь #${ctx.params.id}`;
		refs.name.textContent = data.name;
		refs.email.textContent = data.email;
	},
};

export default userPage;
