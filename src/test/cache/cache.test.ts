import { describe, it, beforeEach } from 'mocha';
import * as assert from 'assert';
import * as crypto from 'crypto';
import { DaggerCache, CacheItem } from '../../cache/types';

// Mock cache implementation for testing
class MockCache implements DaggerCache {
    private storage = new Map<string, CacheItem<any>>();

    private generateSHA256(data: any): string {
        const serialized = JSON.stringify(data, Object.keys(data).sort());
        return crypto.createHash('sha256').update(serialized).digest('hex');
    }

    async get<T>(key: string): Promise<T | undefined> {
        const item = this.storage.get(key);
        
        if (!item) {
            return undefined;
        }

        return item.data;
    }

    async set<T>(key: string, value: T): Promise<void> {
        const sha256 = this.generateSHA256(value);
        const item: CacheItem<T> = {
            data: value,
            sha256
        };

        this.storage.set(key, item);
    }

    async remove(key: string): Promise<void> {
        this.storage.delete(key);
    }

    async clear(): Promise<void> {
        this.storage.clear();
    }

    async has(key: string): Promise<boolean> {
        const item = await this.get(key);
        return item !== undefined;
    }

    async getSHA256(key: string): Promise<string | undefined> {
        const item = this.storage.get(key);
        
        if (!item) {
            return undefined;
        }

        return item.sha256;
    }

    async hasDataChanged<T>(key: string, newData: T): Promise<boolean> {
        const cachedSHA256 = await this.getSHA256(key);
        if (!cachedSHA256) {
            return true; // No cached data, so it's "changed"
        }

        const newSHA256 = this.generateSHA256(newData);
        return cachedSHA256 !== newSHA256;
    }
}

describe('DaggerCache', () => {
    let cache: DaggerCache;

    beforeEach(() => {
        cache = new MockCache();
    });

    it('should store and retrieve values', async () => {
        const key = 'test-key';
        const value = { name: 'test-function', id: '123' };

        await cache.set(key, value);
        const retrieved = await cache.get(key);

        assert.deepStrictEqual(retrieved, value);
    });

    it('should return undefined for non-existent keys', async () => {
        const retrieved = await cache.get('non-existent-key');
        assert.strictEqual(retrieved, undefined);
    });

    it('should clear all items', async () => {
        await cache.set('key1', 'value1');
        await cache.set('key2', 'value2');

        assert.strictEqual(await cache.has('key1'), true);
        assert.strictEqual(await cache.has('key2'), true);

        await cache.clear();

        assert.strictEqual(await cache.has('key1'), false);
        assert.strictEqual(await cache.has('key2'), false);
    });

    it('should remove individual items', async () => {
        await cache.set('key1', 'value1');
        await cache.set('key2', 'value2');

        assert.strictEqual(await cache.has('key1'), true);
        assert.strictEqual(await cache.has('key2'), true);

        await cache.remove('key1');

        assert.strictEqual(await cache.has('key1'), false);
        assert.strictEqual(await cache.has('key2'), true);
    });

    it('should detect data changes using SHA256', async () => {
        const key = 'test-key';
        const originalData = { name: 'test-function', id: '123' };
        const modifiedData = { name: 'test-function', id: '456' };

        // Set initial data
        await cache.set(key, originalData);
        
        // Same data should not be detected as changed
        const sameDataChanged = await cache.hasDataChanged(key, originalData);
        assert.strictEqual(sameDataChanged, false);

        // Different data should be detected as changed
        const differentDataChanged = await cache.hasDataChanged(key, modifiedData);
        assert.strictEqual(differentDataChanged, true);
    });

    it('should return SHA256 hash of cached data', async () => {
        const key = 'test-key';
        const value = { name: 'test-function', id: '123' };

        await cache.set(key, value);
        const sha256 = await cache.getSHA256(key);
        
        assert.strictEqual(typeof sha256, 'string');
        assert.strictEqual(sha256?.length, 64); // SHA256 hex string length
    });

    it('should return undefined for SHA256 of non-existent key', async () => {
        const sha256 = await cache.getSHA256('non-existent-key');
        assert.strictEqual(sha256, undefined);
    });
});