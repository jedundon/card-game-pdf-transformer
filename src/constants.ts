/**
 * @fileoverview Constants used throughout the application
 * 
 * This module defines application-wide constants that ensure consistency
 * across different components and modules. These values are carefully
 * chosen based on printing standards, performance considerations, and
 * usability requirements.
 * 
 * @author Card Game PDF Transformer
 */

/**
 * Default card dimensions for fallback scenarios
 * 
 * Used when card dimensions cannot be calculated from PDF or user settings.
 * Values are in pixels and represent a standard poker card aspect ratio.
 */
export const DEFAULT_CARD_DIMENSIONS = {
  /** Default card width in pixels (2.5" at 80 DPI) */
  width: 200,
  /** Default card height in pixels (3.5" at 80 DPI) */
  height: 280
} as const;

/**
 * DPI constants for consistent resolution handling
 * 
 * These values ensure proper scaling between different contexts:
 * - Extraction at high resolution for print quality
 * - Display at screen resolution for UI performance
 * 
 * **Technical Notes:**
 * - PDF.js uses 72 DPI as its base resolution
 * - Screen DPI varies by platform but 72 is standard for calculations
 * - Screen PPI (96) is used for Windows/web display scaling
 * - Extraction DPI (300) provides print-quality output
 */
export const DPI_CONSTANTS = {
  /** High-resolution DPI for card extraction and final output (print quality) */
  EXTRACTION_DPI: 300,
  /** Standard screen DPI for calculations (PDF.js standard) */
  SCREEN_DPI: 72,
  /** Screen pixels per inch for display scaling (Windows/web standard) */
  SCREEN_PPI: 96
} as const;

/**
 * Preview size constraints for UI display
 * 
 * These limits ensure good performance and usability in the preview components
 * while maintaining sufficient detail for user decision-making.
 * 
 * **Rationale:**
 * - Card previews kept small for fast rendering and grid layouts
 * - PDF previews larger to show page structure and card positioning
 * - Scale limits prevent excessive memory usage and rendering delays
 */
export const PREVIEW_CONSTRAINTS = {
  /** Maximum width for card preview images in pixels */
  MAX_WIDTH: 400,
  /** Maximum height for card preview images in pixels */
  MAX_HEIGHT: 500,
  /** Maximum width for PDF page preview in pixels */
  PDF_PREVIEW_MAX_WIDTH: 450,
  /** Maximum height for PDF page preview in pixels */
  PDF_PREVIEW_MAX_HEIGHT: 600,
  /** Maximum scale factor for PDF preview rendering */
  PDF_PREVIEW_MAX_SCALE: 2.0
} as const;

/**
 * Supported file types for multi-file import
 * 
 * Defines the accepted MIME types and file extensions for both PDF and image files.
 * These constants are used for file validation and user interface feedback.
 */
export const SUPPORTED_FILE_TYPES = {
  /** Supported image MIME types */
  IMAGE_MIME_TYPES: [
    'image/png',
    'image/jpeg',
    'image/jpg'
  ] as const,
  /** Supported image file extensions */
  IMAGE_EXTENSIONS: [
    '.png',
    '.jpg',
    '.jpeg'
  ] as const,
  /** Supported PDF MIME types */
  PDF_MIME_TYPES: [
    'application/pdf'
  ] as const,
  /** Supported PDF file extensions */
  PDF_EXTENSIONS: [
    '.pdf'
  ] as const
} as const;

/**
 * File size limits for different file types
 * 
 * These limits prevent memory issues and ensure reasonable processing times.
 * Values are in bytes for precise size checking.
 */
export const FILE_SIZE_LIMITS = {
  /** Maximum size for PDF files in bytes (100MB) */
  PDF_MAX_SIZE: 100 * 1024 * 1024,
  /** Maximum size for individual image files in bytes (50MB) */
  IMAGE_MAX_SIZE: 50 * 1024 * 1024,
  /** Maximum total size for all files in a multi-file session (500MB) */
  TOTAL_MAX_SIZE: 500 * 1024 * 1024,
  /** Maximum number of files that can be imported simultaneously */
  MAX_FILES: 50,
  /** Maximum total number of pages across all files */
  MAX_TOTAL_PAGES: 1000
} as const;

/**
 * Drag and drop operation constants
 * 
 * Used for page reordering and multi-file drag-and-drop functionality.
 */
export const DRAG_DROP_CONSTANTS = {
  /** Delay before drag operation starts (milliseconds) */
  DRAG_START_DELAY: 150,
  /** Distance threshold for drag detection (pixels) */
  DRAG_THRESHOLD: 5,
  /** Animation duration for drag operations (milliseconds) */
  DRAG_ANIMATION_DURATION: 200,
  /** Z-index for dragged elements */
  DRAG_Z_INDEX: 1000
} as const;

/**
 * Timeout constants for async operations
 * 
 * Centralized timeout values to prevent operations from hanging indefinitely.
 * Values are carefully chosen based on operation complexity and user experience.
 */
export const TIMEOUT_CONSTANTS = {
  /** Card extraction timeout (30 seconds) - allows for complex PDF processing */
  CARD_EXTRACTION_TIMEOUT: 30000,
  /** Image processing timeout (20 seconds) - for canvas operations and transformations */
  IMAGE_PROCESSING_TIMEOUT: 20000,
  /** Color transformation timeout (15 seconds) - for color adjustment operations */
  COLOR_TRANSFORMATION_TIMEOUT: 15000,
  /** Render calculation timeout (10 seconds) - for dimension and layout calculations */
  RENDER_CALCULATION_TIMEOUT: 10000,
  /** Settings debounce delay (500ms) - prevents excessive API calls during user input */
  SETTINGS_DEBOUNCE_DELAY: 500,
  /** Preview update delay (250ms) - balances responsiveness with performance */
  PREVIEW_UPDATE_DELAY: 250,
  /** Canvas operation debounce (100ms) - prevents excessive canvas redraws */
  CANVAS_DEBOUNCE_DELAY: 100
} as const;
