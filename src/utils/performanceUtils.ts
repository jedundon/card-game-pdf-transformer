/**
 * @fileoverview Performance monitoring and memory management utilities
 * 
 * This module provides comprehensive performance monitoring functionality
 * including memory usage tracking, performance metrics collection, and
 * system resource monitoring for large file processing scenarios.
 * 
 * **Key Features:**
 * - Memory usage monitoring and alerts
 * - Performance metrics collection
 * - Resource usage tracking
 * - Automatic cleanup suggestions
 * - Performance bottleneck detection
 * 
 * @author Card Game PDF Transformer
 */

/**
 * Memory usage information interface
 */
interface MemoryUsage {
  /** Used heap size in bytes */
  usedJSHeapSize: number;
  /** Total heap size in bytes */
  totalJSHeapSize: number;
  /** Heap size limit in bytes */
  jsHeapSizeLimit: number;
  /** Usage percentage */
  usagePercentage: number;
  /** Human-readable used memory */
  usedFormatted: string;
  /** Human-readable total memory */
  totalFormatted: string;
  /** Memory status */
  status: 'low' | 'medium' | 'high' | 'critical';
}

/**
 * Performance metrics interface
 */
interface PerformanceMetrics {
  /** Memory usage information */
  memory: MemoryUsage;
  /** Timing information */
  timing: {
    /** Navigation start time */
    navigationStart: number;
    /** DOM content loaded time */
    domContentLoaded: number;
    /** Load complete time */
    loadComplete: number;
    /** Time since page load in ms */
    timeSinceLoad: number;
  };
  /** Resource usage */
  resources: {
    /** Number of active timers */
    activeTimers: number;
    /** Number of active intervals */
    activeIntervals: number;
    /** Number of event listeners */
    eventListeners: number;
  };
  /** Cache statistics */
  cache: {
    /** Thumbnail cache stats */
    thumbnails?: any;
    /** Image cache stats */
    images?: any;
    /** Render cache stats */
    renders?: any;
  };
}

/**
 * Performance monitoring options
 */
interface PerformanceMonitorOptions {
  /** Memory warning threshold percentage (default: 70) */
  memoryWarningThreshold?: number;
  /** Memory critical threshold percentage (default: 85) */
  memoryCriticalThreshold?: number;
  /** Monitoring interval in ms (default: 5000) */
  monitoringInterval?: number;
  /** Enable console logging (default: false) */
  enableLogging?: boolean;
  /** Enable automatic cleanup suggestions (default: true) */
  enableCleanupSuggestions?: boolean;
}

/**
 * Performance monitor class
 * 
 * Provides comprehensive performance monitoring including memory usage,
 * timing metrics, and resource tracking. Helps identify performance
 * bottlenecks and provides optimization suggestions.
 * 
 * @example
 * ```typescript
 * const monitor = new PerformanceMonitor({
 *   memoryWarningThreshold: 75,
 *   enableLogging: true
 * });
 * 
 * monitor.start();
 * const metrics = monitor.getCurrentMetrics();
 * ```
 */
export class PerformanceMonitor {
  private readonly options: Required<PerformanceMonitorOptions>;
  private monitoringTimer?: NodeJS.Timeout;
  private isMonitoring = false;
  private metricsHistory: PerformanceMetrics[] = [];
  private readonly maxHistorySize = 100;

  constructor(options: PerformanceMonitorOptions = {}) {
    this.options = {
      memoryWarningThreshold: options.memoryWarningThreshold ?? 70,
      memoryCriticalThreshold: options.memoryCriticalThreshold ?? 85,
      monitoringInterval: options.monitoringInterval ?? 5000,
      enableLogging: options.enableLogging ?? false,
      enableCleanupSuggestions: options.enableCleanupSuggestions ?? true
    };
  }

  /**
   * Start performance monitoring
   */
  start(): void {
    if (this.isMonitoring) {
      return;
    }

    this.isMonitoring = true;
    this.monitoringTimer = setInterval(() => {
      this.collectMetrics();
    }, this.options.monitoringInterval);

    if (this.options.enableLogging) {
      console.log('Performance monitoring started');
    }
  }

  /**
   * Stop performance monitoring
   */
  stop(): void {
    if (!this.isMonitoring) {
      return;
    }

    this.isMonitoring = false;
    if (this.monitoringTimer) {
      clearInterval(this.monitoringTimer);
      this.monitoringTimer = undefined;
    }

    if (this.options.enableLogging) {
      console.log('Performance monitoring stopped');
    }
  }

  /**
   * Get current performance metrics
   */
  getCurrentMetrics(): PerformanceMetrics {
    return this.collectMetrics();
  }

  /**
   * Get memory usage information
   */
  getMemoryUsage(): MemoryUsage {
    const performance = (window as any).performance;
    const memory = performance?.memory;

    if (!memory) {
      // Fallback for browsers without memory API
      return {
        usedJSHeapSize: 0,
        totalJSHeapSize: 0,
        jsHeapSizeLimit: 0,
        usagePercentage: 0,
        usedFormatted: 'Unknown',
        totalFormatted: 'Unknown',
        status: 'low'
      };
    }

    const usedJSHeapSize = memory.usedJSHeapSize || 0;
    const totalJSHeapSize = memory.totalJSHeapSize || 0;
    const jsHeapSizeLimit = memory.jsHeapSizeLimit || 0;
    
    const usagePercentage = jsHeapSizeLimit > 0 
      ? (usedJSHeapSize / jsHeapSizeLimit) * 100 
      : 0;

    let status: MemoryUsage['status'] = 'low';
    if (usagePercentage >= this.options.memoryCriticalThreshold) {
      status = 'critical';
    } else if (usagePercentage >= this.options.memoryWarningThreshold) {
      status = 'high';
    } else if (usagePercentage >= 50) {
      status = 'medium';
    }

    return {
      usedJSHeapSize,
      totalJSHeapSize,
      jsHeapSizeLimit,
      usagePercentage: Math.round(usagePercentage * 100) / 100,
      usedFormatted: this.formatBytes(usedJSHeapSize),
      totalFormatted: this.formatBytes(totalJSHeapSize),
      status
    };
  }

  /**
   * Get metrics history
   */
  getMetricsHistory(): PerformanceMetrics[] {
    return [...this.metricsHistory];
  }

  /**
   * Clear metrics history
   */
  clearHistory(): void {
    this.metricsHistory.length = 0;
  }

  /**
   * Get performance summary
   */
  getPerformanceSummary(): {
    avgMemoryUsage: number;
    peakMemoryUsage: number;
    memoryTrend: 'increasing' | 'decreasing' | 'stable';
    recommendations: string[];
  } {
    if (this.metricsHistory.length === 0) {
      return {
        avgMemoryUsage: 0,
        peakMemoryUsage: 0,
        memoryTrend: 'stable',
        recommendations: []
      };
    }

    const memoryUsages = this.metricsHistory.map(m => m.memory.usagePercentage);
    const avgMemoryUsage = memoryUsages.reduce((a, b) => a + b, 0) / memoryUsages.length;
    const peakMemoryUsage = Math.max(...memoryUsages);

    // Determine trend (simple linear trend over last 10 measurements)
    let memoryTrend: 'increasing' | 'decreasing' | 'stable' = 'stable';
    if (this.metricsHistory.length >= 10) {
      const recent = memoryUsages.slice(-10);
      const oldAvg = recent.slice(0, 5).reduce((a, b) => a + b, 0) / 5;
      const newAvg = recent.slice(-5).reduce((a, b) => a + b, 0) / 5;
      
      if (newAvg > oldAvg + 5) {
        memoryTrend = 'increasing';
      } else if (newAvg < oldAvg - 5) {
        memoryTrend = 'decreasing';
      }
    }

    // Generate recommendations
    const recommendations: string[] = [];
    
    if (peakMemoryUsage > this.options.memoryCriticalThreshold) {
      recommendations.push('Critical: Memory usage is very high. Consider clearing caches or reducing file size.');
    } else if (peakMemoryUsage > this.options.memoryWarningThreshold) {
      recommendations.push('Warning: Memory usage is high. Monitor closely and consider optimization.');
    }

    if (memoryTrend === 'increasing') {
      recommendations.push('Memory usage is trending upward. Check for memory leaks or unnecessary data retention.');
    }

    if (avgMemoryUsage > 60) {
      recommendations.push('Average memory usage is high. Consider implementing more aggressive caching policies.');
    }

    return {
      avgMemoryUsage: Math.round(avgMemoryUsage * 100) / 100,
      peakMemoryUsage: Math.round(peakMemoryUsage * 100) / 100,
      memoryTrend,
      recommendations
    };
  }

  /**
   * Force garbage collection (if available)
   */
  forceGarbageCollection(): boolean {
    const gc = (window as any).gc;
    if (typeof gc === 'function') {
      try {
        gc();
        if (this.options.enableLogging) {
          console.log('Garbage collection forced');
        }
        return true;
      } catch (error) {
        console.warn('Failed to force garbage collection:', error);
        return false;
      }
    }
    
    if (this.options.enableLogging) {
      console.log('Garbage collection not available');
    }
    return false;
  }

  /**
   * Collect comprehensive performance metrics
   */
  private collectMetrics(): PerformanceMetrics {
    const memory = this.getMemoryUsage();
    const timing = this.getTimingMetrics();
    const resources = this.getResourceMetrics();
    const cache = this.getCacheMetrics();

    const metrics: PerformanceMetrics = {
      memory,
      timing,
      resources,
      cache
    };

    // Add to history
    this.metricsHistory.push(metrics);
    
    // Limit history size
    if (this.metricsHistory.length > this.maxHistorySize) {
      this.metricsHistory.shift();
    }

    // Check for alerts
    this.checkAlerts(metrics);

    return metrics;
  }

  /**
   * Get timing performance metrics
   */
  private getTimingMetrics() {
    const performance = window.performance;
    const timing = performance.timing;
    const now = performance.now();

    return {
      navigationStart: timing.navigationStart,
      domContentLoaded: timing.domContentLoadedEventEnd - timing.navigationStart,
      loadComplete: timing.loadEventEnd - timing.navigationStart,
      timeSinceLoad: now
    };
  }

  /**
   * Get resource usage metrics
   */
  private getResourceMetrics() {
    // Note: These are approximations as browsers don't expose exact counts
    return {
      activeTimers: 0, // Would need timer tracking
      activeIntervals: 0, // Would need interval tracking
      eventListeners: 0 // Would need listener tracking
    };
  }

  /**
   * Get cache metrics from various caches
   */
  private getCacheMetrics() {
    const cache: any = {};

    // Try to get cache stats if available
    try {
      // These would be imported from the actual cache instances
      // For now, we'll provide a placeholder structure
      cache.thumbnails = {
        entryCount: 0,
        totalSize: 0,
        hitRate: 0
      };
    } catch (error) {
      // Cache stats not available
    }

    return cache;
  }

  /**
   * Check for performance alerts
   */
  private checkAlerts(metrics: PerformanceMetrics): void {
    const { memory } = metrics;

    if (memory.status === 'critical') {
      this.emitAlert('critical', `Critical memory usage: ${memory.usagePercentage}%`);
    } else if (memory.status === 'high') {
      this.emitAlert('warning', `High memory usage: ${memory.usagePercentage}%`);
    }
  }

  /**
   * Emit performance alert
   */
  private emitAlert(level: 'warning' | 'critical', message: string): void {
    if (this.options.enableLogging) {
      console.warn(`[Performance ${level.toUpperCase()}] ${message}`);
    }

    // Could dispatch custom events here for UI components to listen to
    window.dispatchEvent(new CustomEvent('performance-alert', {
      detail: { level, message }
    }));

    // Provide cleanup suggestions if enabled
    if (this.options.enableCleanupSuggestions && level === 'critical') {
      this.suggestCleanup();
    }
  }

  /**
   * Suggest cleanup actions
   */
  private suggestCleanup(): void {
    const suggestions = [
      'Clear thumbnail cache to free memory',
      'Remove unused PDF data',
      'Reduce number of loaded pages',
      'Close unused browser tabs',
      'Restart the application if issues persist'
    ];

    if (this.options.enableLogging) {
      console.log('Cleanup suggestions:', suggestions);
    }

    // Could show user-facing cleanup suggestions here
  }

  /**
   * Format bytes to human-readable string
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

/**
 * Global performance monitor instance
 */
export const globalPerformanceMonitor = new PerformanceMonitor({
  memoryWarningThreshold: 75,
  memoryCriticalThreshold: 90,
  enableCleanupSuggestions: true
});

/**
 * React hook for performance monitoring
 */
export function usePerformanceMonitoring(options?: PerformanceMonitorOptions) {
  const [metrics, setMetrics] = React.useState<PerformanceMetrics | null>(null);
  const monitorRef = React.useRef<PerformanceMonitor>();

  React.useEffect(() => {
    monitorRef.current = new PerformanceMonitor(options);
    const monitor = monitorRef.current;

    // Start monitoring
    monitor.start();

    // Update metrics periodically
    const updateInterval = setInterval(() => {
      setMetrics(monitor.getCurrentMetrics());
    }, 2000);

    return () => {
      clearInterval(updateInterval);
      monitor.stop();
    };
  }, []);

  return {
    metrics,
    getMemoryUsage: () => monitorRef.current?.getMemoryUsage(),
    getPerformanceSummary: () => monitorRef.current?.getPerformanceSummary(),
    forceGarbageCollection: () => monitorRef.current?.forceGarbageCollection()
  };
}

/**
 * Simple memory usage check
 */
export function checkMemoryUsage(): MemoryUsage {
  const monitor = new PerformanceMonitor();
  return monitor.getMemoryUsage();
}

/**
 * Log current performance status
 */
export function logPerformanceStatus(): void {
  const monitor = new PerformanceMonitor({ enableLogging: true });
  const metrics = monitor.getCurrentMetrics();
  const summary = monitor.getPerformanceSummary();
  
  console.group('Performance Status');
  console.log('Memory Usage:', metrics.memory);
  console.log('Performance Summary:', summary);
  console.groupEnd();
}

// Import React for hooks
import React from 'react';