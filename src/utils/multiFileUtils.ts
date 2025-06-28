/**
 * @fileoverview Multi-file management utilities
 * 
 * This module provides core functionality for managing multiple imported files
 * and combining them into a unified page list that can be processed by the
 * existing card extraction workflow. It handles both PDF and image files.
 * 
 * **Key Responsibilities:**
 * - Combining multiple files into unified page lists
 * - File source tracking and metadata management
 * - Page reordering with source preservation
 * - Cross-file validation and error handling
 * - State management for multi-file sessions
 * 
 * **Integration Points:**
 * - Works with existing PDF processing pipeline
 * - Integrates with image processing utilities
 * - Maintains compatibility with single-file workflows
 * - Supports all existing PDF modes (simplex/duplex/gutter-fold)
 * 
 * @author Card Game PDF Transformer
 */

import type { PDFDocumentProxy } from 'pdfjs-dist';
import { 
  PageSettings, 
  FileSource, 
  PageSource, 
  MultiFileImportState, 
  ImageFileData,
  PdfMode
} from '../types';
import { FILE_SIZE_LIMITS } from '../constants';
import { 
  isValidImageFile 
} from './imageUtils';

/**
 * Validate if a file is a supported PDF
 * 
 * Checks file type and extension to ensure it's a valid PDF file.
 * Complements the image file validation for complete file support.
 * 
 * @param file - File to validate
 * @returns true if the file is a valid PDF
 * 
 * @example
 * ```typescript
 * const file = new File(['data'], 'cards.pdf', { type: 'application/pdf' });
 * const isValid = isValidPdfFile(file); // Returns true
 * ```
 */
export function isValidPdfFile(file: File): boolean {
  const validTypes = ['application/pdf'];
  const validExtensions = ['.pdf'];
  
  // Check MIME type
  if (!validTypes.includes(file.type)) {
    return false;
  }
  
  // Check file extension
  const fileName = file.name.toLowerCase();
  const hasValidExtension = validExtensions.some(ext => fileName.endsWith(ext));
  
  return hasValidExtension;
}

/**
 * Validate multiple files for multi-file import
 * 
 * Performs comprehensive validation on a collection of files to ensure
 * they can all be processed together. Checks file types, sizes, and
 * total import limits.
 * 
 * @param files - Array of files to validate
 * @returns Validation results with categorized files and errors
 * 
 * @example
 * ```typescript
 * const files = [pdfFile, imageFile1, imageFile2];
 * const validation = validateMultiFileSelection(files);
 * if (validation.isValid) {
 *   // Proceed with import
 * } else {
 *   // Show validation errors
 * }
 * ```
 */
export function validateMultiFileSelection(files: File[]): {
  isValid: boolean;
  validPdfFiles: File[];
  validImageFiles: File[];
  errors: Array<{ file: File; error: string }>;
  totalSize: number;
  totalPages: number;
} {
  const validPdfFiles: File[] = [];
  const validImageFiles: File[] = [];
  const errors: Array<{ file: File; error: string }> = [];
  let totalSize = 0;
  let estimatedPages = 0;
  
  // Check file count limit
  if (files.length > FILE_SIZE_LIMITS.MAX_FILES) {
    errors.push({
      file: files[0], // Use first file for the error
      error: `Too many files selected. Maximum is ${FILE_SIZE_LIMITS.MAX_FILES} files.`
    });
  }
  
  // Validate each file
  for (const file of files) {
    totalSize += file.size;
    
    if (isValidPdfFile(file)) {
      if (file.size <= FILE_SIZE_LIMITS.PDF_MAX_SIZE) {
        validPdfFiles.push(file);
        // Estimate 10 pages per PDF for validation (actual count determined during processing)
        estimatedPages += 10;
      } else {
        errors.push({
          file,
          error: `PDF file too large: ${Math.round(file.size / 1024 / 1024)}MB (max: ${Math.round(FILE_SIZE_LIMITS.PDF_MAX_SIZE / 1024 / 1024)}MB)`
        });
      }
    } else if (isValidImageFile(file)) {
      if (file.size <= FILE_SIZE_LIMITS.IMAGE_MAX_SIZE) {
        validImageFiles.push(file);
        // Each image is 1 page
        estimatedPages += 1;
      } else {
        errors.push({
          file,
          error: `Image file too large: ${Math.round(file.size / 1024 / 1024)}MB (max: ${Math.round(FILE_SIZE_LIMITS.IMAGE_MAX_SIZE / 1024 / 1024)}MB)`
        });
      }
    } else {
      errors.push({
        file,
        error: `Unsupported file type: ${file.type}. Only PDF, PNG, JPG, and JPEG files are supported.`
      });
    }
  }
  
  // Check total size limit
  if (totalSize > FILE_SIZE_LIMITS.TOTAL_MAX_SIZE) {
    errors.push({
      file: files[0],
      error: `Total file size too large: ${Math.round(totalSize / 1024 / 1024)}MB (max: ${Math.round(FILE_SIZE_LIMITS.TOTAL_MAX_SIZE / 1024 / 1024)}MB)`
    });
  }
  
  // Check estimated page count
  if (estimatedPages > FILE_SIZE_LIMITS.MAX_TOTAL_PAGES) {
    errors.push({
      file: files[0],
      error: `Too many pages estimated: ~${estimatedPages} (max: ${FILE_SIZE_LIMITS.MAX_TOTAL_PAGES})`
    });
  }
  
  const isValid = errors.length === 0 && (validPdfFiles.length > 0 || validImageFiles.length > 0);
  
  return {
    isValid,
    validPdfFiles,
    validImageFiles,
    errors,
    totalSize,
    totalPages: estimatedPages
  };
}

/**
 * Create FileSource for a PDF file
 * 
 * Generates metadata for a PDF file to track it in the multi-file system.
 * The page count will be updated after PDF processing is complete.
 * 
 * @param file - PDF file to create metadata for
 * @param pageCount - Number of pages in the PDF (determined after processing)
 * @returns FileSource object for the PDF
 * 
 * @example
 * ```typescript
 * const pdfSource = createPdfFileSource(file, 20);
 * // Returns: { name: 'cards.pdf', type: 'pdf', originalPageCount: 20, ... }
 * ```
 */
export function createPdfFileSource(file: File, pageCount: number): FileSource {
  return {
    name: file.name,
    type: 'pdf',
    originalPageCount: pageCount,
    size: file.size,
    importTimestamp: Date.now()
  };
}

/**
 * Combine multiple processed files into unified page list
 * 
 * Takes processed PDF data and image data from multiple files and combines
 * them into a single page list that can be used by the existing workflow.
 * Maintains source tracking for each page.
 * 
 * @param pdfFiles - Array of processed PDF data with metadata
 * @param imageFiles - Array of processed image data with metadata
 * @param pdfMode - Current PDF processing mode
 * @returns Combined page list with source tracking
 * 
 * @example
 * ```typescript
 * const pdfFiles = [{ pdf: pdfData, source: pdfSource }];
 * const imageFiles = [{ image: imageData, source: imageSource }];
 * const combined = combineMultipleFiles(pdfFiles, imageFiles, pdfMode);
 * ```
 */
export function combineMultipleFiles(
  pdfFiles: Array<{ pdf: PDFDocumentProxy; source: FileSource }>,
  imageFiles: Array<{ image: ImageFileData; source: FileSource }>,
  pdfMode: PdfMode
): (PageSettings & PageSource)[] {
  const combinedPages: (PageSettings & PageSource)[] = [];
  let displayOrder = 0;
  
  // Process files in the order they were imported
  const allFiles = [
    ...pdfFiles.map(f => ({ ...f, type: 'pdf' as const })),
    ...imageFiles.map(f => ({ ...f, type: 'image' as const }))
  ].sort((a, b) => a.source.importTimestamp - b.source.importTimestamp);
  
  for (const fileData of allFiles) {
    if (fileData.type === 'pdf') {
      // Add pages from PDF
      const { pdf, source } = fileData;
      
      for (let pageIndex = 0; pageIndex < pdf.numPages; pageIndex++) {
        const pageSettings: PageSettings & PageSource = {
          skip: false,
          type: pdfMode.type === 'duplex' ? (pageIndex % 2 === 0 ? 'front' : 'back') : 'front',
          sourceFile: source.name,
          originalPageIndex: pageIndex,
          displayOrder: displayOrder++,
          fileName: source.name,
          fileType: 'pdf'
        };
        
        combinedPages.push(pageSettings);
      }
    } else {
      // Add image as single page
      const { source } = fileData;
      
      const pageSettings: PageSettings & PageSource = {
        skip: false,
        type: 'front', // Images are always treated as front cards
        sourceFile: source.name,
        originalPageIndex: 0, // Images are always page 0 of themselves
        displayOrder: displayOrder++,
        fileName: source.name,
        fileType: 'image'
      };
      
      combinedPages.push(pageSettings);
    }
  }
  
  return combinedPages;
}

/**
 * Create initial MultiFileImportState
 * 
 * Sets up the initial state structure for a multi-file import session.
 * This provides the foundation for tracking files, pages, and reorder state.
 * 
 * @returns Initial MultiFileImportState with empty collections
 * 
 * @example
 * ```typescript
 * const initialState = createInitialMultiFileState();
 * // Returns state with empty files, pages, and default reorder state
 * ```
 */
export function createInitialMultiFileState(): MultiFileImportState {
  return {
    files: [],
    pages: [],
    reorderState: {
      dragIndex: null,
      hoverIndex: null,
      isDragging: false,
      pageOrder: []
    },
    originalPageOrder: [],
    isProcessing: false,
    errors: {}
  };
}

/**
 * Add files to existing MultiFileImportState
 * 
 * Processes new files and adds them to an existing multi-file state.
 * This supports incremental file addition during a session.
 * 
 * @param currentState - Current multi-file import state
 * @param newFiles - New files to add to the session
 * @param processedData - Processed data for the new files
 * @returns Updated state with new files added
 * 
 * @example
 * ```typescript
 * const newFiles = [file1, file2];
 * const processedData = await processFiles(newFiles);
 * const updatedState = addFilesToState(currentState, newFiles, processedData);
 * ```
 */
export function addFilesToState(
  currentState: MultiFileImportState,
  _newFiles: File[],
  processedData: {
    pdfFiles: Array<{ pdf: PDFDocumentProxy; source: FileSource }>;
    imageFiles: Array<{ image: ImageFileData; source: FileSource }>;
  },
  pdfMode: PdfMode
): MultiFileImportState {
  // Combine new files with existing sources
  const newSources = [
    ...processedData.pdfFiles.map(f => f.source),
    ...processedData.imageFiles.map(f => f.source)
  ];
  
  const allSources = [...currentState.files, ...newSources];
  
  // Generate new combined page list
  const existingPdfFiles = currentState.files
    .filter(f => f.type === 'pdf')
    .map(source => {
      // This would need actual PDF data - in real implementation,
      // we'd need to track the PDF data alongside the FileSource
      return { pdf: null as any, source }; // Placeholder
    });
  
  const existingImageFiles = currentState.files
    .filter(f => f.type === 'image')
    .map(source => {
      // Similar placeholder for image data
      return { image: null as any, source }; // Placeholder
    });
  
  const allPdfFiles = [...existingPdfFiles, ...processedData.pdfFiles];
  const allImageFiles = [...existingImageFiles, ...processedData.imageFiles];
  
  const combinedPages = combineMultipleFiles(allPdfFiles, allImageFiles, pdfMode);
  
  // Update page order to include new pages
  const newPageOrder = Array.from({ length: combinedPages.length }, (_, index) => index);
  
  return {
    ...currentState,
    files: allSources,
    pages: combinedPages,
    reorderState: {
      ...currentState.reorderState,
      pageOrder: newPageOrder
    }
  };
}

/**
 * Remove file from MultiFileImportState
 * 
 * Removes a file and all its pages from the multi-file state, updating
 * page order and display indices accordingly.
 * 
 * @param currentState - Current multi-file import state
 * @param fileName - Name of file to remove
 * @returns Updated state with file and its pages removed
 * 
 * @example
 * ```typescript
 * const updatedState = removeFileFromState(currentState, 'unwanted.pdf');
 * // Removes 'unwanted.pdf' and all its pages from the state
 * ```
 */
export function removeFileFromState(
  currentState: MultiFileImportState,
  fileName: string
): MultiFileImportState {
  // Remove file from sources
  const updatedFiles = currentState.files.filter(file => file.name !== fileName);
  
  // Remove pages from that file
  const updatedPages = currentState.pages
    .filter(page => page.sourceFile !== fileName)
    .map((page, index) => ({
      ...page,
      displayOrder: index
    }));
  
  // Update page order
  const newPageOrder = Array.from({ length: updatedPages.length }, (_, index) => index);
  
  return {
    ...currentState,
    files: updatedFiles,
    pages: updatedPages,
    reorderState: {
      ...currentState.reorderState,
      pageOrder: newPageOrder
    }
  };
}

/**
 * Update processing state
 * 
 * Helper function to update the processing status in the multi-file state.
 * Used to show loading indicators during file processing operations.
 * 
 * @param currentState - Current multi-file import state
 * @param isProcessing - Whether files are currently being processed
 * @returns Updated state with new processing status
 * 
 * @example
 * ```typescript
 * // Start processing
 * const processingState = updateProcessingState(state, true);
 * 
 * // Complete processing
 * const completeState = updateProcessingState(state, false);
 * ```
 */
export function updateProcessingState(
  currentState: MultiFileImportState,
  isProcessing: boolean
): MultiFileImportState {
  return {
    ...currentState,
    isProcessing
  };
}

/**
 * Add error for file processing
 * 
 * Records an error that occurred during file processing in the state.
 * This allows the UI to display specific error messages for failed files.
 * 
 * @param currentState - Current multi-file import state
 * @param fileName - Name of file that had an error
 * @param error - Error message to record
 * @returns Updated state with error recorded
 * 
 * @example
 * ```typescript
 * const stateWithError = addFileError(state, 'corrupt.pdf', 'Failed to load PDF');
 * // Error can now be displayed in UI for the specific file
 * ```
 */
export function addFileError(
  currentState: MultiFileImportState,
  fileName: string,
  error: string
): MultiFileImportState {
  return {
    ...currentState,
    errors: {
      ...currentState.errors,
      [fileName]: error
    }
  };
}

/**
 * Clear error for specific file
 * 
 * Removes an error record for a specific file, typically used when
 * retrying file processing or when the error has been resolved.
 * 
 * @param currentState - Current multi-file import state
 * @param fileName - Name of file to clear error for
 * @returns Updated state with error removed
 * 
 * @example
 * ```typescript
 * const clearedState = clearFileError(state, 'fixed.pdf');
 * // Error for 'fixed.pdf' is removed from state
 * ```
 */
export function clearFileError(
  currentState: MultiFileImportState,
  fileName: string
): MultiFileImportState {
  const updatedErrors = { ...currentState.errors };
  delete updatedErrors[fileName];
  
  return {
    ...currentState,
    errors: updatedErrors
  };
}

/**
 * Get summary statistics for multi-file state
 * 
 * Calculates useful statistics about the current multi-file import state
 * for display in the UI and validation purposes.
 * 
 * @param state - Multi-file import state to analyze
 * @returns Summary statistics object
 * 
 * @example
 * ```typescript
 * const stats = getMultiFileStatistics(state);
 * console.log(`${stats.totalFiles} files, ${stats.totalPages} pages`);
 * ```
 */
export function getMultiFileStatistics(state: MultiFileImportState): {
  totalFiles: number;
  totalPages: number;
  totalSize: number;
  pdfFiles: number;
  imageFiles: number;
  skippedPages: number;
  errorCount: number;
} {
  const totalFiles = state.files.length;
  const totalPages = state.pages.length;
  const totalSize = state.files.reduce((sum, file) => sum + file.size, 0);
  const pdfFiles = state.files.filter(f => f.type === 'pdf').length;
  const imageFiles = state.files.filter(f => f.type === 'image').length;
  const skippedPages = state.pages.filter(p => p.skip).length;
  const errorCount = Object.keys(state.errors).length;
  
  return {
    totalFiles,
    totalPages,
    totalSize,
    pdfFiles,
    imageFiles,
    skippedPages,
    errorCount
  };
}