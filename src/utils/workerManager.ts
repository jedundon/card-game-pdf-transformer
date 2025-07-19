/**
 * @fileoverview Web Worker management utilities
 * 
 * This module provides a centralized way to manage and coordinate
 * Web Workers for background processing tasks. It handles worker
 * lifecycle, task queuing, and error handling.
 * 
 * **Key Features:**
 * - Worker lifecycle management
 * - Task queuing and load balancing
 * - Error handling and retries
 * - Progress tracking
 * - Automatic worker cleanup
 * 
 * @author Card Game PDF Transformer
 */

interface WorkerTask<T = any, R = any> {
  id: string;
  type: string;
  data: T;
  resolve: (result: R) => void;
  reject: (error: Error) => void;
  onProgress?: (progress: number) => void;
  timeout?: number;
  retryCount?: number;
  maxRetries?: number;
}

interface WorkerPoolOptions {
  /** Maximum number of workers (default: navigator.hardwareConcurrency || 4) */
  maxWorkers?: number;
  /** Worker idle timeout in ms (default: 30000) */
  idleTimeout?: number;
  /** Default task timeout in ms (default: 60000) */
  defaultTimeout?: number;
  /** Maximum retries for failed tasks (default: 2) */
  maxRetries?: number;
  /** Enable logging (default: false) */
  enableLogging?: boolean;
}

interface WorkerInstance {
  worker: Worker;
  busy: boolean;
  lastUsed: number;
  currentTask?: WorkerTask;
}

/**
 * Worker pool manager class
 * 
 * Manages a pool of Web Workers for background processing tasks.
 * Provides load balancing, error handling, and automatic cleanup.
 * 
 * @example
 * ```typescript
 * const workerPool = new WorkerPool('/workers/thumbnailWorker.js', {
 *   maxWorkers: 4,
 *   defaultTimeout: 30000
 * });
 * 
 * const result = await workerPool.execute('generate-thumbnail', {
 *   pageNumber: 1,
 *   maxWidth: 480
 * });
 * ```
 */
export class WorkerPool<TaskData = any, TaskResult = any> {
  private workers: WorkerInstance[] = [];
  private taskQueue: WorkerTask<TaskData, TaskResult>[] = [];
  private readonly workerScript: string;
  private readonly options: Required<WorkerPoolOptions>;
  private isDestroyed = false;
  private cleanupTimer?: NodeJS.Timeout;

  constructor(workerScript: string, options: WorkerPoolOptions = {}) {
    this.workerScript = workerScript;
    this.options = {
      maxWorkers: options.maxWorkers ?? navigator.hardwareConcurrency ?? 4,
      idleTimeout: options.idleTimeout ?? 30000,
      defaultTimeout: options.defaultTimeout ?? 60000,
      maxRetries: options.maxRetries ?? 2,
      enableLogging: options.enableLogging ?? false
    };

    // Start cleanup timer
    this.startCleanupTimer();

    if (this.options.enableLogging) {
      console.log(`WorkerPool initialized for ${workerScript} with ${this.options.maxWorkers} max workers`);
    }
  }

  /**
   * Execute a task using the worker pool
   * 
   * @param taskType - Type of task to execute
   * @param data - Task data
   * @param options - Task options
   * @returns Promise that resolves with task result
   */
  async execute(
    taskType: string,
    data: TaskData,
    options: {
      onProgress?: (progress: number) => void;
      timeout?: number;
      maxRetries?: number;
    } = {}
  ): Promise<TaskResult> {
    if (this.isDestroyed) {
      throw new Error('WorkerPool has been destroyed');
    }

    return new Promise<TaskResult>((resolve, reject) => {
      const task: WorkerTask<TaskData, TaskResult> = {
        id: this.generateTaskId(),
        type: taskType,
        data,
        resolve,
        reject,
        onProgress: options.onProgress,
        timeout: options.timeout ?? this.options.defaultTimeout,
        retryCount: 0,
        maxRetries: options.maxRetries ?? this.options.maxRetries
      };

      this.queueTask(task);
    });
  }

  /**
   * Get worker pool statistics
   */
  getStats() {
    return {
      totalWorkers: this.workers.length,
      busyWorkers: this.workers.filter(w => w.busy).length,
      idleWorkers: this.workers.filter(w => !w.busy).length,
      queuedTasks: this.taskQueue.length,
      maxWorkers: this.options.maxWorkers
    };
  }

  /**
   * Destroy the worker pool and cleanup resources
   */
  destroy(): void {
    if (this.isDestroyed) {
      return;
    }

    this.isDestroyed = true;

    // Clear cleanup timer
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }

    // Terminate all workers
    this.workers.forEach(instance => {
      instance.worker.terminate();
    });
    this.workers.length = 0;

    // Reject pending tasks
    this.taskQueue.forEach(task => {
      task.reject(new Error('WorkerPool destroyed'));
    });
    this.taskQueue.length = 0;

    if (this.options.enableLogging) {
      console.log('WorkerPool destroyed');
    }
  }

  /**
   * Queue a task for execution
   */
  private queueTask(task: WorkerTask<TaskData, TaskResult>): void {
    this.taskQueue.push(task);
    this.processQueue();
  }

  /**
   * Process the task queue
   */
  private async processQueue(): Promise<void> {
    if (this.taskQueue.length === 0) {
      return;
    }

    // Find available worker or create new one
    let workerInstance = this.findAvailableWorker();
    
    if (!workerInstance && this.workers.length < this.options.maxWorkers) {
      workerInstance = await this.createWorker();
    }

    if (!workerInstance) {
      // All workers busy, task will wait in queue
      return;
    }

    // Get next task
    const task = this.taskQueue.shift();
    if (!task) {
      return;
    }

    // Execute task
    this.executeTask(workerInstance, task);

    // Continue processing queue
    this.processQueue();
  }

  /**
   * Find an available worker
   */
  private findAvailableWorker(): WorkerInstance | null {
    return this.workers.find(instance => !instance.busy) || null;
  }

  /**
   * Create a new worker instance
   */
  private async createWorker(): Promise<WorkerInstance> {
    const worker = new Worker(this.workerScript, { type: 'module' });
    
    const instance: WorkerInstance = {
      worker,
      busy: false,
      lastUsed: Date.now()
    };

    // Wait for worker to be ready
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Worker initialization timeout'));
      }, 5000);

      const onMessage = (event: MessageEvent) => {
        if (event.data?.id === 'worker-ready') {
          clearTimeout(timeout);
          worker.removeEventListener('message', onMessage);
          resolve();
        }
      };

      worker.addEventListener('message', onMessage);

      worker.addEventListener('error', (error) => {
        clearTimeout(timeout);
        worker.removeEventListener('message', onMessage);
        reject(error);
      });
    });

    this.workers.push(instance);

    if (this.options.enableLogging) {
      console.log(`Created new worker (${this.workers.length}/${this.options.maxWorkers})`);
    }

    return instance;
  }

  /**
   * Execute a task on a worker
   */
  private async executeTask(
    workerInstance: WorkerInstance,
    task: WorkerTask<TaskData, TaskResult>
  ): Promise<void> {
    workerInstance.busy = true;
    workerInstance.currentTask = task;
    workerInstance.lastUsed = Date.now();

    const { worker } = workerInstance;
    let timeoutHandle: NodeJS.Timeout | undefined;

    // Set up timeout
    if (task.timeout && task.timeout > 0) {
      timeoutHandle = setTimeout(() => {
        this.handleTaskTimeout(workerInstance, task);
      }, task.timeout);
    }

    // Set up message handler
    const messageHandler = (event: MessageEvent) => {
      const response = event.data;
      
      if (response.id !== task.id) {
        return; // Not for this task
      }

      if (response.progress !== undefined && task.onProgress) {
        task.onProgress(response.progress);
      }

      if (response.progress === 100 || response.success !== undefined) {
        // Task completed
        worker.removeEventListener('message', messageHandler);
        worker.removeEventListener('error', errorHandler);
        
        if (timeoutHandle) {
          clearTimeout(timeoutHandle);
        }

        this.completeTask(workerInstance, task, response);
      }
    };

    // Set up error handler
    const errorHandler = (error: ErrorEvent) => {
      worker.removeEventListener('message', messageHandler);
      worker.removeEventListener('error', errorHandler);
      
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }

      this.handleTaskError(workerInstance, task, new Error(error.message));
    };

    worker.addEventListener('message', messageHandler);
    worker.addEventListener('error', errorHandler);

    // Send task to worker
    try {
      worker.postMessage({
        id: task.id,
        type: task.type,
        ...task.data
      });
    } catch (error) {
      worker.removeEventListener('message', messageHandler);
      worker.removeEventListener('error', errorHandler);
      
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }

      this.handleTaskError(workerInstance, task, error as Error);
    }
  }

  /**
   * Handle task completion
   */
  private completeTask(
    workerInstance: WorkerInstance,
    task: WorkerTask<TaskData, TaskResult>,
    response: any
  ): void {
    workerInstance.busy = false;
    workerInstance.currentTask = undefined;

    if (response.success) {
      task.resolve(response);
    } else {
      this.handleTaskError(workerInstance, task, new Error(response.error || 'Task failed'));
    }

    // Process next task in queue
    this.processQueue();
  }

  /**
   * Handle task error
   */
  private handleTaskError(
    workerInstance: WorkerInstance,
    task: WorkerTask<TaskData, TaskResult>,
    error: Error
  ): void {
    workerInstance.busy = false;
    workerInstance.currentTask = undefined;

    task.retryCount = (task.retryCount || 0) + 1;

    if (task.retryCount <= (task.maxRetries || 0)) {
      // Retry task
      if (this.options.enableLogging) {
        console.log(`Retrying task ${task.id} (attempt ${task.retryCount}/${task.maxRetries})`);
      }
      
      this.queueTask(task);
    } else {
      // Max retries exceeded
      task.reject(error);
    }

    // Process next task in queue
    this.processQueue();
  }

  /**
   * Handle task timeout
   */
  private handleTaskTimeout(
    workerInstance: WorkerInstance,
    task: WorkerTask<TaskData, TaskResult>
  ): void {
    if (this.options.enableLogging) {
      console.log(`Task ${task.id} timed out`);
    }

    // Terminate and recreate worker
    workerInstance.worker.terminate();
    const index = this.workers.indexOf(workerInstance);
    if (index !== -1) {
      this.workers.splice(index, 1);
    }

    this.handleTaskError(workerInstance, task, new Error('Task timeout'));
  }

  /**
   * Start cleanup timer for idle workers
   */
  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanupIdleWorkers();
    }, this.options.idleTimeout / 2);
  }

  /**
   * Cleanup idle workers
   */
  private cleanupIdleWorkers(): void {
    const now = Date.now();
    const toRemove: WorkerInstance[] = [];

    for (const instance of this.workers) {
      if (!instance.busy && (now - instance.lastUsed) > this.options.idleTimeout) {
        toRemove.push(instance);
      }
    }

    // Keep at least one worker alive
    if (toRemove.length >= this.workers.length) {
      toRemove.pop();
    }

    for (const instance of toRemove) {
      instance.worker.terminate();
      const index = this.workers.indexOf(instance);
      if (index !== -1) {
        this.workers.splice(index, 1);
      }

      if (this.options.enableLogging) {
        console.log(`Cleaned up idle worker (${this.workers.length} remaining)`);
      }
    }
  }

  /**
   * Generate unique task ID
   */
  private generateTaskId(): string {
    return `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * Global worker pools for common operations
 */
export const thumbnailWorkerPool = new WorkerPool('/workers/thumbnailWorker.js', {
  maxWorkers: 2,
  defaultTimeout: 30000,
  enableLogging: process.env.NODE_ENV === 'development'
});

export const imageProcessingWorkerPool = new WorkerPool('/workers/imageProcessingWorker.js', {
  maxWorkers: Math.max(2, (navigator.hardwareConcurrency || 4) - 2),
  defaultTimeout: 60000,
  enableLogging: process.env.NODE_ENV === 'development'
});

/**
 * Cleanup all worker pools
 */
export function cleanupWorkerPools(): void {
  thumbnailWorkerPool.destroy();
  imageProcessingWorkerPool.destroy();
}

// Cleanup on page unload
window.addEventListener('beforeunload', cleanupWorkerPools);