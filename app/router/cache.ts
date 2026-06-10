interface CacheEntry {
	data: unknown;
	expiresAt: number;
}

/** Результат чтения кэша: данные и признак того, что их TTL истёк (но они ещё пригодны для показа). */
export interface CacheResult<T> {
	data: T;
	stale: boolean;
}

/**
 * Простой in-memory кэш ответов loader'ов с TTL, ключ — путь страницы.
 * Поддерживает stale-while-revalidate: после истечения TTL запись не удаляется
 * сразу, а помечается как `stale` — вызывающий код может показать её мгновенно
 * и обновить в фоне.
 */
export class PageCache {
	private store = new Map<string, CacheEntry>();

	constructor(private ttlMs = 30_000) {}

	/**
	 * Возвращает данные по ключу и признак `stale` (true, если истёк TTL).
	 * Возвращает undefined, только если записи нет вовсе.
	 */
	get<T>(key: string): CacheResult<T> | undefined {
		const entry = this.store.get(key);
		if (!entry) return undefined;
		return { data: entry.data as T, stale: Date.now() > entry.expiresAt };
	}

	/** Сохраняет данные по ключу с истечением через ttlMs от текущего момента. */
	set<T>(key: string, data: T): void {
		this.store.set(key, { data, expiresAt: Date.now() + this.ttlMs });
	}

	/** Проверяет, есть ли в кэше актуальная (не просроченная) запись по ключу. */
	has(key: string): boolean {
		const entry = this.store.get(key);
		return entry !== undefined && Date.now() <= entry.expiresAt;
	}

	/** Полностью очищает кэш. */
	clear(): void {
		this.store.clear();
	}
}
