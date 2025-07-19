/**
 * @fileoverview PDF data management hook for file handling and processing state
 * 
 * Centralizes all PDF-related state management including file data, metadata,
 * processing status, and card dimension calculations. Handles the complete
 * lifecycle of PDF processing from initial file selection through card extraction.
 * 
 * **Key Features:**
 * - PDF file data and metadata management
 * - File name and size tracking
 * - Card dimension calculation and caching
 * - Last imported file persistence
 * - Processing state management
 * 
 * @example
 * ```typescript
 * const { 
 *   pdfData, 
 *   currentPdfFileName, 
 *   handleFileSelect, 
 *   clearPdfData 
 * } = usePdfData();
 * 
 * // Handle file selection
 * handleFileSelect(pdfDataObject, 'cards.pdf', fileObject);
 * ```
 */

import { useState, useCallback } from 'react';
import { PdfData } from '../types';
import { 
  saveLastImportedFile, 
  clearLastImportedFile, 
  getLastImportedFile,
  LastImportedFileInfo 
} from '../utils/localStorageUtils';

/**
 * Card dimensions information calculated from PDF processing
 */
export interface CardDimensions {
  /** Card width in pixels at extraction resolution */
  widthPx: number;
  /** Card height in pixels at extraction resolution */
  heightPx: number;
  /** Card width in inches for printing */
  widthInches: number;
  /** Card height in inches for printing */
  heightInches: number;
}

/**
 * PDF data management state
 */
export interface PdfDataState {
  /** Current PDF document data, null if no file loaded */
  pdfData: PdfData | null;
  /** Name of the currently loaded PDF file */
  currentPdfFileName: string;
  /** Calculated card dimensions from extraction process */
  cardDimensions: CardDimensions | null;
  /** Information about the last imported file from localStorage */
  lastImportedFileInfo: LastImportedFileInfo | null;
  /** Whether PDF data is currently being processed */
  isProcessing: boolean;
}

/**
 * PDF data management actions
 */
export interface PdfDataActions {
  /** Handle PDF file selection and processing */
  handleFileSelect: (data: PdfData | null, fileName: string, file?: File) => void;
  /** Update calculated card dimensions */
  setCardDimensions: (dimensions: CardDimensions | null) => void;
  /** Clear all PDF-related data and reset state */
  clearPdfData: () => void;
  /** Clear last imported file information */
  handleClearLastImportedFile: () => void;
  /** Set processing status */
  setProcessingStatus: (isProcessing: boolean) => void;
}

/**
 * Complete PDF data management interface
 */
export type PdfDataHook = PdfDataState & PdfDataActions;

/**
 * Custom hook for managing PDF file data and processing state
 * 
 * Provides centralized management of PDF-related state including file data,
 * metadata, card dimensions, and last imported file tracking. Integrates
 * with localStorage for persistence of file information.
 * 
 * **State Management:**
 * - PDF document data and parsing results
 * - File metadata (name, size, modification date)
 * - Card dimensions calculated during extraction
 * - Processing status for UI feedback
 * - Last imported file persistence for user convenience
 * 
 * **Integration Points:**
 * - localStorage utilities for file info persistence
 * - Type definitions from main types module
 * - Card extraction utilities for dimension calculation
 * 
 * @returns PDF data state and management actions
 * 
 * @example
 * ```typescript
 * // Basic PDF file handling
 * const pdfManager = usePdfData();
 * 
 * // Handle file selection
 * const handleUpload = (pdfData: PdfData, fileName: string, file: File) => {
 *   pdfManager.handleFileSelect(pdfData, fileName, file);
 * };
 * 
 * // Update card dimensions after extraction
 * pdfManager.setCardDimensions({
 *   widthPx: 750, heightPx: 1050,
 *   widthInches: 2.5, heightInches: 3.5
 * });
 * 
 * // Clear all data when starting over
 * pdfManager.clearPdfData();
 * ```
 */
export function usePdfData(): PdfDataHook {
  // Core PDF state
  const [pdfData, setPdfData] = useState<PdfData | null>(null);
  const [currentPdfFileName, setCurrentPdfFileName] = useState<string>('');
  const [cardDimensions, setCardDimensionsState] = useState<CardDimensions | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  
  // Last imported file tracking
  const [lastImportedFileInfo, setLastImportedFileInfo] = useState<LastImportedFileInfo | null>(() => {
    // Initialize from localStorage on first render
    return getLastImportedFile();
  });

  /**
   * Handle PDF file selection with file metadata tracking
   * 
   * Processes the selected PDF file, updates state, and persists file
   * information to localStorage for user convenience.
   * 
   * @param data - Parsed PDF document data
   * @param fileName - Name of the selected file
   * @param file - Optional File object for metadata extraction
   */
  const handleFileSelect = useCallback((data: PdfData | null, fileName: string, file?: File): void => {
    // Update core PDF state
    setPdfData(data);
    setCurrentPdfFileName(fileName);
    
    // Clear any existing card dimensions since we have a new PDF
    setCardDimensionsState(null);
    
    // Reset processing status
    setIsProcessing(false);
    
    // Save file info to localStorage if File object is provided
    if (file) {
      saveLastImportedFile(file);
      
      // Update the current lastImportedFileInfo state
      const fileInfo: LastImportedFileInfo = {
        name: file.name,
        size: file.size,
        lastModified: file.lastModified,
        importTimestamp: new Date().toISOString(),
        version: '1.0'
      };
      setLastImportedFileInfo(fileInfo);
    }
  }, []);

  /**
   * Update card dimensions calculated during extraction
   * 
   * @param dimensions - Card dimension data or null to clear
   */
  const setCardDimensions = useCallback((dimensions: CardDimensions | null): void => {
    setCardDimensionsState(dimensions);
  }, []);

  /**
   * Clear all PDF-related data and reset to initial state
   * 
   * Resets all PDF state including document data, file name, card dimensions,
   * and processing status. Does not affect lastImportedFileInfo persistence.
   */
  const clearPdfData = useCallback((): void => {
    setPdfData(null);
    setCurrentPdfFileName('');
    setCardDimensionsState(null);
    setIsProcessing(false);
  }, []);

  /**
   * Clear last imported file information from both state and localStorage
   * 
   * Removes the file tracking information used for user convenience features.
   */
  const handleClearLastImportedFile = useCallback((): void => {
    clearLastImportedFile();
    setLastImportedFileInfo(null);
  }, []);

  /**
   * Update processing status for UI feedback
   * 
   * @param processing - Whether PDF processing is currently active
   */
  const setProcessingStatus = useCallback((processing: boolean): void => {
    setIsProcessing(processing);
  }, []);

  return {
    // State
    pdfData,
    currentPdfFileName,
    cardDimensions,
    lastImportedFileInfo,
    isProcessing,
    
    // Actions
    handleFileSelect,
    setCardDimensions,
    clearPdfData,
    handleClearLastImportedFile,
    setProcessingStatus
  };
}