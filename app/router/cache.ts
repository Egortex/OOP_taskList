interface CacheEntry {
	data: unknown;
	expiresAt: number;
}

/** Простой in-memory кэш ответов loader'ов с TTL, ключ — путь страницы. */
export class PageCache {
	private store = new Map<string, CacheEntry>();

	constructor(private ttlMs = 30_000) {}

	/** Возвращает закэшированные данные по ключу либо undefined, если записи нет или истёк TTL. */
	get<T>(key: string): T | undefined {
		const entry = this.store.get(key);
		if (!entry) return undefined;

		if (Date.now() > entry.expiresAt) {
			this.store.delete(key);
			return undefined;
		}

		return entry.data as T;
	}

	/** Сохраняет данные по ключу с истечением через ttlMs от текущего момента. */
	set<T>(key: string, data: T): void {
		this.store.set(key, { data, expiresAt: Date.now() + this.ttlMs });
	}

	/** Проверяет, есть ли в кэше актуальная (не просроченная) запись по ключу. */
	has(key: string): boolean {
		return this.get(key) !== undefined;
	}

	/** Полностью очищает кэш. */
	clear(): void {
		this.store.clear();
	}
}
