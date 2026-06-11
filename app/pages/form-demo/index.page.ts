import "./index.scss";
import templateHTML from "./index.html?raw";
import { mountTemplate } from "@chepchik/dom-template";
import { bindForm, type FormErrors } from "@chepchik/bind-form";
import type { PageModule, RenderResult } from "@chepchik/spa-router";

type FormField = "username" | "email" | "age" | "password" | "bio";

interface FormDemoRefs extends Record<string, HTMLElement> {
	form: HTMLFormElement;
	error: HTMLParagraphElement;
	bioCount: HTMLSpanElement;
	passwordStrength: HTMLSpanElement;
	state: HTMLPreElement;
	fillButton: HTMLButtonElement;
	resetButton: HTMLButtonElement;
	submitButton: HTMLButtonElement;
}

const RESERVED_USERNAMES = ["admin", "root", "test"];

const BIO_MAX_LENGTH = 200;

const SUBMIT_LABEL_IDLE = "Зарегистрироваться";
const SUBMIT_LABEL_PENDING = "Отправка...";

/** Грубая оценка силы пароля по длине и разнообразию символов. */
function getPasswordStrength(value: string): string {
	if (!value) return "";

	let score = 0;
	if (value.length >= 6) score++;
	if (value.length >= 10) score++;
	if (/\d/.test(value) && /[a-zA-Z]/.test(value)) score++;
	if (/[^a-zA-Z0-9]/.test(value)) score++;

	if (score <= 1) return "слабый";
	if (score <= 2) return "средний";
	return "сильный";
}

const formDemoPage: PageModule = {
	render(container): RenderResult {
		const refs = mountTemplate<FormDemoRefs>(container, templateHTML);

		const updateBioCount = (value: string): void => {
			refs.bioCount.textContent = `${value.length}/${BIO_MAX_LENGTH}`;
		};

		const handle = bindForm<FormField>(refs.form, {
			schema: {
				username: {
					required: "Введите имя пользователя",
					pattern: { value: /^[a-zA-Z0-9_]+$/, message: "Только буквы, цифры и _" },
					minLength: { value: 3, message: "Минимум 3 символа" },
					maxLength: { value: 16, message: "Максимум 16 символов" },
				},
				email: {
					required: "Введите email",
					pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: "Неверный формат email" },
				},
				age: {
					required: "Введите возраст",
					min: { value: 18, message: "Минимум 18 лет" },
					max: { value: 99, message: "Максимум 99 лет" },
				},
				password: {
					required: "Введите пароль",
					minLength: { value: 6, message: "Минимум 6 символов" },
					validate: (value) => (/\d/.test(value) ? undefined : "Пароль должен содержать цифру"),
				},
				bio: {
					maxLength: { value: BIO_MAX_LENGTH, message: `Максимум ${BIO_MAX_LENGTH} символов` },
				},
			},
			errorElement: refs.error,
			validateOn: "input",
			// Имитация запроса на сервер: проверяет, что имя пользователя свободно.
			resolver: async (values): Promise<FormErrors<FormField>> => {
				await new Promise((resolve) => setTimeout(resolve, 300));
				if (RESERVED_USERNAMES.includes(values.username.toLowerCase())) {
					return { username: "Это имя уже занято" };
				}
				return {};
			},
			onStateChange: (state) => {
				refs.state.textContent = JSON.stringify(
					{
						isDirty: state.isDirty,
						isSubmitting: state.isSubmitting,
						touched: state.touched,
						dirty: state.dirty,
						errors: state.errors,
					},
					null,
					2,
				);

				refs.submitButton.textContent = state.isSubmitting
					? SUBMIT_LABEL_PENDING
					: SUBMIT_LABEL_IDLE;
			},
			// Имитация запроса регистрации.
			onSubmit: async (values) => {
				await new Promise((resolve) => setTimeout(resolve, 800));
				console.log("Зарегистрирован пользователь:", values);
				alert(`Регистрация прошла успешно: ${values.username}`);
			},
			resetOnSuccess: true,
		});

		handle.watch("bio", (value) => updateBioCount(value));
		updateBioCount(handle.getValues().bio);

		handle.watch("password", (value) => {
			refs.passwordStrength.textContent = getPasswordStrength(value);
		});

		refs.fillButton.addEventListener("click", () => {
			handle.setValue("username", "ivan_petrov");
			handle.setValue("email", "ivan@example.com");
			handle.setValue("age", "25");
			handle.setValue("password", "secret123");
			handle.setValue("bio", "Привет, это пример заполнения формы.");
			updateBioCount(handle.getValues().bio);
			refs.passwordStrength.textContent = getPasswordStrength(handle.getValues().password);
		});

		refs.resetButton.addEventListener("click", () => {
			handle.reset();
			updateBioCount(handle.getValues().bio);
			refs.passwordStrength.textContent = "";
		});

		return handle;
	},
};

export default formDemoPage;
