/** Правило валидации одного поля формы. */
export interface FieldRule {
	/** Сообщение об ошибке, если поле пустое после trim(). */
	required?: string;
	/** Регулярное выражение и сообщение об ошибке при несовпадении (проверяется только если поле не пустое). */
	pattern?: { value: RegExp; message: string };
}

/** Значения формы: имя поля -> строковое значение из FormData. */
export type FormValues<TField extends string> = Record<TField, string>;

export interface BindFormOptions<TField extends string> {
	/** Схема валидации: ключи должны совпадать с атрибутами name полей формы. */
	schema: Record<TField, FieldRule>;
	/** Элемент для показа сообщения об ошибке валидации (должен поддерживать hidden). */
	errorElement?: HTMLElement;
	/** Вызывается с провалидированными значениями после успешного submit. */
	onSubmit: (values: FormValues<TField>, form: HTMLFormElement) => void | Promise<void>;
	/** Сбросить форму после успешного onSubmit. */
	resetOnSuccess?: boolean;
}

/**
 * Подписывается на submit формы: предотвращает перезагрузку страницы, валидирует поля
 * по схеме (required/pattern) и вызывает onSubmit с собранными значениями. Поддерживает
 * отправку по Enter (стандартное поведение <form>). Возвращает функцию отписки.
 */
export function bindForm<TField extends string>(
	form: HTMLFormElement,
	options: BindFormOptions<TField>,
): () => void {
	const handleSubmit = (event: SubmitEvent): void => {
		event.preventDefault();

		const formData = new FormData(form);
		const values = {} as FormValues<TField>;
		let firstError: string | undefined;

		for (const field of Object.keys(options.schema) as TField[]) {
			const raw = String(formData.get(field) ?? "").trim();
			values[field] = raw;

			const rule = options.schema[field];
			if (!firstError && rule.required && !raw) {
				firstError = rule.required;
			} else if (!firstError && raw && rule.pattern && !rule.pattern.value.test(raw)) {
				firstError = rule.pattern.message;
			}
		}

		if (firstError) {
			showError(options.errorElement, firstError);
			return;
		}

		hideError(options.errorElement);
		void Promise.resolve(options.onSubmit(values, form)).then(() => {
			if (options.resetOnSuccess) form.reset();
		});
	};

	form.addEventListener("submit", handleSubmit);
	return () => form.removeEventListener("submit", handleSubmit);
}

function showError(errorElement: HTMLElement | undefined, message: string): void {
	if (!errorElement) return;
	errorElement.textContent = message;
	errorElement.removeAttribute("hidden");
}

function hideError(errorElement: HTMLElement | undefined): void {
	if (!errorElement) return;
	errorElement.setAttribute("hidden", "");
}
