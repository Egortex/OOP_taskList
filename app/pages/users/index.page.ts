import "./index.scss";
import templateHTML from "./index.html?raw";
import { mountTemplate } from "@chepchik/dom-template";
import type { PageModule } from "@chepchik/spa-router";

/**
 * Содержимое outlet'а секции /users по умолчанию: список пользователей рендерит
 * `usersLayout` (сайдбар), здесь — лишь подсказка выбрать пользователя.
 */
const usersPage: PageModule = {
	render(container): void {
		mountTemplate(container, templateHTML);
	},
};

export default usersPage;
