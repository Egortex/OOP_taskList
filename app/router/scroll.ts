/** Хранит и восстанавливает позицию прокрутки между навигациями (для кнопок назад/вперёд). */
export class ScrollManager {
	private positions = new Map<string, number>();

	/** Запоминает текущую позицию прокрутки для указанного пути (перед уходом со страницы). */
	save(path: string): void {
		this.positions.set(path, window.scrollY);
	}

	/** Восстанавливает позицию прокрутки при переходе назад/вперёд или прокручивает наверх при обычной навигации. */
	restore(path: string, isPopState: boolean): void {
		if (isPopState) {
			window.scrollTo(0, this.positions.get(path) ?? 0);
		} else {
			window.scrollTo(0, 0);
		}
	}
}
