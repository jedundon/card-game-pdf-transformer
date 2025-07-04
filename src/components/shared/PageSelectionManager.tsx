/**
 * @fileoverview Page Selection Manager Component
 * 
 * This component provides a comprehensive interface for managing page selections
 * in the unified page management system. It supports individual and batch selection
 * with keyboard shortcuts, visual feedback, and integration with page operations.
 * 
 * **Key Features:**
 * - Individual page selection with checkboxes
 * - Batch selection with Ctrl+A, Shift+click support
 * - Visual selection indicators
 * - Selection state management
 * - Integration with batch operations
 * 
 * @author Card Game PDF Transformer
 */

import React, { useState, useCallback, useEffect } from 'react';
import { Square, CheckSquare, Minus } from 'lucide-react';
import { PageSettings, PageSource } from '../../types';

interface PageSelectionManagerProps {
  /** Current page list */
  pages: (PageSettings & PageSource)[];
  /** Currently selected page indices */
  selectedPages: Set<number>;
  /** Callback when selection changes */
  onSelectionChange: (selectedIndices: Set<number>) => void;
  /** Whether selection is disabled */
  disabled?: boolean;
  /** Whether to show selection controls */
  showControls?: boolean;
  /** Whether to allow keyboard shortcuts */
  enableKeyboardShortcuts?: boolean;
  /** Custom selection indicator component */
  selectionIndicator?: React.ComponentType<{ selected: boolean; indeterminate?: boolean }>;
}

/**
 * Page Selection Manager Component
 * 
 * Provides comprehensive page selection functionality with keyboard support.
 */
export const PageSelectionManager: React.FC<PageSelectionManagerProps> = ({
  pages,
  selectedPages,
  onSelectionChange,
  disabled = false,
  showControls = true,
  enableKeyboardShortcuts = true,
  selectionIndicator: CustomIndicator
}) => {
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null);

  /**
   * Handle individual page selection
   */
  const handlePageSelection = useCallback((pageIndex: number, selected: boolean, isShiftClick = false) => {
    if (disabled) return;

    const newSelection = new Set(selectedPages);

    if (isShiftClick && lastSelectedIndex !== null) {
      // Shift+click: select range
      const start = Math.min(lastSelectedIndex, pageIndex);
      const end = Math.max(lastSelectedIndex, pageIndex);
      
      for (let i = start; i <= end; i++) {
        if (selected) {
          newSelection.add(i);
        } else {
          newSelection.delete(i);
        }
      }
    } else {
      // Normal click: toggle single page
      if (selected) {
        newSelection.add(pageIndex);
      } else {
        newSelection.delete(pageIndex);
      }
      setLastSelectedIndex(pageIndex);
    }

    onSelectionChange(newSelection);
  }, [selectedPages, onSelectionChange, disabled, lastSelectedIndex]);

  /**
   * Handle select all/none
   */
  const handleSelectAll = useCallback((selectAll: boolean) => {
    if (disabled) return;

    if (selectAll) {
      const allIndices = new Set(pages.map((_, index) => index));
      onSelectionChange(allIndices);
    } else {
      onSelectionChange(new Set());
    }
  }, [pages, onSelectionChange, disabled]);

  /**
   * Handle keyboard shortcuts
   */
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!enableKeyboardShortcuts || disabled) return;

    // Ctrl+A / Cmd+A: Select all
    if ((event.ctrlKey || event.metaKey) && event.key === 'a') {
      event.preventDefault();
      handleSelectAll(true);
    }

    // Escape: Clear selection
    if (event.key === 'Escape') {
      onSelectionChange(new Set());
    }
  }, [enableKeyboardShortcuts, disabled, handleSelectAll, onSelectionChange]);

  /**
   * Set up keyboard event listeners
   */
  useEffect(() => {
    if (enableKeyboardShortcuts && !disabled) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [enableKeyboardShortcuts, disabled, handleKeyDown]);

  /**
   * Get selection state for display
   */
  const getSelectionState = () => {
    const totalPages = pages.length;
    const selectedCount = selectedPages.size;

    if (selectedCount === 0) {
      return { state: 'none' as const, count: 0, total: totalPages };
    } else if (selectedCount === totalPages) {
      return { state: 'all' as const, count: selectedCount, total: totalPages };
    } else {
      return { state: 'partial' as const, count: selectedCount, total: totalPages };
    }
  };

  /**
   * Render selection indicator
   */
  const renderSelectionIndicator = (selected: boolean, indeterminate = false) => {
    if (CustomIndicator) {
      return <CustomIndicator selected={selected} indeterminate={indeterminate} />;
    }

    if (indeterminate) {
      return <Minus className="w-4 h-4 text-indigo-600" />;
    }

    return selected 
      ? <CheckSquare className="w-4 h-4 text-indigo-600" />
      : <Square className="w-4 h-4 text-gray-400" />;
  };

  const selectionState = getSelectionState();

  if (pages.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      {/* Selection Controls */}
      {showControls && (
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            {/* Master checkbox */}
            <button
              onClick={() => handleSelectAll(selectionState.state !== 'all')}
              disabled={disabled}
              className="flex items-center space-x-2 text-sm text-gray-700 hover:text-gray-900 disabled:opacity-50"
            >
              {renderSelectionIndicator(
                selectionState.state === 'all',
                selectionState.state === 'partial'
              )}
              <span>
                {selectionState.state === 'all' ? 'Deselect All' : 'Select All'}
              </span>
            </button>

            {/* Selection summary */}
            <span className="text-sm text-gray-500">
              {selectionState.count > 0 
                ? `${selectionState.count} of ${selectionState.total} selected`
                : `${selectionState.total} pages`
              }
            </span>
          </div>

          {/* Keyboard shortcuts hint */}
          {enableKeyboardShortcuts && !disabled && (
            <div className="text-xs text-gray-400">
              <span className="hidden sm:inline">Ctrl+A: Select All • Escape: Clear • Shift+Click: Range</span>
              <span className="sm:hidden">Ctrl+A • Esc</span>
            </div>
          )}
        </div>
      )}

      {/* Individual Page Selection */}
      <div className="space-y-1">
        {pages.map((page, index) => (
          <div
            key={`${page.fileName}-${page.originalPageIndex}`}
            className={`
              flex items-center space-x-3 p-2 rounded-lg cursor-pointer transition-colors
              ${selectedPages.has(index) 
                ? 'bg-indigo-50 border border-indigo-200' 
                : 'bg-white border border-gray-200 hover:bg-gray-50'
              }
              ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
            `}
            onClick={(e) => {
              handlePageSelection(index, !selectedPages.has(index), e.shiftKey);
            }}
          >
            {/* Selection checkbox */}
            <div className="flex-shrink-0">
              {renderSelectionIndicator(selectedPages.has(index))}
            </div>

            {/* Page info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-2">
                <span className="text-sm font-medium text-gray-900">
                  Page {index + 1}
                </span>
                <span className="text-sm text-gray-500">
                  ({page.fileName})
                </span>
                {page.pageType && (
                  <span className={`
                    px-2 py-1 rounded-md text-xs font-medium
                    ${page.pageType === 'card' ? 'bg-blue-100 text-blue-800' :
                      page.pageType === 'rule' ? 'bg-green-100 text-green-800' :
                      'bg-gray-100 text-gray-800'}
                  `}>
                    {page.pageType}
                  </span>
                )}
              </div>
            </div>

            {/* Selection indicator for mobile */}
            <div className="flex-shrink-0 sm:hidden">
              {selectedPages.has(index) && (
                <div className="w-2 h-2 bg-indigo-600 rounded-full" />
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Selection summary for mobile */}
      {selectionState.count > 0 && (
        <div className="sm:hidden p-3 bg-indigo-50 rounded-lg">
          <div className="text-sm font-medium text-indigo-900">
            {selectionState.count} pages selected
          </div>
          <div className="text-xs text-indigo-700 mt-1">
            Ready for batch operations
          </div>
        </div>
      )}
    </div>
  );
};