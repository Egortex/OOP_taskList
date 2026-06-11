import "./index.scss";
import templateHTML from "./index.html?raw";
import { mountTemplate } from "dom-template";
import type { User } from "../../services/ApiService";
import { jsonPlaceholderApi as api } from "../../services/container";
import type { LayoutModule, LayoutRenderResult, RouteContext } from "spa-router";

interface UsersLayoutRefs extends Record<string, HTMLElement> {
	list: HTMLUListElement;
	outlet: HTMLElement;
}

/** Список пользователей переиспользуется между навигациями внутри секции /users. */
let cachedUsers: User[] | null = null;

/** Подсвечивает в списке ссылку на пользователя, открытого в данный момент в outlet'е. */
function highlightActive(refs: UsersLayoutRefs, ctx: RouteContext): void {
	const activeId = ctx.params.id;
	refs.list.querySelectorAll<HTMLAnchorElement>("a").forEach((link) => {
		link.classList.toggle("users-layout__link--active", link.dataset.userId === activeId);
	});
}

/** Загружает (или берёт из кэша) список пользователей и заполняет сайдбар. */
async function renderList(refs: UsersLayoutRefs, ctx: RouteContext, signal: AbortSignal): Promise<void> {
	const users = cachedUsers ?? (cachedUsers = await api.getUsers(signal));
	if (signal.aborted) return;

	refs.list.innerHTML = "";
	users.forEach((user) => {
		const item = document.createElement("li");
		item.className = "users-layout__item";

		const link = document.createElement("a");
		link.href = `/users/${user.id}`;
		link.textContent = user.name;
		link.dataset.userId = String(user.id);
		item.appendChild(link);

		refs.list.appendChild(item);
	});

	highlightActive(refs, ctx);
}

/**
 * Layout секции /users: master-detail — слева список пользователей (общий для
 * /users и /users/:id), справа outlet с деталями. Монтируется вторым в цепочке
 * после `mainLayout`.
 */
const usersLayout: LayoutModule = {
	render(container, ctx): LayoutRenderResult {
		const refs = mountTemplate<UsersLayoutRefs>(container, templateHTML);
		const controller = new AbortController();

		if (!cachedUsers) {
			refs.list.innerHTML = '<li class="users-layout__item--loading">Загрузка...</li>';
		}
		void renderList(refs, ctx, controller.signal);

		return {
			outlet: refs.outlet,
			update(ctx): void {
				highlightActive(refs, ctx);
			},
			cleanup(): void {
				controller.abort();
			},
		};
	},
};

export default usersLayout;
