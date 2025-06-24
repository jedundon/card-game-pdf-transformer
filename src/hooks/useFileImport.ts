/**
 * @fileoverview File import management hook for settings import workflow
 * 
 * Manages the file import functionality including settings file selection,
 * import trigger management, and import workflow coordination. Provides
 * clean separation between file import mechanics and settings application.
 * 
 * **Key Features:**
 * - Import trigger callback management
 * - File import workflow coordination
 * - Import state tracking
 * - Error handling for import operations
 * - Integration with ImportExportManager component
 * 
 * @example
 * ```typescript
 * const { 
 *   triggerImportSettings, 
 *   handleTriggerImportSettings,
 *   setTriggerImportRef 
 * } = useFileImport();
 * 
 * // Trigger import programmatically
 * handleTriggerImportSettings();
 * ```
 */

import { useState, useCallback, useRef } from 'react';

/**
 * File import state
 */
export interface FileImportState {
  /** Callback function to trigger import dialog */
  triggerImportSettings: (() => void) | null;
  /** Whether an import operation is currently in progress */
  isImporting: boolean;
  /** Last import error message, if any */
  importError: string | null;
}

/**
 * File import actions
 */
export interface FileImportActions {
  /** Trigger the import settings functionality */
  handleTriggerImportSettings: () => void;
  /** Set the import trigger callback reference */
  setTriggerImportRef: (trigger: (() => void) | null) => void;
  /** Set import status */
  setImportStatus: (isImporting: boolean) => void;
  /** Set import error message */
  setImportError: (error: string | null) => void;
  /** Clear import state */
  clearImportState: () => void;
}

/**
 * Complete file import interface
 */
export type FileImportHook = FileImportState & FileImportActions;

/**
 * Custom hook for managing file import functionality
 * 
 * Provides centralized management of the settings import workflow including
 * trigger callback management, import state tracking, and error handling.
 * Designed to work seamlessly with the ImportExportManager component.
 * 
 * **Import Flow:**
 * 1. ImportExportManager provides trigger callback via setTriggerImportRef
 * 2. User or component calls handleTriggerImportSettings
 * 3. ImportExportManager opens file dialog and processes selection
 * 4. Settings are validated and applied via other hooks
 * 5. Import state is updated with success/error status
 * 
 * **Integration Points:**
 * - ImportExportManager component for file dialog management
 * - useLocalStorageSync hook for settings validation and application
 * - Error boundary components for import error handling
 * 
 * @returns File import state and management actions
 * 
 * @example
 * ```typescript
 * // Basic import management
 * const importManager = useFileImport();
 * 
 * // Setup with ImportExportManager
 * <ImportExportManager
 *   onTriggerImportRef={importManager.setTriggerImportRef}
 *   // ... other props
 * />
 * 
 * // Trigger import from UI
 * const handleImportClick = () => {
 *   importManager.handleTriggerImportSettings();
 * };
 * 
 * // Handle import errors
 * if (importManager.importError) {
 *   showErrorMessage(importManager.importError);
 * }
 * ```
 */
export function useFileImport(): FileImportHook {
  // State management
  const triggerImportRef = useRef<(() => void) | null>(null);
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [importError, setImportError] = useState<string | null>(null);

  /**
   * Trigger the import settings functionality
   * 
   * Executes the import trigger callback if available, otherwise logs a warning.
   * Used to programmatically initiate the settings import workflow.
   */
  const handleTriggerImportSettings = useCallback((): void => {
    if (triggerImportRef.current) {
      try {
        setIsImporting(true);
        setImportError(null);
        triggerImportRef.current();
        // Reset importing status immediately since file dialog opens synchronously
        setIsImporting(false);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown import error';
        console.error('Import trigger failed:', error);
        setImportError(errorMessage);
        setIsImporting(false);
      }
    } else {
      console.warn('Import trigger not available - ImportExportManager may not be properly initialized');
      setImportError('Import functionality not available');
    }
  }, []);

  /**
   * Set the import trigger callback reference
   * 
   * Called by ImportExportManager to provide the trigger callback.
   * This establishes the connection between the import hook and the
   * file dialog management component.
   * 
   * @param trigger - Callback function to trigger import dialog, or null to clear
   */
  const setTriggerImportRef = useCallback((trigger: (() => void) | null): void => {
    triggerImportRef.current = trigger;
    
    // Clear any existing errors when trigger is updated
    if (trigger) {
      setImportError(null);
    }
  }, []);

  /**
   * Set import status
   * 
   * Updates the import operation status for UI feedback.
   * 
   * @param importing - Whether an import operation is currently active
   */
  const setImportStatus = useCallback((importing: boolean): void => {
    setIsImporting(importing);
    
    // Clear errors when starting a new import
    if (importing) {
      setImportError(null);
    }
  }, []);

  /**
   * Set import error message
   * 
   * Updates the error state with a descriptive message for user feedback.
   * 
   * @param error - Error message or null to clear errors
   */
  const setImportErrorState = useCallback((error: string | null): void => {
    setImportError(error);
    
    // Stop importing status when error occurs
    if (error) {
      setIsImporting(false);
    }
  }, []);

  /**
   * Clear import state
   * 
   * Resets all import-related state to initial values.
   * Useful for cleanup or reset operations.
   */
  const clearImportState = useCallback((): void => {
    setIsImporting(false);
    setImportError(null);
    // Note: Don't clear triggerImportSettings as it's managed by ImportExportManager
  }, []);

  return {
    // State
    triggerImportSettings: triggerImportRef.current,
    isImporting,
    importError,
    
    // Actions
    handleTriggerImportSettings,
    setTriggerImportRef,
    setImportStatus,
    setImportError: setImportErrorState,
    clearImportState
  };
}