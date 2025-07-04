/**
 * @fileoverview Page Type Selector Component
 * 
 * This component provides a user interface for selecting and managing page types
 * in the unified page management system. It allows users to classify pages as
 * cards, rules, or skip pages, with visual indicators and batch selection.
 * 
 * **Key Features:**
 * - Individual page type selection
 * - Batch type assignment
 * - Visual type indicators with color coding
 * - Auto-detection suggestions
 * - Integration with page settings
 * 
 * @author Card Game PDF Transformer
 */

import React, { useState, useCallback } from 'react';
import { ChevronDown, Tag, Wand2 } from 'lucide-react';
import { PageSettings, PageSource, PageTypeSettings } from '../../types';
import { getPageTypeBadgeStyle, detectPageType } from '../../utils/pageTypeDefaults';

interface PageTypeSelectorProps {
  /** Current page settings with source information */
  pages: (PageSettings & PageSource)[];
  /** Page type configurations */
  pageTypeSettings: Record<string, PageTypeSettings>;
  /** Callback when page settings change */
  onPagesChange: (pages: (PageSettings & PageSource)[]) => void;
  /** Whether the selector is disabled */
  disabled?: boolean;
  /** Whether to show batch operations */
  showBatchOperations?: boolean;
}

interface PageTypeOption {
  value: 'card' | 'rule' | 'skip';
  label: string;
  description: string;
  colorScheme: {
    primary: string;
    background: string;
    text: string;
  };
}

/**
 * Page Type Selector Component
 * 
 * Provides UI for selecting page types with visual indicators and batch operations.
 */
export const PageTypeSelector: React.FC<PageTypeSelectorProps> = ({
  pages,
  pageTypeSettings,
  onPagesChange,
  disabled = false,
  showBatchOperations = true
}) => {
  const [selectedPages, setSelectedPages] = useState<Set<number>>(new Set());
  const [showBatchMenu, setShowBatchMenu] = useState(false);

  // Convert page type settings to options
  const pageTypeOptions: PageTypeOption[] = Object.values(pageTypeSettings).map(settings => ({
    value: settings.pageType,
    label: settings.displayName,
    description: settings.isProcessed 
      ? `Process as ${settings.displayName.toLowerCase()}`
      : 'Skip this page',
    colorScheme: settings.colorScheme
  }));

  /**
   * Handle individual page type change
   */
  const handlePageTypeChange = useCallback((pageIndex: number, pageType: 'card' | 'rule' | 'skip') => {
    const updatedPages = pages.map((page, index) => {
      if (index === pageIndex) {
        return {
          ...page,
          pageType,
          skip: pageType === 'skip' ? true : false
        };
      }
      return page;
    });
    
    onPagesChange(updatedPages);
  }, [pages, onPagesChange]);

  /**
   * Handle batch page type change
   */
  const handleBatchPageTypeChange = useCallback((pageType: 'card' | 'rule' | 'skip') => {
    const updatedPages = pages.map((page, index) => {
      if (selectedPages.has(index)) {
        return {
          ...page,
          pageType,
          skip: pageType === 'skip' ? true : false
        };
      }
      return page;
    });
    
    onPagesChange(updatedPages);
    setSelectedPages(new Set());
    setShowBatchMenu(false);
  }, [pages, selectedPages, onPagesChange]);

  /**
   * Handle auto-detection of page types
   */
  const handleAutoDetect = useCallback(() => {
    const updatedPages = pages.map((page) => {
      const detectedType = detectPageType(
        page.originalPageIndex,
        pages.length,
        page.fileName
      );
      
      return {
        ...page,
        pageType: detectedType,
        skip: detectedType === 'skip' ? true : false
      };
    });
    
    onPagesChange(updatedPages);
  }, [pages, onPagesChange]);

  /**
   * Handle page selection for batch operations
   */
  const handlePageSelection = useCallback((pageIndex: number, selected: boolean) => {
    const newSelection = new Set(selectedPages);
    if (selected) {
      newSelection.add(pageIndex);
    } else {
      newSelection.delete(pageIndex);
    }
    setSelectedPages(newSelection);
  }, [selectedPages]);

  /**
   * Handle select all/none
   */
  const handleSelectAll = useCallback((selectAll: boolean) => {
    if (selectAll) {
      setSelectedPages(new Set(pages.map((_, index) => index)));
    } else {
      setSelectedPages(new Set());
    }
  }, [pages]);

  /**
   * Get page type badge component
   */
  const getPageTypeBadge = (pageType: 'card' | 'rule' | 'skip' | undefined, size: 'sm' | 'xs' = 'xs') => {
    if (!pageType) {
      return (
        <span className={`px-2 py-1 rounded-md text-${size} font-medium bg-gray-100 text-gray-500`}>
          None
        </span>
      );
    }

    const style = getPageTypeBadgeStyle(pageType, pageTypeSettings);
    const sizeClass = size === 'sm' ? 'px-3 py-1 text-sm' : 'px-2 py-1 text-xs';
    
    return (
      <span 
        className={`${sizeClass} rounded-md font-medium`}
        style={style.style}
      >
        {pageTypeSettings[pageType]?.displayName || pageType}
      </span>
    );
  };

  if (pages.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      {/* Header with batch operations */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Tag className="w-5 h-5 text-gray-500" />
          <h3 className="text-lg font-medium text-gray-900">Page Types</h3>
          <span className="text-sm text-gray-500">
            ({pages.length} pages)
          </span>
        </div>
        
        {showBatchOperations && pages.length > 1 && (
          <div className="flex items-center space-x-2">
            {/* Auto-detect button */}
            <button
              onClick={handleAutoDetect}
              disabled={disabled}
              className="inline-flex items-center px-3 py-1 border border-gray-300 text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              <Wand2 className="w-4 h-4 mr-1" />
              Auto-detect
            </button>
            
            {/* Batch operations */}
            {selectedPages.size > 0 && (
              <div className="relative">
                <button
                  onClick={() => setShowBatchMenu(!showBatchMenu)}
                  className="inline-flex items-center px-3 py-1 border border-indigo-300 text-sm leading-4 font-medium rounded-md text-indigo-700 bg-indigo-50 hover:bg-indigo-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  Set Type ({selectedPages.size})
                  <ChevronDown className="w-4 h-4 ml-1" />
                </button>
                
                {showBatchMenu && (
                  <div className="absolute right-0 mt-1 w-48 bg-white rounded-md shadow-lg z-10 border border-gray-200">
                    <div className="py-1">
                      {pageTypeOptions.map((option) => (
                        <button
                          key={option.value}
                          onClick={() => handleBatchPageTypeChange(option.value)}
                          className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                        >
                          <span 
                            className="w-3 h-3 rounded-full mr-2"
                            style={{ backgroundColor: option.colorScheme.primary }}
                          />
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Selection controls */}
      {showBatchOperations && pages.length > 1 && (
        <div className="flex items-center space-x-4 text-sm">
          <button
            onClick={() => handleSelectAll(true)}
            className="text-indigo-600 hover:text-indigo-500"
          >
            Select All
          </button>
          <button
            onClick={() => handleSelectAll(false)}
            className="text-gray-500 hover:text-gray-400"
          >
            Select None
          </button>
          {selectedPages.size > 0 && (
            <span className="text-gray-500">
              {selectedPages.size} of {pages.length} selected
            </span>
          )}
        </div>
      )}

      {/* Page list with type selectors */}
      <div className="space-y-2">
        {pages.map((page, index) => (
          <div 
            key={`${page.fileName}-${page.originalPageIndex}`}
            className="flex items-center space-x-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            {/* Selection checkbox for batch operations */}
            {showBatchOperations && pages.length > 1 && (
              <input
                type="checkbox"
                checked={selectedPages.has(index)}
                onChange={(e) => handlePageSelection(index, e.target.checked)}
                disabled={disabled}
                className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
            )}
            
            {/* Page info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-2">
                <span className="text-sm font-medium text-gray-900">
                  Page {index + 1}
                </span>
                <span className="text-sm text-gray-500">
                  ({page.fileName})
                </span>
              </div>
            </div>
            
            {/* Current page type badge */}
            <div className="flex-shrink-0">
              {getPageTypeBadge(page.pageType)}
            </div>
            
            {/* Page type selector */}
            <div className="flex-shrink-0">
              <select
                value={page.pageType || 'card'}
                onChange={(e) => handlePageTypeChange(index, e.target.value as 'card' | 'rule' | 'skip')}
                disabled={disabled}
                className="rounded-md border-gray-300 text-sm focus:border-indigo-500 focus:ring-indigo-500"
              >
                {pageTypeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        ))}
      </div>

      {/* Summary */}
      <div className="flex items-center space-x-4 pt-2 border-t border-gray-200">
        <span className="text-sm text-gray-500">Summary:</span>
        {pageTypeOptions.map((option) => {
          const count = pages.filter(page => page.pageType === option.value).length;
          if (count === 0) return null;
          
          return (
            <div key={option.value} className="flex items-center space-x-1">
              {getPageTypeBadge(option.value, 'sm')}
              <span className="text-sm text-gray-500">× {count}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};