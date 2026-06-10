import "./searchPanel.scss";
import templateHTML from "./searchPanel.html?raw";
import { Component, ComponentProps } from "../component";
import { TaskManager } from "../task/TaskManager";
import { Task } from "../task/Task";

export interface SearchPanelRefs extends Record<string, HTMLElement> {
	searchInput: HTMLInputElement;
}

export interface SearchPanelData {
	taskManager: TaskManager;
}

export class SearchPanel extends Component<SearchPanelRefs> {
	private taskManager: TaskManager;

	/**
	 * Создает панель поиска по задачам.
	 * @param placeholderId - ID элемента для вставки панели поиска.
	 * @param props - Свойства компонента.
	 */
	constructor(placeholderId: string, props: ComponentProps<SearchPanelData>) {
		super(placeholderId, props, templateHTML);
		if (!props.data) throw new Error("SearchPanel requires 'data.taskManager' to be provided.");
		this.taskManager = props.data.taskManager;

		this.refs.searchInput.addEventListener("input", this.handleSearchInput.bind(this));
	}

	/** Обрабатывает ввод в поле поиска: фильтрует задачи и обновляет их отображение. */
	private handleSearchInput(event: Event): void {
		const searchTerm = (event.target as HTMLInputElement).value;
		const filteredTasks = this.taskManager.searchTasks(searchTerm);
		this.updateTaskDisplay(filteredTasks);
	}

	/** Перерисовывает список задач в DOM на основе результатов поиска. */
	private updateTaskDisplay(filteredTasks: Task[]): void {
		// Логика для обновления отображения задач на основе результатов поиска
		const tasksContainer = this.taskManager.getTasksListElement();

		tasksContainer.innerHTML = ""; // Очистить текущее отображение задач

		filteredTasks.forEach((task) => {
			const taskElement = document.createElement("li");
			taskElement.textContent = task.title;
			taskElement.onclick = () => this.taskManager.toggleCompleted(task.id);
			tasksContainer.appendChild(taskElement);

			const deleteButton = document.createElement("button");
			deleteButton.textContent = "Delete";
			deleteButton.onclick = (e) => {
				e.stopPropagation(); // Предотвращаем срабатывание onclick родителя
				this.taskManager.deleteTask(task.id);
			};
			taskElement.appendChild(deleteButton);
		});
	}
}
