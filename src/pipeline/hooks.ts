/**
 * React hooks for integrating with the centralized StateManager
 */

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { StateManager, AppState } from './StateManager';
import { PreviewGenerator, PreviewRequest, PreviewResult, PreviewOptions } from './PreviewGenerator';
import type { CardData, WorkflowSettings } from './types';

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
  const { pageSettings, extractionSettings, pdfMode, outputSettings } = useSettings();

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
  }, [stateManager, pdfData, pageSettings]);  const generateExport = useCallback(async (options: {
    cardType?: 'front' | 'back' | 'both';
    outputSettings?: any;
    onProgress?: (progress: number) => void;
  } = {}): Promise<{
    frontsPdf?: Blob;
    backsPdf?: Blob;
    frontsUrl?: string;
    backsUrl?: string;
  }> => {
    try {
      stateManager.setLoading(true);
      
      // Get the ExportStep from the registry
      const { stepRegistry } = await import('./steps');
      const exportStepInstance = stepRegistry.getStep('export');
      
      if (!exportStepInstance) {
        throw new Error('Export step not found in registry');
      }
      
      // Cast to ExportStep to access specific methods
      const exportStep = exportStepInstance as any; // We know this is ExportStep from registry
        // Build proper WorkflowSettings for the export step
      const workflowSettings = {
        inputMode: 'pdf' as const,
        outputFormat: 'pdf' as const,
        dpi: 300,
        quality: 'high' as const,
        preserveAspectRatio: true,
        
        // Current settings from state
        pdfData,
        pdfMode,
        pageSettings,
        extractionSettings,
        outputSettings: options.outputSettings || outputSettings
      };
      
      // Execute the export step
      await exportStep.execute([], workflowSettings);
      
      // Get the export results
      const exportResults = exportStep.getExportResults();
      const results: { frontsPdf?: Blob; backsPdf?: Blob; frontsUrl?: string; backsUrl?: string; } = {};
      
      if (exportResults) {
        if (options.cardType !== 'back' && exportResults.frontsBlob) {
          results.frontsPdf = exportResults.frontsBlob;
          results.frontsUrl = URL.createObjectURL(exportResults.frontsBlob);
        }
        
        if (options.cardType !== 'front' && exportResults.backsBlob) {
          results.backsPdf = exportResults.backsBlob;
          results.backsUrl = URL.createObjectURL(exportResults.backsBlob);
        }
      }
        return results;
    } catch (error) {
      stateManager.addError(`Export failed: ${error}`);
      throw error;
    } finally {
      stateManager.setLoading(false);
    }
  }, [stateManager, pdfData, pdfMode, pageSettings, extractionSettings, outputSettings]);

  return {
    extractCardImage,
    renderPdfPage,
    generateExport
  };
}

/**
 * Performance-optimized preview hook with debouncing and caching
 */
export function useOptimizedPreview(
  stepId: string,
  input: CardData[],
  settings: WorkflowSettings,
  options: PreviewOptions = {},
  debounceMs: number = 100
): {
  previewData: PreviewResult | null;
  isLoading: boolean;
  error: string | null;
  regeneratePreview: () => void;
  queueBackgroundPreview: (newOptions?: PreviewOptions) => void;
} {
  const [previewData, setPreviewData] = useState<PreviewResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const previewGenerator = useMemo(() => new PreviewGenerator({
    maxCacheSize: 50,
    maxCacheAge: 10 * 60 * 1000, // 10 minutes
    enableBackgroundRender: true
  }), []);
  
  const debounceRef = useRef<NodeJS.Timeout>();
  const lastRequestRef = useRef<string>('');
  const mountedRef = useRef(true);

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      previewGenerator.destroy();
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [previewGenerator]);

  const generatePreview = useCallback(async (
    request: PreviewRequest,
    isBackground: boolean = false
  ) => {
    const requestKey = previewGenerator['generateCacheKey'](request);
    
    // Skip if this is the same request we just processed
    if (requestKey === lastRequestRef.current) {
      return;
    }
    
    lastRequestRef.current = requestKey;

    if (!isBackground) {
      setIsLoading(true);
      setError(null);
    }

    try {
      const result = await previewGenerator.generatePreview(request);
      
      if (!mountedRef.current) return;
      
      if (result.success) {
        setPreviewData(result);
        setError(null);
      } else {
        setError(result.error || 'Preview generation failed');
      }
    } catch (err) {
      if (!mountedRef.current) return;
      setError(err instanceof Error ? err.message : 'Unknown preview error');
    } finally {
      if (!mountedRef.current) return;
      if (!isBackground) {
        setIsLoading(false);
      }
    }
  }, [previewGenerator]);

  // Debounced preview generation
  const debouncedGenerate = useCallback((request: PreviewRequest) => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      generatePreview(request);
    }, debounceMs);
  }, [generatePreview, debounceMs]);
  // Main effect to trigger preview generation
  useEffect(() => {
    const request: PreviewRequest = {
      stepId,
      input,
      settings,
      options,
      priority: 'normal'
    };

    // Use immediate generation for cached previews
    const cacheKey = previewGenerator['generateCacheKey'](request);
    const cached = previewGenerator['cache'].has(cacheKey);
    
    if (cached) {
      generatePreview(request);
    } else {
      debouncedGenerate(request);
    }
  }, [stepId, input, settings, options, generatePreview, debouncedGenerate, previewGenerator]);

  const regeneratePreview = useCallback(() => {
    const request: PreviewRequest = {
      stepId,
      input,
      settings,
      options,
      priority: 'high'
    };
    
    // Force cache invalidation for this request
    const cacheKey = previewGenerator['generateCacheKey'](request);
    previewGenerator.invalidateCache(cacheKey);
    
    generatePreview(request);
  }, [stepId, input, settings, options, generatePreview, previewGenerator]);

  const queueBackgroundPreview = useCallback((newOptions: PreviewOptions = {}) => {
    const request: PreviewRequest = {
      stepId,
      input,
      settings,
      options: { ...options, ...newOptions },
      priority: 'low'
    };
    
    previewGenerator.queueBackgroundRender(request);
  }, [stepId, input, settings, options, previewGenerator]);

  return {
    previewData,
    isLoading,
    error,
    regeneratePreview,
    queueBackgroundPreview
  };
}

/**
 * Hook for progressive preview rendering (renders low-quality first, then high-quality)
 */
export function useProgressivePreview(
  stepId: string,
  input: CardData[],
  settings: WorkflowSettings,
  options: PreviewOptions = {}
): {
  lowQualityPreview: PreviewResult | null;
  highQualityPreview: PreviewResult | null;
  isLoadingLowQuality: boolean;
  isLoadingHighQuality: boolean;
  error: string | null;
} {
  // Low quality preview (fast)
  const lowQualityOptions: PreviewOptions = {
    ...options,
    quality: 0.3,
    width: (options.width || 800) * 0.5,
    height: (options.height || 600) * 0.5
  };

  const {
    previewData: lowQualityPreview,
    isLoading: isLoadingLowQuality,
    error: lowQualityError
  } = useOptimizedPreview(stepId, input, settings, lowQualityOptions, 50);

  // High quality preview (slower, starts after low quality)
  const highQualityOptions: PreviewOptions = {
    ...options,
    quality: options.quality || 1.0
  };

  const {
    previewData: highQualityPreview,
    isLoading: isLoadingHighQuality,
    error: highQualityError
  } = useOptimizedPreview(
    stepId,
    input,
    settings,
    highQualityOptions,
    200 // Longer debounce for high quality
  );

  // Start high quality render after low quality is done
  useEffect(() => {
    if (lowQualityPreview && !isLoadingLowQuality) {
      // Queue high quality render in background
      // This will automatically start due to the useOptimizedPreview effect
    }
  }, [lowQualityPreview, isLoadingLowQuality]);

  return {
    lowQualityPreview,
    highQualityPreview,
    isLoadingLowQuality,
    isLoadingHighQuality,
    error: lowQualityError || highQualityError
  };
}

/**
 * Hook for delta preview updates (optimized for setting changes)
 */
export function useDeltaPreview(
  baseStepId: string,
  baseInput: CardData[],
  baseSettings: WorkflowSettings,
  baseOptions: PreviewOptions = {}
): {
  currentPreview: PreviewResult | null;
  isLoading: boolean;
  error: string | null;
  updateWithDelta: (changes: Partial<PreviewRequest>) => void;
  metrics: { deltaUpdates: number; cacheHitRate: number; averageRenderTime: number };
} {
  const [currentPreview, setCurrentPreview] = useState<PreviewResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const previewGenerator = useMemo(() => new PreviewGenerator({
    maxCacheSize: 30,
    maxCacheAge: 5 * 60 * 1000, // 5 minutes for delta previews
    enableBackgroundRender: true
  }), []);
  
  const baseRequestRef = useRef<PreviewRequest>({
    stepId: baseStepId,
    input: baseInput,
    settings: baseSettings,
    options: baseOptions
  });

  // Update base request when props change
  useEffect(() => {
    baseRequestRef.current = {
      stepId: baseStepId,
      input: baseInput,
      settings: baseSettings,
      options: baseOptions
    };
  }, [baseStepId, baseInput, baseSettings, baseOptions]);

  const updateWithDelta = useCallback(async (changes: Partial<PreviewRequest>) => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await previewGenerator.generateDeltaPreview(
        baseRequestRef.current,
        changes
      );

      if (result.success) {
        setCurrentPreview(result);
        setError(null);
      } else {
        setError(result.error || 'Delta preview generation failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown delta preview error');
    } finally {
      setIsLoading(false);
    }
  }, [previewGenerator]);

  // Generate initial preview
  useEffect(() => {
    updateWithDelta({});
  }, [updateWithDelta]);

  const metrics = useMemo(() => {
    const generatorMetrics = previewGenerator.getMetrics();
    return {
      deltaUpdates: generatorMetrics.deltaUpdates,
      cacheHitRate: generatorMetrics.cacheHitRate,
      averageRenderTime: generatorMetrics.averageRenderTime
    };
  }, [previewGenerator, currentPreview]); // Re-calculate when preview updates

  // Cleanup
  useEffect(() => {
    return () => {
      previewGenerator.destroy();
    };
  }, [previewGenerator]);

  return {
    currentPreview,
    isLoading,
    error,
    updateWithDelta,
    metrics
  };
}

/**
 * Hook to access the pipeline directly for step execution
 */
export function usePipeline() {
  const stateManager = getStateManager();
  
  const executeStep = useCallback(async (stepId: string, input?: any) => {
    return await stateManager.executeStep(stepId, input);
  }, [stateManager]);

  const getPipeline = useCallback(() => {
    return stateManager.getPipeline();
  }, [stateManager]);

  return {
    executeStep,
    getPipeline
  };
}

/**
 * Hook for extraction operations using the pipeline step
 */
export function useExtractStep() {
  const stateManager = getStateManager();
  
  const extractCard = useCallback(async (cardIndex: number, pdfData: any, pdfMode: any, pageSettings: any, extractionSettings: any) => {
    try {
      stateManager.setLoading(true);
      
      // Import and create ExtractStep instance 
      const { ExtractStep } = await import('./steps/ExtractStep');
      const extractStep = new ExtractStep();
      
      // Execute the extraction through the pipeline step
      const result = await extractStep.extractCard({
        pdfData,
        pdfMode, 
        pageSettings,
        extractionSettings,
        cardIndex
      });
      
      if (!result.success) {
        throw new Error(result.errors[0] || 'Extraction failed');
      }
      
      return result.cardImageUrl;
    } catch (error) {
      stateManager.addError(`Failed to extract card: ${error}`);
      throw error;
    } finally {
      stateManager.setLoading(false);
    }
  }, [stateManager]);

  return {
    extractCard
  };
}

/**
 * Hook for configuration operations using the pipeline step
 */
export function useConfigureStep() {
  const stateManager = getStateManager();
  
  const validateSettings = useCallback(async (outputSettings: any) => {
    try {
      // Import and create ConfigureStep instance 
      const { ConfigureStep } = await import('./steps/ConfigureStep');
      const configureStep = new ConfigureStep();
      
      // Validate settings through the pipeline step
      const validation = configureStep.validateOutputSettings(outputSettings);
        if (!validation.valid) {
        // Add validation errors to state
        validation.errors.forEach((error: any) => {
          stateManager.addError(`Configuration error: ${error.message}`);
        });
      }
      
      return validation;
    } catch (error) {
      stateManager.addError(`Failed to validate configuration: ${error}`);
      throw error;
    }
  }, [stateManager]);

  const calculateLayout = useCallback(async (pdfData: any, pdfMode: any, pageSettings: any, outputSettings: any) => {
    try {
      // Import and create ConfigureStep instance 
      const { ConfigureStep } = await import('./steps/ConfigureStep');
      const configureStep = new ConfigureStep();
      
      // Calculate layout through the pipeline step
      const result = await configureStep.calculateLayout({
        pdfData,
        pdfMode,
        pageSettings,
        outputSettings
      });
      
      return result;
    } catch (error) {
      stateManager.addError(`Failed to calculate layout: ${error}`);
      throw error;
    }
  }, [stateManager]);

  return {
    validateSettings,
    calculateLayout
  };
}

/**
 * Hook for import operations using the pipeline step
 */
export function useImportStep() {
  const stateManager = getStateManager();
  
  const importPdf = useCallback(async (file: File) => {
    try {
      stateManager.setLoading(true);
      
      // Import and create ImportStep instance 
      const { ImportStep } = await import('./steps/ImportStep');
      const importStep = new ImportStep();
      
      // Process the file through the pipeline step
      const result = await importStep.importPdfFile(file);
      
      if (!result.success) {
        throw new Error(result.errors[0] || 'Import failed');
      }
      
      return {
        pdfData: result.pdfData,
        fileName: result.fileName,
        pageCount: result.pageCount,
        pageSettings: result.pageSettings
      };
    } catch (error) {
      stateManager.addError(`Failed to import PDF: ${error}`);
      throw error;
    } finally {
      stateManager.setLoading(false);
    }
  }, [stateManager]);

  const validateImportSettings = useCallback(async (pdfMode: any, pageSettings: any) => {
    try {
      // Import and create ImportStep instance 
      const { ImportStep } = await import('./steps/ImportStep');
      const importStep = new ImportStep();
      
      // Validate settings through the pipeline step
      const validation = importStep.validateImportConfiguration(pdfMode, pageSettings);
      
      if (!validation.valid) {
        // Add validation errors to state
        validation.errors.forEach((error: any) => {
          stateManager.addError(`Import configuration error: ${error.message}`);
        });
      }
      
      return validation;
    } catch (error) {
      stateManager.addError(`Failed to validate import settings: ${error}`);
      throw error;
    }
  }, [stateManager]);

  return {
    importPdf,
    validateImportSettings
  };
}

/**
 * Hook for export operations using the pipeline step
 */
export function useExportStep() {
  const stateManager = getStateManager();
  
  const exportPdf = useCallback(async (
    pdfData: any, 
    pdfMode: any, 
    pageSettings: any, 
    extractionSettings: any, 
    outputSettings: any
  ) => {
    try {
      stateManager.setLoading(true);
      
      // Import and create ExportStep instance 
      const { ExportStep } = await import('./steps/ExportStep');
      const exportStep = new ExportStep();
      
      // Execute the export through the pipeline step
      const result = await exportStep.exportToPdf({
        pdfData,
        pdfMode,
        pageSettings,
        extractionSettings,
        outputSettings
      });
      
      if (!result.success) {
        throw new Error(result.errors[0] || 'Export failed');
      }
      
      return {
        fronts: result.frontsBlob,
        backs: result.backsBlob,
        metadata: result.metadata
      };
    } catch (error) {
      stateManager.addError(`Failed to export PDF: ${error}`);
      throw error;
    } finally {
      stateManager.setLoading(false);
    }
  }, [stateManager]);

  const validateExportSettings = useCallback(async (outputSettings: any) => {
    try {
      // Import and create ExportStep instance 
      const { ExportStep } = await import('./steps/ExportStep');
      const exportStep = new ExportStep();
      
      // Validate settings through the pipeline step
      const validation = exportStep.validateExportSettings(outputSettings);
      
      if (!validation.valid) {
        // Add validation errors to state
        validation.errors.forEach((error: any) => {
          stateManager.addError(`Export configuration error: ${error.message}`);
        });
      }
      
      return validation;
    } catch (error) {
      stateManager.addError(`Failed to validate export settings: ${error}`);
      throw error;
    }
  }, [stateManager]);

  return {
    exportPdf,
    validateExportSettings
  };
}
