import React, { useRef /*, useState */ } from 'react';
import { Upload } from 'lucide-react';
import { isValidImageFile } from '../../utils/imageUtils';
import type { MultiFileImportHook } from '../../types';

interface FileUploadDropZoneProps {
  multiFileImport: MultiFileImportHook;
  onFileSelect: (pdfData: any, fileName: string, file?: File) => void;
  onPageSettingsChange: (settings: any[]) => void;
  onStartOverClick: () => void;
  fileName: string;
  setFileName: (name: string) => void;
  pageCount: number;
  setPageCount: (count: number) => void;
  isDragOver: boolean;
  setIsDragOver: (over: boolean) => void;
  dragError: string;
  setDragError: (error: string) => void;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
  loadingError: string;
  setLoadingError: (error: string) => void;
  lastImportedFileInfo: { name: string } | null;
}

/**
 * File upload drop zone component for importing PDF and image files
 * 
 * Provides drag-and-drop functionality and file input handling for both single
 * and multiple file imports. Supports PDF, PNG, JPG, and JPEG file formats.
 */
export const FileUploadDropZone: React.FC<FileUploadDropZoneProps> = ({
  multiFileImport,
  onFileSelect,
  onPageSettingsChange,
  onStartOverClick,
  fileName,
  setFileName,
  pageCount,
  setPageCount,
  isDragOver,
  setIsDragOver,
  dragError,
  setDragError,
  isLoading,
  setIsLoading,
  loadingError,
  setLoadingError,
  lastImportedFileInfo
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // File validation
  const isValidFile = (file: File): boolean => {
    return file.type === 'application/pdf' || isValidImageFile(file);
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

  // File input change handler
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    // Check if files already exist to determine whether to add or replace
    const hasExistingFiles = multiFileImport.getFileList().length > 0;
    
    if (hasExistingFiles) {
      // Add files to existing import instead of replacing
      try {
        const result = await multiFileImport.addFiles(files);
        if (result.success) {
          console.log(`Added ${result.addedFiles.length} files with ${result.addedPages.length} pages`);
        }
        if (Object.keys(result.errors).length > 0) {
          console.warn('Some files had errors:', result.errors);
          setDragError('Some files could not be added. Check console for details.');
        }
      } catch (error) {
        console.error('Error adding files:', error);
        setDragError('Failed to add files. Please try again.');
      }
    } else {
      // Process using multi-file pipeline for initial import
      await processMultipleFiles(files);
    }
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
      
      // Check if files already exist to determine whether to add or replace
      const hasExistingFiles = multiFileImport.getFileList().length > 0;
      
      if (hasExistingFiles) {
        // Add files to existing import instead of replacing
        const result = await multiFileImport.addFiles(files);
        if (result.success) {
          console.log(`Added ${result.addedFiles.length} files with ${result.addedPages.length} pages`);
        }
        if (Object.keys(result.errors).length > 0) {
          console.warn('Some files had errors:', result.errors);
          setDragError('Some files could not be added. Check console for details.');
        }
      } else {
        // Process using multi-file pipeline for initial import
        await processMultipleFiles(files);
      }
    } catch (error) {
      console.error('Error handling file drop:', error);
      setDragError('Failed to process dropped file(s). Please try again.');
    }
  };

  return (
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
          <Upload size={24} />
        </button>
      )}

      <div className="flex flex-col items-center space-y-2">
        {(() => {
          const hasExistingFiles = multiFileImport.getFileList().length > 0;
          const buttonText = hasExistingFiles ? 'Add More Files' : 'Select PDF or image files';
          const ariaLabel = hasExistingFiles ? 'Add more PDF or image files to existing import' : 'Select PDF or image files to import';
          
          return (
            <button 
              onClick={() => !isLoading && fileInputRef.current?.click()} 
              disabled={isLoading}
              className="text-blue-600 hover:text-blue-800 underline disabled:text-gray-400 disabled:no-underline focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 rounded"
              aria-label={ariaLabel}
            >
              {isLoading ? 'Processing...' : buttonText}
            </button>
          );
        })()}
        
        {/* Start Over link - shown when files are already imported */}
        {multiFileImport.getFileList().length > 0 && !isLoading && (
          <button
            onClick={onStartOverClick}
            className="text-xs text-gray-500 hover:text-red-600 underline focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1 rounded transition-colors"
            title="Remove all files and start over"
          >
            Start Over
          </button>
        )}
      </div>

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
  );
};