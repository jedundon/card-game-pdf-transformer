import { WorkflowSettings } from '../defaults';
import { PdfMode, PageSettings } from '../types';

// Re-export WorkflowSettings for use in other modules
export type { WorkflowSettings };

const AUTOSAVE_KEY = 'card-pdf-transformer-autosave';
const AUTOSAVE_VERSION = '1.0';
const LAST_IMPORTED_FILE_KEY = 'card-pdf-transformer-last-file';
const FILE_INFO_VERSION = '1.0';

export interface AutoSaveData {
  settings: WorkflowSettings;
  timestamp: string;
  version: string;
}

export interface LastImportedFileInfo {
  name: string;
  size: number;
  lastModified: number;
  importTimestamp: string;
  version: string;
}

/**
 * Save current workflow settings to localStorage for auto-recovery
 */
export const saveSettingsToLocalStorage = (
  pdfMode: PdfMode,
  pageSettings: PageSettings[],
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

/**
 * Save last imported file information to localStorage
 */
export const saveLastImportedFile = (file: File): void => {
  try {
    const fileInfo: LastImportedFileInfo = {
      name: file.name,
      size: file.size,
      lastModified: file.lastModified,
      importTimestamp: new Date().toISOString(),
      version: FILE_INFO_VERSION
    };

    localStorage.setItem(LAST_IMPORTED_FILE_KEY, JSON.stringify(fileInfo));
  } catch (error) {
    console.warn('Failed to save last imported file info to localStorage:', error);
  }
};

/**
 * Load last imported file information from localStorage
 * Returns null if no valid file info exists
 */
export const getLastImportedFile = (): LastImportedFileInfo | null => {
  try {
    const saved = localStorage.getItem(LAST_IMPORTED_FILE_KEY);
    if (!saved) return null;

    const fileInfo: LastImportedFileInfo = JSON.parse(saved);
    
    // Validate structure and version
    if (!fileInfo.name || !fileInfo.importTimestamp || !fileInfo.version) {
      console.warn('Invalid last imported file info structure');
      return null;
    }

    // Validate required properties
    if (typeof fileInfo.size !== 'number' || typeof fileInfo.lastModified !== 'number') {
      console.warn('Invalid last imported file info data types');
      return null;
    }

    return fileInfo;
  } catch (error) {
    console.warn('Failed to load last imported file info from localStorage:', error);
    return null;
  }
};

/**
 * Clear last imported file information from localStorage
 */
export const clearLastImportedFile = (): void => {
  try {
    localStorage.removeItem(LAST_IMPORTED_FILE_KEY);
  } catch (error) {
    console.warn('Failed to clear last imported file info:', error);
  }
};

/**
 * Check if last imported file info exists
 */
export const hasLastImportedFile = (): boolean => {
  try {
    const saved = localStorage.getItem(LAST_IMPORTED_FILE_KEY);
    return saved !== null;
  } catch (error) {
    return false;
  }
};

/**
 * Format file size in human readable format
 */
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

/**
 * Format import timestamp in human readable format
 */
export const formatImportTimestamp = (timestamp: string): string => {
  try {
    const importDate = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - importDate.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffHours < 1) {
      return 'Less than an hour ago';
    } else if (diffHours < 24) {
      return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    } else if (diffDays < 7) {
      return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    } else {
      return importDate.toLocaleDateString();
    }
  } catch (error) {
    return 'Unknown';
  }
};