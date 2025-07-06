/**
 * @fileoverview Multi-file workflow utilities
 * 
 * Contains functions for handling mixed PDF/image content, page reordering,
 * and card numbering in multi-file workflows.
 */

import { PageSettings, PdfMode, PageSource } from '../../types';

/**
 * Calculate card numbers for reordered pages
 * 
 * This is the critical function that ensures card numbering follows the
 * user's intended page order rather than the original file order. It extends
 * the existing card calculation logic to work with reordered page sequences.
 * 
 * @param pages - Pages array in display order (with PageSource information)
 * @param pdfMode - PDF processing mode affecting card counting
 * @param cardsPerPage - Number of cards per page (grid rows × columns)
 * @param skippedCards - Array of skipped card positions
 * @returns Map of display order index to card numbers for that page
 * 
 * @example
 * ```typescript
 * const reorderedPages = getReorderedPages(); // [page2, page0, page1]
 * const cardNumbers = calculateCardNumbersForReorderedPages(
 *   reorderedPages, 
 *   pdfMode, 
 *   9, // 3x3 grid
 *   []
 * );
 * // Returns: Map { 0 => [1,2,3,4,5,6,7,8,9], 1 => [10,11,12,...], ... }
 * ```
 */
export function calculateCardNumbersForReorderedPages(
  pages: (PageSettings & PageSource)[],
  pdfMode: PdfMode,
  cardsPerPage: number
): Map<number, number[]> {
  const cardNumberMap = new Map<number, number[]>();
  let currentCardId = 1;
  
  // Process pages in their display order (not original file order)
  pages.forEach((page, displayIndex) => {
    if (page.skip || page.removed) {
      // Skipped or removed pages don't get card numbers
      cardNumberMap.set(displayIndex, []);
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
          // Back pages use the same IDs as the previous front page in display order
          const previousFrontPageIndex = findPreviousFrontPageInDisplayOrder(pages, displayIndex);
          if (previousFrontPageIndex !== -1) {
            const frontCardNumbers = cardNumberMap.get(previousFrontPageIndex) || [];
            pageCardNumbers.push(...frontCardNumbers);
          }
        }
        break;
        
      case 'gutter-fold': {
        // Gutter-fold mode: each page contains both fronts and backs
        const cardsPerSide = cardsPerPage / 2;
        for (let i = 0; i < cardsPerSide; i++) {
          pageCardNumbers.push(currentCardId++);
        }
        break;
      }
    }
    
    cardNumberMap.set(displayIndex, pageCardNumbers);
  });
  
  return cardNumberMap;
}

/**
 * Find the previous front page in display order for duplex mode
 * 
 * Helper function for duplex mode card numbering. Finds the most recent
 * front page before the current back page in the display order to determine
 * which card IDs the back page should use.
 * 
 * @param pages - Array of pages in display order
 * @param currentDisplayIndex - Display index of the current back page
 * @returns Display index of the previous front page, or -1 if not found
 */
function findPreviousFrontPageInDisplayOrder(
  pages: (PageSettings & PageSource)[],
  currentDisplayIndex: number
): number {
  for (let i = currentDisplayIndex - 1; i >= 0; i--) {
    if (!pages[i].skip && pages[i].type === 'front') {
      return i;
    }
  }
  return -1;
}

/**
 * Get active pages with source tracking
 * 
 * Extended version of getActivePages that maintains source tracking information
 * for multi-file workflows. This ensures that source file information is
 * preserved when filtering out skipped pages.
 * 
 * @param pageSettings - Array of page settings with source information
 * @returns Array of non-skipped pages with source tracking preserved
 * 
 * @example
 * ```typescript
 * const allPages = [
 *   { skip: false, sourceFile: 'file1.pdf', ... },
 *   { skip: true, sourceFile: 'file2.pdf', ... },
 *   { skip: false, sourceFile: 'file1.pdf', ... }
 * ];
 * const activePages = getActivePagesWithSource(allPages); // Returns 2 pages
 * ```
 */
export function getActivePagesWithSource(
  pageSettings: (PageSettings & PageSource)[]
): (PageSettings & PageSource)[] {
  return pageSettings.filter(page => !page?.skip && !page?.removed);
}

/**
 * Calculate total cards for mixed content with reordering
 * 
 * Extended version of calculateTotalCards that works with reordered pages
 * and mixed PDF/image content. This function properly handles the complexity
 * of card counting when pages have been reordered by the user.
 * 
 * @param pages - Pages in display order with source tracking
 * @param pdfMode - PDF processing mode configuration  
 * @param cardsPerPage - Number of cards per page (grid rows × columns)
 * @returns Total number of unique cards across all pages
 * 
 * @example
 * ```typescript
 * const reorderedPages = getReorderedPages();
 * const total = calculateTotalCardsForMixedContent(reorderedPages, pdfMode, 9);
 * ```
 */
export function calculateTotalCardsForMixedContent(
  pages: (PageSettings & PageSource)[],
  pdfMode: PdfMode,
  cardsPerPage: number
): number {
  const activePages = getActivePagesWithSource(pages);
  
  if (pdfMode.type === 'duplex') {
    // In duplex mode, only front pages contribute to unique card count
    const frontPages = activePages.filter(page => page.type === 'front').length;
    return frontPages * cardsPerPage;
  } else if (pdfMode.type === 'gutter-fold') {
    // In gutter-fold mode, each page contains unique cards
    return activePages.length * cardsPerPage;
  } else {
    // Simplex mode or images: each page is unique
    return activePages.length * cardsPerPage;
  }
}