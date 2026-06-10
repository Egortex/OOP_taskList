export type TaskPriority = "high" | "medium" | "low";

export class Task {
	id: number;
	title: string;
	isCompleted: boolean;
	priority: TaskPriority;

	constructor(id: number, title: string, isCompleted = false, priority: TaskPriority = "medium") {
		this.id = id;
		this.title = title;
		this.isCompleted = isCompleted;
		this.priority = priority;
	}
}
