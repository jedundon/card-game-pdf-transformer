/**
 * Core type definitions for the transformation pipeline
 */

// Card data structure
export interface CardData {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  selected: boolean;
  extracted: boolean;
  sourcePageIndex?: number;
  extractedImageUrl?: string;
  thumbnailUrl?: string;
}

// Processing settings
export interface WorkflowSettings {
  inputMode: 'pdf' | 'images';
  outputFormat: 'individual' | 'sheets' | 'combined';
  dpi: number;
  quality: number;
  
  // Grid configuration
  gridColumns: number;
  gridRows: number;
  cardWidth: number;
  cardHeight: number;
  bleed: number;
  
  // PDF specific
  pdfPages?: number[];
  pageScale?: number;
  
  // Export settings
  exportFilename?: string;
  includeBleed?: boolean;
  cropMarks?: boolean;
  
  // PDF import and processing data
  pdfData?: PDFDocument | null;
  pdfMode?: PDFMode;
  pageSettings?: PageSetting[];
  extractionSettings?: any; // Will be properly typed later
  outputSettings?: OutputSettings;
}

// Preview data
export interface PreviewData {
  imageUrl: string;
  thumbnailUrl?: string;
  metadata: {
    width: number;
    height: number;
    dpi: number;
    fileSize?: number;
    // Extended metadata for preview system
    renderTime?: number;
    stepId?: string;
    cacheKey?: string;
    timestamp?: number;
    deltaRender?: boolean;
  };
}

// Processing metadata
export interface ProcessingMetadata {
  startTime: Date;
  lastModified: Date;
  stepHistory: string[];
  performanceMetrics: {
    [stepId: string]: {
      duration: number;
      memoryUsage: number;
      cacheHits: number;
    };
  };
}

// Step execution result
export interface StepResult {
  stepId: string;
  success: boolean;
  data: CardData[];
  preview?: PreviewData;
  errors: string[];
  warnings: string[];
  metadata: {
    duration: number;
    cardsProcessed: number;
    cacheHit: boolean;
  };
}

// Validation result
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

export interface ValidationWarning {
  field: string;
  message: string;
  code: string;
}

// Pipeline state
export interface PipelineState {
  cards: CardData[];
  settings: WorkflowSettings;
  metadata: ProcessingMetadata;
  stepResults: Map<string, StepResult>;
  currentStep: string;
  isProcessing: boolean;
}

// Transformation step interface
export interface TransformationStep {
  id: string;
  name: string;
  description: string;
  
  execute(input: CardData[], settings: WorkflowSettings): Promise<CardData[]>;
  generatePreview(input: CardData[], settings: WorkflowSettings): Promise<PreviewData>;
  validate(settings: WorkflowSettings): ValidationResult;
  
  // Optional hooks
  onBeforeExecute?(input: CardData[], settings: WorkflowSettings): Promise<void>;
  onAfterExecute?(result: CardData[], settings: WorkflowSettings): Promise<void>;
  
  // Caching support
  getCacheKey?(input: CardData[], settings: WorkflowSettings): string;
  shouldCache?: boolean;
}

// Pipeline configuration
export interface PipelineConfig {
  steps: TransformationStep[];
  cacheEnabled: boolean;
  maxCacheSize: number;
  performanceMonitoring: boolean;
  errorHandling: 'strict' | 'tolerant';
}

// Event types
export type PipelineEvent = 
  | { type: 'step-started'; stepId: string; timestamp: Date }
  | { type: 'step-completed'; stepId: string; result: StepResult; timestamp: Date }
  | { type: 'step-failed'; stepId: string; error: Error; timestamp: Date }
  | { type: 'pipeline-reset'; timestamp: Date }
  | { type: 'state-changed'; state: PipelineState; timestamp: Date }
  | { type: 'preview-generated'; stepId: string; preview: PreviewData; timestamp: Date }
  | { type: 'settings-updated'; settings: WorkflowSettings; timestamp: Date };

// Event listener types
export type PipelineEventListener = (event: PipelineEvent) => void;

// Cache entry
export interface CacheEntry<T = any> {
  key: string;
  data: T;
  timestamp: Date;
  accessCount: number;
  lastAccess: Date;
  size: number;
}

// Import-specific types
export interface PDFDocument {
  numPages: number;
  fingerprint?: string;
  _pdfInfo?: any;
}

export interface PageSetting {
  skip: boolean;
  type: 'front' | 'back';
}

export interface PDFMode {
  type: 'duplex' | 'gutter-fold';
  orientation: 'vertical' | 'horizontal';
  flipEdge: 'short' | 'long';
}

export interface ImportSettings {
  pdfData: PDFDocument | null;
  pdfMode: PDFMode;
  pageSettings: PageSetting[];
  fileName: string;
}

// Export-specific types
export interface OutputPageSize {
  width: number;
  height: number;
}

export interface OutputOffset {
  horizontal: number;
  vertical: number;
}

export interface CardSize {
  widthInches: number;
  heightInches: number;
}

export interface CardRotation {
  front: number;
  back: number;
}

export type CardImageSizingMode = 'actual-size' | 'fit-to-card' | 'fill-card';

export interface OutputSettings {
  pageSize: OutputPageSize;
  offset: OutputOffset;
  cardSize: CardSize;
  cardScalePercent: number;
  bleedMarginInches: number;
  rotation: CardRotation;
  cardImageSizingMode: CardImageSizingMode;
}

export interface ExportSettings {
  outputSettings: OutputSettings;
  outputFormat: 'individual' | 'combined';
  exportFilename?: string;
}

export interface ExportResult {
  frontsBlob: Blob | null;
  backsBlob: Blob | null;
  totalCards: number;
  frontCards: number;
  backCards: number;
}
