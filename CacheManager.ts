// CacheManager.ts
import { LRUCache } from 'lru-cache';

export class CacheManager {
  private static queryTTFMap: { [key: string]: [number, any] } = {};

  /**
   * 最多只缓存50M的数据,防止OOM
   */
  private static memoryLruCache = new LRUCache<string, any>({
    max: 50 * 1024 * 1024,
    length: (value) => value.toString().length,
  });

  /**
   * saveTime 单位为秒
   */
  public static put(key: string, value: any, saveTime: number = 0): void {
    const deadline = saveTime === 0 ? 0 : Date.now() + saveTime * 1000;
    if (value instanceof QueryTTF) {
      this.queryTTFMap[key] = [deadline, value];
    } else if (value instanceof Buffer) {
      // Save value as file
    } else {
      this.putMemory(key, value);
      // Save value to database
    }
  }

  public static putMemory(key: string, value: any): void {
    this.memoryLruCache.set(key, value);
  }

  public static getFromMemory(key: string): any {
    return this.memoryLruCache.get(key);
  }

  public static deleteMemory(key: string): void {
    this.memoryLruCache.del(key);
  }

  public static get(key: string): string | null {
    const value = this.getFromMemory(key);
    if (value !== undefined) {
      if (typeof value === 'string') {
        return value;
      }
      return value.toString();
    }
    // Retrieve value from database
    return null;
  }

  public static getInt(key: string): number | null {
    const value = this.get(key);
    return value !== null ? parseInt(value) : null;
  }

  public static getLong(key: string): bigint | null {
    const value = this.get(key);
    return value !== null ? BigInt(value) : null;
  }

  public static getDouble(key: string): number | null {
    const value = this.get(key);
    return value !== null ? parseFloat(value) : null;
  }

  public static getFloat(key: string): number | null {
    const value = this.get(key);
    return value !== null ? parseFloat(value) : null;
  }

  public static getByteArray(key: string): Buffer | null {
    // Retrieve value as file
    return null;
  }

  public static getQueryTTF(key: string): QueryTTF | null {
    const cache = this.queryTTFMap[key];
    if (cache && (cache[0] === 0 || cache[0] > Date.now())) {
      return cache[1];
    } else {
      delete this.queryTTFMap[key];
    }
    return null;
  }

  public static putFile(key: string, value: string, saveTime: number = 0): void {
    // Save value as file
  }

  public static getFile(key: string): string | null {
    // Retrieve value as file
    return null;
  }

  public static delete(key: string): void {
    this.deleteMemory(key);
    // Delete value from database
  }
}
