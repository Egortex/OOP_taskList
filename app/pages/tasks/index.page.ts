import "./index.scss";
import templateHTML from "./index.html?raw";
import { mountTemplate } from "@chepchik/dom-template";
import { preloader, toaster } from "../../../main";
import { SearchPanel } from "../../components/searchPanel/searchPanel";
import { TaskManager } from "../../components/task/TaskManager";
import { jsonPlaceholderApi as api } from "../../services/container";
import type { PageModule } from "@chepchik/spa-router";

const tasksPage: PageModule = {
	render(container): () => void {
		mountTemplate(container, templateHTML);

		const taskManager = new TaskManager("task", {
			data: { api, dataTest: "тестирование" },
			events: {
				toast: () => toaster.showToast("Задача успешно добавлена!", 5000),
				onLoader: () => preloader.visiblePreloader(),
				offLoader: () => preloader.notVisiblePreloader(),
			},
		});

		new SearchPanel("searchPanel", {
			data: { taskManager },
		});

		return () => {
			container.innerHTML = "";
		};
	},
};

export default tasksPage;
