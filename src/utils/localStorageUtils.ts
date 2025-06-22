import { WorkflowSettings } from '../defaults';

const AUTOSAVE_KEY = 'card-pdf-transformer-autosave';
const AUTOSAVE_VERSION = '1.0';

export interface AutoSaveData {
  settings: WorkflowSettings;
  timestamp: string;
  version: string;
}

/**
 * Save current workflow settings to localStorage for auto-recovery
 */
export const saveSettingsToLocalStorage = (
  pdfMode: any,
  pageSettings: any,
  extractionSettings: any,
  outputSettings: any,
  colorSettings: any
): void => {
  try {
    const autoSaveData: AutoSaveData = {
      settings: {
        pdfMode,
        pageSettings,
        extractionSettings,
        outputSettings,
        colorSettings,
        savedAt: new Date().toISOString(),
        version: AUTOSAVE_VERSION
      },
      timestamp: new Date().toISOString(),
      version: AUTOSAVE_VERSION
    };

    localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(autoSaveData));
  } catch (error) {
    console.warn('Failed to auto-save settings to localStorage:', error);
  }
};

/**
 * Load auto-saved settings from localStorage
 * Returns null if no valid auto-save data exists
 */
export const loadSettingsFromLocalStorage = (): WorkflowSettings | null => {
  try {
    const saved = localStorage.getItem(AUTOSAVE_KEY);
    if (!saved) return null;

    const autoSaveData: AutoSaveData = JSON.parse(saved);
    
    // Validate structure and version
    if (!autoSaveData.settings || !autoSaveData.version) {
      console.warn('Invalid auto-save data structure');
      return null;
    }

    // Validate required settings properties
    const { settings } = autoSaveData;
    if (!settings.pdfMode || !settings.extractionSettings || !settings.outputSettings) {
      console.warn('Invalid auto-saved settings structure');
      return null;
    }

    // colorSettings is optional for backward compatibility with older saves
    if (!settings.colorSettings) {
      console.log('Auto-saved settings missing colorSettings (older version), will use defaults');
    }

    return settings;
  } catch (error) {
    console.warn('Failed to load auto-saved settings from localStorage:', error);
    return null;
  }
};

/**
 * Clear auto-saved settings from localStorage
 */
export const clearLocalStorageSettings = (): void => {
  try {
    localStorage.removeItem(AUTOSAVE_KEY);
  } catch (error) {
    console.warn('Failed to clear auto-saved settings:', error);
  }
};

/**
 * Check if auto-saved settings exist
 */
export const hasAutoSavedSettings = (): boolean => {
  try {
    const saved = localStorage.getItem(AUTOSAVE_KEY);
    return saved !== null;
  } catch (error) {
    return false;
  }
};

/**
 * Get timestamp of last auto-save
 */
export const getAutoSaveTimestamp = (): string | null => {
  try {
    const saved = localStorage.getItem(AUTOSAVE_KEY);
    if (!saved) return null;

    const autoSaveData: AutoSaveData = JSON.parse(saved);
    return autoSaveData.timestamp || null;
  } catch (error) {
    return null;
  }
};