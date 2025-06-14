/**
 * Tests for the StateManager
 */

import { StateManager } from '../StateManager';
import { TransformationPipeline } from '../TransformationPipeline';
import { StepRegistry } from '../StepRegistry';

describe('StateManager', () => {
  let stateManager: StateManager;
  let pipeline: TransformationPipeline;

  beforeEach(() => {
    const stepRegistry = new StepRegistry();
    pipeline = new TransformationPipeline({
      steps: stepRegistry.getAllSteps(),
      cacheEnabled: true,
      maxCacheSize: 10,
      performanceMonitoring: true,
      errorHandling: 'tolerant',
    });
    
    stateManager = new StateManager(pipeline);
  });

  describe('initialization', () => {
    it('should initialize with default state', () => {
      const state = stateManager.getState();
      
      expect(state.currentStep).toBe(0);
      expect(state.pdfData).toBeNull();
      expect(state.currentPdfFileName).toBe('');
      expect(state.isLoading).toBe(false);
      expect(state.errors).toEqual([]);
      expect(state.warnings).toEqual([]);
    });

    it('should have default settings', () => {
      const state = stateManager.getState();
      
      expect(state.pdfMode).toBeDefined();
      expect(state.pageSettings).toBeDefined();
      expect(state.extractionSettings).toBeDefined();
      expect(state.outputSettings).toBeDefined();
    });
  });

  describe('state updates', () => {
    it('should update current step', () => {
      stateManager.setCurrentStep(2);
      
      expect(stateManager.getState().currentStep).toBe(2);
    });

    it('should update PDF data', () => {
      const mockPdfData = { pages: 5 };
      const fileName = 'test.pdf';
      
      stateManager.setPdfData(mockPdfData, fileName);
      
      const state = stateManager.getState();
      expect(state.pdfData).toBe(mockPdfData);
      expect(state.currentPdfFileName).toBe(fileName);
    });

    it('should update PDF mode and related settings', () => {
      const newMode = 'landscape';
      
      stateManager.setPdfMode(newMode);
      
      const state = stateManager.getState();
      expect(state.pdfMode).toBe(newMode);
      // Should also update related grid and rotation settings
      expect(state.extractionSettings.grid).toBeDefined();
      expect(state.outputSettings.rotation).toBeDefined();
    });

    it('should update multiple fields at once', () => {
      stateManager.updateState({
        currentStep: 1,
        isLoading: true,
        errors: ['Test error']
      });
      
      const state = stateManager.getState();
      expect(state.currentStep).toBe(1);
      expect(state.isLoading).toBe(true);
      expect(state.errors).toEqual(['Test error']);
    });
  });

  describe('navigation', () => {
    it('should navigate to next step', () => {
      stateManager.nextStep();
      expect(stateManager.getState().currentStep).toBe(1);
      
      stateManager.nextStep();
      expect(stateManager.getState().currentStep).toBe(2);
    });

    it('should not go beyond last step', () => {
      stateManager.setCurrentStep(3);
      stateManager.nextStep();
      expect(stateManager.getState().currentStep).toBe(3);
    });

    it('should navigate to previous step', () => {
      stateManager.setCurrentStep(2);
      stateManager.previousStep();
      expect(stateManager.getState().currentStep).toBe(1);
    });

    it('should not go below first step', () => {
      stateManager.setCurrentStep(0);
      stateManager.previousStep();
      expect(stateManager.getState().currentStep).toBe(0);
    });
  });

  describe('settings management', () => {
    it('should load settings from file', () => {
      const mockSettings = {
        pdfMode: 'test-mode',
        pageSettings: { testPage: true },
        extractionSettings: { testExtraction: true },
        outputSettings: { testOutput: true }
      };
      
      stateManager.loadSettings(mockSettings);
      
      const state = stateManager.getState();
      expect(state.pdfMode).toBe(mockSettings.pdfMode);
      expect(state.pageSettings).toEqual(mockSettings.pageSettings);
      expect(state.extractionSettings).toEqual(mockSettings.extractionSettings);
      expect(state.outputSettings).toEqual(mockSettings.outputSettings);
    });

    it('should update individual settings', () => {
      const newPageSettings = { testPage: true };
      stateManager.setPageSettings(newPageSettings);
      
      expect(stateManager.getState().pageSettings).toEqual(newPageSettings);
    });
  });

  describe('error and loading state', () => {
    it('should manage loading state', () => {
      stateManager.setLoading(true);
      expect(stateManager.getState().isLoading).toBe(true);
      
      stateManager.setLoading(false);
      expect(stateManager.getState().isLoading).toBe(false);
    });

    it('should manage errors', () => {
      stateManager.addError('Error 1');
      stateManager.addError('Error 2');
      
      expect(stateManager.getState().errors).toEqual(['Error 1', 'Error 2']);
      
      stateManager.clearErrors();
      expect(stateManager.getState().errors).toEqual([]);
    });

    it('should manage warnings', () => {
      stateManager.addWarning('Warning 1');
      stateManager.addWarning('Warning 2');
      
      expect(stateManager.getState().warnings).toEqual(['Warning 1', 'Warning 2']);
      
      stateManager.clearWarnings();
      expect(stateManager.getState().warnings).toEqual([]);
    });
  });

  describe('event handling', () => {
    it('should emit state change events', () => {
      const listener = jest.fn();
      stateManager.onChange(listener);
      
      stateManager.setCurrentStep(1);
      
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          currentStep: 1
        }),
        expect.any(Array)
      );
    });

    it('should emit field-specific change events', () => {
      const listener = jest.fn();
      stateManager.onFieldChange('currentStep', listener);
      
      stateManager.setCurrentStep(2);
      
      expect(listener).toHaveBeenCalledWith(2, 0);
    });

    it('should not emit events for unchanged values', () => {
      const listener = jest.fn();
      stateManager.onChange(listener);
      
      stateManager.setCurrentStep(0); // Same as current value
      
      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('history and undo', () => {
    it('should track state history', () => {
      expect(stateManager.canUndo()).toBe(false);
      
      stateManager.setCurrentStep(1);
      expect(stateManager.canUndo()).toBe(true);
    });

    it('should undo state changes', () => {
      stateManager.setCurrentStep(1);
      stateManager.setCurrentStep(2);
      
      expect(stateManager.getState().currentStep).toBe(2);
      
      const undid = stateManager.undo();
      expect(undid).toBe(true);
      expect(stateManager.getState().currentStep).toBe(1);
    });

    it('should not undo when no history available', () => {
      const undid = stateManager.undo();
      expect(undid).toBe(false);
    });
  });

  describe('pipeline integration', () => {
    it('should sync with pipeline state', () => {
      const state = stateManager.getState();
      expect(state.pipeline).toBeDefined();
      expect(state.pipeline).toEqual(pipeline.getState());
    });

    it('should handle pipeline errors', () => {
      // Simulate a pipeline error event
      const errorEvent = {
        type: 'step-failed' as const,
        stepId: 'test-step',
        error: new Error('Test error'),
        timestamp: new Date()
      };
      
      // Access the pipeline's event emitter directly for testing
      (pipeline as any).eventEmitter.emit(errorEvent);
      
      const state = stateManager.getState();
      expect(state.errors).toContain('Pipeline error: Test error');
    });
  });
});
