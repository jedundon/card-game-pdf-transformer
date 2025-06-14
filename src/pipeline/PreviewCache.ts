/**
 * LRU Cache for preview data with automatic eviction and memory management
 */

import type { PreviewData } from './types';

export interface CacheOptions {
  maxSize: number;
  maxAge: number; // in milliseconds
  maxMemory?: number; // in bytes (optional memory limit)
}

export interface CacheEntry {
  data: PreviewData;
  timestamp: number;
  accessCount: number;
  lastAccess: number;
  size: number; // estimated size in bytes
}

export interface CacheStats {
  size: number;
  maxSize: number;
  hitRate: number;
  totalHits: number;
  totalMisses: number;
  memoryUsage: number;
  maxMemory: number;
  oldestEntry: number;
  newestEntry: number;
}

export class PreviewCache {
  private cache: Map<string, CacheEntry> = new Map();
  private accessOrder: string[] = []; // For LRU tracking
  private options: CacheOptions;
  private stats = {
    hits: 0,
    misses: 0,
    evictions: 0,
    memoryUsage: 0
  };

  constructor(options: CacheOptions) {
    this.options = {
      maxMemory: Infinity,
      ...options
    };

    // Set up periodic cleanup
    this.scheduleCleanup();
  }

  /**
   * Get a cached preview
   */
  get(key: string): PreviewData | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.stats.misses++;
      return null;
    }

    // Check if entry is expired
    if (this.isExpired(entry)) {
      this.delete(key);
      this.stats.misses++;
      return null;
    }

    // Update access tracking
    entry.accessCount++;
    entry.lastAccess = Date.now();
    this.moveToFront(key);
    
    this.stats.hits++;
    return entry.data;
  }

  /**
   * Set a preview in the cache
   */
  set(key: string, data: PreviewData): void {
    const size = this.estimateSize(data);
    const now = Date.now();

    // Remove existing entry if present
    if (this.cache.has(key)) {
      this.delete(key);
    }

    const entry: CacheEntry = {
      data,
      timestamp: now,
      accessCount: 1,
      lastAccess: now,
      size
    };

    // Check if we need to evict entries to make room
    this.makeRoom(size);

    // Add the new entry
    this.cache.set(key, entry);
    this.accessOrder.unshift(key);
    this.stats.memoryUsage += size;

    // Enforce size limits
    this.enforceLimits();
  }

  /**
   * Check if a key exists in the cache
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    return entry !== undefined && !this.isExpired(entry);
  }

  /**
   * Delete a specific key from the cache
   */
  delete(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) {
      return false;
    }

    this.cache.delete(key);
    this.removeFromAccessOrder(key);
    this.stats.memoryUsage -= entry.size;
    
    return true;
  }

  /**
   * Clear all cached entries
   */
  clear(): void {
    this.cache.clear();
    this.accessOrder = [];
    this.stats.memoryUsage = 0;
    this.stats.hits = 0;
    this.stats.misses = 0;
    this.stats.evictions = 0;
  }

  /**
   * Get all cache keys
   */
  keys(): string[] {
    return Array.from(this.cache.keys());
  }

  /**
   * Get current cache statistics
   */
  getStats(): CacheStats {
    const entries = Array.from(this.cache.values());
    const timestamps = entries.map(e => e.timestamp);
    
    return {
      size: this.cache.size,
      maxSize: this.options.maxSize,
      hitRate: this.stats.hits / (this.stats.hits + this.stats.misses) || 0,
      totalHits: this.stats.hits,
      totalMisses: this.stats.misses,
      memoryUsage: this.stats.memoryUsage,
      maxMemory: this.options.maxMemory || Infinity,
      oldestEntry: timestamps.length > 0 ? Math.min(...timestamps) : 0,
      newestEntry: timestamps.length > 0 ? Math.max(...timestamps) : 0
    };
  }

  /**
   * Perform cache maintenance (remove expired entries)
   */
  cleanup(): number {
    const keysToDelete: string[] = [];
    const now = Date.now();

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.options.maxAge) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      this.delete(key);
    }

    return keysToDelete.length;
  }

  /**
   * Get cache entries sorted by access pattern (for debugging)
   */
  getAccessPattern(): Array<{ key: string; accessCount: number; lastAccess: number; age: number }> {
    const now = Date.now();
    
    return Array.from(this.cache.entries())
      .map(([key, entry]) => ({
        key,
        accessCount: entry.accessCount,
        lastAccess: entry.lastAccess,
        age: now - entry.timestamp
      }))
      .sort((a, b) => b.accessCount - a.accessCount);
  }

  // Private methods

  private isExpired(entry: CacheEntry): boolean {
    return Date.now() - entry.timestamp > this.options.maxAge;
  }

  private moveToFront(key: string): void {
    this.removeFromAccessOrder(key);
    this.accessOrder.unshift(key);
  }

  private removeFromAccessOrder(key: string): void {
    const index = this.accessOrder.indexOf(key);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
    }
  }

  private makeRoom(neededSize: number): void {
    // Check memory limit
    while (
      this.stats.memoryUsage + neededSize > (this.options.maxMemory || Infinity) &&
      this.cache.size > 0
    ) {
      this.evictLRU();
    }
  }

  private enforceLimits(): void {
    // Enforce size limit
    while (this.cache.size > this.options.maxSize) {
      this.evictLRU();
    }

    // Clean up expired entries
    this.cleanup();
  }

  private evictLRU(): void {
    if (this.accessOrder.length === 0) {
      return;
    }

    // Find the least recently used entry
    const lruKey = this.accessOrder[this.accessOrder.length - 1];
    this.delete(lruKey);
    this.stats.evictions++;
  }

  private estimateSize(data: PreviewData): number {
    // Estimate the size of the preview data in bytes
    let size = 0;

    // Base64 image data size estimation
    if (data.imageUrl && data.imageUrl.startsWith('data:')) {
      const base64Data = data.imageUrl.split(',')[1] || '';
      size += base64Data.length * 0.75; // Base64 is ~75% of actual size
    } else if (data.imageUrl) {
      size += data.imageUrl.length * 2; // Rough estimate for URL strings
    }

    // Thumbnail size
    if (data.thumbnailUrl) {
      if (data.thumbnailUrl.startsWith('data:')) {
        const base64Data = data.thumbnailUrl.split(',')[1] || '';
        size += base64Data.length * 0.75;
      } else {
        size += data.thumbnailUrl.length * 2;
      }
    }

    // Metadata size
    size += JSON.stringify(data.metadata).length * 2;

    return Math.ceil(size);
  }

  private scheduleCleanup(): void {
    // Run cleanup every 5 minutes
    setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000);
  }
}
