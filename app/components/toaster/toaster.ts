import "./toaster.html?raw";
import "./toaster.scss";

export class Toaster {
	private toasterContainer: HTMLDivElement;

	constructor() {
		this.toasterContainer = this.createToasterContainer();
	}

	private createToasterContainer(): HTMLDivElement {
		const container = document.createElement("div");
		container.setAttribute("id", "toasterContainer");
		container.style.position = "fixed";
		container.style.bottom = "20px";
		container.style.right = "20px";
		container.style.zIndex = "9999";
		document.body.appendChild(container);
		return container;
	}

	showToast(message: string, duration = 3000): void {
		const toast = document.createElement("div");
		toast.textContent = message;
		toast.style.background = "rgba(0,0,0,0.7)";
		toast.style.color = "white";
		toast.style.padding = "10px";
		toast.style.marginTop = "10px";
		toast.style.borderRadius = "5px";
		toast.style.opacity = "0";
		toast.style.transition = "opacity 0.5s";

		this.toasterContainer.appendChild(toast);

		// Fade in
		setTimeout(() => {
			toast.style.opacity = "1";
		}, 100);

		// Fade out
		setTimeout(() => {
			toast.style.opacity = "0";
			toast.addEventListener("transitionend", () => toast.remove());
		}, duration);
	}
}
