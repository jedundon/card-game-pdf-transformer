/**
 * @fileoverview Removed Pages Section Component
 * 
 * This component displays pages that have been soft-removed with the ability
 * to restore them. It provides a better user experience by preventing
 * accidental permanent page deletion.
 * 
 * **Key Features:**
 * - Collapsible section showing removed pages
 * - Individual restore buttons for each page
 * - Bulk "Restore All" functionality
 * - Thumbnail previews for visual identification
 * - File source information for multi-file imports
 * 
 * @author Card Game PDF Transformer
 */

import React, { useState, useCallback } from 'react';
import { ChevronDown, ChevronRight, RotateCcw, FileIcon, ImageIcon, Plus } from 'lucide-react';
import type { PageSettings, PageSource } from '../../types';

interface RemovedPagesSectionProps {
  /** All pages including removed ones */
  pages: (PageSettings & PageSource)[];
  /** Map of page thumbnails (page index -> data URL) */
  thumbnails: Record<number, string>;
  /** Map of thumbnail loading states */
  thumbnailLoading: Record<number, boolean>;
  /** Map of thumbnail error states */
  thumbnailErrors: Record<number, boolean>;
  /** Callback when a page's settings are changed */
  onPageSettingsChange: (pageIndex: number, settings: Partial<PageSettings>) => void;
  /** Callback to load a thumbnail for a specific page */
  onThumbnailLoad: (pageIndex: number) => void;
  /** Whether the component is disabled */
  disabled?: boolean;
}

/**
 * Removed Pages Section - Shows soft-removed pages with restore functionality
 * 
 * Provides a collapsible section at the bottom of the Import Step that displays
 * all pages that have been soft-removed, allowing users to restore them easily.
 */
export const RemovedPagesSection: React.FC<RemovedPagesSectionProps> = ({
  pages,
  thumbnails,
  thumbnailLoading,
  thumbnailErrors,
  onPageSettingsChange,
  onThumbnailLoad,
  disabled = false
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  // Get removed pages with their original indices
  const removedPages = pages
    .map((page, index) => ({ page, originalIndex: index }))
    .filter(({ page }) => page.removed);

  // Handle individual page restoration
  const handleRestorePage = useCallback((pageIndex: number) => {
    onPageSettingsChange(pageIndex, { removed: false });
  }, [onPageSettingsChange]);

  // Handle restore all pages
  const handleRestoreAll = useCallback(() => {
    removedPages.forEach(({ originalIndex }) => {
      onPageSettingsChange(originalIndex, { removed: false });
    });
  }, [removedPages, onPageSettingsChange]);

  // Render file type icon
  const renderFileTypeIcon = (fileType: 'pdf' | 'image') => {
    if (fileType === 'pdf') {
      return <FileIcon size={16} className="text-red-600" />;
    } else {
      return <ImageIcon size={16} className="text-green-600" />;
    }
  };

  // Render thumbnail
  const renderThumbnail = (pageIndex: number) => {
    if (thumbnailLoading[pageIndex]) {
      return (
        <div className="w-12 h-16 bg-gray-100 border border-gray-200 rounded flex items-center justify-center">
          <div className="animate-spin w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full"></div>
        </div>
      );
    }
    
    if (thumbnailErrors[pageIndex]) {
      return (
        <div className="w-12 h-16 bg-gray-100 border border-gray-200 rounded flex items-center justify-center">
          <span className="text-xs text-gray-400">Error</span>
        </div>
      );
    }
    
    if (thumbnails[pageIndex]) {
      return (
        <img
          src={thumbnails[pageIndex]}
          alt={`Page ${pageIndex + 1} preview`}
          className="w-12 h-16 border border-gray-200 rounded opacity-75"
          title={`Page ${pageIndex + 1} preview (removed)`}
        />
      );
    }
    
    // Load thumbnail if not available
    if (!thumbnailLoading[pageIndex] && !thumbnailErrors[pageIndex]) {
      onThumbnailLoad(pageIndex);
    }
    
    return (
      <div className="w-12 h-16 bg-gray-50 border border-gray-200 rounded flex items-center justify-center">
        <span className="text-xs text-gray-400">...</span>
      </div>
    );
  };

  // Don't render if no removed pages
  if (removedPages.length === 0) {
    return null;
  }

  return (
    <div className="mt-6 border border-gray-200 rounded-lg bg-gray-50">
      {/* Header with toggle and restore all button */}
      <div 
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-100 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center space-x-3">
          {isExpanded ? (
            <ChevronDown size={20} className="text-gray-500" />
          ) : (
            <ChevronRight size={20} className="text-gray-500" />
          )}
          <h3 className="text-base font-medium text-gray-800">
            Removed Pages ({removedPages.length})
          </h3>
          <span className="text-sm text-gray-500">
            Pages that can be restored
          </span>
        </div>
        
        {removedPages.length > 0 && (
          <button
            onClick={(e) => {
              e.stopPropagation(); // Prevent header click
              handleRestoreAll();
            }}
            disabled={disabled}
            className="inline-flex items-center px-3 py-1 text-sm bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title="Restore all removed pages"
          >
            <RotateCcw size={14} className="mr-1" />
            Restore All
          </button>
        )}
      </div>

      {/* Collapsible content */}
      {isExpanded && (
        <div className="border-t border-gray-200 p-4 bg-white">
          <div className="text-sm text-gray-600 mb-3">
            These pages have been removed but can be restored at any time. They will not be included in card extraction or final output.
          </div>
          
          {/* Removed pages grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {removedPages.map(({ page, originalIndex }) => (
              <div 
                key={`removed-${page.fileName}-${page.originalPageIndex}-${originalIndex}`}
                className="border border-gray-200 rounded-lg p-3 bg-gray-50 hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-start space-x-3">
                  {/* Thumbnail */}
                  <div className="flex-shrink-0">
                    {renderThumbnail(originalIndex)}
                  </div>
                  
                  {/* Page info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2 mb-2">
                      {renderFileTypeIcon(page.fileType)}
                      <span className="text-sm font-medium text-gray-900">
                        Page {originalIndex + 1}
                      </span>
                    </div>
                    
                    <div className="text-xs text-gray-600 mb-2">
                      <div className="truncate" title={page.fileName}>
                        {page.fileName.length > 25 
                          ? `${page.fileName.substring(0, 20)}...${page.fileName.slice(-4)}`
                          : page.fileName
                        }
                      </div>
                      <div>
                        Source page {(page.originalPageIndex ?? 0) + 1}
                      </div>
                    </div>
                    
                    {/* Restore button */}
                    <button
                      onClick={() => handleRestorePage(originalIndex)}
                      disabled={disabled}
                      className="inline-flex items-center px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      title="Restore this page"
                    >
                      <Plus size={12} className="mr-1" />
                      Restore
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};