import React, { useState, /* useRef, */ useEffect, useCallback } from 'react';
import { ChevronRightIcon } from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';
// import { getDefaultGrid } from '../defaults';
// import { LastImportedFileInfo } from '../utils/localStorageUtils';
import { renderPageThumbnail } from '../utils/cardUtils';
import { PageGroupsManager } from './PageGroupsManager';
import { FileManagerPanel } from './FileManagerPanel';
import { /* isValidImageFile, */ createImageThumbnail } from '../utils/imageUtils';
import { TIMEOUT_CONSTANTS, PERFORMANCE_CONSTANTS } from '../constants';
import type { ImportStepProps /*, MultiFileImportHook */ } from '../types';
import { StartOverConfirmationDialog } from './ImportStep/StartOverConfirmationDialog';
import { ThumbnailPopup } from './ImportStep/ThumbnailPopup';
import { PreviousFileDisplay } from './ImportStep/PreviousFileDisplay';
import { AutoRestoredSettingsNotification } from './ImportStep/AutoRestoredSettingsNotification';
import { FileUploadDropZone } from './ImportStep/FileUploadDropZone';

// Configure PDF.js worker for Vite
pdfjsLib.GlobalWorkerOptions.workerSrc = '/card-game-pdf-transformer/pdf.worker.min.js';
export const ImportStep: React.FC<ImportStepProps> = ({
  onFileSelect,
  onModeSelect,
  onPageSettingsChange,
  onNext,
  onResetToDefaults,
  onTriggerImportSettings,
  pdfData,
  pdfMode,
  pageSettings,
  autoRestoredSettings,
  lastImportedFileInfo,
  onClearLastImportedFile,
  multiFileImport
}) => {
  // const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string>('');
  const [pageCount, setPageCount] = useState<number>(0);
  const [isDragOver, setIsDragOver] = useState<boolean>(false);
  const [dragError, setDragError] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadingError, setLoadingError] = useState<string>('');
  
  // Thumbnail state management
  const [thumbnails, setThumbnails] = useState<Record<number, string>>({});
  const [thumbnailLoading, setThumbnailLoading] = useState<Record<number, boolean>>({});
  const [thumbnailErrors, setThumbnailErrors] = useState<Record<number, boolean>>({});
  const [hoveredThumbnail, setHoveredThumbnail] = useState<number | null>(null);
  const [showStartOverConfirm, setShowStartOverConfirm] = useState<boolean>(false);
  
  // Track when data stores are ready for thumbnail loading
  const [dataStoreVersion, setDataStoreVersion] = useState<number>(0);
  
  // Single-file reset functionality - track original page order
  const [originalPageSettings, setOriginalPageSettings] = useState<any[]>([]);
  
  // Page settings handlers moved to PageReorderTable for Phase 1
  // const handlePageTypeChange = (index: number, type: string) => {
  //   const newSettings = [...pageSettings];
  //   newSettings[index] = {
  //     ...newSettings[index],
  //     type
  //   };
  //   onPageSettingsChange(newSettings);
  // };
  // const handlePageSkipChange = (index: number, skip: boolean) => {
  //   const newSettings = [...pageSettings];
  //   newSettings[index] = {
  //     ...newSettings[index],
  //     skip
  //   };
  //   onPageSettingsChange(newSettings);
  // };
  
  // Thumbnail loading function
  const loadThumbnail = useCallback(async (pageIndex: number) => {
    if (!pdfData) {
      return;
    }
    
    setThumbnailLoading(prev => ({ ...prev, [pageIndex]: true }));
    
    try {
      const thumbnailUrl = await renderPageThumbnail(pdfData, pageIndex + 1);
      setThumbnails(prev => ({ ...prev, [pageIndex]: thumbnailUrl }));
    } catch (error) {
      console.error(`Failed to load thumbnail for page ${pageIndex + 1}:`, error);
      setThumbnailErrors(prev => ({ ...prev, [pageIndex]: true }));
    } finally {
      setThumbnailLoading(prev => ({ ...prev, [pageIndex]: false }));
    }
  }, [pdfData]);

  // Load thumbnail for image files
  const loadImageThumbnail = useCallback(async (pageIndex: number, fileName: string) => {
    setThumbnailLoading(prev => ({ 
      ...prev, 
      [pageIndex]: true 
    }));
    
    try {
      const imageData = multiFileImport.getImageData(fileName);
      if (imageData) {
        // Use the existing createImageThumbnail function from imageUtils
        const thumbnailUrl = createImageThumbnail(imageData, 200, 150);
        setThumbnails(prev => ({ ...prev, [pageIndex]: thumbnailUrl }));
      } else {
        throw new Error(`Image data not found for ${fileName}`);
      }
    } catch (error) {
      console.error(`Failed to load image thumbnail for ${fileName}:`, error);
      setThumbnailErrors(prev => ({ ...prev, [pageIndex]: true }));
    } finally {
      setThumbnailLoading(prev => ({ ...prev, [pageIndex]: false }));
    }
  }, [multiFileImport]);

  // Load thumbnail for PDF pages in multi-file context
  const loadPdfThumbnailForPage = useCallback(async (pageIndex: number, pdfPageNumber: number, fileName?: string) => {
    let activePdfData: any = null;
    
    if (fileName && multiFileImport.getPdfData) {
      // Get specific PDF data for this file from multi-file store
      activePdfData = multiFileImport.getPdfData(fileName);
    }
    
    // Only fall back to main pdfData prop if no fileName specified (single-file mode)
    if (!activePdfData && !fileName) {
      activePdfData = multiFileImport.getCombinedPdfData() || pdfData;
    }
    
    if (!activePdfData) {
      console.warn(`No PDF data available for thumbnail loading at page ${pdfPageNumber}${fileName ? ` from file ${fileName}` : ''} - PDF data not ready yet`);
      return;
    }
    
    setThumbnailLoading(prev => ({ ...prev, [pageIndex]: true }));
    
    try {
      const thumbnailUrl = await renderPageThumbnail(activePdfData, pdfPageNumber);
      setThumbnails(prev => ({ ...prev, [pageIndex]: thumbnailUrl }));
    } catch (error) {
      console.error(`Failed to load thumbnail for PDF page ${pdfPageNumber}${fileName ? ` from file ${fileName}` : ''}:`, error);
      setThumbnailErrors(prev => ({ ...prev, [pageIndex]: true }));
    } finally {
      setThumbnailLoading(prev => ({ ...prev, [pageIndex]: false }));
    }
  }, [pdfData, multiFileImport]);

  // Effect to start loading thumbnails when page settings are available (single-file mode only)
  useEffect(() => {
    // Only run in single-file mode (when no multi-file pages exist)
    if (pdfData && pageSettings.length > 0 && multiFileImport.multiFileState.pages.length === 0) {
      const totalPages = pageSettings.length;
      const isLargePdf = totalPages > PERFORMANCE_CONSTANTS.LARGE_PDF_PAGE_THRESHOLD;
      
      // Adjust loading strategy based on PDF size
      const maxConcurrent = isLargePdf 
        ? PERFORMANCE_CONSTANTS.MAX_CONCURRENT_THUMBNAILS_LARGE 
        : PERFORMANCE_CONSTANTS.MAX_CONCURRENT_THUMBNAILS_NORMAL;
        
      const immediateLoadCount = Math.min(maxConcurrent, totalPages);
      
      // Load first batch immediately (async to prevent blocking render)
      for (let i = 0; i < immediateLoadCount; i++) {
        setTimeout(() => loadThumbnail(i), 0);
      }
      
      // Load remaining thumbnails in controlled batches for large PDFs
      if (totalPages > immediateLoadCount) {
        if (isLargePdf) {
          // For large PDFs, use slower batch loading with memory management
          let batchStart = immediateLoadCount;
          const batchSize = maxConcurrent;
          
          const loadNextBatch = () => {
            if (batchStart >= totalPages) return;
            
            const batchEnd = Math.min(batchStart + batchSize, totalPages);
            for (let i = batchStart; i < batchEnd; i++) {
              setTimeout(() => loadThumbnail(i), (i - batchStart) * TIMEOUT_CONSTANTS.CANVAS_DEBOUNCE_DELAY);
            }
            
            batchStart = batchEnd;
            if (batchStart < totalPages) {
              setTimeout(loadNextBatch, PERFORMANCE_CONSTANTS.LARGE_PDF_BATCH_DELAY);
            }
          };
          
          setTimeout(loadNextBatch, TIMEOUT_CONSTANTS.SETTINGS_DEBOUNCE_DELAY);
        } else {
          // For normal PDFs, use original progressive loading
          setTimeout(() => {
            for (let i = immediateLoadCount; i < totalPages; i++) {
              setTimeout(() => loadThumbnail(i), (i - immediateLoadCount) * TIMEOUT_CONSTANTS.CANVAS_DEBOUNCE_DELAY);
            }
          }, TIMEOUT_CONSTANTS.SETTINGS_DEBOUNCE_DELAY);
        }
      }
    }
  }, [pdfData, pageSettings.length, loadThumbnail, multiFileImport.multiFileState.pages.length]);

  // Effect to track data store changes
  useEffect(() => {
    if (multiFileImport.multiFileState.pages.length > 0) {
      // Increment version to trigger thumbnail loading effect
      setDataStoreVersion(prev => prev + 1);
    }
  }, [
    multiFileImport.multiFileState.pages.length,
    multiFileImport.multiFileState.files.length // Also track file changes
  ]);

  // Effect to track original page settings for single-file mode
  useEffect(() => {
    // Only capture original settings for single-file mode (when no multi-file pages exist)
    if (pdfData && pageSettings.length > 0 && multiFileImport.multiFileState.pages.length === 0) {
      // Only set original if we don't have it yet, or if the page count changed
      if (originalPageSettings.length === 0 || originalPageSettings.length !== pageSettings.length) {
        setOriginalPageSettings([...pageSettings]);
      }
    }
  }, [pdfData, pageSettings, multiFileImport.multiFileState.pages.length, originalPageSettings.length]);
  
  // Effect to start loading thumbnails for multi-file imports
  useEffect(() => {
    if (multiFileImport.multiFileState.pages.length > 0 && dataStoreVersion > 0) {
      const pages = multiFileImport.multiFileState.pages;
      const pdfDataStore = multiFileImport.getAllPdfData();
      const imageDataStore = multiFileImport.getAllImageData();
      
      // Validate that all required data is available before starting
      const allDataReady = pages.every((page: any) => {
        if (page.fileType === 'image') {
          return imageDataStore.has(page.fileName);
        } else if (page.fileType === 'pdf') {
          return pdfDataStore.has(page.fileName);
        }
        return false;
      });
      
      if (!allDataReady) {
        // Schedule a retry after a short delay
        const retryTimeout = setTimeout(() => {
          setDataStoreVersion(prev => prev + 1);
        }, 100);
        
        return () => clearTimeout(retryTimeout);
      }
      
      // Performance-aware thumbnail loading for multi-file imports
      const totalPages = pages.length;
      const isLargeImport = totalPages > PERFORMANCE_CONSTANTS.LARGE_PDF_PAGE_THRESHOLD;
      
      const maxConcurrent = isLargeImport 
        ? PERFORMANCE_CONSTANTS.MAX_CONCURRENT_THUMBNAILS_LARGE 
        : PERFORMANCE_CONSTANTS.MAX_CONCURRENT_THUMBNAILS_NORMAL;
        
      const immediateLoadCount = Math.min(maxConcurrent, totalPages);
      
      // Load first batch immediately (async to prevent blocking render)
      for (let i = 0; i < immediateLoadCount; i++) {
        const page = pages[i];
        if (page.fileType === 'image') {
          setTimeout(() => loadImageThumbnail(i, page.fileName), 0);
        } else if (page.fileType === 'pdf') {
          setTimeout(() => loadPdfThumbnailForPage(i, page.originalPageIndex + 1, page.fileName), 0);
        }
      }
      
      // Load remaining thumbnails in controlled batches for large imports
      if (totalPages > immediateLoadCount) {
        if (isLargeImport) {
          // For large imports, use slower batch loading
          let batchStart = immediateLoadCount;
          const batchSize = maxConcurrent;
          
          const loadNextBatch = () => {
            if (batchStart >= totalPages) return;
            
            const batchEnd = Math.min(batchStart + batchSize, totalPages);
            for (let i = batchStart; i < batchEnd; i++) {
              setTimeout(() => {
                const page = pages[i];
                if (page.fileType === 'image') {
                  loadImageThumbnail(i, page.fileName);
                } else if (page.fileType === 'pdf') {
                  loadPdfThumbnailForPage(i, page.originalPageIndex + 1, page.fileName);
                }
              }, (i - batchStart) * TIMEOUT_CONSTANTS.CANVAS_DEBOUNCE_DELAY);
            }
            
            batchStart = batchEnd;
            if (batchStart < totalPages) {
              setTimeout(loadNextBatch, PERFORMANCE_CONSTANTS.LARGE_PDF_BATCH_DELAY);
            }
          };
          
          setTimeout(loadNextBatch, TIMEOUT_CONSTANTS.SETTINGS_DEBOUNCE_DELAY);
        } else {
          // For normal imports, use original progressive loading
          setTimeout(() => {
            for (let i = immediateLoadCount; i < totalPages; i++) {
              setTimeout(() => {
                const page = pages[i];
                if (page.fileType === 'image') {
                  loadImageThumbnail(i, page.fileName);
                } else if (page.fileType === 'pdf') {
                  loadPdfThumbnailForPage(i, page.originalPageIndex + 1, page.fileName);
                }
              }, (i - immediateLoadCount) * TIMEOUT_CONSTANTS.CANVAS_DEBOUNCE_DELAY);
            }
          }, TIMEOUT_CONSTANTS.SETTINGS_DEBOUNCE_DELAY);
        }
      }
    }
  }, [
    dataStoreVersion,
    loadImageThumbnail, 
    loadPdfThumbnailForPage,
    multiFileImport
  ]);

  // File processing functions are now unified under processMultipleFiles

  // Single-file reset functionality
  const isSingleFileReordered = useCallback((): boolean => {
    if (!pdfData || pageSettings.length === 0 || originalPageSettings.length === 0) {
      return false;
    }
    
    // Compare current page settings with original
    return !originalPageSettings.every((origPage, index) => 
      pageSettings[index] && 
      origPage.type === pageSettings[index].type && 
      origPage.skip === pageSettings[index].skip &&
      origPage.originalPageIndex === pageSettings[index].originalPageIndex
    );
  }, [pdfData, pageSettings, originalPageSettings]);
  
  const resetSingleFileToImportOrder = useCallback(() => {
    if (originalPageSettings.length > 0) {
      onPageSettingsChange([...originalPageSettings]);
    }
  }, [originalPageSettings, onPageSettingsChange]);

  
  // Validate if file is a PDF
  // const isValidPdfFile = (file: File): boolean => {
  //   const validTypes = ['application/pdf'];
  //   const validExtensions = ['.pdf'];
  //   
  //   // Check MIME type
  //   if (!validTypes.includes(file.type)) {
  //     return false;
  //   }
  //   
  //   // Check file extension
  //   const fileName = file.name.toLowerCase();
  //   const hasValidExtension = validExtensions.some(ext => fileName.endsWith(ext));
  //   
  //   return hasValidExtension;
  // };


  // Handle Start Over confirmation
  const handleStartOverClick = () => {
    setShowStartOverConfirm(true);
  };

  const handleStartOverConfirm = () => {
    // Reset all multi-file state
    multiFileImport.reset();
    
    // Reset single-file state
    setFileName('');
    setPageCount(0);
    setDragError('');
    setLoadingError('');
    
    // Reset thumbnail state
    setThumbnails({});
    setThumbnailLoading({});
    setThumbnailErrors({});
    setHoveredThumbnail(null);
    setDataStoreVersion(0);
    
    // Reset single-file reset functionality
    setOriginalPageSettings([]);
    
    // Reset page settings
    onPageSettingsChange([]);
    
    // Reset all app state (PDF data, settings, localStorage)
    onResetToDefaults();
    
    // Close confirmation dialog
    setShowStartOverConfirm(false);
  };

  const handleStartOverCancel = () => {
    setShowStartOverConfirm(false);
  };
  
  
  return <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-800">Import Files</h2>
      </div>
      
      {/* Enhanced File Management Panel */}
      {multiFileImport.getFileList().length > 0 && (
        <FileManagerPanel 
          multiFileImport={multiFileImport}
          expanded={false}
        />
      )}
      
      {/* Previous File Display */}
      <PreviousFileDisplay
        lastImportedFileInfo={lastImportedFileInfo}
        hasCurrentData={!!pdfData || multiFileImport.multiFileState.pages.length > 0}
        onClearLastImportedFile={onClearLastImportedFile}
      />
      
      <FileUploadDropZone
        multiFileImport={multiFileImport}
        onFileSelect={onFileSelect}
        onPageSettingsChange={onPageSettingsChange}
        onStartOverClick={handleStartOverClick}
        fileName={fileName}
        setFileName={setFileName}
        pageCount={pageCount}
        setPageCount={setPageCount}
        isDragOver={isDragOver}
        setIsDragOver={setIsDragOver}
        dragError={dragError}
        setDragError={setDragError}
        isLoading={isLoading}
        setIsLoading={setIsLoading}
        loadingError={loadingError}
        setLoadingError={setLoadingError}
        lastImportedFileInfo={lastImportedFileInfo}
      />

      {/* Multi-file mode toggle removed for Phase 1 - focusing on single PDF page reordering */}
      
      {/* Auto Restored Settings Notification */}
      <AutoRestoredSettingsNotification
        isVisible={autoRestoredSettings}
        onResetToDefaults={onResetToDefaults}
        onTriggerImportSettings={onTriggerImportSettings}
      />
      {/* Page Groups Manager - Show for any imported content */}
      {((pdfData && pageSettings.length > 0) || multiFileImport.multiFileState.pages.length > 0) && (
              <PageGroupsManager
                pages={multiFileImport.multiFileState.pages.length > 0
                  ? multiFileImport.multiFileState.pages.map((page: any, index: number) => ({
                      ...page,
                      displayOrder: index
                    }))
                  : pageSettings.map((page: any, index: number) => ({
                      ...page,
                      fileName: fileName || 'Unknown',
                      fileType: 'pdf' as const,
                      originalPageIndex: page.originalPageIndex ?? index,
                      displayOrder: index
                    }))
                }
                pdfMode={pdfMode}
                onResetToImportOrder={multiFileImport.multiFileState.pages.length > 0 ? multiFileImport.resetToImportOrder : (pdfData && originalPageSettings.length > 0 ? resetSingleFileToImportOrder : undefined)}
                isPagesReordered={multiFileImport.multiFileState.pages.length > 0 ? multiFileImport.isPagesReordered() : isSingleFileReordered()}
                onPagesReorder={(reorderedPages) => {
                  if (multiFileImport.multiFileState.pages.length > 0) {
                    // Get the current pages before reordering to determine the mapping
                    const currentPages = multiFileImport.multiFileState.pages;
                    
                    // Create a mapping from new position to old position for thumbnails
                    // Using a more unique identifier: fileName + originalPageIndex + fileType
                    const thumbnailMapping: Record<number, number> = {};
                    reorderedPages.forEach((reorderedPage, newIndex) => {
                      // Find the old index of this page using a unique page identifier
                      const pageId = `${reorderedPage.fileName}:${reorderedPage.originalPageIndex}:${reorderedPage.fileType}`;
                      const oldIndex = currentPages.findIndex(
                        (currentPage: any) => `${currentPage.fileName}:${currentPage.originalPageIndex}:${currentPage.fileType}` === pageId
                      );
                      if (oldIndex !== -1) {
                        thumbnailMapping[newIndex] = oldIndex;
                      } else {
                        console.warn(`Could not find mapping for page: ${pageId}`, { reorderedPage, currentPages });
                      }
                    });
                    
                    
                    // Create new thumbnail states that preserve existing thumbnails and map reordered ones
                    const newThumbnails: Record<number, string> = {};
                    const newThumbnailLoading: Record<number, boolean> = {};
                    const newThumbnailErrors: Record<number, boolean> = {};
                    
                    // Map thumbnails according to the reordering
                    reorderedPages.forEach((_, newIndex) => {
                      const oldIndex = thumbnailMapping[newIndex];
                      if (oldIndex !== undefined) {
                        // Copy thumbnail data from old position to new position
                        if (thumbnails[oldIndex]) {
                          newThumbnails[newIndex] = thumbnails[oldIndex];
                        }
                        if (thumbnailLoading[oldIndex]) {
                          newThumbnailLoading[newIndex] = thumbnailLoading[oldIndex];
                        }
                        if (thumbnailErrors[oldIndex]) {
                          newThumbnailErrors[newIndex] = thumbnailErrors[oldIndex];
                        }
                      }
                      // If no mapping found, the thumbnail will need to be reloaded
                    });
                    
                    // Update multi-file state first (this updates the page order)
                    multiFileImport.updateAllPageSettings(reorderedPages);
                    
                    
                    // Then update thumbnail states to match the new order
                    setThumbnails(newThumbnails);
                    setThumbnailLoading(newThumbnailLoading);
                    setThumbnailErrors(newThumbnailErrors);
                    
                    // Reload any missing thumbnails after a brief delay to ensure state is settled
                    setTimeout(() => {
                      const pdfDataStore = multiFileImport.getAllPdfData();
                      const imageDataStore = multiFileImport.getAllImageData();
                      
                      reorderedPages.forEach((page, newIndex) => {
                        if (!newThumbnails[newIndex] && !newThumbnailLoading[newIndex] && !newThumbnailErrors[newIndex]) {
                          // Validate data availability before attempting reload
                          if (page.fileType === 'image') {
                            if (imageDataStore.has(page.fileName)) {
                              loadImageThumbnail(newIndex, page.fileName);
                            } else {
                              console.warn(`Image data not available for ${page.fileName}, skipping reload`);
                            }
                          } else if (page.fileType === 'pdf') {
                            if (pdfDataStore.has(page.fileName)) {
                              loadPdfThumbnailForPage(newIndex, page.originalPageIndex + 1, page.fileName);
                            } else {
                              console.warn(`PDF data not available for ${page.fileName}, skipping reload`);
                            }
                          }
                        }
                      });
                    }, 50);
                    
                    // Also update the main page settings for compatibility
                    const corePageSettings = reorderedPages.map(page => ({
                      skip: page.skip || false,
                      type: page.type || 'front',
                      originalPageIndex: page.originalPageIndex
                    }));
                    onPageSettingsChange(corePageSettings);
                  } else {
                    // Single-file mode - preserve existing logic
                    const corePageSettings = reorderedPages.map(page => ({
                      skip: page.skip || false,
                      type: page.type || 'front',
                      originalPageIndex: page.originalPageIndex
                    }));
                    onPageSettingsChange(corePageSettings);
                  }
                }}
                onPageSettingsChange={(pageIndex, settings) => {
                  if (multiFileImport.multiFileState.pages.length > 0) {
                    // Update specific page in multi-file state
                    const currentPages = multiFileImport.multiFileState.pages;
                    const updatedPages = currentPages.map((page: any, index: number) => 
                      index === pageIndex ? { ...page, ...settings } : page
                    );
                    multiFileImport.updateAllPageSettings(updatedPages);
                  } else {
                    // Single-file mode
                    const updatedSettings = [...pageSettings];
                    updatedSettings[pageIndex] = { ...updatedSettings[pageIndex], ...settings };
                    onPageSettingsChange(updatedSettings);
                  }
                }}
                onPageRemove={(pageIndex) => {
                  if (multiFileImport.multiFileState.pages.length > 0) {
                    multiFileImport.removePage(pageIndex);
                  } else {
                    const updatedSettings = [...pageSettings];
                    updatedSettings.splice(pageIndex, 1);
                    onPageSettingsChange(updatedSettings);
                  }
                }}
                thumbnails={thumbnails}
                thumbnailLoading={thumbnailLoading}
                thumbnailErrors={thumbnailErrors}
                onThumbnailsUpdate={setThumbnails}
                onThumbnailLoadingUpdate={setThumbnailLoading}
                onThumbnailErrorsUpdate={setThumbnailErrors}
                onThumbnailLoad={(pageIndex) => {
                  // Load thumbnail based on file type
                  if (multiFileImport.multiFileState.pages.length > 0) {
                    const page = multiFileImport.multiFileState.pages[pageIndex];
                    
                    if (page && page.fileType === 'image') {
                      // Validate image data availability
                      const imageDataStore = multiFileImport.getAllImageData();
                      if (imageDataStore.has(page.fileName)) {
                        loadImageThumbnail(pageIndex, page.fileName);
                      } else {
                        console.warn(`Image data not available for ${page.fileName}, cannot load thumbnail`);
                      }
                    } else if (page && page.fileType === 'pdf') {
                      // Validate PDF data availability
                      const pdfDataStore = multiFileImport.getAllPdfData();
                      if (pdfDataStore.has(page.fileName)) {
                        loadPdfThumbnailForPage(pageIndex, page.originalPageIndex + 1, page.fileName);
                      } else {
                        console.warn(`PDF data not available for ${page.fileName}, cannot load thumbnail`);
                      }
                    }
                  } else if (pdfData) {
                    // Single PDF mode
                    loadThumbnail(pageIndex);
                  }
                }}
                pageTypeSettings={multiFileImport.multiFileState.pageTypeSettings || {}}
                pageGroups={multiFileImport.multiFileState.pageGroups || []}
                onPageGroupsChange={(groups) => {
                  multiFileImport.updatePageGroups(groups);
                }}
                onPagesUpdate={(updatedPages) => {
                  if (multiFileImport.multiFileState.pages.length > 0) {
                    multiFileImport.updateAllPageSettings(updatedPages);
                  } else {
                    // Single-file mode - extract core page settings
                    const corePageSettings = updatedPages.map(page => ({
                      skip: page.skip || false,
                      type: page.type || 'front',
                      pageType: page.pageType,
                      originalPageIndex: page.originalPageIndex
                    }));
                    onPageSettingsChange(corePageSettings);
                  }
                }}
                onGlobalPdfModeChange={onModeSelect}
              />
          )}


      {/* Thumbnail Popup */}
      <ThumbnailPopup
        pageIndex={hoveredThumbnail}
        thumbnails={thumbnails}
        onClose={() => setHoveredThumbnail(null)}
      />

      {/* Next Button - Show when any content is imported */}
      {(pdfData || multiFileImport.multiFileState.pages.length > 0) && (
        <div className="flex justify-end mt-6">
          <button onClick={onNext} className="flex items-center bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700">
            Next Step
            <ChevronRightIcon size={16} className="ml-2" />
          </button>
        </div>
      )}

      {/* Start Over Confirmation Dialog */}
      <StartOverConfirmationDialog
        isOpen={showStartOverConfirm}
        onConfirm={handleStartOverConfirm}
        onCancel={handleStartOverCancel}
      />
    </div>;
};