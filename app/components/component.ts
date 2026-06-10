export type ComponentEventHandler = (event: Event) => void;

export interface ComponentEvents {
	[eventName: string]: ComponentEventHandler;
}

export interface ComponentProps<TData = unknown> {
	events?: ComponentEvents;
	data?: TData;
}

export interface TriggerEventOptions {
	bubbles?: boolean;
	cancelable?: boolean;
}

/**
 * @param placeholderId - Идентификатор элемента, в который нужно раздуть компонент
 * @param props - Свойства компонента, включая события и данные
 * @param template - HTML-шаблон для заполнения идентификатора заполнителя
 */
export class Component<TRefs extends Record<string, HTMLElement> = Record<string, HTMLElement>> {
	protected componentElem: HTMLElement;
	protected refs: TRefs = {} as TRefs;

	constructor(
		placeholderId: string,
		{ events = {} }: ComponentProps<unknown> = {},
		template?: string,
	) {
		const componentElem = document.getElementById(placeholderId);
		if (!componentElem) throw new Error(`Element with ID '${placeholderId}' not found.`);
		this.componentElem = componentElem;

		if (template) {
			const templateFragment = document.createRange().createContextualFragment(template);
			this.componentElem.appendChild(templateFragment);

			this.refs = Array.from(this.componentElem.querySelectorAll<HTMLElement>("[ref]")).reduce(
				(acc, elem) => {
					const refName = elem.getAttribute("ref");
					if (refName) acc[refName] = elem;
					return acc;
				},
				{} as Record<string, HTMLElement>,
			) as TRefs;
		}

		Object.entries(events).forEach(([eventName, handler]) =>
			this.componentElem.addEventListener(eventName, handler, false),
		);
	}

	/**
	 * Запуск события компонента с предоставленной «подробной» полезной нагрузкой и параметрами.
	 */
	triggerEvent(
		eventName: string,
		detail?: unknown,
		options: TriggerEventOptions = { bubbles: false, cancelable: false },
	): void {
		const event = new CustomEvent(eventName, { detail, ...options });
		this.componentElem.dispatchEvent(event);
	}
}
/*
Этот код определяет класс `Component`, предназначенный для создания и управления веб-компонентами. Давайте разберём его по частям:

### Конструктор
Конструктор принимает три аргумента:
1. `placeholderId`: строковый идентификатор элемента DOM, в который будет "раздут" (то есть, добавлен) компонент. Этот элемент служит контейнером для компонента.
2. `props`: объект, который может содержать свойства `events` и `data`. `events` — это объект, где ключи это названия событий, а значения — обработчики этих событий. `data` может содержать любые данные, ассоциированные с компонентом. По умолчанию, если `props` не переданы, они инициализируются пустыми объектами.
3. `template`: строка, содержащая HTML-шаблон, который будет использоваться для создания внутреннего содержимого компонента.

В теле конструктора происходят следующие действия:
- Поиск элемента-контейнера по `placeholderId`. Если элемент не найден, выбрасывается исключение.
- Если шаблон предоставлен, создаётся `DocumentFragment` из этого шаблона, который затем добавляется в элемент-контейнер. Это эффективный способ массовой вставки DOM-узлов, поскольку `DocumentFragment` вставляется за одну операцию, минимизируя перерисовки.
- Инициализация `refs`: поиск внутри компонента элементов с атрибутом `ref` и создание объекта `refs`, где каждому названию `ref` соответствует элемент. Это позволяет легко обращаться к важным элементам компонента по имени.
- Добавление обработчиков событий, указанных в `props.events`, к элементу-контейнеру. Обработчики привязываются к событиям, указанным в ключах объекта `events`.

### Метод `triggerEvent`
Этот метод позволяет программно вызывать события компонента с возможностью передачи дополнительных данных (`detail`) и настройки опций события (например, его возможность всплывать и отменяться). Он создаёт `CustomEvent` с указанными параметрами и диспатчит его на элементе-контейнере. Это может быть полезно для взаимодействия между компонентами или для инициации действий в ответ на изменения состояния.

### Использование
Этот класс предоставляет мощный и гибкий способ для создания и управления веб-компонентами, позволяя:
- Изолировать логику и представление компонента.
- Программно управлять событиями и обработчиками.
- Легко интегрироваться и взаимодействовать с другими компонентами и библиотеками.

При создании экземпляра `Component`, вы можете определить HTML-структуру компонента, его стили (предварительно импортировав CSS/SCSS), логику работы и обработку событий, что делает его мощным инструментом для разработки интерактивных веб-приложений.
*/
