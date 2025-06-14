/**
 * Core transformation pipeline for managing state and step execution
 */

import type {
  PipelineState,
  PipelineConfig,
  TransformationStep,
  WorkflowSettings,
  CardData,
  StepResult,
  ProcessingMetadata,
  PipelineEvent,
} from './types';
import { PipelineEventEmitter } from './events';

export class TransformationPipeline {
  private state: PipelineState;
  private config: PipelineConfig;
  private eventEmitter: PipelineEventEmitter;
  private cache: Map<string, any> = new Map();

  constructor(config: PipelineConfig) {
    this.config = config;
    this.eventEmitter = new PipelineEventEmitter();
    
    this.state = {
      cards: [],
      settings: this.getDefaultSettings(),
      metadata: this.createInitialMetadata(),
      stepResults: new Map(),
      currentStep: '',
      isProcessing: false,
    };
  }

  /**
   * Get current pipeline state (read-only)
   */
  getState(): Readonly<PipelineState> {
    return { ...this.state };
  }

  /**
   * Subscribe to pipeline events
   */
  on(eventType: PipelineEvent['type'], listener: (event: PipelineEvent) => void): () => void {
    return this.eventEmitter.on(eventType, listener);
  }

  /**
   * Subscribe to all pipeline events
   */
  onAny(listener: (event: PipelineEvent) => void): () => void {
    return this.eventEmitter.onAny(listener);
  }

  /**
   * Update workflow settings
   */
  async updateSettings(newSettings: Partial<WorkflowSettings>): Promise<void> {
    const oldSettings = this.state.settings;
    this.state.settings = { ...oldSettings, ...newSettings };
    this.state.metadata.lastModified = new Date();

    this.eventEmitter.emit({
      type: 'settings-updated',
      settings: this.state.settings,
      timestamp: new Date(),
    });

    this.emitStateChange();
  }

  /**
   * Execute a specific step
   */
  async executeStep(stepId: string, input?: CardData[]): Promise<StepResult> {
    const step = this.findStep(stepId);
    if (!step) {
      throw new Error(`Step not found: ${stepId}`);
    }

    if (this.state.isProcessing) {
      throw new Error('Pipeline is already processing');
    }

    this.state.isProcessing = true;
    this.state.currentStep = stepId;
    
    const inputData = input || this.state.cards;
    const startTime = performance.now();

    this.eventEmitter.emit({
      type: 'step-started',
      stepId,
      timestamp: new Date(),
    });    try {
      // Check cache first
      let result: CardData[] | undefined;
      let cacheHit = false;

      if (this.config.cacheEnabled && step.shouldCache) {
        const cacheKey = step.getCacheKey?.(inputData, this.state.settings) || 
                        this.generateDefaultCacheKey(stepId, inputData, this.state.settings);
        
        if (this.cache.has(cacheKey)) {
          result = this.cache.get(cacheKey);
          cacheHit = true;
        }
      }

      // Execute step if not cached
      if (!result) {
        // Validate settings before execution
        const validation = step.validate(this.state.settings);
        if (!validation.valid) {
          throw new Error(`Step validation failed: ${validation.errors.map(e => e.message).join(', ')}`);
        }

        // Execute hooks and step
        await step.onBeforeExecute?.(inputData, this.state.settings);
        result = await step.execute(inputData, this.state.settings);
        await step.onAfterExecute?.(result, this.state.settings);

        // Cache result if enabled
        if (this.config.cacheEnabled && step.shouldCache) {
          const cacheKey = step.getCacheKey?.(inputData, this.state.settings) || 
                          this.generateDefaultCacheKey(stepId, inputData, this.state.settings);
          this.cache.set(cacheKey, result);
        }
      }

      const duration = performance.now() - startTime;
      
      const stepResult: StepResult = {
        stepId,
        success: true,
        data: result,
        errors: [],
        warnings: [],
        metadata: {
          duration,
          cardsProcessed: result.length,
          cacheHit,
        },
      };

      // Update state
      this.state.cards = result;
      this.state.stepResults.set(stepId, stepResult);
      this.state.metadata.lastModified = new Date();
      this.state.metadata.stepHistory.push(stepId);
      
      // Update performance metrics
      this.state.metadata.performanceMetrics[stepId] = {
        duration,
        memoryUsage: this.estimateMemoryUsage(result),
        cacheHits: (this.state.metadata.performanceMetrics[stepId]?.cacheHits || 0) + (cacheHit ? 1 : 0),
      };

      this.eventEmitter.emit({
        type: 'step-completed',
        stepId,
        result: stepResult,
        timestamp: new Date(),
      });

      return stepResult;

    } catch (error) {
      const duration = performance.now() - startTime;
      
      const stepResult: StepResult = {
        stepId,
        success: false,
        data: inputData,
        errors: [error instanceof Error ? error.message : String(error)],
        warnings: [],
        metadata: {
          duration,
          cardsProcessed: 0,
          cacheHit: false,
        },
      };

      this.state.stepResults.set(stepId, stepResult);

      this.eventEmitter.emit({
        type: 'step-failed',
        stepId,
        error: error instanceof Error ? error : new Error(String(error)),
        timestamp: new Date(),
      });

      if (this.config.errorHandling === 'strict') {
        throw error;
      }

      return stepResult;

    } finally {
      this.state.isProcessing = false;
      this.state.currentStep = '';
      this.emitStateChange();
    }
  }

  /**
   * Generate preview for a specific step
   */
  async generatePreview(stepId: string, input?: CardData[]): Promise<void> {
    const step = this.findStep(stepId);
    if (!step) {
      throw new Error(`Step not found: ${stepId}`);
    }

    const inputData = input || this.state.cards;
    
    try {
      const preview = await step.generatePreview(inputData, this.state.settings);
      
      // Update step result with preview
      const stepResult = this.state.stepResults.get(stepId);
      if (stepResult) {
        stepResult.preview = preview;
      }

      this.eventEmitter.emit({
        type: 'preview-generated',
        stepId,
        preview,
        timestamp: new Date(),
      });

    } catch (error) {
      console.error(`Failed to generate preview for step ${stepId}:`, error);
    }
  }

  /**
   * Reset pipeline state
   */
  reset(): void {
    this.state = {
      cards: [],
      settings: this.getDefaultSettings(),
      metadata: this.createInitialMetadata(),
      stepResults: new Map(),
      currentStep: '',
      isProcessing: false,
    };

    this.cache.clear();

    this.eventEmitter.emit({
      type: 'pipeline-reset',
      timestamp: new Date(),
    });

    this.emitStateChange();
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      size: this.cache.size,
      maxSize: this.config.maxCacheSize,
      hitRate: this.calculateCacheHitRate(),
    };
  }

  // Private methods

  private findStep(stepId: string): TransformationStep | undefined {
    return this.config.steps.find(step => step.id === stepId);
  }

  private emitStateChange(): void {
    this.eventEmitter.emit({
      type: 'state-changed',
      state: this.getState(),
      timestamp: new Date(),
    });
  }

  private getDefaultSettings(): WorkflowSettings {
    return {
      inputMode: 'pdf',
      outputFormat: 'individual',
      dpi: 300,
      quality: 0.8,
      gridColumns: 3,
      gridRows: 3,
      cardWidth: 63,
      cardHeight: 88,
      bleed: 0,
    };
  }

  private createInitialMetadata(): ProcessingMetadata {
    return {
      startTime: new Date(),
      lastModified: new Date(),
      stepHistory: [],
      performanceMetrics: {},
    };
  }

  private generateDefaultCacheKey(stepId: string, input: CardData[], settings: WorkflowSettings): string {
    const inputHash = this.hashData(input);
    const settingsHash = this.hashData(settings);
    return `${stepId}_${inputHash}_${settingsHash}`;
  }

  private hashData(data: any): string {
    return btoa(JSON.stringify(data)).slice(0, 16);
  }

  private estimateMemoryUsage(data: CardData[]): number {
    // Rough estimation in bytes
    return JSON.stringify(data).length * 2;
  }

  private calculateCacheHitRate(): number {
    const metrics = Object.values(this.state.metadata.performanceMetrics);
    if (metrics.length === 0) return 0;
    
    const totalHits = metrics.reduce((sum, metric) => sum + metric.cacheHits, 0);
    const totalRequests = metrics.length;
    
    return totalRequests > 0 ? totalHits / totalRequests : 0;
  }
}
