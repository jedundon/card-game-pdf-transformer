/**
 * Unit tests for PreviewCache
 */

import { PreviewCache } from '../PreviewCache';
import { PreviewData } from '../types';

describe('PreviewCache', () => {
  let cache: PreviewCache;
  let samplePreview: PreviewData;

  beforeEach(() => {
    cache = new PreviewCache({
      maxSize: 5,
      maxAge: 1000, // 1 second for testing
      maxMemory: 10000 // 10KB limit
    });

    samplePreview = {
      imageUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
      metadata: {
        width: 800,
        height: 600,
        dpi: 300,
        renderTime: 50,
        timestamp: Date.now()
      }
    };
  });

  afterEach(() => {
    cache.clear();
  });

  describe('Basic Cache Operations', () => {
    it('should store and retrieve values', () => {
      cache.set('test-key', samplePreview);
      const retrieved = cache.get('test-key');

      expect(retrieved).toEqual(samplePreview);
    });

    it('should return null for non-existent keys', () => {
      const result = cache.get('non-existent');
      expect(result).toBeNull();
    });

    it('should check if keys exist', () => {
      cache.set('test-key', samplePreview);
      
      expect(cache.has('test-key')).toBe(true);
      expect(cache.has('non-existent')).toBe(false);
    });

    it('should delete entries', () => {
      cache.set('test-key', samplePreview);
      expect(cache.has('test-key')).toBe(true);

      const deleted = cache.delete('test-key');
      expect(deleted).toBe(true);
      expect(cache.has('test-key')).toBe(false);
    });

    it('should return false when deleting non-existent keys', () => {
      const deleted = cache.delete('non-existent');
      expect(deleted).toBe(false);
    });

    it('should clear all entries', () => {
      cache.set('key1', samplePreview);
      cache.set('key2', samplePreview);
      
      cache.clear();
      
      expect(cache.has('key1')).toBe(false);
      expect(cache.has('key2')).toBe(false);
    });

    it('should get all cache keys', () => {
      cache.set('key1', samplePreview);
      cache.set('key2', samplePreview);
      
      const keys = cache.keys();
      expect(keys).toContain('key1');
      expect(keys).toContain('key2');
      expect(keys.length).toBe(2);
    });
  });

  describe('LRU Eviction', () => {
    it('should evict least recently used entries when size limit is reached', () => {
      // Fill cache to capacity
      for (let i = 0; i < 5; i++) {
        cache.set(`key${i}`, samplePreview);
      }

      // Add one more to trigger eviction
      cache.set('key5', samplePreview);

      // key0 should be evicted (least recently used)
      expect(cache.has('key0')).toBe(false);
      expect(cache.has('key5')).toBe(true);
    });

    it('should update LRU order on access', () => {
      // Fill cache
      for (let i = 0; i < 5; i++) {
        cache.set(`key${i}`, samplePreview);
      }

      // Access key0 to make it most recently used
      cache.get('key0');

      // Add another entry
      cache.set('key5', samplePreview);

      // key1 should be evicted instead of key0
      expect(cache.has('key0')).toBe(true);
      expect(cache.has('key1')).toBe(false);
      expect(cache.has('key5')).toBe(true);
    });

    it('should update access count and timestamp on get', () => {
      cache.set('test-key', samplePreview);
      
      // Get access pattern before access
      const patternBefore = cache.getAccessPattern();
      const entryBefore = patternBefore.find(p => p.key === 'test-key');
      
      // Access the entry
      cache.get('test-key');
      
      // Get access pattern after access
      const patternAfter = cache.getAccessPattern();
      const entryAfter = patternAfter.find(p => p.key === 'test-key');
      
      expect(entryAfter?.accessCount).toBe((entryBefore?.accessCount || 0) + 1);
    });
  });

  describe('Expiration', () => {
    it('should return null for expired entries', async () => {
      cache.set('test-key', samplePreview);
      
      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 1100));
      
      const result = cache.get('test-key');
      expect(result).toBeNull();
    });

    it('should clean up expired entries', async () => {
      cache.set('key1', samplePreview);
      cache.set('key2', samplePreview);
      
      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 1100));
      
      const cleaned = cache.cleanup();
      expect(cleaned).toBe(2);
      expect(cache.has('key1')).toBe(false);
      expect(cache.has('key2')).toBe(false);
    });

    it('should not return expired entries even if they exist in cache', async () => {
      cache.set('test-key', samplePreview);
      
      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 1100));
      
      expect(cache.has('test-key')).toBe(false);
    });
  });

  describe('Memory Management', () => {
    it('should estimate entry sizes', () => {
      const largePreview: PreviewData = {
        imageUrl: 'data:image/png;base64,' + 'A'.repeat(1000),
        metadata: {
          width: 1600,
          height: 1200,
          dpi: 600
        }
      };

      cache.set('large-key', largePreview);
      
      const stats = cache.getStats();
      expect(stats.memoryUsage).toBeGreaterThan(0);
    });

    it('should evict entries when memory limit is reached', () => {
      // Create a large preview that will use significant memory
      const largePreview: PreviewData = {
        imageUrl: 'data:image/png;base64,' + 'A'.repeat(5000),
        metadata: {
          width: 1600,
          height: 1200,
          dpi: 600
        }
      };

      // Fill cache with large entries
      cache.set('large1', largePreview);
      cache.set('large2', largePreview);

      // Add another large entry - should trigger memory-based eviction
      cache.set('large3', largePreview);

      const stats = cache.getStats();
      expect(stats.memoryUsage).toBeLessThanOrEqual(10000);
    });
  });

  describe('Statistics', () => {
    it('should track cache statistics', () => {
      cache.set('key1', samplePreview);
      cache.set('key2', samplePreview);
      
      cache.get('key1'); // Hit
      cache.get('key2'); // Hit
      cache.get('key3'); // Miss

      const stats = cache.getStats();
      
      expect(stats.size).toBe(2);
      expect(stats.maxSize).toBe(5);
      expect(stats.totalHits).toBe(2);
      expect(stats.totalMisses).toBe(1);
      expect(stats.hitRate).toBeCloseTo(2/3);
      expect(stats.memoryUsage).toBeGreaterThan(0);
    });    it('should track oldest and newest entries', async () => {
      const now = Date.now();
      
      cache.set('old-key', {
        ...samplePreview,
        metadata: { ...samplePreview.metadata, timestamp: now - 1000 }
      });
      
      // Add a small delay to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 10));
      
      cache.set('new-key', {
        ...samplePreview,
        metadata: { ...samplePreview.metadata, timestamp: now + 10 }
      });

      const stats = cache.getStats();
      
      expect(stats.oldestEntry).toBeLessThan(stats.newestEntry);
    });
  });

  describe('Access Patterns', () => {
    it('should track access patterns', () => {
      cache.set('key1', samplePreview);
      cache.set('key2', samplePreview);
      
      // Access key1 multiple times
      cache.get('key1');
      cache.get('key1');
      cache.get('key2');

      const pattern = cache.getAccessPattern();
      
      expect(pattern.length).toBe(2);
      expect(pattern[0].key).toBe('key1'); // Most accessed should be first
      expect(pattern[0].accessCount).toBe(3); // 1 set + 2 gets
      expect(pattern[1].accessCount).toBe(2); // 1 set + 1 get
    });

    it('should sort access pattern by access count', () => {
      cache.set('low', samplePreview);
      cache.set('medium', samplePreview);
      cache.set('high', samplePreview);
      
      // Create different access patterns
      cache.get('high');
      cache.get('high');
      cache.get('high');
      cache.get('medium');

      const pattern = cache.getAccessPattern();
      
      expect(pattern[0].key).toBe('high');
      expect(pattern[1].key).toBe('medium');
      expect(pattern[2].key).toBe('low');
    });
  });

  describe('Edge Cases', () => {
    it('should handle setting the same key multiple times', () => {
      cache.set('test-key', samplePreview);
      cache.set('test-key', { ...samplePreview, imageUrl: 'different-url' });
      
      const result = cache.get('test-key');
      expect(result?.imageUrl).toBe('different-url');
    });

    it('should handle empty cache operations', () => {
      expect(cache.cleanup()).toBe(0);
      expect(cache.keys()).toEqual([]);
      expect(cache.getAccessPattern()).toEqual([]);
    });

    it('should handle cache with zero size limit', () => {
      const zeroCache = new PreviewCache({
        maxSize: 0,
        maxAge: 1000
      });

      zeroCache.set('test', samplePreview);
      expect(zeroCache.has('test')).toBe(false);
    });

    it('should handle very large memory limits', () => {
      const bigCache = new PreviewCache({
        maxSize: 100,
        maxAge: 60000,
        maxMemory: Number.MAX_SAFE_INTEGER
      });

      bigCache.set('test', samplePreview);
      expect(bigCache.has('test')).toBe(true);
    });
  });
});
