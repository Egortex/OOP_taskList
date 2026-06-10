import { Component, ComponentProps } from "../component";
import "./task.scss";
import templateHTML from "./task.html?raw";
import { Task, TaskPriority } from "./Task";
import { ApiService } from "../../services/ApiService";

export interface TaskManagerRefs extends Record<string, HTMLElement> {
	newTask: HTMLButtonElement;
	newTaskInput: HTMLInputElement;
	taskPriority: HTMLSelectElement;
	tasksList: HTMLUListElement;
}

export interface TaskManagerData {
	api: ApiService;
	dataTest?: string;
}

export class TaskManager extends Component<TaskManagerRefs> {
	private tasks: Task[];
	private api: ApiService;

	constructor(placeholderId: string, props: ComponentProps<TaskManagerData>) {
		super(placeholderId, props, templateHTML);
		this.tasks = JSON.parse(localStorage.getItem("tasks") ?? "[]") as Task[];
		if (!props.data) throw new Error("TaskManager requires 'data.api' to be provided.");
		this.api = props.data.api;
		this.init();
	}

	private init(): void {
		this.refs.newTask.addEventListener("click", () => this.addTask());
		this.displayTasks();
	}

	async getInform(): Promise<void> {
		try {
			this.triggerEvent("onLoader");
			const users = await this.api.getUsers();
			const fetchedTasks = users.map((user) => new Task(user.id, user.name));
			this.tasks = [...this.tasks, ...fetchedTasks];
			this.updateLocalStorage();
			this.displayTasks();
		} catch (error) {
			console.error("Failed to load user data:", error);
		} finally {
			this.triggerEvent("offLoader");
		}
	}

	searchTasks(searchTerm: string): Task[] {
		const lowerCaseTerm = searchTerm.toLowerCase();
		return this.tasks.filter((task) => task.title.toLowerCase().includes(lowerCaseTerm));
	}

	displayTasks(): void {
		const tasksList = this.refs.tasksList;
		tasksList.innerHTML = ""; // Очистить текущий список
		this.tasks.forEach((task) => {
			const taskElement = document.createElement("li");
			taskElement.textContent = `${task.isCompleted} ${task.title} ${task.priority}`;
			taskElement.onclick = () => this.toggleCompleted(task.id);
			tasksList.appendChild(taskElement);

			const deleteButton = document.createElement("button");
			deleteButton.textContent = "Delete";
			deleteButton.onclick = (e) => {
				e.stopPropagation(); // Предотвращаем срабатывание onclick родителя
				this.deleteTask(task.id);
			};
			taskElement.appendChild(deleteButton);
		});
	}

	addTask(): void {
		const title = this.refs.newTaskInput.value.trim();
		const taskPriority = this.refs.taskPriority.value as TaskPriority;
		if (!title) {
			// валидация
			return;
		}

		const id = Date.now();
		const newTask = new Task(id, title, false, taskPriority);
		this.tasks.push(newTask);
		this.updateLocalStorage();
		this.displayTasks();
		this.refs.newTaskInput.value = "";
		this.triggerEvent("toast");
	}

	private updateLocalStorage(): void {
		localStorage.setItem("tasks", JSON.stringify(this.tasks));
	}

	getTasks(): Task[] {
		return this.tasks;
	}

	getTasksListElement(): HTMLUListElement {
		return this.refs.tasksList;
	}

	toggleCompleted(id: number): void {
		const task = this.tasks.find((task) => task.id === id);
		if (task) {
			task.isCompleted = !task.isCompleted;
			this.updateLocalStorage();
			this.displayTasks();
		}
	}

	deleteTask(id: number): void {
		this.tasks = this.tasks.filter((task) => task.id !== id);
		this.updateLocalStorage();
		this.displayTasks();
	}
}
