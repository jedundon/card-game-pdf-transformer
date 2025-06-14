/**
 * Tests for React hooks integration with StateManager
 */

import { renderHook, act } from '@testing-library/react';
import { 
  initializeStateManager, 
  useAppState, 
  useNavigation, 
  usePdfData, 
  useSettings, 
  useAppStatus 
} from '../hooks';
import { StateManager } from '../StateManager';
import { TransformationPipeline } from '../TransformationPipeline';
import { StepRegistry } from '../StepRegistry';

describe('State Management Hooks', () => {
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
    initializeStateManager(stateManager);
  });

  describe('useAppState', () => {
    it('should return current state', () => {
      const { result } = renderHook(() => useAppState());
      
      expect(result.current.state.currentStep).toBe(0);
      expect(result.current.state.pdfData).toBeNull();
    });

    it('should update state', () => {
      const { result } = renderHook(() => useAppState());
      
      act(() => {
        result.current.updateState({ currentStep: 1 });
      });
      
      expect(result.current.state.currentStep).toBe(1);
    });

    it('should provide undo functionality', () => {
      const { result } = renderHook(() => useAppState());
      
      act(() => {
        result.current.updateState({ currentStep: 1 });
      });
      
      expect(result.current.canUndo).toBe(true);
      
      act(() => {
        result.current.undo();
      });
      
      expect(result.current.state.currentStep).toBe(0);
    });
  });

  describe('useNavigation', () => {
    it('should handle navigation', () => {
      const { result } = renderHook(() => useNavigation());
      
      expect(result.current.currentStep).toBe(0);
      
      act(() => {
        result.current.nextStep();
      });
      
      expect(result.current.currentStep).toBe(1);
      
      act(() => {
        result.current.previousStep();
      });
      
      expect(result.current.currentStep).toBe(0);
    });

    it('should go to specific step', () => {
      const { result } = renderHook(() => useNavigation());
      
      act(() => {
        result.current.goToStep(2);
      });
      
      expect(result.current.currentStep).toBe(2);
    });
  });

  describe('usePdfData', () => {
    it('should handle PDF data', () => {
      const { result } = renderHook(() => usePdfData());
      
      expect(result.current.pdfData).toBeNull();
      expect(result.current.currentPdfFileName).toBe('');
      
      const mockPdfData = { pages: 5 };
      const fileName = 'test.pdf';
      
      act(() => {
        result.current.setPdfData(mockPdfData, fileName);
      });
      
      expect(result.current.pdfData).toBe(mockPdfData);
      expect(result.current.currentPdfFileName).toBe(fileName);
    });
  });

  describe('useSettings', () => {
    it('should handle settings', () => {
      const { result } = renderHook(() => useSettings());
      
      expect(result.current.pdfMode).toBeDefined();
      expect(result.current.pageSettings).toBeDefined();
      
      const newMode = 'test-mode';
      
      act(() => {
        result.current.setPdfMode(newMode);
      });
      
      expect(result.current.pdfMode).toBe(newMode);
    });

    it('should load settings from file', () => {
      const { result } = renderHook(() => useSettings());
      
      const mockSettings = {
        pdfMode: 'loaded-mode',
        pageSettings: { loaded: true }
      };
      
      act(() => {
        result.current.loadSettings(mockSettings);
      });
      
      expect(result.current.pdfMode).toBe('loaded-mode');
      expect(result.current.pageSettings).toEqual({ loaded: true });
    });
  });

  describe('useAppStatus', () => {
    it('should handle loading and error states', () => {
      const { result } = renderHook(() => useAppStatus());
      
      expect(result.current.isLoading).toBe(false);
      expect(result.current.errors).toEqual([]);
      expect(result.current.warnings).toEqual([]);
      
      act(() => {
        result.current.setLoading(true);
        result.current.addError('Test error');
        result.current.addWarning('Test warning');
      });
      
      expect(result.current.isLoading).toBe(true);
      expect(result.current.errors).toEqual(['Test error']);
      expect(result.current.warnings).toEqual(['Test warning']);
      
      act(() => {
        result.current.clearErrors();
        result.current.clearWarnings();
      });
      
      expect(result.current.errors).toEqual([]);
      expect(result.current.warnings).toEqual([]);
    });
  });

  describe('state synchronization', () => {
    it('should keep hooks in sync', () => {
      const { result: navigationResult } = renderHook(() => useNavigation());
      const { result: appStateResult } = renderHook(() => useAppState());
      
      act(() => {
        navigationResult.current.nextStep();
      });
      
      expect(appStateResult.current.state.currentStep).toBe(1);
    });
  });
});
