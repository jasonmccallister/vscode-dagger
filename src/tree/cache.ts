// src/tree/cache.ts
// Generic cache abstraction for function arguments and other tree data

export interface Cache<K, V> {
    get(key: K): V | undefined;
    set(key: K, value: V): void;
    has(key: K): boolean;
    clear(): void;
}

export class MapCache<K, V> implements Cache<K, V> {
    private readonly map = new Map<K, V>();

    get(key: K): V | undefined {
        return this.map.get(key);
    }
    set(key: K, value: V): void {
        this.map.set(key, value);
    }
    has(key: K): boolean {
        return this.map.has(key);
    }
    clear(): void {
        this.map.clear();
    }
}
