import * as vscode from 'vscode';
import * as crypto from 'crypto';
import { DaggerCache, CacheItem } from './types';

export class VSCodeWorkspaceCache implements DaggerCache {
    private readonly storage: vscode.Memento;

    constructor(storage: vscode.Memento) {
        this.storage = storage;
    }

    /**
     * Generates a SHA256 hash of the given data
     * @param data The data to hash
     * @returns The SHA256 hash as a hex string
     */
    private generateSHA256(data: any): string {
        const serialized = JSON.stringify(data, Object.keys(data).sort());
        return crypto.createHash('sha256').update(serialized).digest('hex');
    }

    async get<T>(key: string): Promise<T | undefined> {
        try {
            const item = this.storage.get<CacheItem<T>>(key);
            
            if (!item) {
                return undefined;
            }

            return item.data;
        } catch (error) {
            console.error(`Error getting cache item for key ${key}:`, error);
            return undefined;
        }
    }

    async set<T>(key: string, value: T): Promise<void> {
        try {
            const sha256 = this.generateSHA256(value);
            const item: CacheItem<T> = {
                data: value,
                sha256
            };

            await this.storage.update(key, item);
        } catch (error) {
            console.error(`Error setting cache item for key ${key}:`, error);
            throw error;
        }
    }

    async remove(key: string): Promise<void> {
        try {
            await this.storage.update(key, undefined);
        } catch (error) {
            console.error(`Error removing cache item for key ${key}:`, error);
            throw error;
        }
    }

    async clear(): Promise<void> {
        try {
            // Get all keys and remove them
            const keys = this.storage.keys();
            await Promise.all(keys.map(key => this.remove(key)));
        } catch (error) {
            console.error('Error clearing cache:', error);
            throw error;
        }
    }

    async has(key: string): Promise<boolean> {
        const item = await this.get(key);
        return item !== undefined;
    }

    /**
     * Gets the SHA256 hash of a cached item without returning the data
     * @param key The cache key
     * @returns The SHA256 hash or undefined if not found
     */
    async getSHA256(key: string): Promise<string | undefined> {
        try {
            const item = this.storage.get<CacheItem<any>>(key);
            
            if (!item) {
                return undefined;
            }

            return item.sha256;
        } catch (error) {
            console.error(`Error getting SHA256 for key ${key}:`, error);
            return undefined;
        }
    }

    /**
     * Compares the SHA256 hash of new data with the cached version
     * @param key The cache key
     * @param newData The new data to compare
     * @returns True if the data has changed, false if it's the same
     */
    async hasDataChanged<T>(key: string, newData: T): Promise<boolean> {
        const cachedSHA256 = await this.getSHA256(key);
        if (!cachedSHA256) {
            return true; // No cached data, so it's "changed"
        }

        const newSHA256 = this.generateSHA256(newData);
        return cachedSHA256 !== newSHA256;
    }
}
