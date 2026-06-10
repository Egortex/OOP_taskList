export interface PageContent {
	title: string;
	content: string;
}

export const pagesContent: Record<string, PageContent> = {
	home: {
		title: "Главная",
		content: "Добро пожаловать в Task List App — пример SPA-навигации без перезагрузки страницы.",
	},
	about: {
		title: "О проекте",
		content:
			"Клиентский роутер построен поверх History API и Express API, без сторонних SPA-фреймворков и шаблонизаторов.",
	},
};
