import type { LayoutLoader, LayoutRenderResult, RouteContext } from "./types";

/** Смонтированный layout: ссылка на его loader (для диффинга) и результат рендера. */
export interface MountedLayout {
	loader: LayoutLoader;
	result: LayoutRenderResult;
}

/** Приводит `RouteDefinition.layout` (одиночный layout, цепочка или его отсутствие) к массиву. */
export function toLayoutChain(layout: LayoutLoader | LayoutLoader[] | undefined): LayoutLoader[] {
	if (!layout) return [];
	return Array.isArray(layout) ? layout : [layout];
}

/**
 * Управляет текущей смонтированной цепочкой layout'ов: вычисляет общий префикс
 * с новой цепочкой, размонтирует "хвост", переиспользует совпадающие layout'ы
 * (вызывая их `update()`) и монтирует новые.
 */
export class LayoutChainManager {
	private chain: MountedLayout[] = [];

	/** Длина общего префикса текущей и новой цепочки (по ссылкам функций `LayoutLoader`). */
	commonPrefixLength(layoutChain: LayoutLoader[]): number {
		let common = 0;
		while (
			common < this.chain.length &&
			common < layoutChain.length &&
			this.chain[common].loader === layoutChain[common]
		) {
			common++;
		}
		return common;
	}

	/** `outlet` последнего смонтированного layout'а, либо `fallback`, если цепочка пуста. */
	lastOutlet(fallback: HTMLElement): HTMLElement {
		return this.chain.length > 0 ? this.chain[this.chain.length - 1].result.outlet : fallback;
	}

	/**
	 * Гарантирует, что в `container` смонтирована нужная цепочка layout'ов, и возвращает
	 * `outlet` последнего из них — элемент, в который должна рендериться текущая страница.
	 *
	 * `common` — длина общего префикса текущей и новой цепочки (по ссылкам функций
	 * `LayoutLoader`). Layout'ы из общего префикса не пересоздаются — вызывается только
	 * их `update()` (например, для подсветки активной ссылки). Layout'ы за пределами
	 * префикса размонтируются (`cleanup()`), а новые монтируются по очереди, каждый —
	 * в `outlet` предыдущего.
	 *
	 * `onUnmountTail` вызывается перед размонтированием "хвоста" — даёт роутеру шанс
	 * очистить текущую страницу до того, как будет очищена разметка её layout'ов.
	 */
	async mount(
		layoutChain: LayoutLoader[],
		common: number,
		ctx: RouteContext,
		layoutModulePromises: Map<LayoutLoader, ReturnType<LayoutLoader>>,
		container: HTMLElement,
		onUnmountTail: () => void,
	): Promise<HTMLElement> {
		if (common < this.chain.length) {
			onUnmountTail();
			for (let i = this.chain.length - 1; i >= common; i--) {
				this.chain[i].result.cleanup?.();
			}
			this.chain.length = common;
			if (common === 0) container.innerHTML = "";
		}

		for (let i = 0; i < common; i++) {
			this.chain[i].result.update?.(ctx);
		}

		let outlet = common > 0 ? this.chain[common - 1].result.outlet : container;

		for (let i = common; i < layoutChain.length; i++) {
			outlet.innerHTML = "";
			const loader = layoutChain[i];
			const module = await layoutModulePromises.get(loader)!;
			const result = module.default.render(outlet, ctx);
			this.chain.push({ loader, result });
			outlet = result.outlet;
		}

		return outlet;
	}
}
