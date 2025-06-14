/**
 * React hooks for integrating with the centralized StateManager
 */

import { useEffect, useState, useCallback, useMemo } from 'react';
import { StateManager, AppState } from './StateManager';

// Global state manager instance (will be initialized when needed)
let globalStateManager: StateManager | null = null;

/**
 * Initialize the global state manager with a pipeline
 */
export function initializeStateManager(stateManager: StateManager): void {
  globalStateManager = stateManager;
}

/**
 * Get the global state manager instance
 */
export function getStateManager(): StateManager {
  if (!globalStateManager) {
    throw new Error('StateManager not initialized. Call initializeStateManager first.');
  }
  return globalStateManager;
}

/**
 * Hook to use the entire app state
 */
export function useAppState(): {
  state: AppState;
  updateState: (updates: Partial<AppState>) => void;
  canUndo: boolean;
  undo: () => boolean;
} {
  const stateManager = getStateManager();
  const [state, setState] = useState<AppState>(stateManager.getState());

  useEffect(() => {    const unsubscribe = stateManager.onChange((appState) => {
      setState(appState);
    });

    return unsubscribe;
  }, [stateManager]);

  const updateState = useCallback((updates: Partial<AppState>) => {
    stateManager.updateState(updates);
  }, [stateManager]);

  const canUndo = useMemo(() => stateManager.canUndo(), [stateManager, state]);

  const undo = useCallback(() => {
    return stateManager.undo();
  }, [stateManager]);

  return {
    state,
    updateState,
    canUndo,
    undo
  };
}

/**
 * Hook to subscribe to a specific field in the app state
 */
export function useAppStateField<K extends keyof AppState>(
  fieldName: K
): [AppState[K], (value: AppState[K]) => void] {
  const stateManager = getStateManager();
  const [value, setValue] = useState<AppState[K]>(stateManager.getState()[fieldName]);

  useEffect(() => {
    const unsubscribe = stateManager.onFieldChange(fieldName, (newValue) => {
      setValue(newValue);
    });

    return unsubscribe;
  }, [stateManager, fieldName]);

  const setFieldValue = useCallback((newValue: AppState[K]) => {
    stateManager.updateState({ [fieldName]: newValue } as Partial<AppState>);
  }, [stateManager, fieldName]);

  return [value, setFieldValue];
}

/**
 * Hook for navigation state
 */
export function useNavigation() {
  const stateManager = getStateManager();
  const [currentStep, setCurrentStep] = useAppStateField('currentStep');

  const nextStep = useCallback(() => {
    stateManager.nextStep();
  }, [stateManager]);

  const previousStep = useCallback(() => {
    stateManager.previousStep();
  }, [stateManager]);

  const goToStep = useCallback((step: number) => {
    stateManager.setCurrentStep(step);
  }, [stateManager]);

  return {
    currentStep,
    setCurrentStep,
    nextStep,
    previousStep,
    goToStep
  };
}

/**
 * Hook for PDF data management
 */
export function usePdfData() {
  const stateManager = getStateManager();
  const [pdfData] = useAppStateField('pdfData');
  const [currentPdfFileName] = useAppStateField('currentPdfFileName');

  const setPdfData = useCallback((data: any, fileName: string) => {
    stateManager.setPdfData(data, fileName);
  }, [stateManager]);

  return {
    pdfData,
    currentPdfFileName,
    setPdfData
  };
}

/**
 * Hook for settings management
 */
export function useSettings() {
  const stateManager = getStateManager();
  const [pdfMode] = useAppStateField('pdfMode');
  const [pageSettings] = useAppStateField('pageSettings');
  const [extractionSettings] = useAppStateField('extractionSettings');
  const [outputSettings] = useAppStateField('outputSettings');
  const [cardDimensions] = useAppStateField('cardDimensions');

  const setPdfMode = useCallback((mode: any) => {
    stateManager.setPdfMode(mode);
  }, [stateManager]);

  const setPageSettings = useCallback((settings: any) => {
    stateManager.setPageSettings(settings);
  }, [stateManager]);

  const setExtractionSettings = useCallback((settings: any) => {
    stateManager.setExtractionSettings(settings);
  }, [stateManager]);

  const setOutputSettings = useCallback((settings: any) => {
    stateManager.setOutputSettings(settings);
  }, [stateManager]);

  const setCardDimensions = useCallback((dimensions: any) => {
    stateManager.setCardDimensions(dimensions);
  }, [stateManager]);

  const loadSettings = useCallback((settings: any) => {
    stateManager.loadSettings(settings);
  }, [stateManager]);

  return {
    pdfMode,
    pageSettings,
    extractionSettings,
    outputSettings,
    cardDimensions,
    setPdfMode,
    setPageSettings,
    setExtractionSettings,
    setOutputSettings,
    setCardDimensions,
    loadSettings
  };
}

/**
 * Hook for loading and error states
 */
export function useAppStatus() {
  const stateManager = getStateManager();
  const [isLoading] = useAppStateField('isLoading');
  const [errors] = useAppStateField('errors');
  const [warnings] = useAppStateField('warnings');

  const setLoading = useCallback((loading: boolean) => {
    stateManager.setLoading(loading);
  }, [stateManager]);

  const addError = useCallback((error: string) => {
    stateManager.addError(error);
  }, [stateManager]);

  const clearErrors = useCallback(() => {
    stateManager.clearErrors();
  }, [stateManager]);

  const addWarning = useCallback((warning: string) => {
    stateManager.addWarning(warning);
  }, [stateManager]);

  const clearWarnings = useCallback(() => {
    stateManager.clearWarnings();
  }, [stateManager]);

  return {
    isLoading,
    errors,
    warnings,
    setLoading,
    addError,
    clearErrors,
    addWarning,
    clearWarnings
  };
}

/**
 * Hook to get pipeline state directly
 */
export function usePipelineState() {
  const [pipelineState] = useAppStateField('pipeline');
  return pipelineState;
}

/**
 * Hook for transformation operations
 */
export function useTransformations() {
  const stateManager = getStateManager();
  const { pdfData } = usePdfData();
  const { pageSettings, extractionSettings, pdfMode } = useSettings();

  const extractCardImage = useCallback(async (cardIndex: number): Promise<string | null> => {
    try {
      stateManager.setLoading(true);
      
      // Use the cardUtils function which is the centralized utility
      const { extractCardImage: extractCardImageUtil, getActivePages } = await import('../utils/cardUtils');
      const activePages = getActivePages(pageSettings);
      const result = await extractCardImageUtil(cardIndex, pdfData, pdfMode, activePages, pageSettings, extractionSettings);
      
      return result;
    } catch (error) {
      stateManager.addError(`Failed to extract card: ${error}`);
      return null;
    } finally {
      stateManager.setLoading(false);
    }
  }, [stateManager, pdfData, pageSettings, extractionSettings, pdfMode]);

  const renderPdfPage = useCallback(async (pageIndex: number, canvas: HTMLCanvasElement, zoom: number = 1.0): Promise<any | null> => {
    try {
      if (!pdfData || !canvas) return null;
      
      stateManager.setLoading(true);
      const { getActualPageNumber } = await import('../utils/cardUtils');
      
      const actualPageNumber = getActualPageNumber(pageIndex, pageSettings);
      const page = await pdfData.getPage(actualPageNumber);
      
      const context = canvas.getContext('2d');
      if (!context) return null;

      // Calculate base scale to fit the preview area nicely
      const baseViewport = page.getViewport({ scale: 1.0 });
      const maxWidth = 450;
      const maxHeight = 600;
      
      const scaleX = maxWidth / baseViewport.width;
      const scaleY = maxHeight / baseViewport.height;
      const baseScale = Math.min(scaleX, scaleY, 2.0);

      // Apply zoom-aware DPI scaling for crisp rendering at high zoom levels
      const dpiMultiplier = zoom >= 3.0 ? Math.min(zoom, 5.0) : 1.0;
      const renderScale = baseScale * dpiMultiplier;
      
      const viewport = page.getViewport({ scale: renderScale });
      
      const canvasWidth = Math.max(200, viewport.width);
      const canvasHeight = Math.max(250, viewport.height);
      
      canvas.width = canvasWidth;
      canvas.height = canvasHeight;
      
      // Apply CSS scaling to counteract DPI scaling
      const cssScale = baseScale * zoom;
      canvas.style.width = `${viewport.width / dpiMultiplier}px`;
      canvas.style.height = `${viewport.height / dpiMultiplier}px`;
      
      context.clearRect(0, 0, canvasWidth, canvasHeight);
      
      const renderContext = {
        canvasContext: context,
        viewport: viewport,
        enableWebGL: false
      };
      
      const renderTask = page.render(renderContext);
      await renderTask.promise;
      
      return {
        width: canvasWidth,
        height: canvasHeight,
        previewScale: cssScale,
        renderScale: renderScale,
        viewport: viewport
      };
    } catch (error) {
      stateManager.addError(`Failed to render page: ${error}`);
      return null;
    } finally {
      stateManager.setLoading(false);
    }
  }, [stateManager, pdfData, pageSettings]);

  return {
    extractCardImage,
    renderPdfPage
  };
}
