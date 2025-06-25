/**
 * @fileoverview Multi-file import state management hook
 * 
 * This hook manages the complex state needed for importing multiple PDF files
 * and handling their combined page reordering functionality. It provides a clean
 * interface for managing files, pages, and reordering operations while maintaining
 * compatibility with the existing single-file workflow.
 * 
 * **Key Features:**
 * - Multiple PDF file import and processing
 * - Combined page list with source file tracking
 * - Page reordering across multiple files
 * - File removal and management
 * - Error handling for individual file failures
 * - Backward compatibility with single-file operations
 * 
 * **Architecture:**
 * - Maintains MultiFileImportState as defined in types.ts
 * - Integrates with existing PDF processing pipeline
 * - Preserves originalPageIndex tracking from Phase 1
 * - Provides unified interface for both single and multi-file modes
 * 
 * @author Card Game PDF Transformer
 */

import { useState, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { 
  MultiFileImportState, 
  FileSource, 
  PageSettings, 
  PageSource, 
  PdfData
} from '../types';

// Configure PDF.js worker for Vite
pdfjsLib.GlobalWorkerOptions.workerSrc = '/card-game-pdf-transformer/pdf.worker.min.js';

/**
 * Multi-file import hook return interface
 */
interface UseMultiFileImportReturn {
  /** Current multi-file import state */
  multiFileState: MultiFileImportState;
  /** Whether multi-file mode is currently active */
  isMultiFileMode: boolean;
  /** Enable/disable multi-file mode */
  setMultiFileMode: (enabled: boolean) => void;
  /** Process multiple files */
  processFiles: (files: File[]) => Promise<{
    files: FileSource[];
    pages: (PageSettings & PageSource)[];
    errors: Record<string, string>;
    firstPdf: PdfData | null;
  }>;
  /** Process a single file (backward compatibility) */
  processSingleFile: (file: File) => Promise<PdfData | null>;
  /** Remove a specific file from the import list */
  removeFile: (fileName: string) => void;
  /** Update page settings for all pages */
  updateAllPageSettings: (settings: (PageSettings & Partial<PageSource>)[]) => void;
  /** Reorder pages across all files */
  reorderPages: (oldIndex: number, newIndex: number) => void;
  /** Remove a specific page */
  removePage: (pageIndex: number) => void;
  /** Get combined PDF data (for backward compatibility) */
  getCombinedPdfData: () => PdfData | null;
  /** Get combined page settings (for backward compatibility) */
  getCombinedPageSettings: () => PageSettings[];
  /** Reset all multi-file state */
  reset: () => void;
  /** Get current file list for display */
  getFileList: () => FileSource[];
  /** Get error for a specific file */
  getFileError: (fileName: string) => string | undefined;
}

/**
 * Custom hook for managing multi-file import operations
 */
export const useMultiFileImport = (): UseMultiFileImportReturn => {
  // Multi-file mode toggle
  const [isMultiFileMode, setIsMultiFileMode] = useState<boolean>(false);
  
  // Combined multi-file state
  const [multiFileState, setMultiFileState] = useState<MultiFileImportState>({
    files: [],
    pages: [],
    reorderState: {
      dragIndex: null,
      hoverIndex: null,
      isDragging: false,
      pageOrder: []
    },
    isProcessing: false,
    errors: {}
  });

  // Single PDF reference for backward compatibility
  const [singlePdfData, setSinglePdfData] = useState<PdfData | null>(null);

  /**
   * Validate if file is a PDF
   */
  const isValidPdfFile = useCallback((file: File): boolean => {
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
  }, []);

  /**
   * Process a single PDF file and return PDF data
   */
  const processSingleFile = useCallback(async (file: File): Promise<PdfData | null> => {
    if (!isValidPdfFile(file)) {
      throw new Error('Invalid file type. Only PDF files are supported.');
    }

    try {
      // Validate file size (limit to 100MB)
      const maxSize = 100 * 1024 * 1024; // 100MB
      if (file.size > maxSize) {
        throw new Error('File is too large. Please select a PDF file smaller than 100MB.');
      }

      // Read the file as ArrayBuffer with timeout
      const arrayBuffer = await Promise.race([
        file.arrayBuffer(),
        new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('File reading timed out. Please try a smaller file.')), 30000)
        )
      ]);

      // Load PDF using pdfjs-dist with timeout
      const loadingTask = pdfjsLib.getDocument({ 
        data: arrayBuffer,
        useWorkerFetch: false,
        maxImageSize: 50 * 1024 * 1024 // 50MB max image size
      });

      const pdf = await Promise.race([
        loadingTask.promise,
        new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('PDF loading timed out. The file may be corrupted or too complex.')), 45000)
        )
      ]);

      // Validate PDF
      if (!pdf || pdf.numPages === 0) {
        throw new Error('Invalid PDF file. The file appears to be empty or corrupted.');
      }

      if (pdf.numPages > 1000) {
        throw new Error('PDF has too many pages. Please select a PDF with fewer than 1000 pages.');
      }

      return pdf;
    } catch (error) {
      console.error('Error processing PDF file:', error);
      throw error;
    }
  }, [isValidPdfFile]);

  /**
   * Process multiple PDF files for multi-file mode
   */
  const processFiles = useCallback(async (files: File[]): Promise<{
    files: FileSource[];
    pages: (PageSettings & PageSource)[];
    errors: Record<string, string>;
    firstPdf: PdfData | null;
  }> => {
    setMultiFileState(prev => ({ ...prev, isProcessing: true, errors: {} }));

    const newFiles: FileSource[] = [];
    const newPages: (PageSettings & PageSource)[] = [];
    const errors: Record<string, string> = {};
    let firstPdf: PdfData | null = null;

    try {
      for (const file of files) {
        try {
          if (!isValidPdfFile(file)) {
            errors[file.name] = 'Invalid file type. Only PDF files are supported.';
            continue;
          }

          const pdf = await processSingleFile(file);
          if (!pdf) {
            errors[file.name] = 'Failed to process PDF file.';
            continue;
          }

          // Store first successful PDF for single-file compatibility
          if (!firstPdf) {
            firstPdf = pdf;
            setSinglePdfData(pdf);
          }

          // Create file source entry
          const fileSource: FileSource = {
            name: file.name,
            type: 'pdf',
            originalPageCount: pdf.numPages,
            size: file.size,
            importTimestamp: Date.now()
          };
          newFiles.push(fileSource);

          // Create page entries for this file
          for (let pageIndex = 0; pageIndex < pdf.numPages; pageIndex++) {
            const page: PageSettings & PageSource = {
              skip: false,
              type: pageIndex % 2 === 0 ? 'front' : 'back', // Default alternating
              fileName: file.name,
              originalPageIndex: pageIndex,
              fileType: 'pdf',
              displayOrder: newPages.length // Global display order across all files
            };
            newPages.push(page);
          }

        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
          errors[file.name] = errorMessage;
          console.error(`Error processing file ${file.name}:`, error);
        }
      }

      // Update state with results
      setMultiFileState(prev => ({
        ...prev,
        files: newFiles,
        pages: newPages,
        reorderState: {
          ...prev.reorderState,
          pageOrder: newPages.map((_, index) => index)
        },
        isProcessing: false,
        errors
      }));

      console.log(`Successfully processed ${newFiles.length} of ${files.length} files`);
      if (Object.keys(errors).length > 0) {
        console.warn('Some files failed to process:', errors);
      }

      // Return the processed data immediately
      return {
        files: newFiles,
        pages: newPages,
        errors,
        firstPdf
      };

    } catch (error) {
      console.error('Error in multi-file processing:', error);
      setMultiFileState(prev => ({
        ...prev,
        isProcessing: false,
        errors: { ...errors, _general: 'Failed to process files. Please try again.' }
      }));
      
      // Return empty results on error
      return {
        files: [],
        pages: [],
        errors: { ...errors, _general: 'Failed to process files. Please try again.' },
        firstPdf: null
      };
    }
  }, [isValidPdfFile, processSingleFile, singlePdfData]);

  /**
   * Remove a file from the multi-file list
   */
  const removeFile = useCallback((fileName: string) => {
    setMultiFileState(prev => {
      const newFiles = prev.files.filter(file => file.name !== fileName);
      const newPages = prev.pages.filter(page => page.fileName !== fileName);
      
      // Update display orders
      const updatedPages = newPages.map((page, index) => ({
        ...page,
        displayOrder: index
      }));

      return {
        ...prev,
        files: newFiles,
        pages: updatedPages,
        reorderState: {
          ...prev.reorderState,
          pageOrder: updatedPages.map((_, index) => index)
        },
        errors: Object.fromEntries(
          Object.entries(prev.errors).filter(([key]) => key !== fileName)
        )
      };
    });
  }, []);

  /**
   * Update page settings for all pages
   */
  const updateAllPageSettings = useCallback((settings: (PageSettings & Partial<PageSource>)[]) => {
    setMultiFileState(prev => {
      // If the settings include source information, use them directly (for reordering)
      if (settings.length > 0 && 'fileName' in settings[0]) {
        const updatedPages = settings.map((page, index) => ({
          ...page,
          displayOrder: index
        })) as (PageSettings & PageSource)[];

        return {
          ...prev,
          pages: updatedPages,
          reorderState: {
            ...prev.reorderState,
            pageOrder: updatedPages.map((_, index) => index)
          }
        };
      } else {
        // For settings-only updates, map to existing pages
        const updatedPages = prev.pages.map((page, index) => ({
          ...page,
          ...(settings[index] || {}),
          // Preserve source information
          fileName: page.fileName,
          originalPageIndex: page.originalPageIndex,
          fileType: page.fileType,
          displayOrder: index
        }));

        return {
          ...prev,
          pages: updatedPages
        };
      }
    });
  }, []);

  /**
   * Reorder pages across all files
   */
  const reorderPages = useCallback((oldIndex: number, newIndex: number) => {
    setMultiFileState(prev => {
      const newPages = [...prev.pages];
      const movedPage = newPages.splice(oldIndex, 1)[0];
      newPages.splice(newIndex, 0, movedPage);

      // Update display orders
      const updatedPages = newPages.map((page, index) => ({
        ...page,
        displayOrder: index
      }));

      return {
        ...prev,
        pages: updatedPages,
        reorderState: {
          ...prev.reorderState,
          pageOrder: updatedPages.map((_, index) => index)
        }
      };
    });
  }, []);

  /**
   * Remove a specific page
   */
  const removePage = useCallback((pageIndex: number) => {
    setMultiFileState(prev => {
      const newPages = prev.pages.filter((_, index) => index !== pageIndex);
      
      // Update display orders
      const updatedPages = newPages.map((page, index) => ({
        ...page,
        displayOrder: index
      }));

      return {
        ...prev,
        pages: updatedPages,
        reorderState: {
          ...prev.reorderState,
          pageOrder: updatedPages.map((_, index) => index)
        }
      };
    });
  }, []);

  /**
   * Get combined PDF data for backward compatibility
   */
  const getCombinedPdfData = useCallback((): PdfData | null => {
    if (!isMultiFileMode) {
      return singlePdfData;
    }
    
    // For multi-file mode, return the first PDF data
    // TODO: In the future, we might want to create a virtual combined PDF
    return singlePdfData;
  }, [isMultiFileMode, singlePdfData]);

  /**
   * Get combined page settings for backward compatibility
   */
  const getCombinedPageSettings = useCallback((): PageSettings[] => {
    if (!isMultiFileMode) {
      // For single-file mode, create basic page settings from the current PDF
      if (!singlePdfData) return [];
      
      return Array(singlePdfData.numPages).fill(null).map((_, i) => ({
        skip: false,
        type: i % 2 === 0 ? 'front' : 'back'
      }));
    }
    
    // For multi-file mode, extract page settings from combined pages
    return multiFileState.pages.map(page => ({
      skip: page.skip,
      type: page.type,
      originalPageIndex: page.originalPageIndex
    }));
  }, [isMultiFileMode, singlePdfData, multiFileState.pages]);

  /**
   * Reset all state
   */
  const reset = useCallback(() => {
    setMultiFileState({
      files: [],
      pages: [],
      reorderState: {
        dragIndex: null,
        hoverIndex: null,
        isDragging: false,
        pageOrder: []
      },
      isProcessing: false,
      errors: {}
    });
    setSinglePdfData(null);
  }, []);

  /**
   * Get current file list
   */
  const getFileList = useCallback((): FileSource[] => {
    return multiFileState.files;
  }, [multiFileState.files]);

  /**
   * Get error for a specific file
   */
  const getFileError = useCallback((fileName: string): string | undefined => {
    return multiFileState.errors[fileName];
  }, [multiFileState.errors]);

  /**
   * Set multi-file mode and handle state transitions
   */
  const setMultiFileMode = useCallback((enabled: boolean) => {
    setIsMultiFileMode(enabled);
    
    if (!enabled) {
      // When switching to single-file mode, reset multi-file state
      setMultiFileState(prev => ({
        ...prev,
        files: [],
        pages: [],
        reorderState: {
          dragIndex: null,
          hoverIndex: null,
          isDragging: false,
          pageOrder: []
        },
        errors: {}
      }));
    }
  }, []);

  return {
    multiFileState,
    isMultiFileMode,
    setMultiFileMode,
    processFiles,
    processSingleFile,
    removeFile,
    updateAllPageSettings,
    reorderPages,
    removePage,
    getCombinedPdfData,
    getCombinedPageSettings,
    reset,
    getFileList,
    getFileError
  };
};