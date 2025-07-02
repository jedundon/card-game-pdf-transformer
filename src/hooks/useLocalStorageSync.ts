/**
 * @fileoverview localStorage synchronization hook for settings persistence
 * 
 * Manages automatic saving and restoring of application settings with localStorage,
 * including debounced auto-save, settings import/export validation, and page count
 * mismatch handling. Provides seamless persistence across browser sessions.
 * 
 * **Key Features:**
 * - Debounced auto-save (1 second delay)
 * - Automatic settings restoration on app start
 * - Settings import with validation
 * - Page count mismatch detection and dialog management
 * - Auto-restore flag tracking
 * - Error handling and recovery
 * 
 * @example
 * ```typescript
 * const { 
 *   autoRestoredSettings, 
 *   handleLoadSettings,
 *   pageCountMismatchDialog 
 * } = useLocalStorageSync(settingsToSync, pdfData);
 * ```
 */

import { useState, useEffect, useCallback } from 'react';
import { PdfData } from '../types';
import { 
  saveSettingsToLocalStorage, 
  loadSettingsFromLocalStorage,
  WorkflowSettings
} from '../utils/localStorageUtils';
import { SettingsState } from './useSettingsManager';

/**
 * Page count mismatch dialog state
 */
export interface PageCountMismatchDialog {
  /** Whether the dialog is currently open */
  isOpen: boolean;
  /** Number of pages in current PDF */
  currentPdfPageCount: number;
  /** Number of pages in imported settings */
  importedSettingsPageCount: number;
  /** List of settings that were successfully applied */
  appliedSettings: string[];
  /** List of settings that were skipped due to conflicts */
  skippedSettings: string[];
  /** The pending settings awaiting user decision */
  pendingSettings: WorkflowSettings | null;
}

/**
 * localStorage sync state
 */
export interface LocalStorageSyncState {
  /** Whether settings were auto-restored from localStorage */
  autoRestoredSettings: boolean;
  /** Page count mismatch dialog state */
  pageCountMismatchDialog: PageCountMismatchDialog;
}

/**
 * localStorage sync actions
 */
export interface LocalStorageSyncActions {
  /** Handle loading settings from file or auto-restore */
  handleLoadSettings: (settings: WorkflowSettings, isAutoRestore?: boolean) => void;
  /** Handle page count mismatch dialog close */
  handlePageCountMismatchClose: () => void;
  /** Handle page count mismatch dialog proceed */
  handlePageCountMismatchProceed: () => void;
  /** Clear auto-restored flag */
  clearAutoRestoredFlag: () => void;
  /** Manually trigger settings save */
  saveSettingsNow: () => void;
}

/**
 * Complete localStorage sync interface
 */
export type LocalStorageSyncHook = LocalStorageSyncState & LocalStorageSyncActions;

/**
 * Default page count mismatch dialog state
 */
const DEFAULT_DIALOG_STATE: PageCountMismatchDialog = {
  isOpen: false,
  currentPdfPageCount: 0,
  importedSettingsPageCount: 0,
  appliedSettings: [],
  skippedSettings: [],
  pendingSettings: null
};

/**
 * Custom hook for localStorage synchronization and settings persistence
 * 
 * Provides automatic saving and restoration of application settings with
 * intelligent validation and error handling. Manages the complete persistence
 * lifecycle including debounced auto-save, settings validation, and user
 * interaction for conflict resolution.
 * 
 * **Auto-Save Behavior:**
 * - Debounced saving with 1 second delay
 * - Saves all settings categories (mode, page, extraction, output, color)
 * - Error handling with fallback behavior
 * - Version compatibility checking
 * 
 * **Settings Import:**
 * - Validates settings structure and compatibility
 * - Detects page count mismatches with current PDF
 * - Provides user dialog for conflict resolution
 * - Applies compatible settings immediately
 * 
 * **Page Count Validation:**
 * - Compares imported page settings with current PDF
 * - Shows dialog for manual resolution when counts don't match
 * - Preserves user workflow during imports
 * 
 * @param currentSettings - Current application settings to sync
 * @param pdfData - Current PDF data for validation
 * @param onSettingsApply - Callback to apply loaded settings
 * @returns localStorage sync state and actions
 * 
 * @example
 * ```typescript
 * // Setup localStorage sync
 * const syncManager = useLocalStorageSync(
 *   currentSettings,
 *   pdfData,
 *   (settings) => settingsManager.applySettings(settings)
 * );
 * 
 * // Handle settings import
 * const importSettings = (fileSettings: WorkflowSettings) => {
 *   syncManager.handleLoadSettings(fileSettings, false);
 * };
 * 
 * // Check if settings were auto-restored
 * if (syncManager.autoRestoredSettings) {
 *   showRestoreNotification();
 * }
 * ```
 */
export function useLocalStorageSync(
  currentSettings: SettingsState,
  pdfData: PdfData | null,
  onSettingsApply: (settings: Partial<SettingsState>) => void
): LocalStorageSyncHook {
  // State management
  const [autoRestoredSettings, setAutoRestoredSettings] = useState<boolean>(false);
  const [pageCountMismatchDialog, setPageCountMismatchDialog] = useState<PageCountMismatchDialog>(DEFAULT_DIALOG_STATE);

  // Auto-restore settings from localStorage on hook initialization
  useEffect(() => {
    const autoSavedSettings = loadSettingsFromLocalStorage();
    if (autoSavedSettings) {
      console.log('Auto-restoring settings from localStorage');
      handleLoadSettings(autoSavedSettings, true);
      setAutoRestoredSettings(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty dependency array - initialization effect should only run once on mount

  // Auto-save settings whenever they change (debounced)
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      const { pdfMode, pageSettings, extractionSettings, outputSettings, colorSettings } = currentSettings;
      saveSettingsToLocalStorage(pdfMode, pageSettings, extractionSettings, outputSettings, colorSettings);
    }, 1000); // 1 second debounce

    return () => clearTimeout(timeoutId);
  }, [currentSettings]);

  /**
   * Handle loading settings from file or auto-restore
   * 
   * Processes imported settings with validation and conflict detection.
   * Shows page count mismatch dialog for manual imports when necessary.
   * 
   * @param settings - Settings to import and apply
   * @param isAutoRestore - Whether this is an automatic restore (vs manual import)
   */
  const handleLoadSettings = useCallback((settings: WorkflowSettings, isAutoRestore = false): void => {
    const appliedSettings: string[] = [];
    const skippedSettings: string[] = [];
    
    // Apply compatible settings first
    const settingsToApply: Partial<SettingsState> = {};
    
    if (settings.pdfMode) {
      settingsToApply.pdfMode = settings.pdfMode;
      appliedSettings.push('PDF Mode');
    }
    
    if (settings.extractionSettings) {
      settingsToApply.extractionSettings = settings.extractionSettings;
      appliedSettings.push('Extraction Settings (grid layout, cropping)');
    }
    
    if (settings.outputSettings) {
      settingsToApply.outputSettings = settings.outputSettings;
      appliedSettings.push('Output Settings (page size, card dimensions, positioning)');
    }
    
    if (settings.colorSettings) {
      settingsToApply.colorSettings = settings.colorSettings;
      appliedSettings.push('Color Calibration Settings');
    }
    
    // Handle pageSettings with validation against current PDF
    if (settings.pageSettings) {
      const currentPdfPageCount = pdfData && (pdfData as any).numPages;
      const importedPageCount = settings.pageSettings.length;
      
      if (currentPdfPageCount && importedPageCount !== currentPdfPageCount) {
        // Page count mismatch detected
        console.warn(`Page count mismatch: Current PDF has ${currentPdfPageCount} pages, but imported settings are for ${importedPageCount} pages.`);
        
        skippedSettings.push('Page Settings (page types and skip flags)');
        
        // Show dialog for manual imports (not auto-restore)
        if (!isAutoRestore) {
          setPageCountMismatchDialog({
            isOpen: true,
            currentPdfPageCount,
            importedSettingsPageCount: importedPageCount,
            appliedSettings,
            skippedSettings,
            pendingSettings: settings
          });
          return; // Don't clear auto-restored flag yet, dialog will handle it
        }
      } else {
        // Safe to import pageSettings (same page count or no current PDF)
        settingsToApply.pageSettings = settings.pageSettings;
        appliedSettings.push('Page Settings (page types and skip flags)');
      }
    }
    
    // Apply the settings
    onSettingsApply(settingsToApply);
    
    // Clear auto-restored flag when manually loading settings (not auto-restore)
    if (!isAutoRestore) {
      setAutoRestoredSettings(false);
    }
  }, [pdfData, onSettingsApply]);

  /**
   * Handle page count mismatch dialog close
   * 
   * Closes the dialog and resets state without applying conflicting settings.
   */
  const handlePageCountMismatchClose = useCallback((): void => {
    setPageCountMismatchDialog(DEFAULT_DIALOG_STATE);
  }, []);

  /**
   * Handle page count mismatch dialog proceed
   * 
   * Closes the dialog and clears auto-restored flag for manual imports.
   */
  const handlePageCountMismatchProceed = useCallback((): void => {
    // Clear auto-restored flag since this was a manual import
    setAutoRestoredSettings(false);
    
    // Close the dialog
    handlePageCountMismatchClose();
  }, [handlePageCountMismatchClose]);

  /**
   * Clear auto-restored flag
   * 
   * Manually clears the flag indicating settings were auto-restored.
   */
  const clearAutoRestoredFlag = useCallback((): void => {
    setAutoRestoredSettings(false);
  }, []);

  /**
   * Manually trigger settings save
   * 
   * Forces immediate save of current settings, bypassing debounce.
   */
  const saveSettingsNow = useCallback((): void => {
    const { pdfMode, pageSettings, extractionSettings, outputSettings, colorSettings } = currentSettings;
    saveSettingsToLocalStorage(pdfMode, pageSettings, extractionSettings, outputSettings, colorSettings);
  }, [currentSettings]);

  return {
    // State
    autoRestoredSettings,
    pageCountMismatchDialog,
    
    // Actions
    handleLoadSettings,
    handlePageCountMismatchClose,
    handlePageCountMismatchProceed,
    clearAutoRestoredFlag,
    saveSettingsNow
  };
}