import "./index.scss";
import templateHTML from "./index.html?raw";
import { mountTemplate } from "@chepchik/dom-template";
import { router } from "../../../main";
import { clearAuthToken, getAuthToken } from "../../router/session";
import type { PageModule } from "@chepchik/spa-router";

interface ProfileData {
	user: {
		id: number;
		name: string;
	};
}

interface ProfileRefs extends Record<string, HTMLElement> {
	greeting: HTMLParagraphElement;
	logoutBtn: HTMLButtonElement;
}

const profilePage: PageModule<ProfileData> = {
	guard(): boolean {
		if (!getAuthToken()) {
			router.navigate("/login", { replace: true });
			return false;
		}
		return true;
	},

	async loader(ctx): Promise<ProfileData> {
		const response = await fetch("/api/me", {
			headers: { Authorization: `Bearer ${getAuthToken() ?? ""}` },
			signal: ctx.signal,
		});
		if (!response.ok) throw new Error("Failed to load profile");
		return (await response.json()) as ProfileData;
	},

	render(container, data): void {
		const refs = mountTemplate<ProfileRefs>(container, templateHTML);
		refs.greeting.textContent = `Добро пожаловать, ${data.user.name}!`;

		refs.logoutBtn.addEventListener("click", () => {
			clearAuthToken();
			router.navigate("/login");
		});
	},
};

export default profilePage;
