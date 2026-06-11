/**
 * Выполняет обновление DOM через View Transitions API (`document.startViewTransition`),
 * если браузер её поддерживает и пользователь не запросил отключение анимаций
 * (`prefers-reduced-motion: reduce`). Иначе — просто выполняет `update()` напрямую.
 */
export function runTransition(update: () => void): void {
	const doc = document as Document & { startViewTransition?: (callback: () => void) => unknown };
	if (!doc.startViewTransition || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
		update();
		return;
	}
	doc.startViewTransition(update);
}
