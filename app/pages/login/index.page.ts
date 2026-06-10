import "./index.scss";
import templateHTML from "./index.html?raw";
import { mountTemplate } from "../../router/renderTemplate";
import { router } from "../../../main";
import { setAuthToken } from "../../router/session";
import type { PageModule } from "../../router/types";

interface LoginResponse {
	token: string;
}

interface LoginRefs extends Record<string, HTMLElement> {
	form: HTMLFormElement;
	error: HTMLParagraphElement;
}

const loginPage: PageModule = {
	render(container): void {
		const refs = mountTemplate<LoginRefs>(container, templateHTML);

		refs.form.addEventListener("submit", (event) => {
			event.preventDefault();
			void handleSubmit(refs.form, refs.error);
		});
	},
};

async function handleSubmit(
	form: HTMLFormElement,
	errorMessage: HTMLParagraphElement,
): Promise<void> {
	const formData = new FormData(form);

	const response = await fetch("/api/login", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			username: formData.get("username"),
			password: formData.get("password"),
		}),
	});

	if (!response.ok) {
		errorMessage.removeAttribute("hidden");
		return;
	}

	errorMessage.setAttribute("hidden", "");
	const data = (await response.json()) as LoginResponse;
	setAuthToken(data.token);
	router.navigate("/profile");
}

export default loginPage;
