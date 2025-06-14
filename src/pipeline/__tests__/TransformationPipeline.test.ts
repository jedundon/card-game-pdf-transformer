/**
 * Unit tests for TransformationPipeline
 */

import { TransformationPipeline } from '../TransformationPipeline';
import { createMockCardData, createMockPipelineStep } from './setup';
import type { PipelineConfig, TransformationStep } from '../types';

describe('TransformationPipeline', () => {
  let pipeline: TransformationPipeline;
  let mockStep: TransformationStep;
  let config: PipelineConfig;

  beforeEach(() => {
    mockStep = createMockPipelineStep('test-step');
    
    config = {
      steps: [mockStep],
      cacheEnabled: true,
      maxCacheSize: 100,
      performanceMonitoring: true,
      errorHandling: 'strict',
    };

    pipeline = new TransformationPipeline(config);
  });

  describe('initialization', () => {
    it('should initialize with default state', () => {
      const state = pipeline.getState();
      
      expect(state.cards).toEqual([]);
      expect(state.isProcessing).toBe(false);
      expect(state.currentStep).toBe('');
      expect(state.stepResults.size).toBe(0);
      expect(state.settings).toMatchObject({
        inputMode: 'pdf',
        outputFormat: 'individual',
        dpi: 300,
        quality: 0.8,
      });
    });

    it('should initialize with proper metadata', () => {
      const state = pipeline.getState();
      
      expect(state.metadata.startTime).toBeInstanceOf(Date);
      expect(state.metadata.lastModified).toBeInstanceOf(Date);
      expect(state.metadata.stepHistory).toEqual([]);
      expect(state.metadata.performanceMetrics).toEqual({});
    });
  });

  describe('settings management', () => {
    it('should update settings correctly', async () => {
      const newSettings = { dpi: 600, quality: 0.9 };
      
      await pipeline.updateSettings(newSettings);
      
      const state = pipeline.getState();
      expect(state.settings.dpi).toBe(600);
      expect(state.settings.quality).toBe(0.9);
      expect(state.settings.inputMode).toBe('pdf'); // unchanged
    });

    it('should emit settings-updated event', async () => {
      const eventListener = jest.fn();
      pipeline.on('settings-updated', eventListener);
      
      const newSettings = { dpi: 600 };
      await pipeline.updateSettings(newSettings);
      
      expect(eventListener).toHaveBeenCalledWith({
        type: 'settings-updated',
        settings: expect.objectContaining({ dpi: 600 }),
        timestamp: expect.any(Date),
      });
    });

    it('should update lastModified timestamp', async () => {
      const initialTime = pipeline.getState().metadata.lastModified;
      
      // Wait a bit to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 10));
      await pipeline.updateSettings({ dpi: 600 });
      
      const newTime = pipeline.getState().metadata.lastModified;
      expect(newTime.getTime()).toBeGreaterThan(initialTime.getTime());
    });
  });

  describe('step execution', () => {
    beforeEach(() => {
      const mockCardData = [createMockCardData()];
      
      // Mock step implementation
      (mockStep.validate as jest.Mock).mockReturnValue({
        valid: true,
        errors: [],
        warnings: [],
      });
      
      (mockStep.execute as jest.Mock).mockResolvedValue(mockCardData);
    });

    it('should execute step successfully', async () => {
      const inputCards = [createMockCardData()];
      
      const result = await pipeline.executeStep('test-step', inputCards);
      
      expect(result.success).toBe(true);
      expect(result.stepId).toBe('test-step');
      expect(result.errors).toEqual([]);
      expect(mockStep.execute).toHaveBeenCalledWith(
        inputCards,
        expect.any(Object)
      );
    });

    it('should update pipeline state after execution', async () => {
      const inputCards = [createMockCardData()];
      const outputCards = [createMockCardData({ id: 'output-card' })];
      
      (mockStep.execute as jest.Mock).mockResolvedValue(outputCards);
      
      await pipeline.executeStep('test-step', inputCards);
      
      const state = pipeline.getState();
      expect(state.cards).toEqual(outputCards);
      expect(state.stepResults.has('test-step')).toBe(true);
      expect(state.metadata.stepHistory).toContain('test-step');
    });

    it('should emit step events', async () => {
      const startListener = jest.fn();
      const completeListener = jest.fn();
      
      pipeline.on('step-started', startListener);
      pipeline.on('step-completed', completeListener);
      
      await pipeline.executeStep('test-step');
      
      expect(startListener).toHaveBeenCalledWith({
        type: 'step-started',
        stepId: 'test-step',
        timestamp: expect.any(Date),
      });
      
      expect(completeListener).toHaveBeenCalledWith({
        type: 'step-completed',
        stepId: 'test-step',
        result: expect.any(Object),
        timestamp: expect.any(Date),
      });
    });

    it('should prevent concurrent execution', async () => {
      // Start first execution
      const firstExecution = pipeline.executeStep('test-step');
      
      // Try to start second execution while first is running
      await expect(pipeline.executeStep('test-step')).rejects.toThrow(
        'Pipeline is already processing'
      );
      
      // Wait for first to complete
      await firstExecution;
    });

    it('should handle step validation failures', async () => {
      (mockStep.validate as jest.Mock).mockReturnValue({
        valid: false,
        errors: [{ field: 'dpi', message: 'Invalid DPI', code: 'INVALID_DPI' }],
        warnings: [],
      });
      
      await expect(pipeline.executeStep('test-step')).rejects.toThrow(
        'Step validation failed: Invalid DPI'
      );
    });

    it('should handle step execution failures', async () => {
      (mockStep.execute as jest.Mock).mockRejectedValue(new Error('Step failed'));
      
      await expect(pipeline.executeStep('test-step')).rejects.toThrow('Step failed');
    });

    it('should call step hooks', async () => {
      const beforeHook = jest.fn();
      const afterHook = jest.fn();
      
      mockStep.onBeforeExecute = beforeHook;
      mockStep.onAfterExecute = afterHook;
      
      const inputCards = [createMockCardData()];
      await pipeline.executeStep('test-step', inputCards);
      
      expect(beforeHook).toHaveBeenCalledWith(inputCards, expect.any(Object));
      expect(afterHook).toHaveBeenCalledWith(expect.any(Array), expect.any(Object));
    });

    it('should measure performance metrics', async () => {
      await pipeline.executeStep('test-step');
      
      const state = pipeline.getState();
      const metrics = state.metadata.performanceMetrics['test-step'];
      
      expect(metrics).toBeDefined();
      expect(metrics.duration).toBeGreaterThan(0);
      expect(metrics.memoryUsage).toBeGreaterThan(0);
      expect(metrics.cacheHits).toBe(0);
    });
  });

  describe('caching', () => {
    beforeEach(() => {
      const mockCardData = [createMockCardData()];
      
      (mockStep.validate as jest.Mock).mockReturnValue({
        valid: true,
        errors: [],
        warnings: [],
      });
      
      (mockStep.execute as jest.Mock).mockResolvedValue(mockCardData);
      (mockStep.shouldCache as boolean) = true;
      (mockStep.getCacheKey as jest.Mock) = jest.fn().mockReturnValue('test-cache-key');
    });

    it('should cache step results', async () => {
      const inputCards = [createMockCardData()];
      
      // First execution should call step.execute
      await pipeline.executeStep('test-step', inputCards);
      expect(mockStep.execute).toHaveBeenCalledTimes(1);
      
      // Second execution should use cache
      await pipeline.executeStep('test-step', inputCards);
      expect(mockStep.execute).toHaveBeenCalledTimes(1); // Still 1, not called again
    });

    it('should track cache hits in metrics', async () => {
      const inputCards = [createMockCardData()];
      
      // First execution
      await pipeline.executeStep('test-step', inputCards);
      let state = pipeline.getState();
      expect(state.metadata.performanceMetrics['test-step'].cacheHits).toBe(0);
      
      // Second execution (cache hit)
      await pipeline.executeStep('test-step', inputCards);
      state = pipeline.getState();
      expect(state.metadata.performanceMetrics['test-step'].cacheHits).toBe(1);
    });

    it('should clear cache', () => {
      pipeline.clearCache();
      
      const stats = pipeline.getCacheStats();
      expect(stats.size).toBe(0);
    });
  });

  describe('preview generation', () => {
    const mockPreview = {
      imageUrl: 'data:image/png;base64,mock',
      metadata: { width: 300, height: 420, dpi: 300 },
    };

    beforeEach(() => {
      (mockStep.generatePreview as jest.Mock).mockResolvedValue(mockPreview);
    });

    it('should generate preview successfully', async () => {
      const inputCards = [createMockCardData()];
      
      await pipeline.generatePreview('test-step', inputCards);
      
      expect(mockStep.generatePreview).toHaveBeenCalledWith(
        inputCards,
        expect.any(Object)
      );
    });

    it('should emit preview-generated event', async () => {
      const eventListener = jest.fn();
      pipeline.on('preview-generated', eventListener);
      
      await pipeline.generatePreview('test-step');
      
      expect(eventListener).toHaveBeenCalledWith({
        type: 'preview-generated',
        stepId: 'test-step',
        preview: mockPreview,
        timestamp: expect.any(Date),
      });
    });

    it('should handle preview generation failures gracefully', async () => {
      (mockStep.generatePreview as jest.Mock).mockRejectedValue(new Error('Preview failed'));
      
      // Should not throw
      await expect(pipeline.generatePreview('test-step')).resolves.toBeUndefined();
    });
  });

  describe('pipeline reset', () => {
    it('should reset to initial state', async () => {
      // Modify state first
      await pipeline.updateSettings({ dpi: 600 });
      
      pipeline.reset();
      
      const state = pipeline.getState();
      expect(state.cards).toEqual([]);
      expect(state.settings.dpi).toBe(300); // back to default
      expect(state.stepResults.size).toBe(0);
      expect(state.metadata.stepHistory).toEqual([]);
    });

    it('should emit pipeline-reset event', () => {
      const eventListener = jest.fn();
      pipeline.on('pipeline-reset', eventListener);
      
      pipeline.reset();
      
      expect(eventListener).toHaveBeenCalledWith({
        type: 'pipeline-reset',
        timestamp: expect.any(Date),
      });
    });

    it('should clear cache on reset', () => {
      pipeline.reset();
      
      const stats = pipeline.getCacheStats();
      expect(stats.size).toBe(0);
    });
  });

  describe('event system', () => {
    it('should support multiple listeners for same event', () => {
      const listener1 = jest.fn();
      const listener2 = jest.fn();
      
      pipeline.on('pipeline-reset', listener1);
      pipeline.on('pipeline-reset', listener2);
      
      pipeline.reset();
      
      expect(listener1).toHaveBeenCalled();
      expect(listener2).toHaveBeenCalled();
    });

    it('should support unsubscribing from events', () => {
      const listener = jest.fn();
      const unsubscribe = pipeline.on('pipeline-reset', listener);
      
      unsubscribe();
      pipeline.reset();
      
      expect(listener).not.toHaveBeenCalled();
    });

    it('should support global event listeners', () => {
      const globalListener = jest.fn();
      pipeline.onAny(globalListener);
      
      pipeline.reset();
      
      expect(globalListener).toHaveBeenCalledWith({
        type: 'pipeline-reset',
        timestamp: expect.any(Date),
      });
    });
  });
  describe('error handling', () => {
    it('should handle unknown step IDs', async () => {
      await expect(pipeline.executeStep('unknown-step')).rejects.toThrow(
        'Step not found: unknown-step'
      );
    });

    it('should handle tolerant error mode', async () => {
      const tolerantStep = createMockPipelineStep('tolerant-step');
      const tolerantConfig = { 
        ...config, 
        errorHandling: 'tolerant' as const,
        steps: [tolerantStep]
      };
      const tolerantPipeline = new TransformationPipeline(tolerantConfig);
      
      // Set up valid validation before error
      (tolerantStep.validate as jest.Mock).mockReturnValue({
        valid: true,
        errors: [],
        warnings: [],
      });
      
      (tolerantStep.execute as jest.Mock).mockRejectedValue(new Error('Step failed'));
      
      const result = await tolerantPipeline.executeStep('tolerant-step');
      
      expect(result.success).toBe(false);
      expect(result.errors).toContain('Step failed');
    });
  });
});
