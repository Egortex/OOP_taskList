import "./preloader.scss";
import templateHTML from "./preloader.html?raw";
import { Component, ComponentProps } from "../component";

interface PreloaderRefs extends Record<string, HTMLElement> {
	pagePreloader: HTMLElement;
}

export class Preloader extends Component<PreloaderRefs> {
	/**
	 * Создает предзагрузчик, который может быть показан или скрыт.
	 * @param placeholderId - ID элемента для вставки предзагрузчика.
	 * @param props - Свойства компонента.
	 */
	constructor(placeholderId: string, props?: ComponentProps) {
		super(placeholderId, props, templateHTML);
	}

	/** Показывает предзагрузчик */
	visiblePreloader(): void {
		this.refs.pagePreloader.classList.remove("done");
	}

	/** Скрывает предзагрузчик */
	notVisiblePreloader(): void {
		this.refs.pagePreloader.classList.add("done");
	}
}
