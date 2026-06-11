import "./index.scss";
import templateHTML from "./index.html?raw";
import { mountTemplate } from "@chepchik/dom-template";
import { bindForm } from "@chepchik/bind-form";
import { router } from "../../../main";
import { setAuthToken } from "../../router/session";
import type { PageModule, RenderResult } from "@chepchik/spa-router";

interface LoginResponse {
	token: string;
}

interface LoginRefs extends Record<string, HTMLElement> {
	form: HTMLFormElement;
	error: HTMLParagraphElement;
}

type LoginField = "username" | "password";

const loginPage: PageModule = {
	render(container): RenderResult {
		const refs = mountTemplate<LoginRefs>(container, templateHTML);

		return bindForm<LoginField>(refs.form, {
			schema: {
				username: { required: "Введите логин" },
				password: { required: "Введите пароль" },
			},
			errorElement: refs.error,
			onSubmit: async (values) => {
				const response = await fetch("/api/login", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(values),
				});

				if (!response.ok) {
					refs.error.textContent = "Неверный логин или пароль";
					refs.error.removeAttribute("hidden");
					return;
				}

				refs.error.setAttribute("hidden", "");
				const data = (await response.json()) as LoginResponse;
				setAuthToken(data.token);
				router.navigate("/profile");
			},
		});
	},
};

export default loginPage;
