import "./app/assets/style/style.scss";
import { Preloader } from "./app/components/preloader/preloader";
import { SearchPanel } from "./app/components/searchPanel/searchPanel";
import { TaskManager } from "./app/components/task/TaskManager";
import template from "./app/components/template.html?raw";
import { Toaster } from "./app/components/toaster/toaster";
import { ApiService } from "./app/services/ApiService";

class Main {
	private preloader!: Preloader;
	private api!: ApiService;
	private toaster!: Toaster;
	private tasks!: TaskManager;

	constructor() {
		document.addEventListener("DOMContentLoaded", this.onDOMContentLoaded.bind(this));
	}

	private onDOMContentLoaded(): void {
		// Вставляем шаблон приложения в элемент с ID 'app'
		const appElem = document.getElementById("app");
		if (!appElem) throw new Error("Element with ID 'app' not found.");
		appElem.outerHTML = template;

		// Создаем экземпляр предзагрузчика
		this.preloader = new Preloader("preloaderContainer");

		// Инициализируем остальные компоненты приложения
		this.initializeComponents();
	}

	private initializeComponents(): void {
		this.api = new ApiService("https://jsonplaceholder.typicode.com/");

		this.toaster = new Toaster();

		this.tasks = new TaskManager("task", {
			data: {
				api: this.api,
				dataTest: "тестирование",
			},
			events: {
				toast: () => {
					this.toaster.showToast(`Задача успешно добавлена!`, 5000);
				},
				onLoader: () => {
					this.preloader.visiblePreloader();
				},
				offLoader: () => {
					this.preloader.notVisiblePreloader();
				},
			},
		});

		new SearchPanel("searchPanel", {
			data: {
				taskManager: this.tasks,
			},
		});
	}
}

// Создаем экземпляр приложения
new Main();
