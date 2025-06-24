/**
 * @fileoverview Page reordering and card numbering utilities
 * 
 * This module provides core functionality for managing page reordering operations
 * and ensuring that card numbering stays consistent with the user's intended
 * page sequence. This is critical for the multi-file workflow where users can
 * reorder pages from different sources.
 * 
 * **Key Responsibilities:**
 * - Page sequence management and reordering operations
 * - Dynamic card number recalculation based on page order
 * - Source file tracking during reordering operations
 * - Validation of page order integrity
 * - State management for drag-and-drop operations
 * 
 * **Critical Design Principle:**
 * Card numbers are always calculated from the final reordered page sequence,
 * not the original file order. This ensures that "Card 1" is always the first
 * card from the first page in the user's intended order.
 * 
 * @author Card Game PDF Transformer
 */

import { PageSettings, PageSource, PageReorderState, MultiFileImportState, PdfMode } from '../types';

/**
 * Reorder pages by moving a page from one position to another
 * 
 * Performs the core page reordering operation, updating both the page array
 * and the display order tracking. This function maintains all source tracking
 * information while updating the sequence.
 * 
 * @param pages - Array of pages with source tracking information
 * @param fromIndex - Original position of the page (0-based)
 * @param toIndex - Target position for the page (0-based)
 * @returns New array with reordered pages and updated display orders
 * 
 * @example
 * ```typescript
 * const pages = [page1, page2, page3];
 * const reordered = reorderPages(pages, 0, 2); // Move first page to third position
 * // Result: [page2, page3, page1] with updated display orders
 * ```
 */
export function reorderPages<T extends PageSettings & PageSource>(
  pages: T[],
  fromIndex: number,
  toIndex: number
): T[] {
  // Validate indices
  if (fromIndex < 0 || fromIndex >= pages.length || toIndex < 0 || toIndex >= pages.length) {
    throw new Error(`Invalid reorder indices: ${fromIndex} to ${toIndex} (pages length: ${pages.length})`);
  }
  
  // If indices are the same, no change needed
  if (fromIndex === toIndex) {
    return pages;
  }
  
  // Create a copy of the pages array
  const reorderedPages = [...pages];
  
  // Remove the page from its current position
  const [movedPage] = reorderedPages.splice(fromIndex, 1);
  
  // Insert the page at its new position
  reorderedPages.splice(toIndex, 0, movedPage);
  
  // Update display orders to match new positions
  return reorderedPages.map((page, index) => ({
    ...page,
    displayOrder: index
  }));
}

/**
 * Recalculate card numbers based on reordered page sequence
 * 
 * This is the critical function that ensures card numbering follows the
 * user's intended page order rather than the original file order. Card
 * numbers are recalculated from the beginning of the reordered sequence.
 * 
 * @param pages - Reordered pages array
 * @param pdfMode - PDF processing mode affecting card counting
 * @param gridSettings - Grid configuration for cards per page
 * @returns Map of page indices to their new card number ranges
 * 
 * @example
 * ```typescript
 * const pages = getReorderedPages();
 * const cardNumbers = recalculateCardNumbers(pages, pdfMode, { rows: 3, columns: 3 });
 * // Returns: Map { 0 => [1, 2, 3, 4, 5, 6, 7, 8, 9], 1 => [10, 11, 12, ...], ... }
 * ```
 */
export function recalculateCardNumbers(
  pages: (PageSettings & PageSource)[],
  pdfMode: PdfMode,
  gridSettings: { rows: number; columns: number }
): Map<number, number[]> {
  const cardNumberMap = new Map<number, number[]>();
  let currentCardId = 1;
  
  // Calculate cards per page based on PDF mode
  const cardsPerPage = gridSettings.rows * gridSettings.columns;
  
  // Process pages in their current display order
  pages.forEach((page, pageIndex) => {
    if (page.skip) {
      // Skipped pages don't get card numbers
      cardNumberMap.set(pageIndex, []);
      return;
    }
    
    const pageCardNumbers: number[] = [];
    
    // Calculate card numbers based on PDF mode
    switch (pdfMode.type) {
      case 'simplex':
        // Simplex mode: each page has unique cards
        for (let i = 0; i < cardsPerPage; i++) {
          pageCardNumbers.push(currentCardId++);
        }
        break;
        
      case 'duplex':
        // Duplex mode: fronts and backs are on alternating pages
        if (page.type === 'front') {
          // Front pages get new card IDs
          for (let i = 0; i < cardsPerPage; i++) {
            pageCardNumbers.push(currentCardId++);
          }
        } else if (page.type === 'back') {
          // Back pages use the same IDs as the previous front page
          const previousFrontPageIndex = findPreviousFrontPage(pages, pageIndex);
          if (previousFrontPageIndex !== -1) {
            const frontCardNumbers = cardNumberMap.get(previousFrontPageIndex) || [];
            pageCardNumbers.push(...frontCardNumbers);
          }
        }
        break;
        
      case 'gutter-fold':
        // Gutter-fold mode: each page contains both fronts and backs
        const cardsPerSide = cardsPerPage / 2;
        for (let i = 0; i < cardsPerSide; i++) {
          pageCardNumbers.push(currentCardId++);
        }
        break;
    }
    
    cardNumberMap.set(pageIndex, pageCardNumbers);
  });
  
  return cardNumberMap;
}

/**
 * Find the previous front page for duplex back page calculation
 * 
 * Helper function for duplex mode card numbering. Finds the most recent
 * front page before the current back page to determine which card IDs
 * the back page should use.
 * 
 * @param pages - Array of pages to search
 * @param currentIndex - Index of the current back page
 * @returns Index of the previous front page, or -1 if not found
 */
function findPreviousFrontPage(
  pages: (PageSettings & PageSource)[],
  currentIndex: number
): number {
  for (let i = currentIndex - 1; i >= 0; i--) {
    if (!pages[i].skip && pages[i].type === 'front') {
      return i;
    }
  }
  return -1;
}

/**
 * Create initial page order array
 * 
 * Generates the initial page ordering based on file import sequence.
 * This provides the starting point for user reordering operations.
 * 
 * @param pageCount - Total number of pages across all files
 * @returns Array of page indices in sequential order
 * 
 * @example
 * ```typescript
 * const initialOrder = createInitialPageOrder(10);
 * // Returns: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
 * ```
 */
export function createInitialPageOrder(pageCount: number): number[] {
  return Array.from({ length: pageCount }, (_, index) => index);
}

/**
 * Validate page order integrity
 * 
 * Ensures that the page order array is valid and contains all expected
 * page indices without duplicates or missing values.
 * 
 * @param pageOrder - Array of page indices representing current order
 * @param expectedPageCount - Expected total number of pages
 * @returns true if the page order is valid
 * 
 * @example
 * ```typescript
 * const order = [2, 0, 1];
 * const isValid = validatePageOrder(order, 3); // Returns true
 * 
 * const invalidOrder = [0, 1, 1]; // Duplicate
 * const isInvalid = validatePageOrder(invalidOrder, 3); // Returns false
 * ```
 */
export function validatePageOrder(pageOrder: number[], expectedPageCount: number): boolean {
  // Check length
  if (pageOrder.length !== expectedPageCount) {
    return false;
  }
  
  // Check for duplicates and missing indices
  const sortedOrder = [...pageOrder].sort((a, b) => a - b);
  for (let i = 0; i < expectedPageCount; i++) {
    if (sortedOrder[i] !== i) {
      return false;
    }
  }
  
  return true;
}

/**
 * Update page order in MultiFileImportState
 * 
 * Helper function to update the page order within the multi-file import
 * state while maintaining all other state information.
 * 
 * @param state - Current multi-file import state
 * @param newPageOrder - New page order array
 * @returns Updated state with new page order
 * 
 * @example
 * ```typescript
 * const currentState = getCurrentImportState();
 * const newOrder = [2, 0, 1];
 * const updatedState = updatePageOrderInState(currentState, newOrder);
 * ```
 */
export function updatePageOrderInState(
  state: MultiFileImportState,
  newPageOrder: number[]
): MultiFileImportState {
  // Validate the new page order
  if (!validatePageOrder(newPageOrder, state.pages.length)) {
    throw new Error('Invalid page order provided');
  }
  
  // Reorder the pages array based on the new order
  const reorderedPages = newPageOrder.map(originalIndex => ({
    ...state.pages[originalIndex],
    displayOrder: newPageOrder.indexOf(originalIndex)
  }));
  
  return {
    ...state,
    pages: reorderedPages,
    reorderState: {
      ...state.reorderState,
      pageOrder: newPageOrder
    }
  };
}

/**
 * Get page display order from MultiFileImportState
 * 
 * Extracts the current page display order from the multi-file import state.
 * This is useful for UI components that need to display pages in the
 * correct order.
 * 
 * @param state - Multi-file import state
 * @returns Array of page indices in display order
 * 
 * @example
 * ```typescript
 * const state = getCurrentImportState();
 * const displayOrder = getPageDisplayOrder(state);
 * // Use displayOrder to render pages in correct sequence
 * ```
 */
export function getPageDisplayOrder(state: MultiFileImportState): number[] {
  return state.pages
    .map((page, index) => ({ originalIndex: index, displayOrder: page.displayOrder || 0 }))
    .sort((a, b) => a.displayOrder - b.displayOrder)
    .map(item => item.originalIndex);
}

/**
 * Insert page at specific position in order
 * 
 * Inserts a new page at a specific position in the page order, updating
 * all subsequent page display orders accordingly.
 * 
 * @param pages - Current pages array
 * @param newPage - Page to insert
 * @param insertPosition - Position to insert at (0-based)
 * @returns Updated pages array with inserted page
 * 
 * @example
 * ```typescript
 * const pages = [page1, page2, page3];
 * const newPage = createNewPage();
 * const updated = insertPageAtPosition(pages, newPage, 1);
 * // Result: [page1, newPage, page2, page3] with updated display orders
 * ```
 */
export function insertPageAtPosition<T extends PageSettings & PageSource>(
  pages: T[],
  newPage: T,
  insertPosition: number
): T[] {
  if (insertPosition < 0 || insertPosition > pages.length) {
    throw new Error(`Invalid insert position: ${insertPosition} (pages length: ${pages.length})`);
  }
  
  // Create copy of pages array
  const updatedPages = [...pages];
  
  // Insert the new page
  updatedPages.splice(insertPosition, 0, newPage);
  
  // Update display orders
  return updatedPages.map((page, index) => ({
    ...page,
    displayOrder: index
  }));
}

/**
 * Remove page from order
 * 
 * Removes a page from the page order and updates all subsequent display
 * orders to maintain sequence integrity.
 * 
 * @param pages - Current pages array
 * @param removeIndex - Index of page to remove (0-based)
 * @returns Updated pages array without the removed page
 * 
 * @example
 * ```typescript
 * const pages = [page1, page2, page3];
 * const updated = removePageFromOrder(pages, 1);
 * // Result: [page1, page3] with updated display orders
 * ```
 */
export function removePageFromOrder<T extends PageSettings & PageSource>(
  pages: T[],
  removeIndex: number
): T[] {
  if (removeIndex < 0 || removeIndex >= pages.length) {
    throw new Error(`Invalid remove index: ${removeIndex} (pages length: ${pages.length})`);
  }
  
  // Create copy and remove the page
  const updatedPages = pages.filter((_, index) => index !== removeIndex);
  
  // Update display orders
  return updatedPages.map((page, index) => ({
    ...page,
    displayOrder: index
  }));
}