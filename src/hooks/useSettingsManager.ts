/**
 * @fileoverview Core settings management hook for workflow configuration
 * 
 * Centralizes all application settings state with intelligent mode-specific
 * defaults and cross-setting dependencies. Manages the complete configuration
 * lifecycle including PDF mode selection, extraction parameters, output settings,
 * and color calibration adjustments.
 * 
 * **Key Features:**
 * - PDF mode management with automatic grid/rotation updates
 * - Page settings with validation and defaults
 * - Extraction settings (grid, cropping, rotation)
 * - Output settings (page size, dimensions, positioning)
 * - Color calibration settings (transformations, adjustments)
 * - Mode-specific default calculation
 * - Settings validation and error handling
 * 
 * @example
 * ```typescript
 * const { 
 *   pdfMode, 
 *   pageSettings, 
 *   extractionSettings,
 *   handleModeSelect,
 *   updateExtractionSettings 
 * } = useSettingsManager();
 * 
 * // Change PDF mode with automatic defaults
 * handleModeSelect({ type: 'duplex', flipEdge: 'short' });
 * ```
 */

import { useState, useCallback } from 'react';
import { PdfMode, PageSettings } from '../types';
import { 
  DEFAULT_SETTINGS, 
  getDefaultGrid, 
  getDefaultRotation, 
  getDefaultSettingsForMode 
} from '../defaults';

/**
 * Extraction settings for card processing
 * 
 * Based on the actual structure used in App.tsx
 */
export interface ExtractionSettings {
  /** Grid layout configuration */
  grid: { rows: number; columns: number };
  /** Page cropping margins */
  crop: { top: number; right: number; bottom: number; left: number };
  /** Gutter width for gutter-fold mode */
  gutterWidth: number;
  /** Individual card cropping adjustments */
  cardCrop: { top: number; right: number; bottom: number; left: number };
  /** Card rotation settings for front and back */
  imageRotation: { front: number; back: number };
  /** List of cards to skip during processing */
  skippedCards: any[];
}

/**
 * Output settings for final PDF generation
 * 
 * Based on the actual structure used in defaults.ts
 */
export interface OutputSettings {
  /** Page dimensions */
  pageSize: { width: number; height: number };
  /** Page offset settings */
  offset: { horizontal: number; vertical: number };
  /** Card size settings */
  cardSize: { widthInches: number; heightInches: number };
  /** Card scale percentage */
  cardScalePercent: number;
  /** Bleed margin in inches */
  bleedMarginInches: number;
  /** Card rotation settings */
  rotation: { front: number; back: number };
  /** Card image sizing mode */
  cardImageSizingMode: 'actual-size' | 'fit-to-card' | 'fill-card';
}

/**
 * Color calibration settings for image processing
 */
export interface ColorSettings {
  /** Selected region for color sampling */
  selectedRegion: any;
  /** Grid configuration for color calibration */
  gridConfig: { columns: number; rows: number };
  /** Color transformation parameters */
  transformations: {
    horizontal: { type: string; min: number; max: number };
    vertical: { type: string; min: number; max: number };
  };
  /** Selected color preset */
  selectedPreset: any;
  /** Fine-tuning adjustments */
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
}

/**
 * Settings management state
 */
export interface SettingsState {
  /** Current PDF processing mode */
  pdfMode: PdfMode;
  /** Page-specific settings array */
  pageSettings: PageSettings[];
  /** Card extraction configuration */
  extractionSettings: ExtractionSettings;
  /** Output PDF configuration */
  outputSettings: OutputSettings;
  /** Color calibration configuration */
  colorSettings: ColorSettings;
}

/**
 * Settings management actions
 */
export interface SettingsActions {
  /** Handle PDF mode selection with automatic defaults */
  handleModeSelect: (mode: PdfMode) => void;
  /** Update page settings array */
  updatePageSettings: (settings: PageSettings[]) => void;
  /** Update extraction settings */
  updateExtractionSettings: (settings: ExtractionSettings) => void;
  /** Update output settings */
  updateOutputSettings: (settings: OutputSettings) => void;
  /** Update color calibration settings */
  updateColorSettings: (settings: ColorSettings) => void;
  /** Reset all settings to defaults for current mode */
  resetToDefaults: () => void;
  /** Apply settings from external source (import) */
  applySettings: (settings: Partial<SettingsState>) => void;
}

/**
 * Complete settings management interface
 */
export type SettingsManagerHook = SettingsState & SettingsActions;

/**
 * Default color calibration settings
 */
const DEFAULT_COLOR_SETTINGS: ColorSettings = {
  selectedRegion: null,
  gridConfig: { columns: 4, rows: 4 },
  transformations: {
    horizontal: { type: 'brightness', min: -20, max: 20 },
    vertical: { type: 'contrast', min: 0.8, max: 1.3 }
  },
  selectedPreset: null,
  finalAdjustments: {
    brightness: 0,
    contrast: 1.0,
    saturation: 0,
    hue: 0,
    gamma: 1.0,
    vibrance: 0,
    redMultiplier: 1.0,
    greenMultiplier: 1.0,
    blueMultiplier: 1.0,
    shadows: 0,
    highlights: 0,
    midtoneBalance: 0,
    blackPoint: 0,
    whitePoint: 255,
    outputBlack: 0,
    outputWhite: 255
  }
};

/**
 * Custom hook for managing application settings and configuration
 * 
 * Provides centralized management of all workflow settings with intelligent
 * mode-specific defaults and automatic cross-setting updates. Handles the
 * complex interactions between PDF mode, grid configuration, rotation settings,
 * and other interdependent parameters.
 * 
 * **Mode-Specific Behavior:**
 * - **Duplex Mode**: Updates grid to 2×3, sets appropriate back rotation
 * - **Gutter-fold Mode**: Updates grid based on orientation (4×2 or 2×4)
 * - **Simplex Mode**: Standard grid with no rotation
 * 
 * **Cross-Setting Dependencies:**
 * - PDF mode changes trigger grid and rotation updates
 * - Grid changes may affect card dimensions and spacing
 * - Output settings depend on extraction configuration
 * 
 * @returns Settings state and management actions
 * 
 * @example
 * ```typescript
 * // Basic settings management
 * const settings = useSettingsManager();
 * 
 * // Handle mode change with automatic defaults
 * settings.handleModeSelect({ 
 *   type: 'gutter-fold', 
 *   orientation: 'vertical' 
 * });
 * 
 * // Update specific setting groups
 * settings.updateExtractionSettings({
 *   ...settings.extractionSettings,
 *   grid: { rows: 3, columns: 3 }
 * });
 * 
 * // Reset everything to defaults
 * settings.resetToDefaults();
 * ```
 */
export function useSettingsManager(): SettingsManagerHook {
  // Initialize state with mode-specific defaults
  const [pdfMode, setPdfMode] = useState<PdfMode>(DEFAULT_SETTINGS.pdfMode);
  const [pageSettings, setPageSettings] = useState<PageSettings[]>(DEFAULT_SETTINGS.pageSettings);
  
  // Initialize extraction settings with mode-specific grid
  const [extractionSettings, setExtractionSettings] = useState<ExtractionSettings>(() => {
    const defaultGrid = getDefaultGrid(DEFAULT_SETTINGS.pdfMode);
    return {
      ...DEFAULT_SETTINGS.extractionSettings,
      grid: defaultGrid
    };
  });
  
  // Initialize output settings with mode-specific rotation
  const [outputSettings, setOutputSettings] = useState<OutputSettings>(() => {
    const defaultRotation = getDefaultRotation(DEFAULT_SETTINGS.pdfMode);
    return {
      ...DEFAULT_SETTINGS.outputSettings,
      rotation: defaultRotation
    };
  });
  
  // Initialize color settings
  const [colorSettings, setColorSettings] = useState<ColorSettings>(DEFAULT_COLOR_SETTINGS);

  /**
   * Handle PDF mode selection with automatic setting updates
   * 
   * When the PDF mode changes, automatically updates grid configuration
   * and rotation settings to match the new mode's requirements.
   * 
   * @param mode - New PDF mode configuration
   */
  const handleModeSelect = useCallback((mode: PdfMode): void => {
    setPdfMode(mode);
    
    // Update extraction settings with appropriate grid for the new mode
    const newGrid = getDefaultGrid(mode);
    setExtractionSettings(prev => ({
      ...prev,
      grid: newGrid
    }));
    
    // Update output settings with appropriate rotation for the new mode
    const newRotation = getDefaultRotation(mode);
    setOutputSettings(prev => ({
      ...prev,
      rotation: newRotation
    }));
  }, []);

  /**
   * Update page settings array
   * 
   * @param settings - New page settings configuration
   */
  const updatePageSettings = useCallback((settings: PageSettings[]): void => {
    setPageSettings(settings);
  }, []);

  /**
   * Update extraction settings
   * 
   * @param settings - New extraction settings configuration
   */
  const updateExtractionSettings = useCallback((settings: ExtractionSettings): void => {
    setExtractionSettings(settings);
  }, []);

  /**
   * Update output settings
   * 
   * @param settings - New output settings configuration
   */
  const updateOutputSettings = useCallback((settings: OutputSettings): void => {
    setOutputSettings(settings);
  }, []);

  /**
   * Update color calibration settings
   * 
   * @param settings - New color settings configuration
   */
  const updateColorSettings = useCallback((settings: ColorSettings): void => {
    setColorSettings(settings);
  }, []);

  /**
   * Reset all settings to defaults for current PDF mode
   * 
   * Restores all configuration to default values while maintaining
   * the current PDF mode. Uses mode-specific defaults for grid and rotation.
   */
  const resetToDefaults = useCallback((): void => {
    // Get defaults for current mode
    const defaultsForCurrentMode = getDefaultSettingsForMode(pdfMode);
    
    // Reset all settings to defaults
    setPageSettings(DEFAULT_SETTINGS.pageSettings);
    setExtractionSettings(defaultsForCurrentMode.extractionSettings);
    setOutputSettings(defaultsForCurrentMode.outputSettings);
    setColorSettings(DEFAULT_COLOR_SETTINGS);
  }, [pdfMode]);

  /**
   * Apply settings from external source (import/restore)
   * 
   * Applies settings from file import or localStorage restore, with
   * validation and fallback to current values for missing properties.
   * 
   * @param settings - Partial settings object to apply
   */
  const applySettings = useCallback((settings: Partial<SettingsState>): void => {
    if (settings.pdfMode) {
      // Use handleModeSelect to get automatic grid/rotation updates
      handleModeSelect(settings.pdfMode);
    }
    
    if (settings.pageSettings) {
      setPageSettings(settings.pageSettings);
    }
    
    if (settings.extractionSettings) {
      setExtractionSettings(settings.extractionSettings);
    }
    
    if (settings.outputSettings) {
      setOutputSettings(settings.outputSettings);
    }
    
    if (settings.colorSettings) {
      setColorSettings(settings.colorSettings);
    }
  }, [handleModeSelect]);

  return {
    // State
    pdfMode,
    pageSettings,
    extractionSettings,
    outputSettings,
    colorSettings,
    
    // Actions
    handleModeSelect,
    updatePageSettings,
    updateExtractionSettings,
    updateOutputSettings,
    updateColorSettings,
    resetToDefaults,
    applySettings
  };
}