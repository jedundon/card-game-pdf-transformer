/**
 * @fileoverview Progress management utilities
 * 
 * This module provides centralized progress tracking and management
 * for long-running operations. It supports hierarchical progress
 * tracking, cancellation, and time estimation.
 * 
 * **Key Features:**
 * - Hierarchical progress tracking
 * - Operation cancellation
 * - Time estimation and ETA calculation
 * - Progress event system
 * - Automatic cleanup
 * 
 * @author Card Game PDF Transformer
 */

interface ProgressOperation {
  id: string;
  label: string;
  status: 'idle' | 'running' | 'completed' | 'error' | 'cancelled';
  progress: number;
  startTime?: number;
  endTime?: number;
  estimatedDuration?: number;
  parentId?: string;
  children?: string[];
  metadata?: Record<string, any>;
}

interface ProgressEvent {
  operationId: string;
  type: 'started' | 'progress' | 'completed' | 'error' | 'cancelled';
  progress: number;
  status: ProgressOperation['status'];
  message?: string;
  error?: string;
  eta?: number;
}

type ProgressListener = (event: ProgressEvent) => void;

/**
 * Progress manager class
 * 
 * Manages progress tracking for multiple concurrent operations with
 * support for hierarchical progress, cancellation, and time estimation.
 * 
 * @example
 * ```typescript
 * const progressManager = new ProgressManager();
 * 
 * const operationId = progressManager.createOperation('file-processing', 'Processing Files');
 * progressManager.startOperation(operationId);
 * 
 * progressManager.updateProgress(operationId, 50, 'Halfway done');
 * progressManager.completeOperation(operationId);
 * ```
 */
export class ProgressManager {
  private operations = new Map<string, ProgressOperation>();
  private listeners = new Set<ProgressListener>();
  private cancelCallbacks = new Map<string, () => void>();

  /**
   * Create a new progress operation
   * 
   * @param id - Unique operation identifier
   * @param label - Human-readable operation label
   * @param parentId - Optional parent operation ID for hierarchical tracking
   * @param estimatedDuration - Estimated duration in milliseconds
   * @returns Operation ID
   */
  createOperation(
    id: string,
    label: string,
    parentId?: string,
    estimatedDuration?: number
  ): string {
    if (this.operations.has(id)) {
      throw new Error(`Operation with ID '${id}' already exists`);
    }

    const operation: ProgressOperation = {
      id,
      label,
      status: 'idle',
      progress: 0,
      parentId,
      estimatedDuration,
      children: []
    };

    this.operations.set(id, operation);

    // Add to parent's children if applicable
    if (parentId && this.operations.has(parentId)) {
      const parent = this.operations.get(parentId)!;
      if (!parent.children) {
        parent.children = [];
      }
      parent.children.push(id);
    }

    return id;
  }

  /**
   * Start an operation
   * 
   * @param id - Operation ID
   * @param cancelCallback - Optional cancellation callback
   */
  startOperation(id: string, cancelCallback?: () => void): void {
    const operation = this.operations.get(id);
    if (!operation) {
      throw new Error(`Operation '${id}' not found`);
    }

    operation.status = 'running';
    operation.startTime = Date.now();
    operation.progress = 0;

    if (cancelCallback) {
      this.cancelCallbacks.set(id, cancelCallback);
    }

    this.emitEvent({
      operationId: id,
      type: 'started',
      progress: 0,
      status: 'running'
    });
  }

  /**
   * Update operation progress
   * 
   * @param id - Operation ID
   * @param progress - Progress percentage (0-100)
   * @param message - Optional status message
   */
  updateProgress(id: string, progress: number, message?: string): void {
    const operation = this.operations.get(id);
    if (!operation) {
      throw new Error(`Operation '${id}' not found`);
    }

    if (operation.status !== 'running') {
      return; // Ignore updates for non-running operations
    }

    operation.progress = Math.max(0, Math.min(100, progress));

    // Calculate ETA if we have enough data
    let eta: number | undefined;
    if (operation.startTime && operation.progress > 0) {
      const elapsed = Date.now() - operation.startTime;
      const estimatedTotal = (elapsed / operation.progress) * 100;
      eta = estimatedTotal - elapsed;
    }

    this.emitEvent({
      operationId: id,
      type: 'progress',
      progress: operation.progress,
      status: 'running',
      message,
      eta
    });

    // Update parent progress if applicable
    if (operation.parentId) {
      this.updateParentProgress(operation.parentId);
    }
  }

  /**
   * Complete an operation successfully
   * 
   * @param id - Operation ID
   * @param message - Optional completion message
   */
  completeOperation(id: string, message?: string): void {
    const operation = this.operations.get(id);
    if (!operation) {
      throw new Error(`Operation '${id}' not found`);
    }

    operation.status = 'completed';
    operation.progress = 100;
    operation.endTime = Date.now();

    this.cancelCallbacks.delete(id);

    this.emitEvent({
      operationId: id,
      type: 'completed',
      progress: 100,
      status: 'completed',
      message
    });

    // Update parent progress if applicable
    if (operation.parentId) {
      this.updateParentProgress(operation.parentId);
    }
  }

  /**
   * Mark an operation as failed
   * 
   * @param id - Operation ID
   * @param error - Error message
   */
  errorOperation(id: string, error: string): void {
    const operation = this.operations.get(id);
    if (!operation) {
      throw new Error(`Operation '${id}' not found`);
    }

    operation.status = 'error';
    operation.endTime = Date.now();

    this.cancelCallbacks.delete(id);

    this.emitEvent({
      operationId: id,
      type: 'error',
      progress: operation.progress,
      status: 'error',
      error
    });

    // Update parent progress if applicable
    if (operation.parentId) {
      this.updateParentProgress(operation.parentId);
    }
  }

  /**
   * Cancel an operation
   * 
   * @param id - Operation ID
   * @param message - Optional cancellation message
   */
  cancelOperation(id: string, message?: string): void {
    const operation = this.operations.get(id);
    if (!operation) {
      throw new Error(`Operation '${id}' not found`);
    }

    // Cancel all child operations first
    if (operation.children) {
      for (const childId of operation.children) {
        this.cancelOperation(childId, 'Cancelled by parent operation');
      }
    }

    operation.status = 'cancelled';
    operation.endTime = Date.now();

    // Execute cancel callback if available
    const cancelCallback = this.cancelCallbacks.get(id);
    if (cancelCallback) {
      try {
        cancelCallback();
      } catch (error) {
        console.warn(`Error executing cancel callback for operation '${id}':`, error);
      }
    }

    this.cancelCallbacks.delete(id);

    this.emitEvent({
      operationId: id,
      type: 'cancelled',
      progress: operation.progress,
      status: 'cancelled',
      message
    });

    // Update parent progress if applicable
    if (operation.parentId) {
      this.updateParentProgress(operation.parentId);
    }
  }

  /**
   * Get operation details
   * 
   * @param id - Operation ID
   * @returns Operation details or undefined if not found
   */
  getOperation(id: string): ProgressOperation | undefined {
    return this.operations.get(id);
  }

  /**
   * Get all operations
   * 
   * @returns Array of all operations
   */
  getAllOperations(): ProgressOperation[] {
    return Array.from(this.operations.values());
  }

  /**
   * Get operations by status
   * 
   * @param status - Operation status to filter by
   * @returns Array of operations with the specified status
   */
  getOperationsByStatus(status: ProgressOperation['status']): ProgressOperation[] {
    return Array.from(this.operations.values()).filter(op => op.status === status);
  }

  /**
   * Check if operation can be cancelled
   * 
   * @param id - Operation ID
   * @returns true if operation can be cancelled
   */
  canCancel(id: string): boolean {
    const operation = this.operations.get(id);
    return operation?.status === 'running' && this.cancelCallbacks.has(id);
  }

  /**
   * Get operation duration
   * 
   * @param id - Operation ID
   * @returns Duration in milliseconds, or undefined if not available
   */
  getOperationDuration(id: string): number | undefined {
    const operation = this.operations.get(id);
    if (!operation || !operation.startTime) {
      return undefined;
    }

    const endTime = operation.endTime || Date.now();
    return endTime - operation.startTime;
  }

  /**
   * Remove an operation from tracking
   * 
   * @param id - Operation ID
   */
  removeOperation(id: string): void {
    const operation = this.operations.get(id);
    if (!operation) {
      return;
    }

    // Remove from parent's children
    if (operation.parentId) {
      const parent = this.operations.get(operation.parentId);
      if (parent && parent.children) {
        const index = parent.children.indexOf(id);
        if (index !== -1) {
          parent.children.splice(index, 1);
        }
      }
    }

    // Remove child operations
    if (operation.children) {
      for (const childId of operation.children) {
        this.removeOperation(childId);
      }
    }

    this.operations.delete(id);
    this.cancelCallbacks.delete(id);
  }

  /**
   * Clear all completed and error operations
   */
  cleanup(): void {
    const toRemove: string[] = [];
    
    for (const [id, operation] of this.operations) {
      if (operation.status === 'completed' || operation.status === 'error' || operation.status === 'cancelled') {
        // Only remove if it has no running children
        const hasRunningChildren = operation.children?.some(childId => {
          const child = this.operations.get(childId);
          return child?.status === 'running';
        });

        if (!hasRunningChildren) {
          toRemove.push(id);
        }
      }
    }

    for (const id of toRemove) {
      this.removeOperation(id);
    }
  }

  /**
   * Add progress event listener
   * 
   * @param listener - Progress event listener function
   */
  addListener(listener: ProgressListener): void {
    this.listeners.add(listener);
  }

  /**
   * Remove progress event listener
   * 
   * @param listener - Progress event listener function
   */
  removeListener(listener: ProgressListener): void {
    this.listeners.delete(listener);
  }

  /**
   * Clear all listeners
   */
  clearListeners(): void {
    this.listeners.clear();
  }

  /**
   * Update parent operation progress based on children
   */
  private updateParentProgress(parentId: string): void {
    const parent = this.operations.get(parentId);
    if (!parent || !parent.children || parent.children.length === 0) {
      return;
    }

    let totalProgress = 0;
    let completedCount = 0;
    let errorCount = 0;
    let cancelledCount = 0;

    for (const childId of parent.children) {
      const child = this.operations.get(childId);
      if (!child) continue;

      totalProgress += child.progress;
      
      switch (child.status) {
        case 'completed':
          completedCount++;
          break;
        case 'error':
          errorCount++;
          break;
        case 'cancelled':
          cancelledCount++;
          break;
      }
    }

    const avgProgress = totalProgress / parent.children.length;
    const totalChildren = parent.children.length;
    const finishedChildren = completedCount + errorCount + cancelledCount;

    // Update parent progress
    parent.progress = avgProgress;

    // Update parent status based on children
    if (finishedChildren === totalChildren) {
      if (errorCount > 0) {
        parent.status = 'error';
      } else if (cancelledCount > 0) {
        parent.status = 'cancelled';
      } else {
        parent.status = 'completed';
      }
      parent.endTime = Date.now();
    } else if (parent.status === 'idle') {
      // Start parent if any child is running
      const hasRunningChild = parent.children.some(childId => {
        const child = this.operations.get(childId);
        return child?.status === 'running';
      });
      
      if (hasRunningChild) {
        parent.status = 'running';
        parent.startTime = Date.now();
      }
    }

    // Emit progress event for parent
    this.emitEvent({
      operationId: parentId,
      type: 'progress',
      progress: parent.progress,
      status: parent.status,
      message: `${completedCount}/${totalChildren} completed`
    });

    // Continue up the hierarchy
    if (parent.parentId) {
      this.updateParentProgress(parent.parentId);
    }
  }

  /**
   * Emit progress event to all listeners
   */
  private emitEvent(event: ProgressEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (error) {
        console.warn('Error in progress event listener:', error);
      }
    }
  }
}

/**
 * Global progress manager instance
 */
export const globalProgressManager = new ProgressManager();

/**
 * React hook for progress tracking
 */
export function useProgressManager() {
  const [operations, setOperations] = React.useState<ProgressOperation[]>([]);

  React.useEffect(() => {
    const updateOperations = () => {
      setOperations(globalProgressManager.getAllOperations());
    };

    const listener = () => {
      updateOperations();
    };

    globalProgressManager.addListener(listener);
    updateOperations(); // Initial load

    return () => {
      globalProgressManager.removeListener(listener);
    };
  }, []);

  return {
    operations,
    createOperation: globalProgressManager.createOperation.bind(globalProgressManager),
    startOperation: globalProgressManager.startOperation.bind(globalProgressManager),
    updateProgress: globalProgressManager.updateProgress.bind(globalProgressManager),
    completeOperation: globalProgressManager.completeOperation.bind(globalProgressManager),
    errorOperation: globalProgressManager.errorOperation.bind(globalProgressManager),
    cancelOperation: globalProgressManager.cancelOperation.bind(globalProgressManager),
    getOperation: globalProgressManager.getOperation.bind(globalProgressManager),
    canCancel: globalProgressManager.canCancel.bind(globalProgressManager),
    cleanup: globalProgressManager.cleanup.bind(globalProgressManager)
  };
}

/**
 * Simple progress tracking for individual operations
 */
export function createSimpleProgress(
  label: string,
  onProgress?: (progress: number, message?: string) => void,
  onComplete?: () => void,
  onError?: (error: string) => void
) {
  const id = `simple-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  globalProgressManager.createOperation(id, label);
  
  if (onProgress || onComplete || onError) {
    const listener = (event: ProgressEvent) => {
      if (event.operationId !== id) return;
      
      switch (event.type) {
        case 'progress':
          onProgress?.(event.progress, event.message);
          break;
        case 'completed':
          onComplete?.();
          break;
        case 'error':
          onError?.(event.error || 'Unknown error');
          break;
      }
    };
    
    globalProgressManager.addListener(listener);
  }

  return {
    start: (cancelCallback?: () => void) => globalProgressManager.startOperation(id, cancelCallback),
    update: (progress: number, message?: string) => globalProgressManager.updateProgress(id, progress, message),
    complete: (message?: string) => globalProgressManager.completeOperation(id, message),
    error: (error: string) => globalProgressManager.errorOperation(id, error),
    cancel: (message?: string) => globalProgressManager.cancelOperation(id, message),
    remove: () => globalProgressManager.removeOperation(id)
  };
}

// Import React for hooks
import React from 'react';