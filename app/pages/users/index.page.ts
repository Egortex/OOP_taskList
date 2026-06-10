import "./index.scss";
import templateHTML from "./index.html?raw";
import { mountTemplate } from "../../router/renderTemplate";
import type { PageModule } from "../../router/types";

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
