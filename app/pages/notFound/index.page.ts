import "./index.scss";
import templateHTML from "./index.html?raw";
import { mountTemplate } from "dom-template";
import type { PageModule } from "spa-router";

interface NotFoundRefs extends Record<string, HTMLElement> {
	message: HTMLParagraphElement;
}

const notFoundPage: PageModule = {
	render(container, _data, ctx): void {
		const refs = mountTemplate<NotFoundRefs>(container, templateHTML);
		refs.message.textContent = `Страница «${ctx.path}» не найдена.`;
	},
};

export default notFoundPage;
