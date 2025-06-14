// Constants used throughout the application

// Card extraction constants
export const DEFAULT_CARD_DIMENSIONS = {
  width: 200,
  height: 280
} as const;

export const DPI_CONSTANTS = {
  EXTRACTION_DPI: 300,
  SCREEN_DPI: 72,
  SCREEN_PPI: 96,
  PDF_BASE_DPI: 72,  // PDF.js uses 72 DPI as base
  PDF_DPI: 300       // For high-quality PDF preview generation
} as const;



// Preview size limits
export const PREVIEW_CONSTRAINTS = {
  MAX_WIDTH: 400,
  MAX_HEIGHT: 500,
  PDF_PREVIEW_MAX_WIDTH: 450,
  PDF_PREVIEW_MAX_HEIGHT: 600,
  PDF_PREVIEW_MAX_SCALE: 2.0
} as const;
