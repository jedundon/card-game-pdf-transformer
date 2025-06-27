import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ChevronRightIcon, RotateCcwIcon, UploadIcon, XIcon, ClockIcon } from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';
import { getDefaultGrid } from '../defaults';
import { LastImportedFileInfo, formatFileSize, formatImportTimestamp } from '../utils/localStorageUtils';
import { renderPageThumbnail } from '../utils/cardUtils';
import { PageReorderTable } from './PageReorderTable';
import { AddFilesButton } from './AddFilesButton';
import { FileManagerPanel } from './FileManagerPanel';
import { isValidImageFile, createImageThumbnail } from '../utils/imageUtils';

// Configure PDF.js worker for Vite
pdfjsLib.GlobalWorkerOptions.workerSrc = '/card-game-pdf-transformer/pdf.worker.min.js';
interface ImportStepProps {
  onFileSelect: (data: any, fileName: string, file?: File) => void;
  onModeSelect: (mode: any) => void;
  onPageSettingsChange: (settings: any) => void;
  onNext: () => void;
  onResetToDefaults: () => void;
  onTriggerImportSettings: () => void;
  pdfData: any;
  pdfMode: any;
  pageSettings: any;
  autoRestoredSettings: boolean;
  lastImportedFileInfo: LastImportedFileInfo | null;
  onClearLastImportedFile: () => void;
  multiFileImport: any; // Add multiFileImport as a prop
}
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
  const fileInputRef = useRef<HTMLInputElement>(null);
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
  
  // Multi-file support - using shared instance from App.tsx
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    // Always process files using multi-file pipeline
    // Single files are treated as multi-file with one file
    await processMultipleFiles(files);
  };

  // Process multiple files using the multi-file import hook
  const processMultipleFiles = async (files: File[]) => {
    // Reset single-file state when switching to multi-file
    setFileName('');
    setPageCount(0);
    setDragError('');
    setLoadingError('');
    setIsLoading(true);
    onPageSettingsChange([]);
    
    // Reset thumbnail state
    setThumbnails({});
    setThumbnailLoading({});
    setThumbnailErrors({});
    setHoveredThumbnail(null);

    try {
      const result = await multiFileImport.processFiles(files);
      
      if (result.files.length > 0) {
        const totalPages = result.pages.length;
        setFileName(`${result.files.length} files (${totalPages} pages total)`);
        setPageCount(totalPages);
        
        // Use the first successful PDF for onFileSelect compatibility
        if (result.firstPdf) {
          onFileSelect(result.firstPdf, `Multi-file import`, undefined);
        }
        
        // Set combined page settings
        const corePageSettings = result.pages.map((page: any) => ({
          skip: page.skip || false,
          type: page.type || 'front',
          originalPageIndex: page.originalPageIndex
        }));
        onPageSettingsChange(corePageSettings);
        
        console.log(`Successfully processed ${result.files.length} files with ${totalPages} total pages`);
      } else {
        throw new Error('No files were successfully processed');
      }
      
    } catch (error) {
      console.error('Error processing multiple files:', error);
      setLoadingError(error instanceof Error ? error.message : 'Failed to process multiple files');
    } finally {
      setIsLoading(false);
    }
  };
  const handleModeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const type = e.target.value as 'duplex' | 'gutter-fold';
    onModeSelect({
      ...pdfMode,
      type
    });
  };
  const handleOrientationChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const orientation = e.target.value as 'vertical' | 'horizontal';
    onModeSelect({
      ...pdfMode,
      orientation
    });
  };
  const handleFlipEdgeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const flipEdge = e.target.value as 'short' | 'long';
    onModeSelect({
      ...pdfMode,
      flipEdge
    });
  };
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
  const loadPdfThumbnailForPage = useCallback(async (pageIndex: number, pdfPageNumber: number) => {
    // Get PDF data from multiFileImport (for added files) or fallback to pdfData prop (for initial import)
    const activePdfData = multiFileImport.getCombinedPdfData() || pdfData;
    
    if (!activePdfData) {
      console.warn(`No PDF data available for thumbnail loading at page ${pdfPageNumber}`);
      return;
    }
    
    setThumbnailLoading(prev => ({ ...prev, [pageIndex]: true }));
    
    try {
      const thumbnailUrl = await renderPageThumbnail(activePdfData, pdfPageNumber);
      setThumbnails(prev => ({ ...prev, [pageIndex]: thumbnailUrl }));
    } catch (error) {
      console.error(`Failed to load thumbnail for PDF page ${pdfPageNumber}:`, error);
      setThumbnailErrors(prev => ({ ...prev, [pageIndex]: true }));
    } finally {
      setThumbnailLoading(prev => ({ ...prev, [pageIndex]: false }));
    }
  }, [pdfData, multiFileImport]);

  // Effect to start loading thumbnails when page settings are available
  useEffect(() => {
    if (pdfData && pageSettings.length > 0) {
      // Start loading thumbnails progressively - load first few immediately
      const immediateLoadCount = Math.min(5, pageSettings.length);
      for (let i = 0; i < immediateLoadCount; i++) {
        loadThumbnail(i);
      }
      
      // Load remaining thumbnails with a delay to avoid overwhelming the browser
      if (pageSettings.length > immediateLoadCount) {
        setTimeout(() => {
          for (let i = immediateLoadCount; i < pageSettings.length; i++) {
            setTimeout(() => loadThumbnail(i), i * 100); // Stagger loading by 100ms
          }
        }, 500);
      }
    }
  }, [pdfData, pageSettings.length]);

  // Effect to start loading thumbnails for multi-file imports
  useEffect(() => {
    if (multiFileImport.multiFileState.pages.length > 0) {
      const pages = multiFileImport.multiFileState.pages;
      
      // Start loading thumbnails progressively
      const immediateLoadCount = Math.min(5, pages.length);
      for (let i = 0; i < immediateLoadCount; i++) {
        const page = pages[i];
        if (page.fileType === 'image') {
          loadImageThumbnail(i, page.fileName);
        } else if (page.fileType === 'pdf') {
          loadPdfThumbnailForPage(i, page.originalPageIndex + 1);
        }
      }
      
      // Load remaining thumbnails with a delay
      if (pages.length > immediateLoadCount) {
        setTimeout(() => {
          for (let i = immediateLoadCount; i < pages.length; i++) {
            setTimeout(() => {
              const page = pages[i];
              if (page.fileType === 'image') {
                loadImageThumbnail(i, page.fileName);
              } else if (page.fileType === 'pdf') {
                loadPdfThumbnailForPage(i, page.originalPageIndex + 1);
              }
            }, i * 100);
          }
        }, 500);
      }
    }
  }, [multiFileImport.multiFileState.pages.length, loadImageThumbnail, loadPdfThumbnailForPage]);

  // File processing functions are now unified under processMultipleFiles

  
  // Validate if file is a PDF
  const isValidPdfFile = (file: File): boolean => {
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
  };

  // Validate if file is supported (PDF or image)
  const isValidFile = (file: File): boolean => {
    return isValidPdfFile(file) || isValidImageFile(file);
  };
  
  // Drag and drop event handlers
  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
    setDragError('');
  };
  
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Validate dragged files
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      const files = Array.from(e.dataTransfer.items)
        .filter(item => item.kind === 'file')
        .map(item => item.getAsFile())
        .filter((file): file is File => file !== null);
      
      // Always accept PDFs and images
      const invalidFiles = files.filter(file => !isValidFile(file));
      if (invalidFiles.length > 0) {
        setDragError('Only PDF and image files (PNG, JPG, JPEG) are supported');
      } else {
        setDragError('');
      }
    }
  };
  
  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Only reset drag state if we're actually leaving the drop zone
    // Check if the mouse is leaving to go to a child element
    const rect = e.currentTarget.getBoundingClientRect();
    const isLeavingDropZone = (
      e.clientX < rect.left ||
      e.clientX > rect.right ||
      e.clientY < rect.top ||
      e.clientY > rect.bottom
    );
    
    if (isLeavingDropZone) {
      setIsDragOver(false);
      setDragError('');
    }
  };
  
  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    
    try {
      const files = Array.from(e.dataTransfer.files);
      
      if (files.length === 0) {
        setDragError('No files were dropped');
        return;
      }
      
      // Always validate for PDFs and images
      const invalidFiles = files.filter(file => !isValidFile(file));
      if (invalidFiles.length > 0) {
        setDragError('Only PDF and image files (PNG, JPG, JPEG) are supported.');
        return;
      }
      
      // Always process using multi-file pipeline
      await processMultipleFiles(files);
    } catch (error) {
      console.error('Error handling file drop:', error);
      setDragError('Failed to process dropped file(s). Please try again.');
    }
  };
  
  return <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-800">Import Files</h2>
        
        {/* Add Files button - shown when files are already imported */}
        {multiFileImport.getFileList().length > 0 && (
          <AddFilesButton 
            multiFileImport={multiFileImport}
            onFilesAdded={() => {
              // Refresh the UI after adding files
              console.log('Files added successfully');
            }}
            disabled={isLoading}
            variant="primary"
            size="sm"
          />
        )}
      </div>
      
      {/* Enhanced File Management Panel */}
      {multiFileImport.getFileList().length > 0 && (
        <FileManagerPanel 
          multiFileImport={multiFileImport}
          expanded={true}
        />
      )}
      
      {/* Previously Imported File Display */}
      {lastImportedFileInfo && !pdfData && (
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-md">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center mb-2">
                <ClockIcon size={16} className="text-blue-600 mr-2" />
                <h4 className="text-sm font-medium text-blue-800">
                  Previously Imported File
                </h4>
              </div>
              <div className="mb-2">
                <p className="text-sm font-medium text-blue-900 mb-1">
                  {lastImportedFileInfo.name}
                </p>
                <p className="text-xs text-blue-700">
                  {formatFileSize(lastImportedFileInfo.size)} • {formatImportTimestamp(lastImportedFileInfo.importTimestamp)}
                </p>
              </div>
              <p className="text-xs text-blue-600">
                Upload the same file or choose a different one to continue working.
              </p>
            </div>
            <button
              onClick={onClearLastImportedFile}
              className="ml-3 flex-shrink-0 p-1 text-blue-400 hover:text-blue-600 hover:bg-blue-100 rounded transition-colors"
              title="Clear previous file info"
            >
              <XIcon size={16} />
            </button>
          </div>
        </div>
      )}
      
      <div 
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          isLoading
            ? 'border-yellow-400 bg-yellow-50'
            : isDragOver 
              ? 'border-blue-400 bg-blue-50' 
              : (dragError || loadingError)
                ? 'border-red-400 bg-red-50' 
                : 'border-gray-300 bg-white'
        }`}
        onDragEnter={!isLoading ? handleDragEnter : undefined}
        onDragOver={!isLoading ? handleDragOver : undefined}
        onDragLeave={!isLoading ? handleDragLeave : undefined}
        onDrop={!isLoading ? handleDrop : undefined}
      >
        <input 
          type="file" 
          accept=".pdf,.png,.jpg,.jpeg"
          multiple
          className="hidden" 
          ref={fileInputRef} 
          onChange={handleFileChange}
          disabled={isLoading}
        />
        
        {/* Loading spinner or clickable upload icon */}
        {isLoading ? (
          <div className="flex items-center justify-center mx-auto mb-4 w-16 h-16 rounded-full bg-yellow-100 text-yellow-700">
            <div className="animate-spin w-6 h-6 border-2 border-yellow-600 border-t-transparent rounded-full"></div>
          </div>
        ) : (
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading}
            className={`flex items-center justify-center mx-auto mb-4 w-16 h-16 rounded-full transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed ${
              isDragOver 
                ? 'bg-blue-100 text-blue-700 hover:bg-blue-200' 
                : (dragError || loadingError)
                  ? 'bg-red-100 text-red-600' 
                  : 'bg-blue-50 text-blue-600 hover:bg-blue-100'
            }`}
            aria-label="Select PDF or image files to import"
            title="Click to select PDF or image files"
          >
            <UploadIcon size={24} />
          </button>
        )}

        <button 
          onClick={() => !isLoading && fileInputRef.current?.click()} 
          disabled={isLoading}
          className="mb-2 text-blue-600 hover:text-blue-800 underline disabled:text-gray-400 disabled:no-underline focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 rounded"
          aria-label="Select PDF or image files to import"
        >
          {isLoading ? 'Processing...' : 'Select PDF or image files'}
        </button>

        <p className={`mb-2 ${
          isLoading 
            ? 'text-yellow-700' 
            : isDragOver 
              ? 'text-blue-700' 
              : (dragError || loadingError)
                ? 'text-red-600' 
                : 'text-gray-600'
        }`}>
          {isLoading
            ? `Processing ${fileName}...`
            : isDragOver 
              ? 'Drop your PDF or image files here'
              : fileName && !dragError && !loadingError
                ? `Successfully loaded: ${fileName} (${pageCount} pages)`
                : lastImportedFileInfo 
                  ? `Drag & drop or click to upload PDF or image files (last: ${lastImportedFileInfo.name})` 
                  : `Drag & drop your PDF or image files here or click to browse`
          }
        </p>

        {/* Error messages */}
        {(dragError || loadingError) && (
          <div className="mt-3 p-3 bg-red-100 border border-red-200 rounded-md">
            <p className="text-red-800 text-sm font-medium mb-2">
              {dragError || loadingError}
            </p>
            {loadingError && (
              <button
                onClick={() => {
                  setLoadingError('');
                  setDragError('');
                  setFileName('');
                  setPageCount(0);
                }}
                className="text-red-600 hover:text-red-800 text-xs underline"
              >
                Try a different file
              </button>
            )}
          </div>
        )}

        {/* Success message */}
        {fileName && !dragError && !loadingError && !isLoading && (
          <div className="mt-3 p-3 bg-green-100 border border-green-200 rounded-md">
            <p className="text-green-800 text-sm font-medium">
              Successfully loaded: {fileName} ({pageCount} pages)
            </p>
          </div>
        )}

        {/* Loading message */}
        {isLoading && (
          <div className="mt-3 p-3 bg-yellow-100 border border-yellow-200 rounded-md">
            <p className="text-yellow-800 text-sm">
              Loading and processing your PDF file. This may take a moment for large files...
            </p>
          </div>
        )}
      </div>

      {/* Multi-file mode toggle removed for Phase 1 - focusing on single PDF page reordering */}
      
      {/* Auto-restored Settings Notification */}
      {autoRestoredSettings && (
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-md">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h4 className="text-sm font-medium text-blue-800 mb-1">
                Settings Automatically Restored
              </h4>
              <p className="text-xs text-blue-700 mb-3">
                Your previous workflow settings have been automatically applied. 
                This includes PDF mode, extraction settings, output configuration, and color calibration.
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={onResetToDefaults}
                  className="inline-flex items-center px-3 py-1 text-xs bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                >
                  <RotateCcwIcon size={12} className="mr-1" />
                  Reset to Defaults
                </button>
                <button
                  onClick={onTriggerImportSettings}
                  className="inline-flex items-center px-3 py-1 text-xs bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
                >
                  <UploadIcon size={12} className="mr-1" />
                  Import Different Settings
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* PDF Mode Configuration - Show for any imported files */}
      {(pdfData || multiFileImport.multiFileState.pages.length > 0) && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Processing Mode
              </label>
              <select value={pdfMode.type} onChange={handleModeChange} className="w-full border border-gray-300 rounded-md px-3 py-2">
                <option value="duplex">
                  Duplex (fronts and backs on alternate pages)
                </option>
                <option value="gutter-fold">
                  Gutter-fold (fronts and backs on same page)
                </option>
              </select>
            </div>
            {pdfMode.type === 'duplex' ? <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Flip Edge
                </label>
                <select value={pdfMode.flipEdge} onChange={handleFlipEdgeChange} className="w-full border border-gray-300 rounded-md px-3 py-2">
                  <option value="short">Short Edge</option>
                  <option value="long">Long Edge</option>
                </select>
              </div> : <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Orientation
                </label>
                <select value={pdfMode.orientation} onChange={handleOrientationChange} className="w-full border border-gray-300 rounded-md px-3 py-2">              <option value="vertical">Vertical</option>
              <option value="horizontal">Horizontal</option>
                </select>
              </div>}
          </div>
          
          {/* Grid Information */}
          <div className="p-4 bg-blue-50 rounded-md">
            <h4 className="text-sm font-medium text-blue-800 mb-2">
              Default Card Grid for Selected Mode
            </h4>
            <div className="text-sm text-blue-700">
              {(() => {
                const grid = getDefaultGrid(pdfMode);
                return `${grid.rows} rows × ${grid.columns} columns (${grid.rows * grid.columns} cards per page)`;
              })()}
            </div>
            <p className="text-xs text-blue-600 mt-1">
              You can adjust these settings in the next step if needed.
            </p>
          </div>
        </>
      )}

      
      {/* Page Reordering Table - Show for any imported content */}
      {(pageSettings.length > 0 || multiFileImport.multiFileState.pages.length > 0) && (
              <PageReorderTable
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
                onPagesReorder={(reorderedPages) => {
                  if (multiFileImport.multiFileState.pages.length > 0) {
                    // Get the current pages before reordering to determine the mapping
                    const currentPages = multiFileImport.multiFileState.pages;
                    
                    // Create a mapping from new position to old position for thumbnails
                    const thumbnailMapping: Record<number, number> = {};
                    reorderedPages.forEach((reorderedPage, newIndex) => {
                      // Find the old index of this page
                      const oldIndex = currentPages.findIndex(
                        (currentPage: any) => currentPage.fileName === reorderedPage.fileName && 
                        currentPage.originalPageIndex === reorderedPage.originalPageIndex
                      );
                      if (oldIndex !== -1) {
                        thumbnailMapping[newIndex] = oldIndex;
                      }
                    });
                    
                    // Reorder thumbnails to match the new page order
                    const newThumbnails: Record<number, string> = {};
                    const newThumbnailLoading: Record<number, boolean> = {};
                    const newThumbnailErrors: Record<number, boolean> = {};
                    
                    Object.entries(thumbnailMapping).forEach(([newIndexStr, oldIndex]) => {
                      const newIndex = parseInt(newIndexStr);
                      if (thumbnails[oldIndex]) {
                        newThumbnails[newIndex] = thumbnails[oldIndex];
                      }
                      if (thumbnailLoading[oldIndex]) {
                        newThumbnailLoading[newIndex] = thumbnailLoading[oldIndex];
                      }
                      if (thumbnailErrors[oldIndex]) {
                        newThumbnailErrors[newIndex] = thumbnailErrors[oldIndex];
                      }
                    });
                    
                    // Update thumbnail states
                    setThumbnails(newThumbnails);
                    setThumbnailLoading(newThumbnailLoading);
                    setThumbnailErrors(newThumbnailErrors);
                    
                    // Update multi-file state with complete page objects (preserves reordering)
                    multiFileImport.updateAllPageSettings(reorderedPages);
                    
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
                onThumbnailLoad={(pageIndex) => {
                  // Load thumbnail based on file type
                  if (multiFileImport.multiFileState.pages.length > 0) {
                    const page = multiFileImport.multiFileState.pages[pageIndex];
                    if (page && page.fileType === 'image') {
                      // Load image thumbnail
                      loadImageThumbnail(pageIndex, page.fileName);
                    } else if (page && page.fileType === 'pdf') {
                      // Load PDF thumbnail (uses multiFileImport.getCombinedPdfData() internally)
                      loadPdfThumbnailForPage(pageIndex, page.originalPageIndex + 1);
                    }
                  } else if (pdfData) {
                    // Single PDF mode
                    loadThumbnail(pageIndex);
                  }
                }}
              />
          )}

      {/* Thumbnail Popup - Show for any imported content */}
      {hoveredThumbnail !== null && thumbnails[hoveredThumbnail] && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.3)' }}
          onClick={() => setHoveredThumbnail(null)}
        >
          <div 
            className="bg-white border border-gray-300 rounded-lg shadow-xl p-4 max-w-[95vw] max-h-[95vh] overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-medium text-gray-800">
                Page {hoveredThumbnail + 1} Preview
              </h4>
              <button
                onClick={() => setHoveredThumbnail(null)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <XIcon size={16} />
              </button>
            </div>
            <img
              src={thumbnails[hoveredThumbnail]}
              alt={`Page ${hoveredThumbnail + 1} preview`}
              className="w-auto h-auto border border-gray-200 rounded"
              style={{
                maxWidth: 'min(600px, 90vw)',
                maxHeight: 'min(600px, 90vh)'
              }}
            />
          </div>
        </div>
      )}

      {/* Next Button - Show when any content is imported */}
      {(pdfData || multiFileImport.multiFileState.pages.length > 0) && (
        <div className="flex justify-end mt-6">
          <button onClick={onNext} className="flex items-center bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700">
            Next Step
            <ChevronRightIcon size={16} className="ml-2" />
          </button>
        </div>
      )}
    </div>;
};