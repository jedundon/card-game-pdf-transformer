import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ChevronRightIcon, RotateCcwIcon, UploadIcon, XIcon, ClockIcon } from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';
import { getDefaultGrid } from '../defaults';
import { LastImportedFileInfo, formatFileSize, formatImportTimestamp } from '../utils/localStorageUtils';
import { renderPageThumbnail } from '../utils/cardUtils';

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
  onClearLastImportedFile
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
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await processFile(file);
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
  const handlePageTypeChange = (index: number, type: string) => {
    const newSettings = [...pageSettings];
    newSettings[index] = {
      ...newSettings[index],
      type
    };
    onPageSettingsChange(newSettings);
  };
  const handlePageSkipChange = (index: number, skip: boolean) => {
    const newSettings = [...pageSettings];
    newSettings[index] = {
      ...newSettings[index],
      skip
    };
    onPageSettingsChange(newSettings);
  };
  
  // Thumbnail loading function
  const loadThumbnail = useCallback(async (pageIndex: number) => {
    if (!pdfData || thumbnails[pageIndex] || thumbnailLoading[pageIndex] || thumbnailErrors[pageIndex]) {
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
  }, [pdfData, thumbnails, thumbnailLoading, thumbnailErrors]);

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
  }, [pdfData, pageSettings.length, loadThumbnail]);

  // File processing helper function (shared between drag/drop and file input)
  const processFile = async (file: File) => {
    // Reset all state
    setFileName(file.name);
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
        // Disable workers for better error handling
        useWorkerFetch: false,
        // Set memory limits
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

      // Success - update state
      setPageCount(pdf.numPages);
      onFileSelect(pdf, file.name, file);
      
      // Initialize page settings with default values
      const initialPageSettings = Array(pdf.numPages).fill(null).map((_, i) => ({
        skip: false,
        type: i % 2 === 0 ? 'front' : 'back' // Default alternating front/back for duplex
      }));
      onPageSettingsChange(initialPageSettings);
      
      console.log(`Successfully loaded PDF: ${file.name} (${pdf.numPages} pages)`);
    } catch (error) {
      console.error('Error processing PDF file:', error);
      
      // Provide specific error messages based on error type
      let errorMessage = 'Failed to process PDF file. Please try a different file.';
      
      if (error instanceof Error) {
        if (error.message.includes('timeout') || error.message.includes('timed out')) {
          errorMessage = 'PDF loading timed out. The file may be too large or complex. Please try a smaller or simpler PDF file.';
        } else if (error.message.includes('too large')) {
          errorMessage = error.message;
        } else if (error.message.includes('Invalid PDF') || error.message.includes('corrupted')) {
          errorMessage = 'The PDF file appears to be corrupted or invalid. Please try a different PDF file.';
        } else if (error.message.includes('password') || error.message.includes('encrypted')) {
          errorMessage = 'Password-protected or encrypted PDF files are not supported. Please use an unprotected PDF file.';
        } else if (error.message.includes('too many pages')) {
          errorMessage = error.message;
        } else if (error.message.includes('memory') || error.message.includes('out of memory')) {
          errorMessage = 'Not enough memory to process this PDF. Please try a smaller file or refresh the page.';
        }
      }
      
      setLoadingError(errorMessage);
      setDragError(errorMessage);
      
      // Reset file state on error
      setFileName('');
      setPageCount(0);
      onFileSelect(null, '', undefined);
    } finally {
      setIsLoading(false);
    }
  };
  
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
      const item = e.dataTransfer.items[0];
      if (item.kind === 'file') {
        const file = item.getAsFile();
        if (file && !isValidPdfFile(file)) {
          setDragError('Only PDF files are supported');
        } else {
          setDragError('');
        }
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
      
      if (files.length > 1) {
        setDragError('Please drop only one PDF file at a time');
        return;
      }
      
      const file = files[0];
      
      if (!isValidPdfFile(file)) {
        setDragError('Only PDF files are supported. Please drop a valid PDF file.');
        return;
      }
      
      // Process the dropped PDF file
      await processFile(file);
    } catch (error) {
      console.error('Error handling file drop:', error);
      setDragError('Failed to process dropped file. Please try again.');
    }
  };
  
  return <div className="space-y-6">
      <h2 className="text-xl font-semibold text-gray-800">Import PDF File</h2>
      
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
          accept=".pdf" 
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
            aria-label="Select PDF file to import"
            title="Click to select PDF file"
          >
            <UploadIcon size={24} />
          </button>
        )}

        <button 
          onClick={() => !isLoading && fileInputRef.current?.click()} 
          disabled={isLoading}
          className="mb-2 text-blue-600 hover:text-blue-800 underline disabled:text-gray-400 disabled:no-underline focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 rounded"
          aria-label="Select PDF file to import"
        >
          {isLoading ? 'Processing...' : 'Select PDF file'}
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
              ? 'Drop your PDF file here' 
              : fileName && !dragError && !loadingError
                ? `Successfully loaded: ${fileName} (${pageCount} pages)`
                : lastImportedFileInfo 
                  ? `Drag & drop or click to upload a PDF file (last: ${lastImportedFileInfo.name})` 
                  : 'Drag & drop your PDF file here or click to browse'
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
      {pdfData && <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                PDF Mode
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
          
          {pageSettings.length > 0 && <div className="mt-6">
              <h3 className="text-lg font-medium text-gray-800 mb-3">
                Page Settings
              </h3>
              <div className="border border-gray-200 rounded-md">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Page
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Preview
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Type
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Skip
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {pageSettings.map((page: any, index: number) => <tr key={index}>
                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">
                          {index + 1}
                        </td>
                        <td className="px-2 py-2 whitespace-nowrap">
                          <div className="relative inline-block">
                            {thumbnailLoading[index] ? (
                              <div className="w-12 h-16 bg-gray-100 border border-gray-200 rounded flex items-center justify-center">
                                <div className="animate-spin w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full"></div>
                              </div>
                            ) : thumbnailErrors[index] ? (
                              <div className="w-12 h-16 bg-gray-100 border border-gray-200 rounded flex items-center justify-center">
                                <span className="text-xs text-gray-400">Error</span>
                              </div>
                            ) : thumbnails[index] ? (
                              <img
                                src={thumbnails[index]}
                                alt={`Page ${index + 1} preview`}
                                className="w-12 h-16 border border-gray-200 rounded cursor-pointer hover:border-blue-300 transition-colors"
                                onClick={() => setHoveredThumbnail(index)}
                                title={`Click to view larger preview of page ${index + 1}`}
                              />
                            ) : (
                              <div className="w-12 h-16 bg-gray-50 border border-gray-200 rounded flex items-center justify-center">
                                <span className="text-xs text-gray-400">...</span>
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm">
                          {pdfMode.type === 'duplex' && !page?.skip && <select value={page?.type || 'front'} onChange={e => handlePageTypeChange(index, e.target.value)} className="border border-gray-300 rounded px-2 py-1 text-sm">
                              <option value="front">Front</option>
                              <option value="back">Back</option>
                            </select>}
                          {pdfMode.type === 'gutter-fold' && !page?.skip && <span className="text-gray-600">Front & Back</span>}
                          {page?.skip && <span className="text-gray-400 italic">
                              Skipped
                            </span>}
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm">
                          <input type="checkbox" checked={page?.skip || false} onChange={e => handlePageSkipChange(index, e.target.checked)} className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                        </td>
                      </tr>)}
                  </tbody>
                </table>
              </div>
            </div>}
          
          {/* Thumbnail Popup */}
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
          
          <div className="flex justify-end mt-6">
            <button onClick={onNext} className="flex items-center bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700">
              Next Step
              <ChevronRightIcon size={16} className="ml-2" />
            </button>
          </div>
        </>}
    </div>;
};