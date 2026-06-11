import "./index.scss";
import templateHTML from "./index.html?raw";
import { mountTemplate } from "@chepchik/dom-template";
import type { LayoutModule, LayoutRenderResult } from "@chepchik/spa-router";

interface MainLayoutRefs extends Record<string, HTMLElement> {
	nav: HTMLElement;
	outlet: HTMLElement;
}

/** Подсвечивает в навигации ссылку, соответствующую текущему пути. */
function updateActiveLink(nav: HTMLElement, path: string): void {
	nav.querySelectorAll<HTMLAnchorElement>("a").forEach((link) => {
		link.classList.toggle("site-nav__link--active", link.getAttribute("href") === path);
	});
}

/** Основной layout приложения: шапка с навигацией + outlet для текущей страницы. */
const mainLayout: LayoutModule = {
	render(container, ctx): LayoutRenderResult {
		const refs = mountTemplate<MainLayoutRefs>(container, templateHTML);
		updateActiveLink(refs.nav, ctx.path);

		return {
			outlet: refs.outlet,
			update(ctx): void {
				updateActiveLink(refs.nav, ctx.path);
			},
		};
	},
};

export default mainLayout;
