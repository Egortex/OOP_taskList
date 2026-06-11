import { Component, ComponentProps } from "../component";
import "./task.scss";
import templateHTML from "./task.html?raw";
import { Task, TaskPriority } from "./Task";
import { ApiService } from "../../services/ApiService";
import { bindForm } from "@chepchik/bind-form";

export interface TaskManagerRefs extends Record<string, HTMLElement> {
	form: HTMLFormElement;
	taskPriority: HTMLSelectElement;
	tasksList: HTMLUListElement;
}

type TaskFormField = "title" | "priority";

export interface TaskManagerData {
	api: ApiService;
	dataTest?: string;
}

/** Компонент списка задач: хранение в localStorage, добавление/удаление/переключение статуса, поиск. */
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

	/** Подписывается на форму добавления задачи (submit/Enter) и рендерит начальный список. */
	private init(): void {
		bindForm<TaskFormField>(this.refs.form, {
			schema: { title: { required: "Введите название задачи" }, priority: {} },
			resetOnSuccess: true,
			onSubmit: (values) => {
				this.addTask(values.title, values.priority as TaskPriority);
			},
		});
		this.displayTasks();
	}

	/** Подгружает пользователей с API и добавляет их как задачи (демонстрация работы с ApiService). */
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

	/** Возвращает задачи, заголовок которых содержит искомую подстроку (без учёта регистра). */
	searchTasks(searchTerm: string): Task[] {
		const lowerCaseTerm = searchTerm.toLowerCase();
		return this.tasks.filter((task) => task.title.toLowerCase().includes(lowerCaseTerm));
	}

	/** Полностью перерисовывает список задач в DOM. */
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

	/** Создаёт новую задачу с указанным названием и приоритетом и добавляет её в список. */
	addTask(title: string, priority: TaskPriority): void {
		const id = Date.now();
		const newTask = new Task(id, title, false, priority);
		this.tasks.push(newTask);
		this.updateLocalStorage();
		this.displayTasks();
		this.triggerEvent("toast");
	}

	/** Сохраняет текущий список задач в localStorage. */
	private updateLocalStorage(): void {
		localStorage.setItem("tasks", JSON.stringify(this.tasks));
	}

	/** Возвращает текущий список задач. */
	getTasks(): Task[] {
		return this.tasks;
	}

	/** Возвращает корневой элемент списка задач (используется SearchPanel для отрисовки результатов). */
	getTasksListElement(): HTMLUListElement {
		return this.refs.tasksList;
	}

	/** Переключает статус выполнения задачи по id. */
	toggleCompleted(id: number): void {
		const task = this.tasks.find((task) => task.id === id);
		if (task) {
			task.isCompleted = !task.isCompleted;
			this.updateLocalStorage();
			this.displayTasks();
		}
	}

	/** Удаляет задачу по id. */
	deleteTask(id: number): void {
		this.tasks = this.tasks.filter((task) => task.id !== id);
		this.updateLocalStorage();
		this.displayTasks();
	}
}
