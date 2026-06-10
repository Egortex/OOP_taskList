import "./index.scss";
import templateHTML from "./index.html?raw";
import { mountTemplate } from "../../router/renderTemplate";
import { ApiService, type User } from "../../services/ApiService";
import type { PageModule } from "../../router/types";

const api = new ApiService("https://jsonplaceholder.typicode.com/");

interface UsersRefs extends Record<string, HTMLElement> {
	list: HTMLUListElement;
}

const usersPage: PageModule<User[]> = {
	async loader(): Promise<User[]> {
		return api.getUsers();
	},

	render(container, data): void {
		const refs = mountTemplate<UsersRefs>(container, templateHTML);

		data.forEach((user) => {
			const item = document.createElement("li");
			item.className = "users-grid__item";
			const link = document.createElement("a");
			link.href = `/users/${user.id}`;
			link.textContent = user.name;
			item.appendChild(link);
			refs.list.appendChild(item);
		});
	},
};

export default usersPage;
