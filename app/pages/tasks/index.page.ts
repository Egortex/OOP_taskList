import "./index.scss";
import templateHTML from "./index.html?raw";
import { mountTemplate } from "../../router/renderTemplate";
import { preloader, toaster } from "../../../main";
import { SearchPanel } from "../../components/searchPanel/searchPanel";
import { TaskManager } from "../../components/task/TaskManager";
import { ApiService } from "../../services/ApiService";
import type { PageModule } from "../../router/types";

const tasksPage: PageModule = {
	render(container): () => void {
		mountTemplate(container, templateHTML);

		const api = new ApiService("https://jsonplaceholder.typicode.com/");

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
