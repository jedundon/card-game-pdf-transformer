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
