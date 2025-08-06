import { describe, it, beforeEach } from "mocha";
import * as assert from "assert";
import * as crypto from "crypto";
import { CliCache, CacheItem } from "../../src/cache/types";

// Mock cache implementation for testing
class MockCache implements CliCache {
  private storage = new Map<string, CacheItem<any>>();

  /**
   * Generates a SHA256 hash of the given data
   * @param data The data to hash
   * @returns The SHA256 hash as a hex string
   */
  private generateSHA256(data: any): string {
    let serialized: string;
    if (typeof data === "object" && data !== null) {
      const keys = Object.keys(data).sort();
      const values = keys.map((k) => (data as any)[k]);
      serialized = JSON.stringify({ keys, values });
    } else {
      serialized = JSON.stringify(data);
    }
    return crypto.createHash("sha256").update(serialized).digest("hex");
  }

  async get<T>(key: string): Promise<T | undefined> {
    try {
      const item = this.storage.get(key);

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
        sha256,
      };

      this.storage.set(key, item);
    } catch (error) {
      console.error(`Error setting cache item for key ${key}:`, error);
      throw error;
    }
  }

  async remove(key: string): Promise<void> {
    try {
      this.storage.delete(key);
    } catch (error) {
      console.error(`Error removing cache item for key ${key}:`, error);
      throw error;
    }
  }

  async clear(): Promise<void> {
    try {
      this.storage.clear();
    } catch (error) {
      console.error("Error clearing cache:", error);
      throw error;
    }
  }

  async has(key: string): Promise<boolean> {
    const item = await this.get(key);
    return item !== undefined;
  }

  async getSHA256(key: string): Promise<string | undefined> {
    try {
      const item = this.storage.get(key);

      if (!item) {
        return undefined;
      }

      return item.sha256;
    } catch (error) {
      console.error(`Error getting SHA256 for key ${key}:`, error);
      return undefined;
    }
  }

  async hasDataChanged<T>(key: string, newData: T): Promise<boolean> {
    const cachedSHA256 = await this.getSHA256(key);
    if (!cachedSHA256) {
      return true; // No cached data, so it's "changed"
    }

    const newSHA256 = this.generateSHA256(newData);
    return cachedSHA256 !== newSHA256;
  }
  
  /**
   * Generates a cache key based on a prefix and path
   * @param prefix The prefix for the cache key
   * @param path The path to include in the key
   * @returns A unique cache key
   */
  generateKey(prefix: string, path: string): string {
    return crypto.createHash("md5").update(`${prefix}-${path}`).digest("hex");
  }
}

describe("CliCache", () => {
  let cache: CliCache;

  beforeEach(() => {
    cache = new MockCache();
  });

  it("should store and retrieve values", async () => {
    const key = "test-key";
    const value = { name: "test-function", id: "123" };

    await cache.set(key, value);
    const retrieved = await cache.get<typeof value>(key);

    assert.deepStrictEqual(retrieved, value);
  });

  it("should return undefined for non-existent keys", async () => {
    const retrieved = await cache.get<string>("non-existent-key");
    assert.strictEqual(retrieved, undefined);
  });

  it("should clear all items", async () => {
    await cache.set("key1", "value1");
    await cache.set("key2", "value2");

    assert.strictEqual(await cache.has("key1"), true);
    assert.strictEqual(await cache.has("key2"), true);

    await cache.clear();

    assert.strictEqual(await cache.has("key1"), false);
    assert.strictEqual(await cache.has("key2"), false);
  });

  it("should remove individual items", async () => {
    await cache.set("key1", "value1");
    await cache.set("key2", "value2");

    assert.strictEqual(await cache.has("key1"), true);
    assert.strictEqual(await cache.has("key2"), true);

    await cache.remove("key1");

    assert.strictEqual(await cache.has("key1"), false);
    assert.strictEqual(await cache.has("key2"), true);
  });

  it("should detect data changes using SHA256", async () => {
    const key = "test-key";
    const originalData = { name: "test-function", id: "123" };
    const modifiedData = { name: "test-function", id: "456" };

    // Set initial data
    await cache.set(key, originalData);

    // Same data should not be detected as changed
    const sameDataChanged = await cache.hasDataChanged(key, originalData);
    assert.strictEqual(sameDataChanged, false);

    // Different data should be detected as changed
    const differentDataChanged = await cache.hasDataChanged(key, modifiedData);
    assert.strictEqual(differentDataChanged, true);
  });

  it("should return SHA256 hash of cached data", async () => {
    const key = "test-key";
    const value = { name: "test-function", id: "123" };

    await cache.set(key, value);
    const sha256 = await cache.getSHA256(key);

    assert.strictEqual(typeof sha256, "string");
    assert.strictEqual(sha256?.length, 64); // SHA256 hex string length
  });

  it("should return undefined for SHA256 of non-existent key", async () => {
    const sha256 = await cache.getSHA256("non-existent-key");
    assert.strictEqual(sha256, undefined);
  });
  
  it("should generate consistent cache keys", () => {
    const prefix = "functions";
    const path = "/Users/jason/go/src/github.com/jasonmccallister/vscode-dagger";
    
    const key1 = cache.generateKey(prefix, path);
    const key2 = cache.generateKey(prefix, path);
    
    // Same inputs should generate the same key
    assert.strictEqual(key1, key2);
    
    // Different inputs should generate different keys
    const differentKey = cache.generateKey("modules", path);
    assert.notStrictEqual(key1, differentKey);
  });
  
  it("should handle error cases gracefully", async () => {
    // Test with undefined value (should not throw)
    await assert.doesNotReject(async () => {
      await cache.set("undefined-key", undefined);
    });
    
    // Test with null value
    await cache.set("null-key", null);
    const nullValue = await cache.get("null-key");
    assert.strictEqual(nullValue, null);
    
    // Test with primitive values
    await cache.set("string-key", "simple string");
    const stringValue = await cache.get<string>("string-key");
    assert.strictEqual(stringValue, "simple string");
    
    await cache.set("number-key", 42);
    const numberValue = await cache.get<number>("number-key");
    assert.strictEqual(numberValue, 42);
  });
});
