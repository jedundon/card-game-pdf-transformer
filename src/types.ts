/**
 * @fileoverview TypeScript interfaces for the Card Game PDF Transformer application
 * 
 * This module defines all the core data structures and type definitions used
 * throughout the application. These interfaces ensure type safety and provide
 * clear contracts for data flow between components.
 * 
 * **Interface Categories:**
 * - PDF Processing: Types for working with PDF.js and document structure
 * - Configuration: Settings for extraction, output, and processing modes
 */

import { LastImportedFileInfo } from './utils/localStorageUtils';
import { ColorTransformation } from './utils/colorUtils';

/**
 * - Card Data: Information about individual cards and their properties
 * - Layout & Positioning: Grid systems, cropping, and spatial configurations
 * - Color Processing: Color transformation and calibration settings
 * - Component Interfaces: Props and event handler type definitions
 * 
 * **Type Safety:**
 * All interfaces use strict typing with specific value constraints where
 * appropriate (e.g., 'front' | 'back' unions) to prevent runtime errors
 * and provide better IDE support.
 * 
 * @author Card Game PDF Transformer
 */

import { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist';

// PDF-related types
/** PDF document proxy from PDF.js library */
export type PdfData = PDFDocumentProxy;
/** Individual PDF page proxy from PDF.js library */
export type PdfPage = PDFPageProxy;

/**
 * Page settings for PDF processing
 * 
 * Configures how individual PDF pages should be processed, including
 * whether to skip them and their card type designation.
 */
export interface PageSettings {
  /** Whether to skip this page during processing (default: false) */
  skip?: boolean;
  /** Whether this page has been soft-removed (can be restored) */
  removed?: boolean;
  /** Card type designation for duplex/gutter-fold modes ('front' or 'back') */
  type?: 'front' | 'back';
  /** Page type for specialized processing ('card', 'rule', 'skip') */
  pageType?: 'card' | 'rule' | 'skip';
  /** Source file information for multi-file support */
  sourceFile?: string;
  /** Original page index within the source file (0-based) */
  originalPageIndex?: number;
  /** Display order for page reordering (0-based) */
  displayOrder?: number;
  /** Page rotation in degrees (0, 90, 180, 270) */
  rotation?: number;
  /** Page scale factor (1.0 = 100%) */
  scale?: number;
  /** Custom crop adjustments for this page */
  customCrop?: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
}

/**
 * PDF mode configuration
 * 
 * Defines how the PDF should be processed based on its layout and intended
 * printing method. This affects card identification and rotation logic.
 */
export interface PdfMode {
  /** Processing mode type */
  type: 'simplex' | 'duplex' | 'gutter-fold';
  /** Orientation for gutter-fold mode (vertical = left/right split, horizontal = top/bottom split) */
  orientation?: 'vertical' | 'horizontal';
  /** Flip edge for duplex printing (short = flip along short edge, long = flip along long edge) */
  flipEdge?: 'short' | 'long';
}

/**
 * Grid configuration for card extraction
 * 
 * Defines the grid layout used to extract individual cards from PDF pages.
 * The grid divides each page into a rectangular array of card positions.
 */
export interface GridSettings {
  /** Number of card rows per page (must be positive integer) */
  rows: number;
  /** Number of card columns per page (must be positive integer) */
  columns: number;
}

/**
 * Crop settings (in pixels at 300 DPI)
 * 
 * Defines how much to crop from each edge of the PDF page before
 * extracting cards. Values are in pixels at extraction DPI (300).
 */
export interface CropSettings {
  /** Pixels to crop from left edge of page */
  left: number;
  /** Pixels to crop from right edge of page */
  right: number;
  /** Pixels to crop from top edge of page */
  top: number;
  /** Pixels to crop from bottom edge of page */
  bottom: number;
}

/**
 * Card-specific crop settings
 * 
 * Additional cropping applied to individual cards after extraction
 * from the page grid. Values are in pixels relative to the extracted card.
 */
export interface CardCropSettings {
  /** Pixels to crop from top edge of individual card */
  top: number;
  /** Pixels to crop from right edge of individual card */
  right: number;
  /** Pixels to crop from bottom edge of individual card */
  bottom: number;
  /** Pixels to crop from left edge of individual card */
  left: number;
}

/**
 * Skipped card position
 * 
 * Identifies a specific card position that should be excluded from processing.
 * Used to handle blank spaces, damaged cards, or unwanted content in the PDF.
 */
export interface SkippedCard {
  /** Index in activePages array (0-based) */
  pageIndex: number;
  /** Row position in extraction grid (0-based) */
  gridRow: number;
  /** Column position in extraction grid (0-based) */
  gridColumn: number;
  /** Optional card type filter for duplex/gutter-fold modes */
  cardType?: 'front' | 'back';
}

/**
 * Card type override
 * 
 * Allows manual override of a card's front/back type designation,
 * superseding the automatic assignment from processing mode.
 */
export interface CardTypeOverride {
  /** Index in activePages array (0-based) */
  pageIndex: number;
  /** Row position in extraction grid (0-based) */
  gridRow: number;
  /** Column position in extraction grid (0-based) */
  gridColumn: number;
  /** Manually assigned card type */
  cardType: 'front' | 'back';
}

/**
 * Image rotation settings
 * 
 * Defines rotation angles to apply to card images during extraction.
 * Useful for correcting orientation issues in source PDFs.
 */
export interface ImageRotationSettings {
  /** Rotation angle for front cards in degrees (0-359) */
  front: number;
  /** Rotation angle for back cards in degrees (0-359) */
  back: number;
}

/**
 * Complete extraction settings
 * 
 * Comprehensive configuration for the card extraction process,
 * including grid layout, cropping, and special handling options.
 */
export interface ExtractionSettings {
  /** Grid layout for dividing pages into card positions */
  grid: GridSettings;
  /** Page-level cropping settings */
  crop: CropSettings;
  /** Width of gutter between card halves in gutter-fold mode (pixels) */
  gutterWidth?: number;
  /** Individual card cropping settings */
  cardCrop?: CardCropSettings;
  /** Rotation settings for extracted card images */
  imageRotation?: ImageRotationSettings;
  /** Array of card positions to skip during processing */
  skippedCards?: SkippedCard[];
  /** Array of card type overrides for manual front/back assignment */
  cardTypeOverrides?: CardTypeOverride[];
  /** Page dimensions for orientation-aware card ID calculations */
  pageDimensions?: { width: number; height: number };
}


/**
 * Color transformation settings per card type
 * 
 * Allows different color adjustments for front and back cards,
 * useful when they have different printing characteristics.
 */
export interface ColorTransformationSettings {
  /** Color transformations for front cards */
  front: ColorTransformation;
  /** Color transformations for back cards */
  back: ColorTransformation;
}

/**
 * Card size configuration
 * 
 * Defines the target dimensions for output cards in inches.
 * These are the final printed card dimensions before any bleed or scaling.
 */
export interface CardSizeSettings {
  /** Card width in inches (e.g., 2.5 for poker cards) */
  widthInches: number;
  /** Card height in inches (e.g., 3.5 for poker cards) */
  heightInches: number;
}

/**
 * Page size configuration
 * 
 * Defines the output page dimensions in inches for the final PDF.
 * Can be different from card size for layout flexibility.
 */
export interface PageSizeSettings {
  /** Page width in inches */
  width: number;
  /** Page height in inches */
  height: number;
}

/**
 * Card spacing configuration
 * 
 * Defines spacing between cards when multiple cards are placed on a page.
 * Currently reserved for future multi-card layout features.
 */
export interface CardSpacingSettings {
  /** Horizontal spacing between cards in inches */
  horizontal: number;
  /** Vertical spacing between cards in inches */
  vertical: number;
}

/**
 * Layout rotation settings
 * 
 * Defines rotation angles for final card layout in the output PDF.
 * Applied after image processing and sizing calculations.
 */
export interface LayoutRotationSettings {
  /** Rotation angle for front cards in degrees */
  front: number;
  /** Rotation angle for back cards in degrees */
  back: number;
}

/**
 * Complete output settings
 * 
 * Comprehensive configuration for final PDF generation, including
 * page layout, card sizing, positioning, and print optimization.
 */
export interface OutputSettings {
  /** Output page dimensions */
  pageSize: PageSizeSettings;
  /** Target card dimensions */
  cardSize: CardSizeSettings;
  /** Scale percentage applied to cards (1-500) */
  cardScalePercent: number;
  /** Bleed margin added to each card edge in inches */
  bleedMarginInches: number;
  /** Spacing between cards (for future multi-card layouts) */
  spacing: CardSpacingSettings;
  /** Rotation settings for card layout */
  rotation: LayoutRotationSettings;
  /** How card images should be sized within card boundaries */
  cardImageSizingMode: 'actual-size' | 'fit-to-card' | 'fill-card';
  /** Card alignment within page (for future positioning options) */
  cardAlignment: 'top-left' | 'center';
  /** Whether to include color calibration elements in output */
  includeColorCalibration: boolean;
  /** Position offset from center of page */
  offset: {
    /** Horizontal offset in inches (positive = right) */
    horizontal: number;
    /** Vertical offset in inches (positive = down) */
    vertical: number;
  };
  /** Optional printer calibration adjustments */
  printerCalibration?: {
    /** X-axis offset in inches */
    offsetX: number;
    /** Y-axis offset in inches */
    offsetY: number;
    /** X-axis scale multiplier */
    scaleX: number;
    /** Y-axis scale multiplier */
    scaleY: number;
  };
}

/**
 * Color calibration grid configuration
 * 
 * Defines the dimensions of the color calibration preview grid
 * used to test different color transformation settings.
 */
export interface ColorGridConfig {
  /** Number of columns in the calibration grid */
  columns: number;
  /** Number of rows in the calibration grid */
  rows: number;
}

/**
 * Color transformation range for calibration grid
 * 
 * Defines the parameter range for a specific transformation type
 * across the calibration grid preview.
 */
export interface ColorTransformationRange {
  /** Transformation type (matches ColorTransformation properties) */
  type: string;
  /** Minimum value for the transformation */
  min: number;
  /** Maximum value for the transformation */
  max: number;
}

/**
 * Complete color calibration settings
 * 
 * Contains all color-related configuration including the selected region,
 * calibration grid setup, transformation ranges, and final adjustments.
 */
export interface ColorSettings {
  /** Selected region for color sampling and preview */
  selectedRegion: {
    /** X coordinate of region center in extraction coordinates */
    centerX: number;
    /** Y coordinate of region center in extraction coordinates */
    centerY: number;
    /** Width of region in extraction coordinates */
    width: number;
    /** Height of region in extraction coordinates */
    height: number;
    /** X coordinate of region center in preview coordinates */
    previewCenterX: number;
    /** Y coordinate of region center in preview coordinates */
    previewCenterY: number;
    /** Width of region in preview coordinates */
    previewWidth: number;
    /** Height of region in preview coordinates */
    previewHeight: number;
    /** Source page index */
    pageIndex?: number;
  } | null;
  /** Calibration grid configuration */
  gridConfig: ColorGridConfig;
  /** Transformation ranges for calibration grid */
  transformations: {
    /** Horizontal axis transformation range */
    horizontal: ColorTransformationRange;
    /** Vertical axis transformation range */
    vertical: ColorTransformationRange;
  };
  /** Selected preset key */
  selectedPreset: string;
  /** Final color adjustments applied to output */
  finalAdjustments: ColorTransformation;
}

/**
 * File source information for multi-file support
 * 
 * Tracks metadata about imported files including their type and page count.
 */
export interface FileSource {
  /** File name including extension */
  name: string;
  /** File type - 'pdf' for PDF files, 'image' for image files */
  type: 'pdf' | 'image';
  /** Original number of pages in the file (1 for image files) */
  originalPageCount: number;
  /** File size in bytes */
  size: number;
  /** Import timestamp */
  importTimestamp: number;
}

/**
 * Page source information
 * 
 * Links each page to its source file and original position for tracking
 * during page reordering operations.
 */
export interface PageSource {
  /** Name of the source file */
  fileName: string;
  /** Original page index within the source file (0-based) */
  originalPageIndex: number;
  /** File type */
  fileType: 'pdf' | 'image';
  /** Current display order in the page list (0-based) */
  displayOrder: number;
}

/**
 * Image file data for processing
 * 
 * Contains the processed image data that can be used in the same workflow
 * as PDF pages. Images are converted to canvas data for consistent processing.
 */
export interface ImageFileData {
  /** Canvas element containing the image data */
  canvas: HTMLCanvasElement;
  /** Original image dimensions */
  width: number;
  height: number;
  /** File name for display purposes */
  fileName: string;
}

/**
 * Page reorder state management
 * 
 * Manages the state during drag-and-drop reordering operations including
 * tracking of source positions and target positions.
 */
export interface PageReorderState {
  /** Index of the page being dragged */
  dragIndex: number | null;
  /** Index where the page will be dropped */
  hoverIndex: number | null;
  /** Whether a drag operation is currently active */
  isDragging: boolean;
  /** Array of page indices representing the current order */
  pageOrder: number[];
}

/**
 * Multi-file import state
 * 
 * Comprehensive state management for handling multiple imported files
 * and their combined page list with reordering capabilities.
 */
export interface MultiFileImportState {
  /** Array of imported file sources */
  files: FileSource[];
  /** Combined list of all pages from all files with source tracking */
  pages: (PageSettings & PageSource)[];
  /** Current page reordering state */
  reorderState: PageReorderState;
  /** Original import order of pages for reset functionality */
  originalPageOrder: (PageSettings & PageSource)[];
  /** Whether any files are currently being processed */
  isProcessing: boolean;
  /** Error messages for failed file imports */
  errors: Record<string, string>;
  /** Page type configurations */
  pageTypeSettings: Record<string, PageTypeSettings>;
  /** Page groups for organization */
  pageGroups: PageGroup[];
}

/**
 * Card information
 * 
 * Identifies a card's type and unique identifier as determined by
 * the card identification algorithm based on PDF mode and position.
 */
export interface CardInfo {
  /** Card type ('Front', 'Back', or 'Unknown') */
  type: string;
  /** Unique card identifier (1-based numbering) */
  id: number;
}

/**
 * Page type settings for specialized processing
 * 
 * Defines default settings and processing parameters for each page type.
 * This allows different pages to have different extraction and output settings.
 */
export interface PageTypeSettings {
  /** Page type identifier */
  pageType: 'card' | 'rule' | 'skip';
  /** Display name for the page type */
  displayName: string;
  /** Default extraction settings for this page type */
  defaultExtractionSettings?: Partial<ExtractionSettings>;
  /** Default output settings for this page type */
  defaultOutputSettings?: Partial<OutputSettings>;
  /** Default color settings for this page type */
  defaultColorSettings?: Partial<ColorSettings>;
  /** Whether this page type should be processed by default */
  isProcessed: boolean;
  /** Color scheme for UI indicators */
  colorScheme: {
    /** Primary color for badges and indicators */
    primary: string;
    /** Background color for UI elements */
    background: string;
    /** Text color for high contrast */
    text: string;
  };
}

/**
 * Page group for organizing pages
 * 
 * Allows users to group related pages together for batch operations
 * and specialized processing settings.
 */
export interface PageGroup {
  /** Unique identifier for the group */
  id: string;
  /** User-defined name for the group */
  name: string;
  /** Array of page indices that belong to this group */
  pageIndices: number[];
  /** Group type: 'auto' for system-created, 'manual' for user-created */
  type: 'auto' | 'manual';
  /** Display order of the group (lower numbers appear first) */
  order: number;
  /** Processing mode specific to this group */
  processingMode: PdfMode;
  /** Group-specific settings that override defaults */
  settings?: {
    /** Extraction settings for this group */
    extraction?: Partial<ExtractionSettings>;
    /** Output settings for this group */
    output?: Partial<OutputSettings>;
    /** Color settings for this group */
    color?: Partial<ColorSettings>;
  };
  /** Visual color for group indicators */
  color?: string;
  /** Whether this group is currently selected */
  isSelected?: boolean;
  /** Creation timestamp */
  createdAt: number;
  /** Last modified timestamp */
  modifiedAt: number;
}

// Settings for import/export
export interface AppSettings {
  pdfMode: PdfMode;
  pageSettings: PageSettings[];
  extractionSettings: ExtractionSettings;
  outputSettings: OutputSettings;
  colorTransformationSettings?: ColorTransformationSettings;
  /** Page type configurations */
  pageTypeSettings?: Record<string, PageTypeSettings>;
  /** Page groups for organization */
  pageGroups?: PageGroup[];
}

// Card dimensions
export interface CardDimensions {
  widthPx: number;
  heightPx: number;
  widthInches: number;
  heightInches: number;
  originalWidthPx?: number;
  originalHeightPx?: number;
  rotation?: number;
  cardType?: string;
}

// React component props types
export interface StepComponentProps {
  onPrevious: () => void;
  onNext: () => void;
}

// Error boundary props
export interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ComponentType<{ error: Error; resetError: () => void }>;
}

// Event handler types
export type FileSelectHandler = (data: PdfData, fileName: string, file?: File) => void;
export type ModeSelectHandler = (mode: PdfMode) => void;
export type PageSettingsChangeHandler = (settings: PageSettings[]) => void;
export type ExtractionSettingsChangeHandler = (settings: ExtractionSettings) => void;
export type OutputSettingsChangeHandler = (settings: OutputSettings) => void;
export type ColorTransformationChangeHandler = (settings: ColorTransformationSettings) => void;
export type CardDimensionsChangeHandler = (dimensions: CardDimensions | null) => void;

// Multi-file and page reordering event handler types
export type MultiFileSelectHandler = (files: File[]) => void;
export type PageReorderHandler = (oldIndex: number, newIndex: number) => void;
export type PageRemoveHandler = (pageIndex: number) => void;
export type FileRemoveHandler = (fileName: string) => void;
export type MultiFileImportStateChangeHandler = (state: MultiFileImportState) => void;

/**
 * Multi-file import hook interface
 * 
 * Defines the public API for the multi-file import functionality.
 * This hook manages state for importing and processing multiple PDF and image files.
 */
export interface MultiFileImportHook {
  /** Current multi-file import state */
  multiFileState: MultiFileImportState;
  
  /** Add new files to the import */
  addFiles: (files: File[]) => Promise<{
    success: boolean;
    addedFiles: FileSource[];
    addedPages: (PageSettings & PageSource)[];
    errors: Record<string, string>;
  }>;
  
  /** Process initial files for import */
  processFiles: (files: File[]) => Promise<{
    files: FileSource[];
    pages: (PageSettings & PageSource)[];
    firstPdf: PdfData | null;
  }>;
  
  /** Remove a specific file and its pages */
  removeFile: (fileName: string) => void;
  
  /** Remove a specific page */
  removePage: (pageIndex: number) => void;
  
  /** Reset all import state */
  reset: () => void;
  
  /** Get list of imported files */
  getFileList: () => FileSource[];
  
  /** Get image data for a specific file */
  getImageData: (fileName: string) => ImageFileData | null;
  
  /** Get PDF data for a specific file */
  getPdfData: (fileName: string) => PdfData | null;
  
  /** Get all PDF data */
  getAllPdfData: () => Map<string, PdfData>;
  
  /** Get all image data */
  getAllImageData: () => Map<string, ImageFileData>;
  
  /** Get combined PDF data (for single-file compatibility) */
  getCombinedPdfData: () => PdfData | null;
  
  /** Update all page settings */
  updateAllPageSettings: (pages: (PageSettings & PageSource)[]) => void;
  
  /** Reset pages to import order */
  resetToImportOrder: () => void;
  
  /** Check if pages have been reordered */
  isPagesReordered: () => boolean;
  
  /** Update page groups */
  updatePageGroups: (groups: PageGroup[]) => void;
  
  /** Update page type settings */
  updatePageTypeSettings: (settings: Record<string, PageTypeSettings>) => void;
}

/**
 * Component prop interfaces for better type safety
 */

/** Props for ImportStep component */
export interface ImportStepProps {
  onFileSelect: FileSelectHandler;
  onModeSelect: ModeSelectHandler;
  onPageSettingsChange: PageSettingsChangeHandler;
  onNext: () => void;
  onResetToDefaults: () => void;
  onTriggerImportSettings: () => void;
  pdfData: PdfData | null;
  pdfMode: PdfMode;
  pageSettings: PageSettings[];
  autoRestoredSettings: boolean;
  lastImportedFileInfo: LastImportedFileInfo | null;
  onClearLastImportedFile: () => void;
  multiFileImport: MultiFileImportHook;
  /** Global settings for settings hierarchy */
  extractionSettings?: ExtractionSettings;
  outputSettings?: OutputSettings;
  colorSettings?: ColorSettings;
}

/** Props for ExtractStep component */
export interface ExtractStepProps {
  pdfData: PdfData | null;
  pdfMode: PdfMode;
  pageSettings: PageSettings[];
  extractionSettings: ExtractionSettings;
  multiFileImport: MultiFileImportHook;
  onSettingsChange: ExtractionSettingsChangeHandler;
  onCardDimensionsChange: CardDimensionsChangeHandler;
  onPrevious: () => void;
  onNext: () => void;
}

/** Props for ColorCalibrationStep component */
export interface ColorCalibrationStepProps {
  pdfData: PdfData | null;
  pdfMode: PdfMode;
  pageSettings: PageSettings[];
  extractionSettings: ExtractionSettings;
  colorSettings: ColorSettings;
  multiFileImport: MultiFileImportHook;
  onSettingsChange: (settings: ColorSettings) => void;
  onPrevious: () => void;
  onNext: () => void;
}

/** Props for ConfigureStep component */
export interface ConfigureStepProps {
  pdfData: PdfData | null;
  pdfMode: PdfMode;
  extractionSettings: ExtractionSettings;
  outputSettings: OutputSettings;
  pageSettings: PageSettings[];
  cardDimensions: CardDimensions | null;
  multiFileImport: MultiFileImportHook;
  onSettingsChange: OutputSettingsChangeHandler;
  onPrevious: () => void;
  onNext: () => void;
}

/** Props for ExportStep component */
export interface ExportStepProps {
  pdfData: PdfData | null;
  pdfMode: PdfMode;
  pageSettings: PageSettings[];
  extractionSettings: ExtractionSettings;
  outputSettings: OutputSettings;
  colorSettings: ColorSettings;
  currentPdfFileName?: string;
  multiFileImport: MultiFileImportHook;
  onPrevious: () => void;
}