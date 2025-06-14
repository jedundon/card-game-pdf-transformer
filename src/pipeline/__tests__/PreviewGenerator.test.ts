/**
 * Unit tests for PreviewGenerator
 */

import { PreviewGenerator, PreviewRequest, PreviewOptions } from '../PreviewGenerator';
import { CardData, WorkflowSettings } from '../types';

describe('PreviewGenerator', () => {
  let generator: PreviewGenerator;
  let sampleRequest: PreviewRequest;

  beforeEach(() => {
    generator = new PreviewGenerator({
      maxCacheSize: 10,
      maxCacheAge: 60000, // 1 minute
      enableBackgroundRender: false
    });

    const sampleCards: CardData[] = [
      {
        id: 'card-1',
        x: 0,
        y: 0,
        width: 100,
        height: 140,
        rotation: 0,
        selected: false,
        extracted: false
      }
    ];

    const sampleSettings: WorkflowSettings = {
      inputMode: 'pdf',
      outputFormat: 'individual',
      dpi: 300,
      quality: 85,
      gridColumns: 3,
      gridRows: 3,
      cardWidth: 2.5,
      cardHeight: 3.5,
      bleed: 0.125
    };

    const sampleOptions: PreviewOptions = {
      width: 800,
      height: 600,
      quality: 1,
      format: 'png',
      zoom: 1.0,
      showGrid: true
    };

    sampleRequest = {
      stepId: 'extract',
      input: sampleCards,
      settings: sampleSettings,
      options: sampleOptions,
      priority: 'normal'
    };
  });

  afterEach(() => {
    generator.destroy();
  });

  describe('Basic Preview Generation', () => {
    it('should generate a preview successfully', async () => {
      const result = await generator.generatePreview(sampleRequest);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.imageUrl).toBeDefined();
      expect(result.data?.metadata.width).toBe(800);
      expect(result.data?.metadata.height).toBe(600);
      expect(result.cached).toBe(false);
      expect(result.cacheHit).toBe(false);
      expect(typeof result.renderTime).toBe('number');
    });

    it('should generate preview with custom options', async () => {
      const customRequest = {
        ...sampleRequest,
        options: {
          ...sampleRequest.options,
          width: 1200,
          height: 900,
          quality: 2
        }
      };

      const result = await generator.generatePreview(customRequest);

      expect(result.success).toBe(true);
      expect(result.data?.metadata.width).toBe(1200);
      expect(result.data?.metadata.height).toBe(900);
    });

    it('should handle preview generation errors gracefully', async () => {
      // Create a request that would cause an error (invalid input)
      const invalidRequest = {
        ...sampleRequest,
        input: null as any
      };

      const result = await generator.generatePreview(invalidRequest);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.cached).toBe(false);
      expect(result.cacheHit).toBe(false);
    });
  });

  describe('Caching System', () => {
    it('should cache preview results', async () => {
      // First request
      const result1 = await generator.generatePreview(sampleRequest);
      expect(result1.cached).toBe(false);
      expect(result1.cacheHit).toBe(false);

      // Second identical request should be cached
      const result2 = await generator.generatePreview(sampleRequest);
      expect(result2.cached).toBe(true);
      expect(result2.cacheHit).toBe(true);
      expect(result2.renderTime).toBe(0);
    });

    it('should generate different cache keys for different requests', async () => {
      const request1 = sampleRequest;
      const request2 = {
        ...sampleRequest,
        options: { ...sampleRequest.options, width: 1000 }
      };

      await generator.generatePreview(request1);
      const result2 = await generator.generatePreview(request2);

      expect(result2.cached).toBe(false); // Should not be cached
    });

    it('should invalidate cache correctly', async () => {
      // Generate and cache a preview
      await generator.generatePreview(sampleRequest);

      // Invalidate cache
      generator.invalidateCache();

      // Next request should not be cached
      const result = await generator.generatePreview(sampleRequest);
      expect(result.cached).toBe(false);
    });

    it('should invalidate cache by pattern', async () => {
      // Generate multiple previews
      await generator.generatePreview(sampleRequest);
      
      const request2 = {
        ...sampleRequest,
        stepId: 'configure'
      };
      await generator.generatePreview(request2);

      // Invalidate only extract previews
      generator.invalidateCache('extract');

      // Extract request should not be cached, configure should be cached
      const extractResult = await generator.generatePreview(sampleRequest);
      const configureResult = await generator.generatePreview(request2);

      expect(extractResult.cached).toBe(false);
      expect(configureResult.cached).toBe(true);
    });
  });

  describe('Delta Updates', () => {
    it('should perform delta updates for UI changes', async () => {
      // Generate base preview
      await generator.generatePreview(sampleRequest);

      // Make a UI-only change (zoom)
      const changes = {
        options: { ...sampleRequest.options, zoom: 1.5 }
      };

      const result = await generator.generateDeltaPreview(sampleRequest, changes);

      expect(result.success).toBe(true);
      expect(result.data?.metadata.deltaRender).toBe(true);
      expect(result.renderTime).toBeLessThan(50); // Should be faster than full render
    });

    it('should fall back to full render for major changes', async () => {
      // Generate base preview
      await generator.generatePreview(sampleRequest);

      // Make a major change (different grid)
      const changes = {
        settings: { ...sampleRequest.settings, gridColumns: 4 }
      };

      const result = await generator.generateDeltaPreview(sampleRequest, changes);

      expect(result.success).toBe(true);
      expect(result.data?.metadata.deltaRender).toBeUndefined();
    });
  });

  describe('Performance Metrics', () => {
    it('should track performance metrics correctly', async () => {
      // Generate some previews
      await generator.generatePreview(sampleRequest);
      await generator.generatePreview(sampleRequest); // Cache hit
      
      const request2 = {
        ...sampleRequest,
        options: { ...sampleRequest.options, width: 1000 }
      };
      await generator.generatePreview(request2);

      const metrics = generator.getMetrics();

      expect(metrics.totalRequests).toBe(3);
      expect(metrics.cacheHitRate).toBeCloseTo(1/3); // 1 hit out of 3 requests
      expect(metrics.averageRenderTime).toBeGreaterThan(0);
    });

    it('should reset metrics correctly', async () => {
      await generator.generatePreview(sampleRequest);
      
      generator.resetMetrics();
      const metrics = generator.getMetrics();

      expect(metrics.totalRequests).toBe(0);
      expect(metrics.cacheHitRate).toBe(0);
      expect(metrics.averageRenderTime).toBe(0);
    });
  });

  describe('Background Rendering', () => {
    it('should queue background renders', () => {
      // Queue a background render
      generator.queueBackgroundRender(sampleRequest);

      // Should not throw or cause issues
      expect(() => {
        generator.queueBackgroundRender(sampleRequest);
      }).not.toThrow();
    });
  });

  describe('Concurrent Requests', () => {
    it('should handle concurrent requests for same preview', async () => {
      // Start multiple requests for the same preview simultaneously
      const promises = [
        generator.generatePreview(sampleRequest),
        generator.generatePreview(sampleRequest),
        generator.generatePreview(sampleRequest)
      ];

      const results = await Promise.all(promises);

      // All should succeed
      results.forEach(result => {
        expect(result.success).toBe(true);
      });

      // Only one should actually render (others should wait or get cached result)
      const renderTimes = results.map(r => r.renderTime);
      const nonZeroRenderTimes = renderTimes.filter(t => t > 0);
      expect(nonZeroRenderTimes.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Memory Management', () => {
    it('should destroy resources properly', () => {
      generator.destroy();

      // Should not throw when trying to use destroyed generator
      expect(() => {
        generator.getMetrics();
      }).not.toThrow();
    });
  });

  describe('Cache Key Generation', () => {
    it('should generate consistent cache keys', async () => {
      const request1 = { ...sampleRequest };
      const request2 = { ...sampleRequest };

      // Both requests should get the same cache key (and thus same result)
      await generator.generatePreview(request1);
      const result2 = await generator.generatePreview(request2);

      expect(result2.cached).toBe(true);
    });

    it('should generate different keys for different settings', async () => {
      const request1 = sampleRequest;
      const request2 = {
        ...sampleRequest,
        settings: { ...sampleRequest.settings, dpi: 600 }
      };

      await generator.generatePreview(request1);
      const result2 = await generator.generatePreview(request2);

      expect(result2.cached).toBe(false);
    });
  });
});
