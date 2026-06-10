import "./app/assets/style/tailwind.css";
import "./app/assets/style/style.scss";
import { Preloader } from "./app/components/preloader/preloader";
import { Toaster } from "./app/components/toaster/toaster";
import { Router } from "./app/router/Router";
import { routes } from "./app/pages/routes";

const appElem = document.getElementById("app");
if (!appElem) throw new Error("Element with ID 'app' not found.");

export const preloader = new Preloader("preloaderContainer");
export const toaster = new Toaster();

export const router = new Router(routes, appElem);

router.onStatusChange((status) => {
	if (status === "loading") {
		preloader.visiblePreloader();
	} else {
		preloader.notVisiblePreloader();
	}

	document.body.dataset.navStatus = status;
});

router.start();
