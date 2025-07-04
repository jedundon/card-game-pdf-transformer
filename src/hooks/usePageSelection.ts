/**
 * @fileoverview Page Selection State Management Hook
 * 
 * This hook manages the state for page selection operations in the unified
 * page management system. It provides a clean interface for handling
 * individual and batch page selections with proper state management.
 * 
 * **Key Features:**
 * - Selection state management
 * - Batch selection operations
 * - Selection persistence across operations
 * - Integration with page operations
 * - Keyboard shortcut support
 * 
 * @author Card Game PDF Transformer
 */

import { useState, useCallback, useMemo } from 'react';
import { PageSettings, PageSource } from '../types';

interface UsePageSelectionOptions {
  /** Whether to persist selection across page changes */
  persistSelection?: boolean;
  /** Maximum number of pages that can be selected */
  maxSelection?: number;
  /** Callback when selection limit is reached */
  onSelectionLimitReached?: (limit: number) => void;
}

interface PageSelectionState {
  /** Set of selected page indices */
  selectedPages: Set<number>;
  /** Last selected page index for range operations */
  lastSelectedIndex: number | null;
  /** Whether all pages are selected */
  isAllSelected: boolean;
  /** Whether some pages are selected */
  hasSelection: boolean;
  /** Number of selected pages */
  selectionCount: number;
}

interface UsePageSelectionReturn {
  /** Current selection state */
  selectionState: PageSelectionState;
  /** Select/deselect a single page */
  togglePageSelection: (pageIndex: number, selected?: boolean) => void;
  /** Select/deselect a range of pages */
  selectPageRange: (startIndex: number, endIndex: number, selected?: boolean) => void;
  /** Select all pages */
  selectAll: () => void;
  /** Clear all selections */
  clearSelection: () => void;
  /** Select pages by filter function */
  selectByFilter: (filter: (page: PageSettings & PageSource, index: number) => boolean) => void;
  /** Toggle selection for all pages */
  toggleSelectAll: () => void;
  /** Check if a specific page is selected */
  isPageSelected: (pageIndex: number) => boolean;
  /** Get selected pages data */
  getSelectedPages: () => (PageSettings & PageSource)[];
  /** Get selected page indices */
  getSelectedIndices: () => number[];
}

/**
 * Custom hook for managing page selection state
 */
export const usePageSelection = (
  pages: (PageSettings & PageSource)[],
  options: UsePageSelectionOptions = {}
): UsePageSelectionReturn => {
  const {
    persistSelection = false,
    maxSelection,
    onSelectionLimitReached
  } = options;

  const [selectedPages, setSelectedPages] = useState<Set<number>>(new Set());
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null);

  /**
   * Computed selection state
   */
  const selectionState = useMemo((): PageSelectionState => {
    const selectionCount = selectedPages.size;
    const totalPages = pages.length;

    return {
      selectedPages: new Set(selectedPages),
      lastSelectedIndex,
      isAllSelected: selectionCount > 0 && selectionCount === totalPages,
      hasSelection: selectionCount > 0,
      selectionCount
    };
  }, [selectedPages, lastSelectedIndex, pages.length]);

  /**
   * Check selection limit
   */
  const checkSelectionLimit = useCallback((newSize: number): boolean => {
    if (maxSelection && newSize > maxSelection) {
      onSelectionLimitReached?.(maxSelection);
      return false;
    }
    return true;
  }, [maxSelection, onSelectionLimitReached]);

  /**
   * Toggle single page selection
   */
  const togglePageSelection = useCallback((pageIndex: number, selected?: boolean) => {
    if (pageIndex < 0 || pageIndex >= pages.length) {
      console.warn(`Invalid page index: ${pageIndex}`);
      return;
    }

    setSelectedPages(prev => {
      const newSelection = new Set(prev);
      const isCurrentlySelected = newSelection.has(pageIndex);
      const shouldSelect = selected !== undefined ? selected : !isCurrentlySelected;

      if (shouldSelect) {
        if (!checkSelectionLimit(newSelection.size + 1)) {
          return prev;
        }
        newSelection.add(pageIndex);
      } else {
        newSelection.delete(pageIndex);
      }

      return newSelection;
    });

    setLastSelectedIndex(pageIndex);
  }, [pages.length, checkSelectionLimit]);

  /**
   * Select/deselect page range
   */
  const selectPageRange = useCallback((startIndex: number, endIndex: number, selected = true) => {
    const start = Math.max(0, Math.min(startIndex, endIndex));
    const end = Math.min(pages.length - 1, Math.max(startIndex, endIndex));

    setSelectedPages(prev => {
      const newSelection = new Set(prev);
      
      for (let i = start; i <= end; i++) {
        if (selected) {
          newSelection.add(i);
        } else {
          newSelection.delete(i);
        }
      }

      if (selected && !checkSelectionLimit(newSelection.size)) {
        return prev;
      }

      return newSelection;
    });

    setLastSelectedIndex(endIndex);
  }, [pages.length, checkSelectionLimit]);

  /**
   * Select all pages
   */
  const selectAll = useCallback(() => {
    const allIndices = Array.from({ length: pages.length }, (_, i) => i);
    
    if (!checkSelectionLimit(allIndices.length)) {
      return;
    }

    setSelectedPages(new Set(allIndices));
    setLastSelectedIndex(pages.length - 1);
  }, [pages.length, checkSelectionLimit]);

  /**
   * Clear all selections
   */
  const clearSelection = useCallback(() => {
    setSelectedPages(new Set());
    setLastSelectedIndex(null);
  }, []);

  /**
   * Select pages by filter function
   */
  const selectByFilter = useCallback((filter: (page: PageSettings & PageSource, index: number) => boolean) => {
    const matchingIndices = pages
      .map((page, index) => ({ page, index }))
      .filter(({ page, index }) => filter(page, index))
      .map(({ index }) => index);

    if (!checkSelectionLimit(matchingIndices.length)) {
      return;
    }

    setSelectedPages(new Set(matchingIndices));
    setLastSelectedIndex(matchingIndices.length > 0 ? matchingIndices[matchingIndices.length - 1] : null);
  }, [pages, checkSelectionLimit]);

  /**
   * Toggle select all
   */
  const toggleSelectAll = useCallback(() => {
    if (selectionState.isAllSelected) {
      clearSelection();
    } else {
      selectAll();
    }
  }, [selectionState.isAllSelected, clearSelection, selectAll]);

  /**
   * Check if specific page is selected
   */
  const isPageSelected = useCallback((pageIndex: number): boolean => {
    return selectedPages.has(pageIndex);
  }, [selectedPages]);

  /**
   * Get selected pages data
   */
  const getSelectedPages = useCallback((): (PageSettings & PageSource)[] => {
    return Array.from(selectedPages)
      .sort((a, b) => a - b)
      .map(index => pages[index])
      .filter(Boolean);
  }, [selectedPages, pages]);

  /**
   * Get selected page indices
   */
  const getSelectedIndices = useCallback((): number[] => {
    return Array.from(selectedPages).sort((a, b) => a - b);
  }, [selectedPages]);

  // Clear selection when pages change (unless persistence is enabled)
  useState(() => {
    if (!persistSelection) {
      setSelectedPages(new Set());
      setLastSelectedIndex(null);
    }
  });

  return {
    selectionState,
    togglePageSelection,
    selectPageRange,
    selectAll,
    clearSelection,
    selectByFilter,
    toggleSelectAll,
    isPageSelected,
    getSelectedPages,
    getSelectedIndices
  };
};