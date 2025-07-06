/**
 * CardImageExportButton - Export all extracted cards as labeled zip file
 * 
 * Provides a button that exports all extracted card images as individual PNG files
 * in a zip archive with consistent filename convention. Includes progress tracking
 * and error handling for robust user experience.
 */

import React, { useState, useCallback } from 'react';
import { Download, Loader2, Archive, AlertTriangle } from 'lucide-react';
import { 
  exportAndDownloadCardImages, 
  type CardImageExportOptions 
} from '../../utils/cardImageExport';
import { calculateTotalCardsForMixedContent, getActivePagesWithSource } from '../../utils/cardUtils';
import type { 
  PdfData, 
  PdfMode, 
  ExtractionSettings, 
  PageSettings, 
  MultiFileImportHook,
  PageGroup
} from '../../types';

export interface CardImageExportButtonProps {
  pdfData?: PdfData | null;
  pdfMode: PdfMode;
  extractionSettings: ExtractionSettings;
  pageSettings: PageSettings[];
  multiFileImport: MultiFileImportHook;
  /** Current active group ID (null for default group) */
  activeGroupId?: string | null;
  /** All page groups for group-aware export */
  pageGroups?: PageGroup[];
  /** Export mode - current group only or all groups */
  exportMode?: 'current-group' | 'all-groups';
  disabled?: boolean;
  className?: string;
  children?: React.ReactNode;
}

interface ExportState {
  isExporting: boolean;
  progress: number;
  message: string;
  error: string | null;
}

/**
 * Button component that exports all extracted cards as a zip file
 */
export const CardImageExportButton: React.FC<CardImageExportButtonProps> = ({
  pdfData,
  pdfMode,
  extractionSettings,
  pageSettings,
  multiFileImport,
  activeGroupId,
  pageGroups = [],
  exportMode = 'current-group',
  disabled = false,
  className = '',
  children
}) => {
  const [exportState, setExportState] = useState<ExportState>({
    isExporting: false,
    progress: 0,
    message: '',
    error: null
  });

  // Calculate total cards for display (group-aware)
  const totalCards = React.useMemo(() => {
    try {
      // Get unified page data using same logic as ExtractStep
      const unifiedPages = multiFileImport.multiFileState.pages.length > 0
        ? multiFileImport.multiFileState.pages
        : pageSettings.map((page: any, index: number) => ({
            ...page,
            fileName: 'current.pdf',
            fileType: 'pdf' as const,
            originalPageIndex: index,
            displayOrder: index
          }));
      
      let targetPages = getActivePagesWithSource(unifiedPages);
      
      // Filter by active group if in current-group mode
      if (exportMode === 'current-group' && activeGroupId) {
        const activeGroup = pageGroups.find(g => g.id === activeGroupId);
        if (activeGroup) {
          // Get only pages that belong to this group
          const groupPages = activeGroup.pageIndices
            .map(index => unifiedPages[index])
            .filter(Boolean);
          targetPages = getActivePagesWithSource(groupPages);
        }
      } else if (exportMode === 'current-group' && !activeGroupId && pageGroups.length > 0) {
        // Default group - exclude pages that are in custom groups
        const DEFAULT_GROUP_ID = 'default';
        const groupedPageIndices = new Set(
          pageGroups
            .filter(g => g.id !== DEFAULT_GROUP_ID)
            .flatMap(g => g.pageIndices)
        );
        
        targetPages = targetPages.filter(page => {
          const pageOriginalIndex = unifiedPages.findIndex(p => p === page);
          return !groupedPageIndices.has(pageOriginalIndex);
        });
      }
      
      const cardsPerPage = extractionSettings.grid.rows * extractionSettings.grid.columns;
      return calculateTotalCardsForMixedContent(targetPages, pdfMode, cardsPerPage);
    } catch (error) {
      console.error('Error calculating total cards:', error);
      return 0;
    }
  }, [pageSettings, multiFileImport, extractionSettings, pdfMode, exportMode, activeGroupId, pageGroups]);

  // Generate base filename for the zip (group-aware)
  const generateBaseFilename = useCallback(() => {
    let baseName = 'card-images';
    
    // Add group context to filename
    if (exportMode === 'current-group' && activeGroupId) {
      const activeGroup = pageGroups.find(g => g.id === activeGroupId);
      if (activeGroup) {
        const cleanGroupName = activeGroup.name
          .replace(/[^a-zA-Z0-9-_]/g, '-')
          .replace(/-+/g, '-')
          .replace(/^-|-$/g, '');
        baseName = `card-images-${cleanGroupName}`;
      }
    } else if (exportMode === 'current-group' && !activeGroupId) {
      baseName = 'card-images-default-group';
    } else if (exportMode === 'all-groups') {
      baseName = 'card-images-all-groups';
    }
    
    return baseName;
  }, [exportMode, activeGroupId, pageGroups]);

  // Get current group name for display
  const currentGroupName = React.useMemo(() => {
    if (exportMode === 'all-groups') {
      return 'All Groups';
    } else if (activeGroupId) {
      const activeGroup = pageGroups.find(g => g.id === activeGroupId);
      return activeGroup?.name || 'Unknown Group';
    } else {
      return 'Default Group';
    }
  }, [exportMode, activeGroupId, pageGroups]);

  const handleExport = useCallback(async () => {
    if (disabled || exportState.isExporting || totalCards === 0) {
      return;
    }

    setExportState({
      isExporting: true,
      progress: 0,
      message: 'Initializing export...',
      error: null
    });

    try {
      const options: CardImageExportOptions = {
        pdfData,
        pdfMode,
        extractionSettings,
        pageSettings,
        multiFileImport,
        pageGroups,
        activeGroupId,
        exportMode,
        onProgress: (progress: number, message: string) => {
          setExportState(prev => ({
            ...prev,
            progress: Math.round(progress),
            message
          }));
        },
        onError: (error: Error) => {
          setExportState(prev => ({
            ...prev,
            error: error.message
          }));
        }
      };

      const baseFilename = generateBaseFilename();
      await exportAndDownloadCardImages(options, baseFilename);

      // Success state
      setExportState({
        isExporting: false,
        progress: 100,
        message: 'Export completed successfully!',
        error: null
      });

      // Reset message after delay
      setTimeout(() => {
        setExportState(prev => ({
          ...prev,
          message: '',
          progress: 0
        }));
      }, 3000);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setExportState({
        isExporting: false,
        progress: 0,
        message: '',
        error: errorMessage
      });

      // Clear error after delay
      setTimeout(() => {
        setExportState(prev => ({
          ...prev,
          error: null
        }));
      }, 5000);
    }
  }, [
    disabled,
    exportState.isExporting,
    totalCards,
    pdfData,
    pdfMode,
    extractionSettings,
    pageSettings,
    multiFileImport,
    generateBaseFilename
  ]);

  const isDisabled = disabled || exportState.isExporting || totalCards === 0;

  return (
    <div className="space-y-2">
      <button
        onClick={handleExport}
        disabled={isDisabled}
        className={`
          flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-all
          ${isDisabled
            ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
            : 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2'
          }
          ${className}
        `}
        title={totalCards === 0 ? 'No cards available to export' : `Export ${totalCards} cards as zip file`}
      >
        {exportState.isExporting ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Archive className="h-4 w-4" />
        )}
        <span>
          {children || (
            exportState.isExporting 
              ? 'Exporting...'
              : `Export ${totalCards} Card${totalCards !== 1 ? 's' : ''} from ${currentGroupName}`
          )}
        </span>
      </button>

      {/* Progress indicator */}
      {exportState.isExporting && (
        <div className="space-y-1">
          <div className="flex justify-between text-sm text-gray-600">
            <span>{exportState.message}</span>
            <span>{exportState.progress}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${exportState.progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Success message */}
      {!exportState.isExporting && exportState.message && !exportState.error && (
        <div className="flex items-center space-x-2 text-sm text-green-600">
          <Download className="h-4 w-4" />
          <span>{exportState.message}</span>
        </div>
      )}

      {/* Error message */}
      {exportState.error && (
        <div className="flex items-center space-x-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-2">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          <span>Export failed: {exportState.error}</span>
        </div>
      )}

      {/* Help text */}
      {!exportState.isExporting && !exportState.error && !exportState.message && totalCards > 0 && (
        <p className="text-xs text-gray-500">
          Downloads a zip file containing all extracted cards as individual PNG images with labels like "front_01_filename.png"
        </p>
      )}

      {/* No cards warning */}
      {totalCards === 0 && (
        <p className="text-xs text-amber-600">
          No cards available for export. Please configure your grid settings and ensure you have loaded files.
        </p>
      )}
    </div>
  );
};

export default CardImageExportButton;