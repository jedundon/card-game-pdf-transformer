/**
 * Preview generation system for transformation steps
 * Provides optimized, cacheable preview generation with delta updates
 */

import type { CardData, WorkflowSettings, PreviewData } from './types';
import { PreviewCache } from './PreviewCache';

export interface PreviewOptions {
  width?: number;
  height?: number;
  quality?: number;
  format?: 'png' | 'jpeg' | 'webp';
  background?: string;
  zoom?: number;
  showGrid?: boolean;
  showSelection?: boolean;
  selectedCards?: Set<string>;
}

export interface PreviewRequest {
  stepId: string;
  input: CardData[];
  settings: WorkflowSettings;
  options: PreviewOptions;
  priority?: 'low' | 'normal' | 'high';
  cacheKey?: string;
}

export interface PreviewResult {
  success: boolean;
  data?: PreviewData;
  error?: string;
  cached: boolean;
  renderTime: number;
  cacheHit: boolean;
}

export interface PreviewMetrics {
  totalRequests: number;
  cacheHitRate: number;
  averageRenderTime: number;
  backgroundRenders: number;
  deltaUpdates: number;
}

export class PreviewGenerator {
  private cache: PreviewCache;
  private renderQueue: Map<string, PreviewRequest> = new Map();
  private activeRenders: Set<string> = new Set();
  private backgroundWorker: Worker | null = null;
  private metrics: PreviewMetrics = {
    totalRequests: 0,
    cacheHitRate: 0,
    averageRenderTime: 0,
    backgroundRenders: 0,
    deltaUpdates: 0
  };

  constructor(options?: {
    maxCacheSize?: number;
    maxCacheAge?: number;
    enableBackgroundRender?: boolean;
  }) {
    this.cache = new PreviewCache({
      maxSize: options?.maxCacheSize || 100,
      maxAge: options?.maxCacheAge || 5 * 60 * 1000 // 5 minutes
    });

    // Initialize background worker if supported and enabled
    if (options?.enableBackgroundRender && typeof Worker !== 'undefined') {
      this.initializeBackgroundWorker();
    }
  }

  /**
   * Generate a preview for a transformation step
   */
  async generatePreview(request: PreviewRequest): Promise<PreviewResult> {
    const startTime = Date.now();
    this.metrics.totalRequests++;

    try {
      // Generate cache key if not provided
      const cacheKey = request.cacheKey || this.generateCacheKey(request);

      // Check cache first
      const cached = this.cache.get(cacheKey);
      if (cached) {
        this.updateCacheHitRate(true);
        return {
          success: true,
          data: cached,
          cached: true,
          renderTime: 0,
          cacheHit: true
        };
      }

      // Check if this render is already in progress
      if (this.activeRenders.has(cacheKey)) {
        // Wait for the active render to complete
        return this.waitForActiveRender(cacheKey, startTime);
      }

      // Mark as active render
      this.activeRenders.add(cacheKey);

      try {
        // Generate the preview
        const previewData = await this.renderPreview(request);
        
        // Cache the result
        this.cache.set(cacheKey, previewData);
        
        const renderTime = Date.now() - startTime;
        this.updateRenderTime(renderTime);
        this.updateCacheHitRate(false);

        return {
          success: true,
          data: previewData,
          cached: false,
          renderTime,
          cacheHit: false
        };
      } finally {
        this.activeRenders.delete(cacheKey);
      }
    } catch (error) {
      this.activeRenders.delete(request.cacheKey || this.generateCacheKey(request));
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown preview generation error',
        cached: false,
        renderTime: Date.now() - startTime,
        cacheHit: false
      };
    }
  }
  /**
   * Generate preview with delta updates (only re-render changed parts)
   */
  async generateDeltaPreview(
    baseRequest: PreviewRequest,
    changes: Partial<PreviewRequest>
  ): Promise<PreviewResult> {
    this.metrics.deltaUpdates++;

    // Merge changes with base request
    const newRequest: PreviewRequest = {
      ...baseRequest,
      ...changes,
      options: { ...baseRequest.options, ...changes.options }
    };

    // Try to use delta rendering if possible
    const baseCacheKey = this.generateCacheKey(baseRequest);

    const basePreview = this.cache.get(baseCacheKey);
    
    if (basePreview && this.canUseDeltaRender(baseRequest, newRequest)) {
      return this.renderDelta(basePreview, baseRequest, newRequest);
    }

    // Fall back to full render
    return this.generatePreview(newRequest);
  }

  /**
   * Queue a preview for background rendering
   */
  queueBackgroundRender(request: PreviewRequest): void {
    if (!this.backgroundWorker) {
      return;
    }

    const cacheKey = request.cacheKey || this.generateCacheKey(request);
    
    // Don't queue if already cached or in progress
    if (this.cache.has(cacheKey) || this.activeRenders.has(cacheKey)) {
      return;
    }

    this.renderQueue.set(cacheKey, { ...request, priority: 'low' });
    this.processBackgroundQueue();
  }

  /**
   * Invalidate cache entries matching a pattern
   */
  invalidateCache(pattern?: string | RegExp): void {
    if (!pattern) {
      this.cache.clear();
      return;
    }

    const keys = this.cache.keys();
    for (const key of keys) {
      if (typeof pattern === 'string' && key.includes(pattern)) {
        this.cache.delete(key);
      } else if (pattern instanceof RegExp && pattern.test(key)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Get current performance metrics
   */
  getMetrics(): PreviewMetrics {
    return { ...this.metrics };
  }

  /**
   * Reset performance metrics
   */
  resetMetrics(): void {
    this.metrics = {
      totalRequests: 0,
      cacheHitRate: 0,
      averageRenderTime: 0,
      backgroundRenders: 0,
      deltaUpdates: 0
    };
  }

  /**
   * Destroy the preview generator and clean up resources
   */
  destroy(): void {
    this.cache.clear();
    this.renderQueue.clear();
    this.activeRenders.clear();
    
    if (this.backgroundWorker) {
      this.backgroundWorker.terminate();
      this.backgroundWorker = null;
    }
  }

  // Private methods
  private generateCacheKey(request: PreviewRequest): string {
    const inputLength = request.input?.length ?? 0;
    const inputIds = request.input?.map(card => card.id).slice(0, 5) ?? [];
    
    const settingsHash = this.hashObject({
      stepId: request.stepId,
      inputLength,
      inputIds, // Sample of IDs
      settings: {
        gridColumns: request.settings.gridColumns,
        gridRows: request.settings.gridRows,
        dpi: request.settings.dpi,
        cardWidth: request.settings.cardWidth,
        cardHeight: request.settings.cardHeight,
        bleed: request.settings.bleed
      },
      options: request.options
    });

    return `preview-${request.stepId}-${settingsHash}`;
  }

  private hashObject(obj: any): string {
    const str = JSON.stringify(obj);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16);
  }

  private async renderPreview(request: PreviewRequest): Promise<PreviewData> {
    // This is where the actual preview rendering logic will go
    // For now, create a basic preview structure
    
    const { options } = request;
    const width = options.width || 800;
    const height = options.height || 600;
    
    // Simulate render time based on complexity
    const complexity = request.input.length * (options.quality || 1);
    const renderDelay = Math.min(complexity * 0.1, 50); // Max 50ms simulation
    
    if (renderDelay > 0) {
      await new Promise(resolve => setTimeout(resolve, renderDelay));
    }

    // Create mock preview data
    // In real implementation, this would render the actual cards/layouts
    const previewData: PreviewData = {
      imageUrl: `data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==`,
      metadata: {
        width,
        height,
        dpi: request.settings.dpi || 300,
        renderTime: renderDelay,
        stepId: request.stepId,
        cacheKey: this.generateCacheKey(request),
        timestamp: Date.now()
      }
    };

    return previewData;
  }

  private canUseDeltaRender(baseRequest: PreviewRequest, newRequest: PreviewRequest): boolean {
    // Check if changes are suitable for delta rendering
    const baseOpts = baseRequest.options;
    const newOpts = newRequest.options;

    // Only zoom, selection, and grid changes can use delta rendering
    const onlyUIChanges = 
      baseRequest.stepId === newRequest.stepId &&
      baseRequest.input.length === newRequest.input.length &&
      baseRequest.settings.gridColumns === newRequest.settings.gridColumns &&
      baseRequest.settings.gridRows === newRequest.settings.gridRows &&
      baseRequest.settings.dpi === newRequest.settings.dpi;

    const supportedChanges = [
      'zoom', 'showGrid', 'showSelection', 'selectedCards'
    ].some(key => baseOpts[key as keyof PreviewOptions] !== newOpts[key as keyof PreviewOptions]);

    return onlyUIChanges && supportedChanges;
  }
  private async renderDelta(
    basePreview: PreviewData,
    _baseRequest: PreviewRequest,
    newRequest: PreviewRequest
  ): Promise<PreviewResult> {
    const startTime = Date.now();

    // For delta rendering, we would apply the changes to the base preview
    // For now, simulate a faster render
    await new Promise(resolve => setTimeout(resolve, 5));

    const deltaPreview: PreviewData = {
      ...basePreview,
      metadata: {
        ...basePreview.metadata,
        timestamp: Date.now(),
        renderTime: 5,
        deltaRender: true
      }
    };

    const cacheKey = this.generateCacheKey(newRequest);
    this.cache.set(cacheKey, deltaPreview);

    return {
      success: true,
      data: deltaPreview,
      cached: false,
      renderTime: Date.now() - startTime,
      cacheHit: false
    };
  }

  private async waitForActiveRender(cacheKey: string, startTime: number): Promise<PreviewResult> {
    // Wait for active render to complete (with timeout)
    const timeout = 5000; // 5 second timeout
    const checkInterval = 50;
    const maxChecks = timeout / checkInterval;
    
    for (let i = 0; i < maxChecks; i++) {
      if (!this.activeRenders.has(cacheKey)) {
        // Check cache again
        const cached = this.cache.get(cacheKey);
        if (cached) {
          return {
            success: true,
            data: cached,
            cached: true,
            renderTime: Date.now() - startTime,
            cacheHit: true
          };
        }
        break;
      }
      await new Promise(resolve => setTimeout(resolve, checkInterval));
    }

    // If we get here, either the render completed or timed out
    throw new Error('Preview render timeout or failed');
  }

  private processBackgroundQueue(): void {
    if (!this.backgroundWorker || this.renderQueue.size === 0) {
      return;
    }

    // Process high priority items first
    const sortedRequests = Array.from(this.renderQueue.entries())
      .sort(([, a], [, b]) => {
        const priorityOrder = { high: 3, normal: 2, low: 1 };
        return priorityOrder[b.priority || 'normal'] - priorityOrder[a.priority || 'normal'];
      });

    const [cacheKey, request] = sortedRequests[0];
    this.renderQueue.delete(cacheKey);

    // Send to background worker
    this.backgroundWorker.postMessage({
      type: 'render',
      cacheKey,
      request
    });

    this.metrics.backgroundRenders++;
  }

  private initializeBackgroundWorker(): void {
    // Background worker would be initialized here
    // For now, we'll simulate it without actually creating a worker
    console.log('Background preview rendering initialized');
  }

  private updateCacheHitRate(wasHit: boolean): void {
    const total = this.metrics.totalRequests;
    const currentHits = this.metrics.cacheHitRate * (total - 1);
    const newHits = currentHits + (wasHit ? 1 : 0);
    this.metrics.cacheHitRate = newHits / total;
  }

  private updateRenderTime(renderTime: number): void {
    const total = this.metrics.totalRequests;
    const currentAvg = this.metrics.averageRenderTime;
    this.metrics.averageRenderTime = 
      (currentAvg * (total - 1) + renderTime) / total;
  }
}
