export interface CacheItem<T> {
    readonly data: T;
    readonly sha256: string; // SHA256 hash of the serialized data
}

export interface DaggerCache {
    /**
     * Gets an item from the cache
     * @param key The cache key
     * @returns The cached item or undefined if not found or expired
     */
    get<T>(key: string): Promise<T | undefined>;

    /**
     * Sets an item in the cache
     * @param key The cache key
     * @param value The value to cache
     */
    set<T>(key: string, value: T): Promise<void>;

    /**
     * Removes an item from the cache
     * @param key The cache key
     */
    remove(key: string): Promise<void>;

    /**
     * Clears all items from the cache
     */
    clear(): Promise<void>;

    /**
     * Checks if an item exists in the cache
     * @param key The cache key
     */
    has(key: string): Promise<boolean>;

    /**
     * Gets the SHA256 hash of a cached item without returning the data
     * @param key The cache key
     * @returns The SHA256 hash or undefined if not found
     */
    getSHA256(key: string): Promise<string | undefined>;

    /**
     * Compares the SHA256 hash of new data with the cached version
     * @param key The cache key
     * @param newData The new data to compare
     * @returns True if the data has changed, false if it's the same
     */
    hasDataChanged<T>(key: string, newData: T): Promise<boolean>;
}
