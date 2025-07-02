/**
 * @fileoverview Cache utilities for performance optimization
 * 
 * This module provides LRU (Least Recently Used) cache implementation with
 * size limits and timestamp-based eviction for managing memory usage in
 * large file processing scenarios.
 * 
 * **Key Features:**
 * - LRU eviction policy
 * - Size-based limits (memory usage)
 * - Timestamp-based expiration
 * - Automatic cleanup of expired entries
 * - Memory usage tracking and reporting
 * 
 * @author Card Game PDF Transformer
 */

/**
 * Cache entry interface with metadata
 */
interface CacheEntry<T> {
  /** Cached data */
  data: T;
  /** Timestamp when entry was created */
  timestamp: number;
  /** Timestamp when entry was last accessed */
  lastAccessed: number;
  /** Estimated memory size in bytes */
  size: number;
}

/**
 * Cache statistics interface
 */
interface CacheStats {
  /** Total number of entries */
  entryCount: number;
  /** Total memory usage in bytes */
  totalSize: number;
  /** Number of cache hits */
  hits: number;
  /** Number of cache misses */
  misses: number;
  /** Hit rate percentage */
  hitRate: number;
}

/**
 * Cache configuration options
 */
interface CacheOptions {
  /** Maximum number of entries (default: 100) */
  maxEntries?: number;
  /** Maximum total size in bytes (default: 50MB) */
  maxSize?: number;
  /** Entry expiration time in milliseconds (default: 15 minutes) */
  maxAge?: number;
  /** Cleanup interval in milliseconds (default: 5 minutes) */
  cleanupInterval?: number;
}

/**
 * LRU Cache implementation with size and time-based eviction
 * 
 * Provides efficient caching for thumbnail images and other large data
 * with automatic memory management and cleanup.
 * 
 * @example
 * ```typescript
 * const thumbnailCache = new LRUCache<string>({
 *   maxEntries: 50,
 *   maxSize: 25 * 1024 * 1024, // 25MB
 *   maxAge: 10 * 60 * 1000      // 10 minutes
 * });
 * 
 * thumbnailCache.set('page-1', thumbnailDataUrl, estimatedSize);
 * const thumbnail = thumbnailCache.get('page-1');
 * ```
 */
export class LRUCache<T> {
  private cache = new Map<string, CacheEntry<T>>();
  private readonly options: Required<CacheOptions>;
  private stats = { hits: 0, misses: 0 };
  private cleanupTimer?: NodeJS.Timeout;

  constructor(options: CacheOptions = {}) {
    this.options = {
      maxEntries: options.maxEntries ?? 100,
      maxSize: options.maxSize ?? 50 * 1024 * 1024, // 50MB default
      maxAge: options.maxAge ?? 15 * 60 * 1000,      // 15 minutes default
      cleanupInterval: options.cleanupInterval ?? 5 * 60 * 1000 // 5 minutes default
    };

    // Start automatic cleanup
    this.startCleanup();
  }

  /**
   * Get cached entry
   * 
   * @param key - Cache key
   * @returns Cached data or undefined if not found/expired
   */
  get(key: string): T | undefined {
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.stats.misses++;
      return undefined;
    }

    // Check if entry is expired
    if (this.isExpired(entry)) {
      this.cache.delete(key);
      this.stats.misses++;
      return undefined;
    }

    // Update last accessed time (LRU tracking)
    entry.lastAccessed = Date.now();
    this.stats.hits++;
    
    // Move to end (most recently used) by re-inserting
    this.cache.delete(key);
    this.cache.set(key, entry);
    
    return entry.data;
  }

  /**
   * Set cache entry
   * 
   * @param key - Cache key
   * @param data - Data to cache
   * @param estimatedSize - Estimated memory size in bytes
   */
  set(key: string, data: T, estimatedSize: number): void {
    const now = Date.now();
    const entry: CacheEntry<T> = {
      data,
      timestamp: now,
      lastAccessed: now,
      size: estimatedSize
    };

    // Remove existing entry if present
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }

    // Add new entry
    this.cache.set(key, entry);

    // Enforce size limits
    this.enforceCapacity();
  }

  /**
   * Remove entry from cache
   * 
   * @param key - Cache key to remove
   * @returns true if entry was removed, false if not found
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
    this.stats = { hits: 0, misses: 0 };
  }

  /**
   * Check if key exists in cache (without updating access time)
   * 
   * @param key - Cache key
   * @returns true if key exists and is not expired
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    
    if (this.isExpired(entry)) {
      this.cache.delete(key);
      return false;
    }
    
    return true;
  }

  /**
   * Get cache statistics
   * 
   * @returns Cache statistics object
   */
  getStats(): CacheStats {
    const totalSize = Array.from(this.cache.values())
      .reduce((sum, entry) => sum + entry.size, 0);
    
    const totalRequests = this.stats.hits + this.stats.misses;
    const hitRate = totalRequests > 0 ? (this.stats.hits / totalRequests) * 100 : 0;

    return {
      entryCount: this.cache.size,
      totalSize,
      hits: this.stats.hits,
      misses: this.stats.misses,
      hitRate: Math.round(hitRate * 100) / 100
    };
  }

  /**
   * Get memory usage as formatted string
   * 
   * @returns Human-readable memory usage string
   */
  getMemoryUsage(): string {
    const stats = this.getStats();
    const sizeInMB = Math.round((stats.totalSize / (1024 * 1024)) * 100) / 100;
    const maxSizeInMB = Math.round((this.options.maxSize / (1024 * 1024)) * 100) / 100;
    
    return `${sizeInMB}MB / ${maxSizeInMB}MB (${stats.entryCount} entries)`;
  }

  /**
   * Manually trigger cleanup of expired entries
   * 
   * @returns Number of entries removed
   */
  cleanup(): number {
    let removedCount = 0;
    const now = Date.now();

    for (const [key, entry] of this.cache.entries()) {
      if (this.isExpired(entry, now)) {
        this.cache.delete(key);
        removedCount++;
      }
    }

    return removedCount;
  }

  /**
   * Destroy cache and cleanup resources
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }
    this.clear();
  }

  /**
   * Check if entry is expired
   */
  private isExpired(entry: CacheEntry<T>, now = Date.now()): boolean {
    return (now - entry.timestamp) > this.options.maxAge;
  }

  /**
   * Enforce cache capacity limits
   */
  private enforceCapacity(): void {
    // Remove expired entries first
    this.cleanup();

    // Enforce entry count limit (LRU eviction)
    while (this.cache.size > this.options.maxEntries) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }

    // Enforce size limit (LRU eviction)
    while (this.getTotalSize() > this.options.maxSize && this.cache.size > 0) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }
  }

  /**
   * Get total cache size in bytes
   */
  private getTotalSize(): number {
    return Array.from(this.cache.values())
      .reduce((sum, entry) => sum + entry.size, 0);
  }

  /**
   * Start automatic cleanup timer
   */
  private startCleanup(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.options.cleanupInterval);
  }
}

/**
 * Estimate memory size of common data types
 * 
 * @param data - Data to estimate size for
 * @returns Estimated size in bytes
 */
export function estimateDataSize(data: unknown): number {
  if (typeof data === 'string') {
    // String: 2 bytes per character (UTF-16)
    return data.length * 2;
  }
  
  if (data instanceof ArrayBuffer) {
    return data.byteLength;
  }
  
  if (data instanceof Blob) {
    return data.size;
  }
  
  if (typeof data === 'object' && data !== null) {
    // Rough estimation for objects (JSON serialization approach)
    try {
      return JSON.stringify(data).length * 2;
    } catch {
      // Fallback for non-serializable objects
      return 1024; // 1KB default
    }
  }
  
  // Primitives
  if (typeof data === 'number') return 8;  // 64-bit float
  if (typeof data === 'boolean') return 1;
  
  return 0;
}

/**
 * Create cache key from multiple parameters
 * 
 * @param parts - Parts to combine into cache key
 * @returns Cache key string
 */
export function createCacheKey(...parts: (string | number)[]): string {
  return parts.join(':');
}

/**
 * Global cache instances for common use cases
 */
export const thumbnailCache = new LRUCache<string>({
  maxEntries: 200,
  maxSize: 25 * 1024 * 1024, // 25MB
  maxAge: 15 * 60 * 1000      // 15 minutes
});

export const imageCache = new LRUCache<string>({
  maxEntries: 100,
  maxSize: 100 * 1024 * 1024, // 100MB
  maxAge: 30 * 60 * 1000       // 30 minutes
});

export const renderCache = new LRUCache<string>({
  maxEntries: 50,
  maxSize: 50 * 1024 * 1024,  // 50MB
  maxAge: 10 * 60 * 1000       // 10 minutes
});