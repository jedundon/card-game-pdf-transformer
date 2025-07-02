/**
 * @fileoverview Lazy loading utilities for performance optimization
 * 
 * This module provides intersection observer-based lazy loading functionality
 * for thumbnails and other heavy content. It helps improve performance by
 * only loading content when it becomes visible or is about to become visible.
 * 
 * **Key Features:**
 * - Intersection Observer API for efficient viewport detection
 * - Configurable root margins and thresholds
 * - Automatic cleanup and memory management
 * - Loading state management
 * - Error handling and retry logic
 * 
 * @author Card Game PDF Transformer
 */

/**
 * Lazy loading configuration options
 */
interface LazyLoadingOptions {
  /** Root margin for intersection observer (default: '50px') */
  rootMargin?: string;
  /** Intersection threshold (default: 0.1) */
  threshold?: number;
  /** Maximum number of concurrent loads (default: 3) */
  maxConcurrentLoads?: number;
  /** Retry attempts for failed loads (default: 2) */
  retryAttempts?: number;
  /** Delay between retry attempts in ms (default: 1000) */
  retryDelay?: number;
}

/**
 * Loading state for lazy-loaded items
 */
interface LoadingState {
  /** Current loading status */
  status: 'idle' | 'loading' | 'loaded' | 'error';
  /** Error message if loading failed */
  error?: string;
  /** Number of retry attempts made */
  retryCount: number;
  /** Loaded content (if any) */
  content?: any;
}

/**
 * Lazy loader function signature
 */
type LazyLoader<T> = () => Promise<T>;

/**
 * Lazy loading manager class
 * 
 * Manages lazy loading of content using intersection observer pattern.
 * Provides efficient loading of thumbnails and other heavy content only
 * when they become visible in the viewport.
 * 
 * @example
 * ```typescript
 * const lazyLoader = new LazyLoadingManager({
 *   rootMargin: '100px',
 *   maxConcurrentLoads: 5
 * });
 * 
 * // Register elements for lazy loading
 * lazyLoader.observe(thumbnailElement, async () => {
 *   return await renderPageThumbnail(pdfData, pageNumber);
 * });
 * ```
 */
export class LazyLoadingManager<T = any> {
  private observer: IntersectionObserver;
  private loadingStates = new Map<Element, LoadingState>();
  private loaders = new Map<Element, LazyLoader<T>>();
  private loadingQueue: Element[] = [];
  private currentlyLoading = 0;
  private readonly options: Required<LazyLoadingOptions>;

  constructor(options: LazyLoadingOptions = {}) {
    this.options = {
      rootMargin: options.rootMargin ?? '50px',
      threshold: options.threshold ?? 0.1,
      maxConcurrentLoads: options.maxConcurrentLoads ?? 3,
      retryAttempts: options.retryAttempts ?? 2,
      retryDelay: options.retryDelay ?? 1000
    };

    // Create intersection observer
    this.observer = new IntersectionObserver(
      this.handleIntersection.bind(this),
      {
        rootMargin: this.options.rootMargin,
        threshold: this.options.threshold
      }
    );
  }

  /**
   * Start observing an element for lazy loading
   * 
   * @param element - DOM element to observe
   * @param loader - Function that loads the content
   * @param onLoad - Optional callback when content is loaded
   * @param onError - Optional callback when loading fails
   */
  observe(
    element: Element,
    loader: LazyLoader<T>,
    onLoad?: (content: T) => void,
    onError?: (error: string) => void
  ): void {
    // Initialize loading state
    this.loadingStates.set(element, {
      status: 'idle',
      retryCount: 0
    });

    // Store loader function
    this.loaders.set(element, loader);

    // Store callbacks if provided
    if (onLoad) {
      element.setAttribute('data-lazy-onload', 'true');
      (element as any).__lazyOnLoad = onLoad;
    }
    if (onError) {
      element.setAttribute('data-lazy-onerror', 'true');
      (element as any).__lazyOnError = onError;
    }

    // Start observing
    this.observer.observe(element);
  }

  /**
   * Stop observing an element
   * 
   * @param element - DOM element to stop observing
   */
  unobserve(element: Element): void {
    this.observer.unobserve(element);
    this.loadingStates.delete(element);
    this.loaders.delete(element);
    
    // Remove from loading queue if present
    const queueIndex = this.loadingQueue.indexOf(element);
    if (queueIndex !== -1) {
      this.loadingQueue.splice(queueIndex, 1);
    }

    // Clean up callbacks
    delete (element as any).__lazyOnLoad;
    delete (element as any).__lazyOnError;
  }

  /**
   * Get loading state for an element
   * 
   * @param element - DOM element
   * @returns Loading state or undefined if not observed
   */
  getLoadingState(element: Element): LoadingState | undefined {
    return this.loadingStates.get(element);
  }

  /**
   * Manually trigger loading for an element
   * 
   * @param element - DOM element to load
   * @returns Promise that resolves when loading completes
   */
  async load(element: Element): Promise<T | null> {
    const loader = this.loaders.get(element);
    if (!loader) {
      throw new Error('Element is not being observed');
    }

    return this.executeLoad(element, loader);
  }

  /**
   * Clear all observations and cleanup resources
   */
  destroy(): void {
    this.observer.disconnect();
    this.loadingStates.clear();
    this.loaders.clear();
    this.loadingQueue.length = 0;
    this.currentlyLoading = 0;
  }

  /**
   * Get statistics about lazy loading performance
   */
  getStats() {
    const states = Array.from(this.loadingStates.values());
    
    return {
      totalElements: states.length,
      idle: states.filter(s => s.status === 'idle').length,
      loading: states.filter(s => s.status === 'loading').length,
      loaded: states.filter(s => s.status === 'loaded').length,
      error: states.filter(s => s.status === 'error').length,
      currentlyLoading: this.currentlyLoading,
      queueLength: this.loadingQueue.length
    };
  }

  /**
   * Handle intersection observer callback
   */
  private handleIntersection(entries: IntersectionObserverEntry[]): void {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        const element = entry.target;
        const state = this.loadingStates.get(element);
        
        if (state && state.status === 'idle') {
          // Add to loading queue
          this.addToQueue(element);
        }
      }
    }
  }

  /**
   * Add element to loading queue and process if possible
   */
  private addToQueue(element: Element): void {
    if (!this.loadingQueue.includes(element)) {
      this.loadingQueue.push(element);
      this.processQueue();
    }
  }

  /**
   * Process loading queue within concurrency limits
   */
  private async processQueue(): Promise<void> {
    while (
      this.loadingQueue.length > 0 && 
      this.currentlyLoading < this.options.maxConcurrentLoads
    ) {
      const element = this.loadingQueue.shift();
      if (!element) continue;

      const loader = this.loaders.get(element);
      if (!loader) continue;

      this.executeLoad(element, loader);
    }
  }

  /**
   * Execute loading for a specific element
   */
  private async executeLoad(element: Element, loader: LazyLoader<T>): Promise<T | null> {
    const state = this.loadingStates.get(element);
    if (!state || state.status === 'loading' || state.status === 'loaded') {
      return state?.content ?? null;
    }

    // Update state to loading
    state.status = 'loading';
    this.currentlyLoading++;

    try {
      // Execute the loader function
      const content = await loader();
      
      // Update state on success
      state.status = 'loaded';
      state.content = content;
      state.error = undefined;
      
      // Call success callback if provided
      const onLoad = (element as any).__lazyOnLoad;
      if (onLoad) {
        onLoad(content);
      }

      // Stop observing this element since it's loaded
      this.observer.unobserve(element);
      
      return content;

    } catch (error) {
      // Handle error
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      state.error = errorMessage;
      state.retryCount++;

      // Retry if we haven't exceeded retry attempts
      if (state.retryCount <= this.options.retryAttempts) {
        state.status = 'idle'; // Reset to idle for retry
        
        // Schedule retry with delay
        setTimeout(() => {
          this.addToQueue(element);
        }, this.options.retryDelay);
      } else {
        // Max retries exceeded
        state.status = 'error';
        
        // Call error callback if provided
        const onError = (element as any).__lazyOnError;
        if (onError) {
          onError(errorMessage);
        }
      }

      return null;

    } finally {
      this.currentlyLoading--;
      // Process next items in queue
      this.processQueue();
    }
  }
}

/**
 * React hook for lazy loading
 * 
 * Provides a convenient React hook interface for lazy loading functionality.
 * 
 * @param options - Lazy loading configuration options
 * @returns Lazy loading manager instance and helper functions
 */
export function useLazyLoading<T = any>(options?: LazyLoadingOptions) {
  const managerRef = React.useRef<LazyLoadingManager<T>>();

  // Initialize manager on first use
  if (!managerRef.current) {
    managerRef.current = new LazyLoadingManager<T>(options);
  }

  const manager = managerRef.current;

  // Cleanup on unmount
  React.useEffect(() => {
    return () => {
      manager.destroy();
    };
  }, [manager]);

  return {
    manager,
    observe: manager.observe.bind(manager),
    unobserve: manager.unobserve.bind(manager),
    getLoadingState: manager.getLoadingState.bind(manager),
    load: manager.load.bind(manager),
    getStats: manager.getStats.bind(manager)
  };
}

/**
 * Simple lazy loading wrapper for thumbnails
 * 
 * Provides a simplified interface specifically for thumbnail lazy loading.
 * 
 * @param element - Element to lazy load
 * @param thumbnailLoader - Function that loads the thumbnail
 * @param options - Lazy loading options
 * @returns Promise that resolves when thumbnail is loaded
 */
export function lazyLoadThumbnail(
  element: Element,
  thumbnailLoader: () => Promise<string>,
  options?: LazyLoadingOptions
): Promise<string | null> {
  const manager = new LazyLoadingManager<string>(options);
  
  return new Promise((resolve, reject) => {
    manager.observe(
      element,
      thumbnailLoader,
      (thumbnailUrl) => {
        resolve(thumbnailUrl);
        manager.destroy();
      },
      (error) => {
        reject(new Error(error));
        manager.destroy();
      }
    );
  });
}

// Global lazy loading manager for application-wide use
export const globalLazyLoader = new LazyLoadingManager({
  rootMargin: '100px',
  maxConcurrentLoads: 5,
  retryAttempts: 2
});

// Ensure we import React for the hook
import React from 'react';