/**
 * Performance-optimized preview management hook
 */

import { useState, useEffect, useCallback, useRef } from 'react';

export interface PreviewPerformanceMetrics {
  renderCount: number;
  averageRenderTime: number;
  cacheHits: number;
  totalRequests: number;
  lastRenderTime: number;
}

export interface PreviewOptimizationOptions {
  debounceMs?: number;
  enableProgressiveRender?: boolean;
  maxCacheSize?: number;
  targetRenderTime?: number;
}

/**
 * Optimized preview hook with performance monitoring and debouncing
 */
export function useOptimizedPreview<T>(
  renderFunction: () => Promise<T>,
  dependencies: any[],
  options: PreviewOptimizationOptions = {}
): {
  result: T | null;
  isLoading: boolean;
  error: string | null;
  metrics: PreviewPerformanceMetrics;
  forceRefresh: () => void;
} {
  const {
    debounceMs = 100,
    targetRenderTime = 100
  } = options;

  const [result, setResult] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<PreviewPerformanceMetrics>({
    renderCount: 0,
    averageRenderTime: 0,
    cacheHits: 0,
    totalRequests: 0,
    lastRenderTime: 0
  });

  const debounceRef = useRef<NodeJS.Timeout>();
  const cacheRef = useRef<Map<string, { result: T; timestamp: number }>>(new Map());
  const lastDepsRef = useRef<string>('');
  const mountedRef = useRef(true);
  const renderCountRef = useRef(0);
  const totalRenderTimeRef = useRef(0);

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  const updateMetrics = useCallback((renderTime: number, wasCacheHit: boolean) => {
    if (!mountedRef.current) return;

    renderCountRef.current++;
    if (!wasCacheHit) {
      totalRenderTimeRef.current += renderTime;
    }

    setMetrics(prev => ({
      renderCount: renderCountRef.current,
      averageRenderTime: totalRenderTimeRef.current / (renderCountRef.current - prev.cacheHits),
      cacheHits: wasCacheHit ? prev.cacheHits + 1 : prev.cacheHits,
      totalRequests: renderCountRef.current,
      lastRenderTime: renderTime
    }));
  }, []);

  const performRender = useCallback(async (cacheKey: string) => {
    if (!mountedRef.current) return;

    setIsLoading(true);
    setError(null);

    const startTime = Date.now();

    try {
      // Check cache first
      const cached = cacheRef.current.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < 5 * 60 * 1000) { // 5 min cache
        setResult(cached.result);
        const renderTime = Date.now() - startTime;
        updateMetrics(renderTime, true);
        setIsLoading(false);
        return;
      }

      // Perform actual render
      const newResult = await renderFunction();
      
      if (!mountedRef.current) return;

      // Cache the result
      cacheRef.current.set(cacheKey, { result: newResult, timestamp: Date.now() });
      
      // Clean old cache entries if needed
      if (cacheRef.current.size > (options.maxCacheSize || 20)) {
        const entries = Array.from(cacheRef.current.entries());
        entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
        for (let i = 0; i < entries.length - (options.maxCacheSize || 20); i++) {
          cacheRef.current.delete(entries[i][0]);
        }
      }

      setResult(newResult);
      const renderTime = Date.now() - startTime;
      updateMetrics(renderTime, false);

      // Warn if render time exceeds target
      if (renderTime > targetRenderTime) {
        console.warn(`Preview render took ${renderTime}ms, exceeding target of ${targetRenderTime}ms`);
      }

    } catch (err) {
      if (!mountedRef.current) return;
      
      const errorMsg = err instanceof Error ? err.message : 'Preview render failed';
      setError(errorMsg);
      console.error('Preview render error:', err);
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [renderFunction, updateMetrics, targetRenderTime, options.maxCacheSize]);

  const debouncedRender = useCallback((cacheKey: string) => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      performRender(cacheKey);
    }, debounceMs);
  }, [performRender, debounceMs]);

  // Main effect to trigger renders
  useEffect(() => {
    const depsKey = JSON.stringify(dependencies);
    
    // Skip if dependencies haven't actually changed
    if (depsKey === lastDepsRef.current) {
      return;
    }
    
    lastDepsRef.current = depsKey;
    
    // Check if we have a cached result for these exact dependencies
    const cached = cacheRef.current.get(depsKey);
    if (cached && Date.now() - cached.timestamp < 60 * 1000) { // 1 min for immediate cache
      setResult(cached.result);
      updateMetrics(0, true);
      return;
    }

    // Trigger debounced render
    debouncedRender(depsKey);
  }, dependencies); // eslint-disable-line react-hooks/exhaustive-deps

  const forceRefresh = useCallback(() => {
    const depsKey = JSON.stringify(dependencies);
    cacheRef.current.delete(depsKey); // Clear cache for current dependencies
    performRender(depsKey);
  }, [dependencies, performRender]);

  return {
    result,
    isLoading,
    error,
    metrics,
    forceRefresh
  };
}

/**
 * Progressive preview hook that renders low quality first, then high quality
 */
export function useProgressivePreview<T>(
  lowQualityRender: () => Promise<T>,
  highQualityRender: () => Promise<T>,
  dependencies: any[],
  options: PreviewOptimizationOptions = {}
): {
  lowQualityResult: T | null;
  highQualityResult: T | null;
  isLoadingLowQuality: boolean;
  isLoadingHighQuality: boolean;
  error: string | null;
  combinedMetrics: PreviewPerformanceMetrics;
} {
  const lowQuality = useOptimizedPreview(lowQualityRender, dependencies, {
    ...options,
    debounceMs: 50, // Faster for low quality
    targetRenderTime: 50
  });

  const highQuality = useOptimizedPreview(highQualityRender, dependencies, {
    ...options,
    debounceMs: 200, // Slower for high quality
    targetRenderTime: 200
  });

  // Start high quality render after low quality is available
  useEffect(() => {
    if (lowQuality.result && !lowQuality.isLoading) {
      // High quality will start automatically due to dependency changes
    }
  }, [lowQuality.result, lowQuality.isLoading]);

  const combinedMetrics: PreviewPerformanceMetrics = {
    renderCount: lowQuality.metrics.renderCount + highQuality.metrics.renderCount,
    averageRenderTime: (lowQuality.metrics.averageRenderTime + highQuality.metrics.averageRenderTime) / 2,
    cacheHits: lowQuality.metrics.cacheHits + highQuality.metrics.cacheHits,
    totalRequests: lowQuality.metrics.totalRequests + highQuality.metrics.totalRequests,
    lastRenderTime: Math.max(lowQuality.metrics.lastRenderTime, highQuality.metrics.lastRenderTime)
  };

  return {
    lowQualityResult: lowQuality.result,
    highQualityResult: highQuality.result,
    isLoadingLowQuality: lowQuality.isLoading,
    isLoadingHighQuality: highQuality.isLoading,
    error: lowQuality.error || highQuality.error,
    combinedMetrics
  };
}
