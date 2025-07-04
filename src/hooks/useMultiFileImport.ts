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
  PdfData,
  ImageFileData
} from '../types';
import { 
  isValidImageFile, 
  processImageFile, 
  createImageFileSource, 
  validateImageFileSize 
} from '../utils/imageUtils';
import { SUPPORTED_FILE_TYPES } from '../constants';
import { initializePageTypeSettings, detectPageType } from '../utils/pageTypeDefaults';

// Configure PDF.js worker for Vite
pdfjsLib.GlobalWorkerOptions.workerSrc = '/card-game-pdf-transformer/pdf.worker.min.js';

/**
 * Multi-file import hook return interface
 */
interface UseMultiFileImportReturn {
  /** Current multi-file import state */
  multiFileState: MultiFileImportState;
  /** Process multiple files (PDFs and images) */
  processFiles: (files: File[]) => Promise<{
    files: FileSource[];
    pages: (PageSettings & PageSource)[];
    errors: Record<string, string>;
    firstPdf: PdfData | null;
    imageData: Map<string, ImageFileData>;
  }>;
  /** Add files to existing import (append instead of replace) */
  addFiles: (files: File[]) => Promise<{
    success: boolean;
    addedFiles: FileSource[];
    addedPages: (PageSettings & PageSource)[];
    errors: Record<string, string>;
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
  /** Reset page order to original import order */
  resetToImportOrder: () => void;
  /** Check if pages have been reordered from original import order */
  isPagesReordered: () => boolean;
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
  /** Get image data for a specific file */
  getImageData: (fileName: string) => ImageFileData | null;
  /** Get all image data */
  getAllImageData: () => Map<string, ImageFileData>;
  /** Get PDF data for a specific file */
  getPdfData: (fileName: string) => PdfData | null;
  /** Get all PDF data */
  getAllPdfData: () => Map<string, PdfData>;
}

/**
 * Custom hook for managing multi-file import operations
 */
export const useMultiFileImport = (): UseMultiFileImportReturn => {
  
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
    originalPageOrder: [],
    isProcessing: false,
    errors: {},
    pageTypeSettings: initializePageTypeSettings(),
    pageGroups: []
  });

  // Single PDF reference for backward compatibility
  const [singlePdfData, setSinglePdfData] = useState<PdfData | null>(null);
  
  // PDF data storage for multiple PDF files (fileName -> PdfData)
  const [pdfDataStore, setPdfDataStore] = useState<Map<string, PdfData>>(new Map());
  
  // Image data storage for processed images
  const [imageDataStore, setImageDataStore] = useState<Map<string, ImageFileData>>(new Map());

  /**
   * Validate if file is a supported file type (PDF or image)
   */
  const isValidFile = useCallback((file: File): { isValid: boolean; type: 'pdf' | 'image' | null } => {
    // Check for PDF
    const isPdf = SUPPORTED_FILE_TYPES.PDF_MIME_TYPES.includes(file.type as any) &&
                  SUPPORTED_FILE_TYPES.PDF_EXTENSIONS.some(ext => file.name.toLowerCase().endsWith(ext));
    
    if (isPdf) {
      return { isValid: true, type: 'pdf' };
    }
    
    // Check for image
    const isImage = isValidImageFile(file);
    if (isImage) {
      return { isValid: true, type: 'image' };
    }
    
    return { isValid: false, type: null };
  }, []);

  /**
   * Process a single PDF file and return PDF data
   */
  const processSingleFile = useCallback(async (file: File): Promise<PdfData | null> => {
    const validation = isValidFile(file);
    if (!validation.isValid || validation.type !== 'pdf') {
      throw new Error('Invalid file type. Only PDF files are supported for single file processing.');
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
  }, [isValidFile]);

  /**
   * Process multiple files (PDFs and images) for multi-file mode
   */
  const processFiles = useCallback(async (files: File[]): Promise<{
    files: FileSource[];
    pages: (PageSettings & PageSource)[];
    errors: Record<string, string>;
    firstPdf: PdfData | null;
    imageData: Map<string, ImageFileData>;
  }> => {
    setMultiFileState(prev => ({ ...prev, isProcessing: true, errors: {} }));

    const newFiles: FileSource[] = [];
    const newPages: (PageSettings & PageSource)[] = [];
    const errors: Record<string, string> = {};
    let firstPdf: PdfData | null = null;
    const newImageData = new Map<string, ImageFileData>();
    const newPdfData = new Map<string, PdfData>();

    try {
      for (const file of files) {
        try {
          const validation = isValidFile(file);
          if (!validation.isValid) {
            errors[file.name] = `Unsupported file type. Supported formats: PDF, PNG, JPG, JPEG.`;
            continue;
          }

          if (validation.type === 'pdf') {
            // Process PDF file
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
            
            // Store PDF data in local map for batch update
            newPdfData.set(file.name, pdf);

            // Create file source entry
            const fileSource: FileSource = {
              name: file.name,
              type: 'pdf',
              originalPageCount: pdf.numPages,
              size: file.size,
              importTimestamp: Date.now()
            };
            newFiles.push(fileSource);

            // Create page entries for this PDF file
            for (let pageIndex = 0; pageIndex < pdf.numPages; pageIndex++) {
              const detectedPageType = detectPageType(pageIndex, pdf.numPages, file.name);
              const page: PageSettings & PageSource = {
                skip: detectedPageType === 'skip',
                type: pageIndex % 2 === 0 ? 'front' : 'back', // Default alternating
                pageType: detectedPageType,
                fileName: file.name,
                originalPageIndex: pageIndex,
                fileType: 'pdf',
                displayOrder: newPages.length // Global display order across all files
              };
              newPages.push(page);
            }

          } else if (validation.type === 'image') {
            // Process image file
            if (!validateImageFileSize(file)) {
              errors[file.name] = `Image file too large. Maximum size: 50MB.`;
              continue;
            }

            const imageData = await processImageFile(file);
            if (!imageData) {
              errors[file.name] = 'Failed to process image file.';
              continue;
            }

            // Store image data for later access
            newImageData.set(file.name, imageData);

            // Create file source entry
            const fileSource: FileSource = createImageFileSource(file);
            newFiles.push(fileSource);

            // Create single page entry for this image file
            const detectedPageType = detectPageType(0, 1, file.name);
            const page: PageSettings & PageSource = {
              skip: detectedPageType === 'skip',
              type: 'front', // Images default to front type
              pageType: detectedPageType,
              fileName: file.name,
              originalPageIndex: 0, // Images are always single "page"
              fileType: 'image',
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
        originalPageOrder: [...newPages], // Store original order for reset functionality
        isProcessing: false,
        errors
      }));

      // Update data stores
      setImageDataStore(prev => {
        const updated = new Map(prev);
        newImageData.forEach((data, fileName) => {
          updated.set(fileName, data);
        });
        return updated;
      });
      
      setPdfDataStore(prev => {
        const updated = new Map(prev);
        newPdfData.forEach((data, fileName) => {
          updated.set(fileName, data);
        });
        return updated;
      });

      console.log(`Successfully processed ${newFiles.length} of ${files.length} files`);
      if (Object.keys(errors).length > 0) {
        console.warn('Some files failed to process:', errors);
      }

      // Return the processed data immediately
      return {
        files: newFiles,
        pages: newPages,
        errors,
        firstPdf,
        imageData: newImageData
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
        firstPdf: null,
        imageData: new Map()
      };
    }
  }, [isValidFile, processSingleFile]);

  /**
   * Add files to existing import (append instead of replace)
   */
  const addFiles = useCallback(async (files: File[]): Promise<{
    success: boolean;
    addedFiles: FileSource[];
    addedPages: (PageSettings & PageSource)[];
    errors: Record<string, string>;
  }> => {
    const addedFiles: FileSource[] = [];
    const addedPages: (PageSettings & PageSource)[] = [];
    const errors: Record<string, string> = {};
    const newImageData = new Map<string, ImageFileData>();
    const newPdfData = new Map<string, PdfData>();

    try {
      // Get current state for proper ordering
      const currentPageCount = multiFileState.pages.length;
      
      for (const file of files) {
        try {
          const validation = isValidFile(file);
          if (!validation.isValid) {
            errors[file.name] = `Unsupported file type. Supported formats: PDF, PNG, JPG, JPEG.`;
            continue;
          }

          // Check for duplicate files
          const isDuplicate = multiFileState.files.some(existingFile => existingFile.name === file.name);
          if (isDuplicate) {
            errors[file.name] = `File already imported: ${file.name}`;
            continue;
          }

          if (validation.type === 'pdf') {
            // Process PDF file
            const pdf = await processSingleFile(file);
            if (!pdf) {
              errors[file.name] = 'Failed to process PDF file.';
              continue;
            }

            // Update first PDF reference if this is the first PDF overall
            if (!singlePdfData) {
              setSinglePdfData(pdf);
            }
            
            // Store PDF data in local map for batch update
            newPdfData.set(file.name, pdf);

            // Create file source entry
            const fileSource: FileSource = {
              name: file.name,
              type: 'pdf',
              originalPageCount: pdf.numPages,
              size: file.size,
              importTimestamp: Date.now()
            };
            addedFiles.push(fileSource);

            // Create page entries for this PDF file
            for (let pageIndex = 0; pageIndex < pdf.numPages; pageIndex++) {
              const detectedPageType = detectPageType(pageIndex, pdf.numPages, file.name);
              const page: PageSettings & PageSource = {
                skip: detectedPageType === 'skip',
                type: pageIndex % 2 === 0 ? 'front' : 'back', // Default alternating
                pageType: detectedPageType,
                fileName: file.name,
                originalPageIndex: pageIndex,
                fileType: 'pdf',
                displayOrder: currentPageCount + addedPages.length // Sequential ordering
              };
              addedPages.push(page);
            }

          } else if (validation.type === 'image') {
            // Process image file
            if (!validateImageFileSize(file)) {
              errors[file.name] = `Image file too large. Maximum size: 50MB.`;
              continue;
            }

            const imageData = await processImageFile(file);
            if (!imageData) {
              errors[file.name] = 'Failed to process image file.';
              continue;
            }

            // Store image data for later access
            newImageData.set(file.name, imageData);

            // Create file source entry
            const fileSource: FileSource = createImageFileSource(file);
            addedFiles.push(fileSource);

            // Create single page entry for this image file
            const detectedPageType = detectPageType(0, 1, file.name);
            const page: PageSettings & PageSource = {
              skip: detectedPageType === 'skip',
              type: 'front', // Images default to front type
              pageType: detectedPageType,
              fileName: file.name,
              originalPageIndex: 0, // Images are always single "page"
              fileType: 'image',
              displayOrder: currentPageCount + addedPages.length // Sequential ordering
            };
            addedPages.push(page);
          }

        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
          errors[file.name] = errorMessage;
          console.error(`Error processing file ${file.name}:`, error);
        }
      }

      // Update state by appending to existing files and pages
      if (addedFiles.length > 0 || addedPages.length > 0) {
        setMultiFileState(prev => {
          const allPages = [...prev.pages, ...addedPages];
          const allOriginalPages = [...prev.originalPageOrder, ...addedPages];
          return {
            ...prev,
            files: [...prev.files, ...addedFiles], // Append to existing files
            pages: allPages, // Append to existing pages
            reorderState: {
              ...prev.reorderState,
              pageOrder: allPages.map((_, index) => index)
            },
            originalPageOrder: allOriginalPages, // Append to original order
            errors: { ...prev.errors, ...errors }
          };
        });

        // Update data stores
        setImageDataStore(prev => {
          const updated = new Map(prev);
          newImageData.forEach((data, fileName) => {
            updated.set(fileName, data);
          });
          return updated;
        });
        
        setPdfDataStore(prev => {
          const updated = new Map(prev);
          newPdfData.forEach((data, fileName) => {
            updated.set(fileName, data);
          });
          return updated;
        });

        console.log(`Successfully added ${addedFiles.length} files with ${addedPages.length} total pages`);
      }

      return {
        success: addedFiles.length > 0,
        addedFiles,
        addedPages,
        errors
      };

    } catch (error) {
      console.error('Error in addFiles:', error);
      return {
        success: false,
        addedFiles: [],
        addedPages: [],
        errors: { _general: 'Failed to add files. Please try again.' }
      };
    }
  }, [isValidFile, processSingleFile, multiFileState.files, multiFileState.pages, singlePdfData]);

  /**
   * Remove a file from the multi-file list
   */
  const removeFile = useCallback((fileName: string) => {
    setMultiFileState(prev => {
      const newFiles = prev.files.filter(file => file.name !== fileName);
      const newPages = prev.pages.filter(page => page.fileName !== fileName);
      const newOriginalPages = prev.originalPageOrder.filter(page => page.fileName !== fileName);
      
      // Update display orders
      const updatedPages = newPages.map((page, index) => ({
        ...page,
        displayOrder: index
      }));

      const updatedOriginalPages = newOriginalPages.map((page, index) => ({
        ...page,
        displayOrder: index
      }));

      return {
        ...prev,
        files: newFiles,
        pages: updatedPages,
        originalPageOrder: updatedOriginalPages,
        reorderState: {
          ...prev.reorderState,
          pageOrder: updatedPages.map((_, index) => index)
        },
        errors: Object.fromEntries(
          Object.entries(prev.errors).filter(([key]) => key !== fileName)
        )
      };
    });
    
    // Remove image data if it exists
    setImageDataStore(prev => {
      const updated = new Map(prev);
      updated.delete(fileName);
      return updated;
    });
    
    // Remove PDF data if it exists
    setPdfDataStore(prev => {
      const updated = new Map(prev);
      updated.delete(fileName);
      return updated;
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
    // Always return the first PDF data from multi-file state
    return singlePdfData;
  }, [singlePdfData]);

  /**
   * Get combined page settings for backward compatibility
   */
  const getCombinedPageSettings = useCallback((): PageSettings[] => {
    // Always extract page settings from multi-file state
    // If no multi-file pages, fall back to single PDF data
    if (multiFileState.pages.length > 0) {
      return multiFileState.pages.map(page => ({
        skip: page.skip,
        type: page.type,
        originalPageIndex: page.originalPageIndex
      }));
    }
    
    // Fallback for empty multi-file state with single PDF
    if (singlePdfData) {
      return Array(singlePdfData.numPages).fill(null).map((_, i) => ({
        skip: false,
        type: i % 2 === 0 ? 'front' : 'back'
      }));
    }
    
    return [];
  }, [singlePdfData, multiFileState.pages]);

  /**
   * Check if pages have been reordered from original import order
   */
  const isPagesReordered = useCallback((): boolean => {
    const { pages, originalPageOrder } = multiFileState;
    
    // If lengths don't match, something has changed
    if (originalPageOrder.length !== pages.length) return false;
    
    // If no pages, nothing to reorder
    if (pages.length === 0) return false;
    
    // Compare each page position with original order
    return !originalPageOrder.every((origPage, index) => 
      pages[index] && 
      origPage.fileName === pages[index].fileName && 
      origPage.originalPageIndex === pages[index].originalPageIndex &&
      origPage.fileType === pages[index].fileType
    );
  }, [multiFileState]);

  /**
   * Reset page order to original import order
   */
  const resetToImportOrder = useCallback(() => {
    setMultiFileState(prev => {
      // Restore pages to original import order
      const restoredPages = [...prev.originalPageOrder];
      return {
        ...prev,
        pages: restoredPages,
        reorderState: {
          ...prev.reorderState,
          pageOrder: restoredPages.map((_, index) => index)
        }
      };
    });
  }, []);

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
      originalPageOrder: [],
      isProcessing: false,
      errors: {},
      pageTypeSettings: initializePageTypeSettings(),
      pageGroups: []
    });
    setSinglePdfData(null);
    setPdfDataStore(new Map());
    setImageDataStore(new Map());
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
   * Get image data for a specific file
   */
  const getImageData = useCallback((fileName: string): ImageFileData | null => {
    return imageDataStore.get(fileName) || null;
  }, [imageDataStore]);

  /**
   * Get all image data
   */
  const getAllImageData = useCallback((): Map<string, ImageFileData> => {
    return new Map(imageDataStore);
  }, [imageDataStore]);

  /**
   * Get PDF data for a specific file
   */
  const getPdfData = useCallback((fileName: string): PdfData | null => {
    return pdfDataStore.get(fileName) || null;
  }, [pdfDataStore]);

  /**
   * Get all PDF data
   */
  const getAllPdfData = useCallback((): Map<string, PdfData> => {
    return new Map(pdfDataStore);
  }, [pdfDataStore]);


  return {
    multiFileState,
    processFiles,
    addFiles,
    processSingleFile,
    removeFile,
    updateAllPageSettings,
    reorderPages,
    removePage,
    resetToImportOrder,
    isPagesReordered,
    getCombinedPdfData,
    getCombinedPageSettings,
    reset,
    getFileList,
    getFileError,
    getImageData,
    getAllImageData,
    getPdfData,
    getAllPdfData
  };
};