/**
 * @fileoverview Card identification and information utilities
 * 
 * Contains functions for card type identification, ID mapping, and card information
 * calculation. The core function `getCardInfo` handles complex card identification
 * logic for different PDF modes (duplex, gutter-fold, simplex).
 */

import { PageSettings, ExtractionSettings, PdfMode, CardInfo, OutputSettings } from '../../types';
import { isCardSkipped } from './cardValidation';

/**
 * Helper function to count front pages up to a given index
 * 
 * Used internally for duplex mode card identification to determine
 * which front page a given back page corresponds to.
 * 
 * @param activePages - Array of active pages with type information
 * @param pageIndex - Target page index (inclusive)
 * @returns Number of front pages from index 0 up to and including pageIndex
 * 
 * @internal
 */
function countFrontPagesUpTo(activePages: PageSettings[], pageIndex: number): number {
  let count = 0;
  for (let i = 0; i <= pageIndex && i < activePages.length; i++) {
    if (activePages[i]?.type === 'front') {
      count++;
    }
  }
  return count;
}

/**
 * Helper function to count back pages up to a given index
 * 
 * Used internally for duplex mode card identification to determine
 * the relative position of back pages.
 * 
 * @param activePages - Array of active pages with type information
 * @param pageIndex - Target page index (inclusive)
 * @returns Number of back pages from index 0 up to and including pageIndex
 * 
 * @internal
 */
function countBackPagesUpTo(activePages: PageSettings[], pageIndex: number): number {
  let count = 0;
  for (let i = 0; i <= pageIndex && i < activePages.length; i++) {
    if (activePages[i]?.type === 'back') {
      count++;
    }
  }
  return count;
}

/**
 * Helper function to get total count of pages of a specific type
 * 
 * Used internally for duplex mode calculations to determine the total
 * number of front or back pages in the document.
 * 
 * @param activePages - Array of active pages with type information
 * @param pageType - Type of pages to count ('front' or 'back')
 * @returns Total number of pages of the specified type
 * 
 * @internal
 */
function getTotalPagesOfType(activePages: PageSettings[], pageType: 'front' | 'back'): number {
  return activePages.filter(page => page?.type === pageType).length;
}

/**
 * Calculate card front/back identification based on PDF mode
 * 
 * This is the core algorithm for identifying whether a card is a front or back,
 * and determining its unique ID. The logic varies significantly by PDF mode:
 * 
 * **Duplex Mode:**
 * - Front pages contain unique cards numbered sequentially
 * - Back pages map to corresponding front cards based on printing flip edge
 * - Supports complex scenarios like single back page for multiple front pages
 * - Applies flip edge logic (short/long edge) for proper back card mapping
 * 
 * **Gutter-fold Mode:**
 * - Each page contains both front and back cards split by a gutter line
 * - Vertical: left=front, right=back (mirrored across vertical gutter)
 * - Horizontal: top=front, bottom=back (mirrored across horizontal gutter)
 * - Front and back cards share the same ID (represent same logical card)
 * 
 * **Simplex Mode:**
 * - Each card is treated as unique with sequential numbering
 * 
 * @param cardIndex - Global card index across all pages (0-based)
 * @param activePages - Array of non-skipped pages with type information
 * @param extractionSettings - Grid and cropping configuration
 * @param pdfMode - PDF processing mode and orientation settings
 * @param cardsPerPage - Number of cards per page (grid rows × columns)
 * @param pageWidth - Optional page width for flip edge calculations
 * @param pageHeight - Optional page height for flip edge calculations
 * @returns Object containing card type ('Front'/'Back') and unique ID number
 * 
 * @example
 * ```typescript
 * // Duplex mode example
 * const duplexMode = { type: 'duplex', flipEdge: 'short' };
 * const pages = [{ type: 'front' }, { type: 'back' }];
 * const grid = { rows: 2, columns: 3 };
 * const settings = { grid, crop: {...}, skippedCards: [] };
 * 
 * // Card index 0 = first card on first front page
 * const info1 = getCardInfo(0, pages, settings, duplexMode, 6); // { type: 'Front', id: 1 }
 * 
 * // Card index 6 = first card on first back page (maps to front card 1 with flip)
 * const info2 = getCardInfo(6, pages, settings, duplexMode, 6); // { type: 'Back', id: 1 }
 * 
 * // Gutter-fold mode example
 * const gutterMode = { type: 'gutter-fold', orientation: 'vertical' };
 * const gutterPages = [{}];
 * const gutterGrid = { rows: 2, columns: 4 }; // 2 columns each side
 * const gutterSettings = { grid: gutterGrid, crop: {...} };
 * 
 * // Card index 0 = top-left (front side)
 * const info3 = getCardInfo(0, gutterPages, gutterSettings, gutterMode, 8); // { type: 'Front', id: 1 }
 * 
 * // Card index 2 = top-right (back side, maps to front card)
 * const info4 = getCardInfo(2, gutterPages, gutterSettings, gutterMode, 8); // { type: 'Back', id: 2 }
 * ```
 * 
 * @throws {Error} When page dimensions are invalid or card index is out of bounds
 */
export function getCardInfo(
  cardIndex: number,
  activePages: PageSettings[],
  extractionSettings: ExtractionSettings,
  pdfMode: PdfMode,
  cardsPerPage: number,
  pageWidth?: number,
  pageHeight?: number
): CardInfo {
  if (!activePages.length) return { type: 'Unknown', id: 0 };
  
  const pageIndex = Math.floor(cardIndex / cardsPerPage);
  const cardOnPage = cardIndex % cardsPerPage;
  
  if (pageIndex >= activePages.length) return { type: 'Unknown', id: 0 };
  
  const pageType = activePages[pageIndex]?.type || 'front';
  
  if (pdfMode.type === 'duplex') {
    // In duplex mode, handle non-alternating pages and unequal page counts
    // Use actual page types instead of positional assumptions
    
    if (pageType === 'front') {
      // Front cards: sequential numbering based on which front page this is
      const frontPageIndex = countFrontPagesUpTo(activePages, pageIndex) - 1; // 0-indexed
      const globalCardId = frontPageIndex * cardsPerPage + cardOnPage + 1;
      
      return { type: 'Front', id: globalCardId };
    } else {
      // Back cards: map to corresponding front cards based on logical position
      const backPageIndex = countBackPagesUpTo(activePages, pageIndex) - 1; // 0-indexed
      const totalFrontPages = getTotalPagesOfType(activePages, 'front');
      const totalBackPages = getTotalPagesOfType(activePages, 'back');
      
      // Calculate which front card this back corresponds to
      let correspondingFrontPageIndex: number;
      
      if (totalBackPages === 1 && totalFrontPages > 1) {
        // Special case: single back page for all fronts (common in card games)
        // Map each back card position to corresponding front cards across all front pages
        const totalFrontCards = totalFrontPages * cardsPerPage;
        const backCardGlobalIndex = cardOnPage; // position within the single back page
        
        // Cycle through front cards if we have more front cards than back card positions
        const targetFrontCardIndex = backCardGlobalIndex % totalFrontCards;
        correspondingFrontPageIndex = Math.floor(targetFrontCardIndex / cardsPerPage);
        
        // Apply flip edge logic to determine which front card this back card corresponds to
        // Instead of trying to match positions, directly calculate the mirrored position
        
        // Determine flip direction based on page orientation and flip edge
        let shouldFlipRows: boolean;
        if (pageWidth && pageHeight) {
          const isPortraitPage = pageHeight > pageWidth;
          if (isPortraitPage) {
            shouldFlipRows = (pdfMode.flipEdge === 'short'); // Short edge = flip rows for portrait
          } else {
            shouldFlipRows = (pdfMode.flipEdge === 'long');  // Long edge = flip rows for landscape  
          }
        } else {
          // Fallback to original logic if page dimensions not available
          console.warn('getCardInfo: Page dimensions not available for card ID calculation. Using fallback logic which may produce inconsistent IDs.', {
            flipEdge: pdfMode.flipEdge,
            cardIndex,
            fallbackShouldFlipRows: (pdfMode.flipEdge === 'long')
          });
          shouldFlipRows = (pdfMode.flipEdge === 'long');
        }
        
        // Mirror the current back card position to find which front card it corresponds to
        const row = Math.floor(cardOnPage / extractionSettings.grid.columns);
        const col = cardOnPage % extractionSettings.grid.columns;
        
        let mirroredCardOnPage: number;
        if (shouldFlipRows) {
          // Flip rows (vertical mirroring)
          const flippedRow = extractionSettings.grid.rows - 1 - row;
          mirroredCardOnPage = flippedRow * extractionSettings.grid.columns + col;
        } else {
          // Flip columns (horizontal mirroring)
          const flippedCol = extractionSettings.grid.columns - 1 - col;
          mirroredCardOnPage = row * extractionSettings.grid.columns + flippedCol;
        }
        
        // Calculate which front page this mirrored position belongs to
        const targetFrontPageIndex = Math.floor(mirroredCardOnPage / cardsPerPage);
        const targetCardOnFrontPage = mirroredCardOnPage % cardsPerPage;
        
        const globalCardId = targetFrontPageIndex * cardsPerPage + targetCardOnFrontPage + 1;
        
        return { type: 'Back', id: globalCardId };
      } else {
        // Normal case: map back pages to front pages proportionally
        if (totalFrontPages === 0) {
          // No front pages, treat as standalone back cards
          const globalCardId = backPageIndex * cardsPerPage + cardOnPage + 1;
          return { type: 'Back', id: globalCardId };
        }
        
        // Map back page index to corresponding front page index
        correspondingFrontPageIndex = Math.floor((backPageIndex * totalFrontPages) / Math.max(totalBackPages, 1));
      }
      
      // Apply flip edge logic for normal cases
      let mirroredCardOnPage: number;
      
      // Determine flip direction based on page orientation and flip edge
      let shouldFlipRows: boolean;
      if (pageWidth && pageHeight) {
        const isPortraitPage = pageHeight > pageWidth;
        if (isPortraitPage) {
          shouldFlipRows = (pdfMode.flipEdge === 'short'); // Short edge = flip rows for portrait
        } else {
          shouldFlipRows = (pdfMode.flipEdge === 'long');  // Long edge = flip rows for landscape  
        }
      } else {
        // Fallback to original logic if page dimensions not available
        console.warn('getCardInfo: Page dimensions not available for card ID calculation. Using fallback logic which may produce inconsistent IDs.', {
          flipEdge: pdfMode.flipEdge,
          cardIndex,
          fallbackShouldFlipRows: (pdfMode.flipEdge === 'long')
        });
        shouldFlipRows = (pdfMode.flipEdge === 'long');
      }
      
      const row = Math.floor(cardOnPage / extractionSettings.grid.columns);
      const col = cardOnPage % extractionSettings.grid.columns;
      
      if (shouldFlipRows) {
        // Flip rows (vertical mirroring)
        const flippedRow = extractionSettings.grid.rows - 1 - row;
        mirroredCardOnPage = flippedRow * extractionSettings.grid.columns + col;
      } else {
        // Flip columns (horizontal mirroring)
        const flippedCol = extractionSettings.grid.columns - 1 - col;
        mirroredCardOnPage = row * extractionSettings.grid.columns + flippedCol;
      }
      
      const globalCardId = correspondingFrontPageIndex * cardsPerPage + mirroredCardOnPage + 1;
      
      return { type: 'Back', id: globalCardId };
    }
  } else if (pdfMode.type === 'gutter-fold') {
    // In gutter-fold mode, each page contains both front and back cards
    // Front and back cards have matching IDs (e.g., Front 1 and Back 1 are the same logical card)
    // Card IDs should continue across pages
    
    if (pdfMode.orientation === 'vertical') {
      // Portrait gutter-fold: left side is front, right side is back
      // Cards should be mirrored across the vertical gutter line
      const row = Math.floor(cardOnPage / extractionSettings.grid.columns);
      const col = cardOnPage % extractionSettings.grid.columns;
      const halfColumns = extractionSettings.grid.columns / 2;
      const isLeftSide = col < halfColumns;
      
      // Calculate cards per half-page (only count front or back cards)
      const cardsPerHalfPage = extractionSettings.grid.rows * halfColumns;
      const pageOffset = pageIndex * cardsPerHalfPage;
      
      if (isLeftSide) {
        // Front card: calculate ID based on position in left half + page offset
        const cardIdInSection = row * halfColumns + col + 1;
        const globalCardId = pageOffset + cardIdInSection;
        return { type: 'Front', id: globalCardId };
      } else {
        // Back card: mirror position across gutter line
        // Rightmost card (col = columns-1) matches leftmost (col = 0)
        const rightCol = col - halfColumns; // Position within right half (0-based)
        const mirroredCol = halfColumns - 1 - rightCol; // Mirror across the gutter
        const cardIdInSection = row * halfColumns + mirroredCol + 1;
        const globalCardId = pageOffset + cardIdInSection;
        return { type: 'Back', id: globalCardId };
      }
    } else {
      // Landscape gutter-fold: top is front, bottom is back
      // Cards should be mirrored across the horizontal gutter line
      const row = Math.floor(cardOnPage / extractionSettings.grid.columns);
      const col = cardOnPage % extractionSettings.grid.columns;
      const halfRows = extractionSettings.grid.rows / 2;
      const isTopHalf = row < halfRows;
      
      // Calculate cards per half-page (only count front or back cards)
      const cardsPerHalfPage = halfRows * extractionSettings.grid.columns;
      const pageOffset = pageIndex * cardsPerHalfPage;
      
      if (isTopHalf) {
        // Front card: calculate ID based on position in top half + page offset
        const cardIdInSection = row * extractionSettings.grid.columns + col + 1;
        const globalCardId = pageOffset + cardIdInSection;
        return { type: 'Front', id: globalCardId };
      } else {
        // Back card: mirror position across gutter line
        // Bottom row matches top row in mirrored fashion
        const bottomRow = row - halfRows; // Position within bottom half (0-based)
        const mirroredRow = halfRows - 1 - bottomRow; // Mirror across the gutter
        const cardIdInSection = mirroredRow * extractionSettings.grid.columns + col + 1;
        const globalCardId = pageOffset + cardIdInSection;
        return { type: 'Back', id: globalCardId };
      }
    }
  }
  
  // Fallback - use global card indexing
  return { type: pageType.charAt(0).toUpperCase() + pageType.slice(1), id: cardIndex + 1 };
}

/**
 * Get the actual page number from active pages
 */
export function getActualPageNumber(
  pageIndex: number,
  pageSettings: PageSettings[]
): number {
  return pageSettings.findIndex((page: PageSettings, index: number) => 
    !page?.skip && pageSettings.slice(0, index + 1).filter((p: PageSettings) => !p?.skip).length === pageIndex + 1
  ) + 1;
}

/**
 * Get list of available card IDs for a specific view mode
 * 
 * Calculates which card IDs exist and are not skipped for the specified
 * card type (front or back). Used for card selection and preview generation.
 * 
 * @param viewMode - Which card type to get IDs for ('front' or 'back')
 * @param totalCards - Total number of cards in the document
 * @param pdfMode - PDF processing mode configuration
 * @param activePages - Array of non-skipped pages
 * @param cardsPerPage - Number of cards per page (grid rows × columns)
 * @param extractionSettings - Grid and skip configuration
 * @returns Array of unique card IDs available for the specified type
 */
export function getAvailableCardIds(
  viewMode: 'front' | 'back',
  totalCards: number,
  pdfMode: PdfMode,
  activePages: PageSettings[],
  cardsPerPage: number,
  extractionSettings: ExtractionSettings
): number[] {
  const cardIds: number[] = [];
  const maxIndex = pdfMode.type === 'duplex' || pdfMode.type === 'gutter-fold' 
    ? activePages.length * cardsPerPage 
    : totalCards;
  const skippedCards = extractionSettings.skippedCards || [];
  
  for (let i = 0; i < maxIndex; i++) {
    const cardInfo = getCardInfo(i, activePages, extractionSettings, pdfMode, cardsPerPage);
    if (cardInfo.type.toLowerCase() === viewMode) {
      // Calculate grid position for this card
      const pageIndex = Math.floor(i / cardsPerPage);
      const cardOnPage = i % cardsPerPage;
      const gridRow = Math.floor(cardOnPage / extractionSettings.grid.columns);
      const gridColumn = cardOnPage % extractionSettings.grid.columns;
      
      // Check if this card position is skipped
      const isSkipped = isCardSkipped(pageIndex, gridRow, gridColumn, skippedCards, cardInfo.type.toLowerCase() as 'front' | 'back');
      
      if (!isSkipped && !cardIds.includes(cardInfo.id)) {
        cardIds.push(cardInfo.id);
      }
    }
  }
  
  return cardIds.sort((a, b) => a - b); // Sort card IDs numerically
}

/**
 * Get rotation value for a specific card type from settings
 */
export function getRotationForCardType(
  outputSettings: OutputSettings,
  cardType: 'front' | 'back'
): number {
  if (typeof outputSettings.rotation === 'object' && outputSettings.rotation !== null) {
    return outputSettings.rotation[cardType] || 0;
  }
  return outputSettings.rotation || 0;
}

/**
 * Count cards of a specific type (front/back) in the given parameters
 */
export function countCardsByType(
  cardType: 'front' | 'back',
  activePages: PageSettings[],
  cardsPerPage: number,
  pdfMode: PdfMode,
  extractionSettings: ExtractionSettings
): number {
  let count = 0;
  // Import calculateTotalCards locally to avoid circular dependencies
  const calculateTotalCards = (pdfMode: PdfMode, activePages: PageSettings[], cardsPerPage: number): number => {
    const totalPages = activePages.length;
    
    if (pdfMode.type === 'duplex') {
      const frontPages = activePages.filter((page: PageSettings) => page.type === 'front').length;
      return frontPages * cardsPerPage;
    } else if (pdfMode.type === 'gutter-fold') {
      return totalPages * cardsPerPage;
    } else {
      return totalPages * cardsPerPage;
    }
  };
  
  const maxIndex = pdfMode.type === 'duplex' || pdfMode.type === 'gutter-fold' 
    ? activePages.length * cardsPerPage 
    : calculateTotalCards(pdfMode, activePages, cardsPerPage);
  
  for (let i = 0; i < maxIndex; i++) {
    const cardInfo = getCardInfo(i, activePages, extractionSettings, pdfMode, cardsPerPage);
    if (cardInfo.type.toLowerCase() === cardType) {
      count++;
    }
  }
  
  return count;
}