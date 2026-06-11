import "./index.scss";
import templateHTML from "./index.html?raw";
import { mountTemplate } from "dom-template";
import type { PageModule } from "spa-router";

interface HomeData {
	title: string;
	content: string;
}

interface HomeRefs extends Record<string, HTMLElement> {
	title: HTMLHeadingElement;
	content: HTMLParagraphElement;
}

const homePage: PageModule<HomeData> = {
	async loader(ctx): Promise<HomeData> {
		const response = await fetch("/api/pages/home", { signal: ctx.signal });
		if (!response.ok) throw new Error("Failed to load home page data");
		return (await response.json()) as HomeData;
	},

	render(container, data): void {
		const refs = mountTemplate<HomeRefs>(container, templateHTML);
		refs.title.textContent = data.title;
		refs.content.textContent = data.content;
	},
};

export default homePage;
