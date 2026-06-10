import "./index.scss";
import templateHTML from "./index.html?raw";
import { mountTemplate } from "../../router/renderTemplate";
import type { PageModule } from "../../router/types";

interface AboutData {
	title: string;
	content: string;
}

interface AboutRefs extends Record<string, HTMLElement> {
	title: HTMLHeadingElement;
	content: HTMLParagraphElement;
	hint: HTMLParagraphElement;
}

const aboutPage: PageModule<AboutData> = {
	async loader(): Promise<AboutData> {
		const response = await fetch("/api/pages/about");
		if (!response.ok) throw new Error("Failed to load about page data");
		return (await response.json()) as AboutData;
	},

	render(container, data, ctx): void {
		const refs = mountTemplate<AboutRefs>(container, templateHTML);
		refs.title.textContent = data.title;
		refs.content.textContent = data.content;

		// Пример работы с query-параметрами: /about?ref=home
		const ref = ctx.query.get("ref");
		if (ref) {
			refs.hint.textContent = `Переход по ссылке из: ${ref}`;
			refs.hint.removeAttribute("hidden");
		}
	},
};

export default aboutPage;
