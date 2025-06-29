/**
 * @fileoverview Default configuration values for the application
 * 
 * This module serves as the single source of truth for all default settings
 * across the Card Game PDF Transformer. It provides both static defaults
 * and intelligent mode-specific configuration generators.
 * 
 * **Key Responsibilities:**
 * - Define base default values for all application settings
 * - Generate PDF mode-specific grid configurations
 * - Calculate appropriate rotation defaults based on printing method
 * - Provide complete workflow settings with mode-aware defaults
 * - Type definitions for settings structure
 * 
 * **Default Values:**
 * - PDF Mode: Duplex, short edge flip (most common for card games)
 * - Grid: 2×3 for duplex, 4×2/2×4 for gutter-fold
 * - Card Size: 2.5" × 3.5" (poker card standard)
 * - Output: No bleed, 100% scale, actual-size mode
 * - Rotation: 0° front, mode-specific back rotation
 * 
 * @author Card Game PDF Transformer
 */

import { PdfMode, PageSettings } from './types';

/**
 * Get default grid configuration based on PDF mode
 * 
 * Calculates the optimal grid layout for each PDF processing mode based on
 * common card game layouts and printing practices.
 * 
 * **Grid Logic by Mode:**
 * - **Duplex**: 2×3 grid (6 cards per page) - standard for most card games
 * - **Gutter-fold Vertical**: 4×2 grid (4 cards per half, 8 total)
 * - **Gutter-fold Horizontal**: 2×4 grid (4 cards per half, 8 total)
 * - **Fallback**: 2×3 grid for unknown/unsupported modes
 * 
 * @param pdfMode - PDF processing mode configuration
 * @returns Grid configuration object with rows and columns
 * 
 * @example
 * ```typescript
 * const duplexGrid = getDefaultGrid({ type: 'duplex', flipEdge: 'short' });
 * // Returns: { rows: 2, columns: 3 }
 * 
 * const gutterGrid = getDefaultGrid({ type: 'gutter-fold', orientation: 'vertical' });
 * // Returns: { rows: 4, columns: 2 }
 * ```
 */
export const getDefaultGrid = (pdfMode: PdfMode) => {
  if (pdfMode.type === 'duplex') {
    // Both long and short edge duplex use same grid
    return { rows: 2, columns: 3 };
  } else if (pdfMode.type === 'gutter-fold') {
    if (pdfMode.orientation === 'vertical') {
      return { rows: 4, columns: 2 };
    } else if (pdfMode.orientation === 'horizontal') {
      return { rows: 2, columns: 4 };
    }
  }
  // Fallback default
  return { rows: 2, columns: 3 };
};

/**
 * Get default rotation settings based on PDF mode
 * 
 * Calculates appropriate default rotations for front and back cards based on
 * the PDF processing mode and printing method. These defaults ensure proper
 * card orientation when printed.
 * 
 * **Rotation Logic:**
 * - **Front cards**: Always 0° (no rotation)
 * - **Back cards**: Depends on printing method:
 *   - Duplex short edge: 0° (cards flip along short edge)
 *   - Duplex long edge: 180° (cards flip along long edge)
 *   - Gutter-fold vertical: 0° (fold along vertical center)
 *   - Gutter-fold horizontal: 180° (fold along horizontal center)
 * 
 * **Printing Context:**
 * These defaults assume standard duplex printing where the back side
 * needs to be oriented correctly relative to the front side based on
 * which edge the paper flips along.
 * 
 * @param pdfMode - PDF processing mode configuration
 * @returns Rotation object with front and back rotation values in degrees
 * 
 * @example
 * ```typescript
 * const shortEdge = getDefaultRotation({ type: 'duplex', flipEdge: 'short' });
 * // Returns: { front: 0, back: 0 }
 * 
 * const longEdge = getDefaultRotation({ type: 'duplex', flipEdge: 'long' });
 * // Returns: { front: 0, back: 180 }
 * 
 * const gutter = getDefaultRotation({ type: 'gutter-fold', orientation: 'horizontal' });
 * // Returns: { front: 0, back: 180 }
 * ```
 */
export const getDefaultRotation = (pdfMode: PdfMode) => {
  // Front cards always default to 0 degrees
  const front = 0;
  
  // Back cards default based on mode:
  // - 0 degrees for: Duplex short edge, Gutter-fold vertical
  // - 180 degrees for: Duplex long edge, Gutter-fold horizontal
  let back = 0;
  
  if (pdfMode.type === 'duplex') {
    back = pdfMode.flipEdge === 'long' ? 180 : 0;
  } else if (pdfMode.type === 'gutter-fold') {
    back = pdfMode.orientation === 'horizontal' ? 180 : 0;
  }
  
  return { front, back };
};

/**
 * Base default settings for the application
 * 
 * This object contains the foundational default values used throughout
 * the application. These are "safe" defaults that work for most common
 * card game scenarios.
 * 
 * **Default Values:**
 * - **PDF Mode**: Duplex with short edge flip (most common)
 * - **Grid**: 2×3 (6 cards per page)
 * - **Card Size**: 2.5" × 3.5" (poker card standard)
 * - **Page Size**: 3.5" × 3.5" (single card output)
 * - **Bleed**: None (0 inches)
 * - **Scale**: 100% (no scaling)
 * - **Sizing Mode**: actual-size (no image scaling)
 * - **Rotation**: 0° for both front and back
 * - **Crop**: No cropping applied
 * 
 * **Usage Note:**
 * For mode-specific defaults, use `getDefaultSettingsForMode()` instead
 * which applies intelligent grid and rotation settings.
 */
export const DEFAULT_SETTINGS = {
  pdfMode: {
    type: 'duplex' as const,
    orientation: 'vertical' as const,
    flipEdge: 'short' as const
  },
  pageSettings: [],  extractionSettings: {
    crop: {
      top: 0,
      right: 0,
      bottom: 0,
      left: 0
    },
    grid: {
      rows: 2,
      columns: 3
    },
    gutterWidth: 0,
    cardCrop: {
      top: 0,
      right: 0,
      bottom: 0,
      left: 0
    },
    imageRotation: {
      front: 0,
      back: 0
    },
    skippedCards: []
  },  outputSettings: {
    pageSize: {
      width: 3.5,
      height: 3.5
    },
    offset: {
      horizontal: 0,
      vertical: 0
    },
    // Card size settings (poker card default)
    cardSize: {
      widthInches: 2.5,
      heightInches: 3.5
    },
    // Card scale setting (percentage)
    cardScalePercent: 100,
    // Bleed margin setting (inches)
    bleedMarginInches: 0,    // Card rotation settings
    rotation: {
      front: 0,
      back: 0
    },
    // Card image sizing mode
    cardImageSizingMode: 'actual-size' as 'actual-size' | 'fit-to-card' | 'fill-card',
    // Spacing between cards (for future multi-card layouts)
    spacing: {
      horizontal: 0,
      vertical: 0
    },
    // Card alignment within page
    cardAlignment: 'center' as 'top-left' | 'center',
    // Include color calibration in output
    includeColorCalibration: false
  }
};

/**
 * Get complete default settings with mode-specific grid and rotation
 * 
 * Combines the base DEFAULT_SETTINGS with intelligent mode-specific
 * configurations for grid layout and rotation. This is the recommended
 * way to initialize settings for a new PDF mode.
 * 
 * **Features:**
 * - Uses base defaults as foundation
 * - Applies mode-specific grid from getDefaultGrid()
 * - Applies mode-specific rotation from getDefaultRotation()
 * - Preserves all other default values
 * - Returns complete, ready-to-use settings object
 * 
 * @param pdfMode - PDF processing mode configuration
 * @returns Complete workflow settings with mode-specific adaptations
 * 
 * @example
 * ```typescript
 * const settings = getDefaultSettingsForMode({
 *   type: 'gutter-fold',
 *   orientation: 'vertical'
 * });
 * 
 * // Result includes:
 * // - Grid: { rows: 4, columns: 2 } (from getDefaultGrid)
 * // - Rotation: { front: 0, back: 0 } (from getDefaultRotation)
 * // - All other defaults: card size, bleed, scale, etc.
 * ```
 */
export const getDefaultSettingsForMode = (pdfMode: PdfMode) => {
  return {
    ...DEFAULT_SETTINGS,
    pdfMode,
    extractionSettings: {
      ...DEFAULT_SETTINGS.extractionSettings,
      grid: getDefaultGrid(pdfMode)
    },
    outputSettings: {
      ...DEFAULT_SETTINGS.outputSettings,
      rotation: getDefaultRotation(pdfMode)
    }
  };
};

/**
 * Complete workflow settings type definition
 * 
 * Defines the structure for all settings used throughout the application
 * workflow. This type represents the complete state that can be saved,
 * loaded, and passed between workflow steps.
 * 
 * **Main Sections:**
 * - `pdfMode`: Processing mode configuration (duplex/gutter-fold/simplex)
 * - `pageSettings`: Per-page configuration (skip flags, front/back types)
 * - `extractionSettings`: Grid, cropping, and image processing settings
 * - `outputSettings`: Page layout, card sizing, and final output configuration
 * - `colorSettings`: Color calibration and transformation settings
 * 
 * **Persistence:**
 * This type is used for:
 * - Auto-saving workflow state to localStorage
 * - Importing/exporting settings files
 * - Passing state between application components
 * - Validating loaded settings structure
 * 
 * **Version Compatibility:**
 * Includes optional `savedAt` and `version` fields for tracking
 * settings origin and enabling future migration logic.
 */
export type WorkflowSettings = {
  pdfMode: PdfMode;
  pageSettings: PageSettings[];
  extractionSettings: {
    crop: {
      top: number;
      right: number;
      bottom: number;
      left: number;
    };
    grid: {
      rows: number;
      columns: number;
    };
    gutterWidth: number;
    cardCrop: {
      top: number;
      right: number;
      bottom: number;
      left: number;
    };
    imageRotation: {
      front: number;
      back: number;
    };
    skippedCards: any[];
  };  outputSettings: {
    pageSize: {
      width: number;
      height: number;
    };
    offset: {
      horizontal: number;
      vertical: number;
    };
    cardSize: {
      widthInches: number;
      heightInches: number;
    };
    cardScalePercent: number;
    bleedMarginInches: number;
    rotation: {
      front: number;
      back: number;
    };
    cardImageSizingMode: 'actual-size' | 'fit-to-card' | 'fill-card';
    spacing: {
      horizontal: number;
      vertical: number;
    };
    cardAlignment: 'top-left' | 'center';
    includeColorCalibration: boolean;
  };
  colorSettings: {
    selectedRegion: any;
    gridConfig: { columns: number; rows: number };
    transformations: {
      horizontal: { type: string; min: number; max: number };
      vertical: { type: string; min: number; max: number };
    };
    selectedPreset: any;
    finalAdjustments: {
      brightness: number;
      contrast: number;
      saturation: number;
      hue: number;
      gamma: number;
      vibrance: number;
      redMultiplier: number;
      greenMultiplier: number;
      blueMultiplier: number;
      shadows: number;
      highlights: number;
      midtoneBalance: number;
      blackPoint: number;
      whitePoint: number;
      outputBlack: number;
      outputWhite: number;
    };
  };
  savedAt?: string;
  version?: string;
};
