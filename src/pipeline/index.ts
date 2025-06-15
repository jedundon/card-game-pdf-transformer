/**
 * Pipeline module exports
 */

export { TransformationPipeline } from './TransformationPipeline';
export { PipelineEventEmitter } from './events';
export { StateManager } from './StateManager';
export { PreviewGenerator } from './PreviewGenerator';
export { PreviewCache } from './PreviewCache';
export { StepRegistry } from './StepRegistry';

// State management hooks
export {
  initializeStateManager,
  getStateManager,
  useAppState,
  useAppStateField,
  useNavigation,
  usePdfData,
  useSettings,
  useAppStatus,
  usePipelineState,
  useTransformations,
  useOptimizedPreview,
  useProgressivePreview,
  useDeltaPreview,
  usePipeline,
  useExtractStep,
  useConfigureStep,
  useImportStep,
  useExportStep
} from './hooks';

// Performance optimization hooks
export {
  useOptimizedPreview as useOptimizedPreviewSimple,
  useProgressivePreview as useProgressivePreviewSimple,
  type PreviewPerformanceMetrics,
  type PreviewOptimizationOptions
} from './previewOptimization';

// Types
export type * from './types';

// Steps
export * from './steps';
