/**
 * @fileoverview Card processing utilities for PDF card game extraction
 * 
 * This module contains the core business logic for processing card game PDFs,
 * including card identification, image extraction, and dimension calculations.
 * 
 * **Key Responsibilities:**
 * - Card identification logic for different PDF modes (simplex/duplex/gutter-fold)
 * - High-resolution image extraction from PDF pages at 300 DPI
 * - Complex card ID mapping and front/back relationships
 * - Grid-based card positioning and cropping calculations
 * - Skip card management and filtering
 * - DPI conversion and scaling operations
 * 
 * **PDF Mode Support:**
 * - **Simplex**: Each page contains unique cards
 * - **Duplex**: Alternating front/back pages with flip edge logic
 * - **Gutter-fold**: Pages split into front/back halves with mirroring
 * 
 * **Shared Components:**
 * Used by ExtractStep, ConfigureStep, and ExportStep components for consistent
 * card processing across the application workflow.
 * 
 * @author Card Game PDF Transformer
 */

import { DPI_CONSTANTS } from '../constants';
import { PdfData, PdfPage, PageSettings, PdfMode, ExtractionSettings, CardInfo, OutputSettings, SkippedCard, ImageFileData, PageSource } from '../types';

/**
 * Calculate active pages (non-skipped pages)
 * 
 * @param pageSettings - Array of page settings with optional skip flags
 * @returns Array of pages that are not marked as skipped
 * 
 * @example
 * ```typescript
 * const allPages = [{ skip: false }, { skip: true }, { skip: false }];
 * const activePages = getActivePages(allPages); // Returns [{ skip: false }, { skip: false }]
 * ```
 */
export function getActivePages(pageSettings: PageSettings[]): PageSettings[] {
  return pageSettings.filter((page: PageSettings) => !page?.skip);
}

/**
 * Check if a specific card position is skipped
 * 
 * @param pageIndex - Index in the active pages array (0-based)
 * @param gridRow - Row position in the extraction grid (0-based)
 * @param gridColumn - Column position in the extraction grid (0-based)
 * @param skippedCards - Array of skipped card positions
 * @param cardType - Optional card type filter ('front' or 'back')
 * @returns true if the card position is in the skipped cards list
 * 
 * @example
 * ```typescript
 * const skipped = [{ pageIndex: 0, gridRow: 1, gridColumn: 2, cardType: 'front' }];
 * const isSkipped = isCardSkipped(0, 1, 2, skipped, 'front'); // Returns true
 * ```
 */
export function isCardSkipped(
  pageIndex: number,
  gridRow: number,
  gridColumn: number,
  skippedCards: SkippedCard[] = [],
  cardType?: 'front' | 'back'
): boolean {
  return skippedCards.some(skip => 
    skip.pageIndex === pageIndex &&
    skip.gridRow === gridRow &&
    skip.gridColumn === gridColumn &&
    (cardType === undefined || skip.cardType === undefined || skip.cardType === cardType)
  );
}

/**
 * Get all skipped cards for a specific page
 * 
 * @param pageIndex - Index in the active pages array (0-based)
 * @param skippedCards - Array of all skipped card positions
 * @returns Array of skipped cards that belong to the specified page
 * 
 * @example
 * ```typescript
 * const allSkipped = [
 *   { pageIndex: 0, gridRow: 1, gridColumn: 2 },
 *   { pageIndex: 1, gridRow: 0, gridColumn: 1 },
 *   { pageIndex: 0, gridRow: 2, gridColumn: 0 }
 * ];
 * const page0Skipped = getSkippedCardsForPage(0, allSkipped); // Returns 2 items for page 0
 * ```
 */
export function getSkippedCardsForPage(pageIndex: number, skippedCards: SkippedCard[] = []): SkippedCard[] {
  return skippedCards.filter(skip => skip.pageIndex === pageIndex);
}

/**
 * Calculate effective card count excluding skipped cards
 * 
 * This function computes the total number of unique cards that will be processed,
 * accounting for the PDF mode and any cards that have been marked as skipped.
 * 
 * @param pdfMode - PDF processing mode configuration
 * @param activePages - Array of non-skipped pages
 * @param cardsPerPage - Number of cards per page based on grid settings (rows × columns)
 * @param skippedCards - Array of individual card positions to skip
 * @returns Total number of cards that will be processed (total - skipped)
 * 
 * @example
 * ```typescript
 * const pdfMode = { type: 'duplex', orientation: 'vertical', flipEdge: 'short' };
 * const activePages = [{ type: 'front' }, { type: 'back' }];
 * const cardsPerPage = 6; // 2×3 grid
 * const skipped = [{ pageIndex: 0, gridRow: 0, gridColumn: 0 }];
 * const effective = getEffectiveCardCount(pdfMode, activePages, cardsPerPage, skipped); // 5 cards
 * ```
 */
export function getEffectiveCardCount(
  pdfMode: PdfMode,
  activePages: PageSettings[],
  cardsPerPage: number,
  skippedCards: SkippedCard[] = []
): number {
  const totalCards = calculateTotalCards(pdfMode, activePages, cardsPerPage);
  const skippedCount = skippedCards.length;
  return Math.max(0, totalCards - skippedCount);
}

/**
 * Calculate total unique cards based on PDF mode and settings
 * 
 * This is a core function that determines how many unique cards exist in the PDF
 * based on the processing mode. The algorithm varies significantly by mode:
 * 
 * - **Duplex Mode**: Each front page represents unique cards, back pages are duplicates
 *   Formula: (number of front pages) × (cards per page)
 * 
 * - **Gutter-fold Mode**: Each page contains unique cards for both front and back
 *   Formula: (total pages) × (cards per page)
 * 
 * - **Simplex Mode**: Each page is treated as containing unique cards
 *   Formula: (total pages) × (cards per page)
 * 
 * @param pdfMode - PDF processing mode configuration
 * @param activePages - Array of non-skipped pages with their types
 * @param cardsPerPage - Number of cards per page (grid rows × columns)
 * @returns Total number of unique cards in the PDF
 * 
 * @example
 * ```typescript
 * // Duplex mode with 2 front pages and 2 back pages, 6 cards per page
 * const duplexMode = { type: 'duplex', flipEdge: 'short' };
 * const duplexPages = [
 *   { type: 'front' }, { type: 'back' }, 
 *   { type: 'front' }, { type: 'back' }
 * ];
 * const total = calculateTotalCards(duplexMode, duplexPages, 6); // Returns 12 (2 front pages × 6)
 * 
 * // Gutter-fold mode with 3 pages, 8 cards per page
 * const gutterMode = { type: 'gutter-fold', orientation: 'vertical' };
 * const gutterPages = [{}, {}, {}];
 * const total2 = calculateTotalCards(gutterMode, gutterPages, 8); // Returns 24 (3 pages × 8)
 * ```
 */
export function calculateTotalCards(
  pdfMode: PdfMode,
  activePages: PageSettings[],
  cardsPerPage: number
): number {
  const totalPages = activePages.length;
  
  if (pdfMode.type === 'duplex') {
    // In duplex mode, front and back pages alternate
    const frontPages = activePages.filter((page: PageSettings) => page.type === 'front').length;
    return frontPages * cardsPerPage; // Each front card has a corresponding back card
  } else if (pdfMode.type === 'gutter-fold') {
    // In gutter-fold mode, each page contains both front and back cards
    // Total unique cards = total pages * cards per page (each card is unique)
    return totalPages * cardsPerPage;
  } else {
    // Fallback: treat each image as a unique card
    return totalPages * cardsPerPage;
  }
}



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
 * const duplexMode = { type: 'duplex', flipEdge: 'short' };\n * const pages = [{ type: 'front' }, { type: 'back' }];\n * const grid = { rows: 2, columns: 3 };\n * const settings = { grid, crop: {...}, skippedCards: [] };\n * \n * // Card index 0 = first card on first front page\n * const info1 = getCardInfo(0, pages, settings, duplexMode, 6); // { type: 'Front', id: 1 }\n * \n * // Card index 6 = first card on first back page (maps to front card 1 with flip)\n * const info2 = getCardInfo(6, pages, settings, duplexMode, 6); // { type: 'Back', id: 1 }\n * \n * // Gutter-fold mode example\n * const gutterMode = { type: 'gutter-fold', orientation: 'vertical' };\n * const gutterPages = [{}];\n * const gutterGrid = { rows: 2, columns: 4 }; // 2 columns each side\n * const gutterSettings = { grid: gutterGrid, crop: {...} };\n * \n * // Card index 0 = top-left (front side)\n * const info3 = getCardInfo(0, gutterPages, gutterSettings, gutterMode, 8); // { type: 'Front', id: 1 }\n * \n * // Card index 2 = top-right (back side, maps to front card)\n * const info4 = getCardInfo(2, gutterPages, gutterSettings, gutterMode, 8); // { type: 'Back', id: 2 }\n * ```\n * \n * @throws {Error} When page dimensions are invalid or card index is out of bounds\n */
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
        const targetCardOnPage = targetFrontCardIndex % cardsPerPage;
        
        // Apply flip edge logic to get the actual card position on the back page
        let logicalCardOnPage: number;
        
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
          shouldFlipRows = (pdfMode.flipEdge === 'long');
        }
        
        const row = Math.floor(targetCardOnPage / extractionSettings.grid.columns);
        const col = targetCardOnPage % extractionSettings.grid.columns;
        
        if (shouldFlipRows) {
          // Flip rows (vertical mirroring)
          const flippedRow = extractionSettings.grid.rows - 1 - row;
          logicalCardOnPage = flippedRow * extractionSettings.grid.columns + col;
        } else {
          // Flip columns (horizontal mirroring)
          const flippedCol = extractionSettings.grid.columns - 1 - col;
          logicalCardOnPage = row * extractionSettings.grid.columns + flippedCol;
        }
        
        // Only assign back card ID if this matches our current card position
        if (logicalCardOnPage === cardOnPage) {
          const globalCardId = correspondingFrontPageIndex * cardsPerPage + targetCardOnPage + 1;
          return { type: 'Back', id: globalCardId };
        } else {
          // This back card position doesn't correspond to a front card
          return { type: 'Back', id: cardOnPage + 1 };
        }
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
      let logicalCardOnPage: number;
      
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
        shouldFlipRows = (pdfMode.flipEdge === 'long');
      }
      
      const row = Math.floor(cardOnPage / extractionSettings.grid.columns);
      const col = cardOnPage % extractionSettings.grid.columns;
      
      if (shouldFlipRows) {
        // Flip rows (vertical mirroring)
        const flippedRow = extractionSettings.grid.rows - 1 - row;
        logicalCardOnPage = flippedRow * extractionSettings.grid.columns + col;
      } else {
        // Flip columns (horizontal mirroring)
        const flippedCol = extractionSettings.grid.columns - 1 - col;
        logicalCardOnPage = row * extractionSettings.grid.columns + flippedCol;
      }
      
      const globalCardId = correspondingFrontPageIndex * cardsPerPage + logicalCardOnPage + 1;
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
 * Extract individual card from PDF at 300 DPI
 * 
 * This is the core image extraction function that converts a card position
 * into a high-resolution image. The process involves multiple steps:
 * 
 * **Extraction Pipeline:**
 * 1. Validate inputs and calculate page/card positions
 * 2. Load PDF page at high resolution (300 DPI)
 * 3. Render page to canvas with error handling and timeouts
 * 4. Calculate card boundaries based on grid and crop settings
 * 5. Handle special cases (gutter-fold with gutter width)
 * 6. Extract card region from rendered page
 * 7. Apply individual card cropping if specified
 * 8. Apply image rotation based on card type
 * 9. Generate final data URL with validation
 * 
 * **DPI Handling:**
 * - PDF.js uses 72 DPI as base, scales to 300 DPI for extraction
 * - Crop settings are in extraction DPI pixels (300 DPI)
 * - Final output maintains 300 DPI for print quality
 * 
 * **Error Handling:**
 * - Comprehensive validation of all inputs
 * - Timeout protection for PDF operations (15s page load, 30s render)
 * - Canvas size limits to prevent memory issues
 * - Graceful fallbacks for extraction failures
 * 
 * @param cardIndex - Global card index across all pages (0-based)
 * @param pdfData - PDF document proxy from PDF.js
 * @param pdfMode - PDF processing mode configuration
 * @param activePages - Array of non-skipped pages
 * @param pageSettings - Complete page settings including skipped pages
 * @param extractionSettings - Grid, crop, rotation, and skip configuration
 * @returns Promise resolving to data URL of extracted card image, or null if failed
 * 
 * @example
 * ```typescript
 * const cardImage = await extractCardImage(
 *   0, // First card
 *   pdfDocument,
 *   { type: 'duplex', flipEdge: 'short' },
 *   activePages,
 *   allPageSettings,
 *   {
 *     grid: { rows: 2, columns: 3 },
 *     crop: { top: 10, right: 10, bottom: 10, left: 10 },
 *     cardCrop: { top: 5, right: 5, bottom: 5, left: 5 },
 *     imageRotation: { front: 0, back: 180 },
 *     skippedCards: []
 *   }
 * );
 * 
 * if (cardImage) {
 *   // Use the data URL for display or processing
 *   imgElement.src = cardImage;
 * }
 * ```
 * 
 * @throws {Error} When PDF operations fail, canvas creation fails, or invalid settings provided
 */
export async function extractCardImage(
  cardIndex: number,
  pdfData: PdfData,
  pdfMode: PdfMode,
  activePages: PageSettings[],
  pageSettings: PageSettings[],
  extractionSettings: ExtractionSettings
): Promise<string | null> {
  // Validate inputs
  if (!pdfData) {
    console.error('Card extraction failed: No PDF data provided');
    return null;
  }
  
  if (!activePages || activePages.length === 0) {
    console.error('Card extraction failed: No active pages available');
    return null;
  }
  
  if (!extractionSettings || !extractionSettings.grid) {
    console.error('Card extraction failed: Invalid extraction settings');
    return null;
  }
  
  if (cardIndex < 0) {
    console.error(`Card extraction failed: Invalid card index ${cardIndex}`);
    return null;
  }

  try {
    const cardsPerPage = extractionSettings.grid.rows * extractionSettings.grid.columns;
    
    if (cardsPerPage <= 0) {
      throw new Error('Invalid grid configuration: cards per page must be greater than 0');
    }
    
    // Calculate which page and card position this cardIndex represents
    const pageIndex = Math.floor(cardIndex / cardsPerPage);
    const cardOnPage = cardIndex % cardsPerPage;

    if (pageIndex >= activePages.length) {
      console.warn(`Card extraction failed: Page index ${pageIndex} exceeds active pages (${activePages.length})`);
      return null;
    }

    // Get the actual page number from active pages
    const actualPageNumber = getActualPageNumber(pageIndex, pageSettings);
    
    if (actualPageNumber <= 0) {
      throw new Error(`Invalid page number calculated: ${actualPageNumber}`);
    }

    // Get PDF page with timeout and validation
    let page: PdfPage;
    try {
      const pagePromise = pdfData.getPage(actualPageNumber);
      const timeoutPromise = new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error(`PDF page ${actualPageNumber} loading timed out`)), 15000)
      );
      
      page = await Promise.race([pagePromise, timeoutPromise]);
      
      if (!page) {
        throw new Error(`Failed to load PDF page ${actualPageNumber}`);
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes('timed out')) {
        throw error;
      }
      throw new Error(`Failed to access PDF page ${actualPageNumber}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    // Calculate scale for extraction DPI (PDF.js uses 72 DPI as base)
    const highResScale = DPI_CONSTANTS.EXTRACTION_DPI / DPI_CONSTANTS.SCREEN_DPI;
    
    if (highResScale <= 0) {
      throw new Error('Invalid DPI configuration: scale must be greater than 0');
    }
    
    // Get viewport with error handling
    let viewport: any;
    try {
      viewport = page.getViewport({ scale: highResScale });
      
      if (!viewport || viewport.width <= 0 || viewport.height <= 0) {
        throw new Error(`Invalid viewport dimensions: ${viewport?.width} x ${viewport?.height}`);
      }
      
      // Check for reasonable viewport size (prevent memory issues)
      const maxDimension = 50000; // 50k pixels max
      if (viewport.width > maxDimension || viewport.height > maxDimension) {
        throw new Error(`Viewport too large: ${viewport.width} x ${viewport.height}. Maximum allowed: ${maxDimension} x ${maxDimension}`);
      }
    } catch (error) {
      throw new Error(`Failed to get page viewport: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    
    // Create a high-resolution canvas with validation
    let highResCanvas: HTMLCanvasElement;
    let highResContext: CanvasRenderingContext2D;
    
    try {
      highResCanvas = document.createElement('canvas');
      
      if (!highResCanvas) {
        throw new Error('Failed to create canvas element');
      }
      
      highResCanvas.width = viewport.width;
      highResCanvas.height = viewport.height;
      
      const context = highResCanvas.getContext('2d');
      if (!context) {
        throw new Error('Failed to get 2D rendering context from canvas');
      }
      
      highResContext = context;
    } catch (error) {
      throw new Error(`Canvas creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    
    // Render the page at high resolution with timeout
    try {
      const renderContext = {
        canvasContext: highResContext,
        viewport: viewport
      };
      
      const renderPromise = page.render(renderContext).promise;
      const renderTimeout = new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error(`Page rendering timed out for page ${actualPageNumber}`)), 30000)
      );
      
      await Promise.race([renderPromise, renderTimeout]);
    } catch (error) {
      throw new Error(`Page rendering failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
      // Calculate card dimensions after cropping at high resolution
    // Crop settings are in extraction DPI pixels, so they can be used directly
    const croppedWidth = viewport.width - extractionSettings.crop.left - extractionSettings.crop.right;
    const croppedHeight = viewport.height - extractionSettings.crop.top - extractionSettings.crop.bottom;
    
    // Validate cropped dimensions
    if (croppedWidth <= 0 || croppedHeight <= 0) {
      console.error('Card extraction failed: invalid cropped dimensions');
      return null;
    }
    
    let cardWidth, cardHeight;
    let adjustedX, adjustedY;
    
    // Handle gutter-fold mode with gutter width
    if (pdfMode.type === 'gutter-fold' && (extractionSettings.gutterWidth || 0) > 0) {
      const gutterWidth = extractionSettings.gutterWidth || 0;
      
      if (pdfMode.orientation === 'vertical') {
        // Vertical gutter-fold: gutter runs vertically down the middle
        const availableWidthForCards = croppedWidth - gutterWidth;
        const halfWidth = availableWidthForCards / 2;
        cardWidth = halfWidth / (extractionSettings.grid.columns / 2);
        cardHeight = croppedHeight / extractionSettings.grid.rows;
        
        // Calculate card position accounting for gutter
        const row = Math.floor(cardOnPage / extractionSettings.grid.columns);
        const col = cardOnPage % extractionSettings.grid.columns;
        const halfColumns = extractionSettings.grid.columns / 2;
        const isLeftSide = col < halfColumns;
        
        if (isLeftSide) {
          // Left side (front cards) - no gutter offset needed
          adjustedX = extractionSettings.crop.left + (col * cardWidth);
        } else {
          // Right side (back cards) - add gutter width and adjust column position
          const rightCol = col - halfColumns;
          adjustedX = extractionSettings.crop.left + halfWidth + gutterWidth + (rightCol * cardWidth);
        }
        adjustedY = extractionSettings.crop.top + (row * cardHeight);
      } else {
        // Horizontal gutter-fold: gutter runs horizontally across the middle
        const availableHeightForCards = croppedHeight - gutterWidth;
        const halfHeight = availableHeightForCards / 2;
        cardWidth = croppedWidth / extractionSettings.grid.columns;
        cardHeight = halfHeight / (extractionSettings.grid.rows / 2);
        
        // Calculate card position accounting for gutter
        const row = Math.floor(cardOnPage / extractionSettings.grid.columns);
        const col = cardOnPage % extractionSettings.grid.columns;
        const halfRows = extractionSettings.grid.rows / 2;
        const isTopHalf = row < halfRows;
        
        adjustedX = extractionSettings.crop.left + (col * cardWidth);
        if (isTopHalf) {
          // Top half (front cards) - no gutter offset needed
          adjustedY = extractionSettings.crop.top + (row * cardHeight);
        } else {
          // Bottom half (back cards) - add gutter height and adjust row position
          const bottomRow = row - halfRows;
          adjustedY = extractionSettings.crop.top + halfHeight + gutterWidth + (bottomRow * cardHeight);
        }
      }
    } else {
      // Standard mode or gutter-fold without gutter width
      cardWidth = croppedWidth / extractionSettings.grid.columns;
      cardHeight = croppedHeight / extractionSettings.grid.rows;
      
      // Calculate card position at high resolution using cardOnPage (not cardIndex)
      const row = Math.floor(cardOnPage / extractionSettings.grid.columns);
      const col = cardOnPage % extractionSettings.grid.columns;
      
      adjustedX = extractionSettings.crop.left + (col * cardWidth);
      adjustedY = extractionSettings.crop.top + (row * cardHeight);
    }
    
    // Validate card dimensions
    if (cardWidth <= 0 || cardHeight <= 0) {
      throw new Error(`Invalid card dimensions calculated: ${cardWidth} x ${cardHeight}`);
    }
    
    // Ensure extraction coordinates are within canvas bounds
    const sourceX = Math.max(0, Math.min(Math.floor(adjustedX), viewport.width - 1));
    const sourceY = Math.max(0, Math.min(Math.floor(adjustedY), viewport.height - 1));
    const sourceWidth = Math.max(1, Math.min(Math.floor(cardWidth), viewport.width - sourceX));
    const sourceHeight = Math.max(1, Math.min(Math.floor(cardHeight), viewport.height - sourceY));
    
    // Validate extraction bounds
    if (sourceWidth <= 0 || sourceHeight <= 0) {
      throw new Error(`Invalid extraction dimensions: ${sourceWidth} x ${sourceHeight} at position (${sourceX}, ${sourceY})`);
    }
    
    // Create a new canvas for the extracted card
    let cardCanvas: HTMLCanvasElement;
    let cardContext: CanvasRenderingContext2D;
    
    try {
      cardCanvas = document.createElement('canvas');
      cardCanvas.width = Math.max(1, sourceWidth);
      cardCanvas.height = Math.max(1, sourceHeight);
      
      const context = cardCanvas.getContext('2d');
      if (!context) {
        throw new Error('Failed to get 2D rendering context for card canvas');
      }
      
      cardContext = context;
    } catch (error) {
      throw new Error(`Card canvas creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    
    // Extract the card area from the high-resolution canvas
    try {
      cardContext.drawImage(
        highResCanvas,
        sourceX, sourceY, sourceWidth, sourceHeight,
        0, 0, cardCanvas.width, cardCanvas.height
      );
    } catch (error) {
      throw new Error(`Card image extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // Apply individual card cropping if specified
    let finalCanvas = cardCanvas;
    if (extractionSettings.cardCrop && 
        (extractionSettings.cardCrop.top > 0 || extractionSettings.cardCrop.right > 0 || 
         extractionSettings.cardCrop.bottom > 0 || extractionSettings.cardCrop.left > 0)) {
      
      const cardCrop = extractionSettings.cardCrop;
      const croppedCardWidth = Math.max(1, cardCanvas.width - cardCrop.left - cardCrop.right);
      const croppedCardHeight = Math.max(1, cardCanvas.height - cardCrop.top - cardCrop.bottom);
      
      // Only apply cropping if the result would be a valid size
      if (croppedCardWidth > 0 && croppedCardHeight > 0) {
        // Create a new canvas for the cropped card
        const croppedCanvas = document.createElement('canvas');
        croppedCanvas.width = croppedCardWidth;
        croppedCanvas.height = croppedCardHeight;
        const croppedContext = croppedCanvas.getContext('2d');
        
        if (croppedContext) {
          // Extract the cropped area from the original card
          croppedContext.drawImage(
            cardCanvas,
            cardCrop.left, cardCrop.top, croppedCardWidth, croppedCardHeight,
            0, 0, croppedCardWidth, croppedCardHeight
          );
          
          finalCanvas = croppedCanvas;
        }
      }
    }

    // Apply image rotation if specified
    if (extractionSettings.imageRotation) {
      // Determine card type to get appropriate rotation
      const cardInfo = getCardInfo(cardIndex, activePages, extractionSettings, pdfMode, cardsPerPage);
      const cardType = cardInfo.type.toLowerCase() as 'front' | 'back';
      const rotation = extractionSettings.imageRotation[cardType] || 0;
      
      if (rotation !== 0) {
        // Create a new canvas for the rotated card
        const rotatedCanvas = document.createElement('canvas');
        const rotatedContext = rotatedCanvas.getContext('2d');
        
        if (rotatedContext) {
          // For 90° or 270° rotations, swap width and height
          if (rotation === 90 || rotation === 270) {
            rotatedCanvas.width = finalCanvas.height;
            rotatedCanvas.height = finalCanvas.width;
          } else {
            rotatedCanvas.width = finalCanvas.width;
            rotatedCanvas.height = finalCanvas.height;
          }
          
          // Clear canvas and apply rotation
          rotatedContext.clearRect(0, 0, rotatedCanvas.width, rotatedCanvas.height);
          rotatedContext.save();
          
          // Move to center and apply rotation
          rotatedContext.translate(rotatedCanvas.width / 2, rotatedCanvas.height / 2);
          const radians = (rotation * Math.PI) / 180;
          rotatedContext.rotate(radians);
          
          // Draw the image centered
          rotatedContext.drawImage(
            finalCanvas, 
            -finalCanvas.width / 2, 
            -finalCanvas.height / 2
          );
          
          rotatedContext.restore();
          finalCanvas = rotatedCanvas;
        }
      }
    }

    // Generate data URL with error handling
    try {
      const dataUrl = finalCanvas.toDataURL('image/png');
      
      if (!dataUrl || dataUrl === 'data:,') {
        throw new Error('Failed to generate valid image data URL');
      }
      
      // Check if the data URL is reasonably sized (not empty but not too large)
      if (dataUrl.length < 100) {
        throw new Error('Generated image data URL is too small, likely invalid');
      }
      
      const maxSize = 50 * 1024 * 1024; // 50MB limit
      if (dataUrl.length > maxSize) {
        throw new Error(`Generated image data URL is too large (${Math.round(dataUrl.length / 1024 / 1024)}MB), exceeds ${Math.round(maxSize / 1024 / 1024)}MB limit`);
      }
      
      return dataUrl;
    } catch (error) {
      throw new Error(`Data URL generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    
  } catch (error) {
    console.error(`Card extraction failed for card ${cardIndex}:`, error);
    
    // Provide more specific error context (calculate pageIndex and cardOnPage for context)
    const cardsPerPageForContext = extractionSettings.grid.rows * extractionSettings.grid.columns;
    const pageIndexForContext = Math.floor(cardIndex / cardsPerPageForContext);
    const cardOnPageForContext = cardIndex % cardsPerPageForContext;
    
    console.error(`Card extraction context: cardIndex=${cardIndex}, pageIndex=${pageIndexForContext}, cardOnPage=${cardOnPageForContext}, pdfMode=${pdfMode.type}`);
    
    return null;
  }
}

/**
 * Extract a card image from a canvas source (for image files)
 * 
 * This function extracts individual cards from image files loaded into canvas elements.
 * It handles grid-based card extraction similar to PDF extraction but operates on
 * canvas data instead of PDF pages.
 * 
 * @param cardIndex - Global card index to extract
 * @param imageData - Image data containing the source canvas
 * @param pdfMode - PDF mode configuration for card layout
 * @param activePages - Array of active page settings
 * @param extractionSettings - Grid and cropping settings
 * @returns Promise<string | null> - Data URL of the extracted card or null on error
 */
export async function extractCardImageFromCanvas(
  cardIndex: number,
  imageData: ImageFileData,
  pdfMode: PdfMode,
  activePages: (PageSettings & PageSource)[],
  extractionSettings: ExtractionSettings
): Promise<string | null> {
  // Validate inputs
  if (!imageData || !imageData.canvas) {
    console.error('Card extraction failed: No image data or canvas provided');
    return null;
  }
  
  if (!activePages || activePages.length === 0) {
    console.error('Card extraction failed: No active pages available');
    return null;
  }
  
  if (!extractionSettings || !extractionSettings.grid) {
    console.error('Card extraction failed: Invalid extraction settings');
    return null;
  }
  
  if (cardIndex < 0) {
    console.error(`Card extraction failed: Invalid card index ${cardIndex}`);
    return null;
  }

  try {
    const cardsPerPage = extractionSettings.grid.rows * extractionSettings.grid.columns;
    
    if (cardsPerPage <= 0) {
      throw new Error('Invalid grid configuration: cards per page must be greater than 0');
    }
    
    // Calculate which page and card position this cardIndex represents
    const pageIndex = Math.floor(cardIndex / cardsPerPage);
    const cardOnPage = cardIndex % cardsPerPage;

    if (pageIndex >= activePages.length) {
      console.warn(`Card extraction failed: Page index ${pageIndex} exceeds active pages (${activePages.length})`);
      return null;
    }

    const sourceCanvas = imageData.canvas;
    const sourceWidth = sourceCanvas.width;
    const sourceHeight = sourceCanvas.height;
    
    // Calculate cropped dimensions (apply page-level cropping)
    const cropLeft = extractionSettings.crop?.left || 0;
    const cropTop = extractionSettings.crop?.top || 0;  
    const cropRight = extractionSettings.crop?.right || 0;
    const cropBottom = extractionSettings.crop?.bottom || 0;
    
    const croppedWidth = Math.max(1, sourceWidth - cropLeft - cropRight);
    const croppedHeight = Math.max(1, sourceHeight - cropTop - cropBottom);
    
    // Calculate card dimensions and position
    let cardWidth: number;
    let cardHeight: number;
    let adjustedX: number;
    let adjustedY: number;
    
    if (pdfMode.type === 'gutter-fold' && extractionSettings.gutterWidth && extractionSettings.gutterWidth > 0) {
      // Gutter-fold mode with gutter width
      const availableWidth = croppedWidth - extractionSettings.gutterWidth;
      cardWidth = availableWidth / (extractionSettings.grid.columns || 1);
      cardHeight = croppedHeight / extractionSettings.grid.rows;
      
      const row = Math.floor(cardOnPage / extractionSettings.grid.columns);
      const col = cardOnPage % extractionSettings.grid.columns;
      
      adjustedX = cropLeft + (col * cardWidth) + (col >= extractionSettings.grid.columns / 2 ? extractionSettings.gutterWidth : 0);
      adjustedY = cropTop + (row * cardHeight);
    } else {
      // Standard mode or gutter-fold without gutter width
      cardWidth = croppedWidth / extractionSettings.grid.columns;
      cardHeight = croppedHeight / extractionSettings.grid.rows;
      
      const row = Math.floor(cardOnPage / extractionSettings.grid.columns);
      const col = cardOnPage % extractionSettings.grid.columns;
      
      adjustedX = cropLeft + (col * cardWidth);
      adjustedY = cropTop + (row * cardHeight);
    }
    
    // Validate card dimensions
    if (cardWidth <= 0 || cardHeight <= 0) {
      throw new Error(`Invalid card dimensions calculated: ${cardWidth} x ${cardHeight}`);
    }
    
    // Ensure extraction coordinates are within canvas bounds
    const sourceX = Math.max(0, Math.min(Math.floor(adjustedX), sourceWidth - 1));
    const sourceY = Math.max(0, Math.min(Math.floor(adjustedY), sourceHeight - 1));
    const extractWidth = Math.max(1, Math.min(Math.floor(cardWidth), sourceWidth - sourceX));
    const extractHeight = Math.max(1, Math.min(Math.floor(cardHeight), sourceHeight - sourceY));
    
    // Validate extraction bounds
    if (extractWidth <= 0 || extractHeight <= 0) {
      throw new Error(`Invalid extraction dimensions: ${extractWidth} x ${extractHeight} at position (${sourceX}, ${sourceY})`);
    }
    
    // Create a new canvas for the extracted card
    let cardCanvas: HTMLCanvasElement;
    let cardContext: CanvasRenderingContext2D;
    
    try {
      cardCanvas = document.createElement('canvas');
      cardCanvas.width = Math.max(1, extractWidth);
      cardCanvas.height = Math.max(1, extractHeight);
      
      const context = cardCanvas.getContext('2d');
      if (!context) {
        throw new Error('Failed to get 2D rendering context for card canvas');
      }
      
      cardContext = context;
    } catch (error) {
      throw new Error(`Card canvas creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    
    // Extract the card area from the source canvas
    try {
      cardContext.drawImage(
        sourceCanvas,
        sourceX, sourceY, extractWidth, extractHeight,
        0, 0, cardCanvas.width, cardCanvas.height
      );
    } catch (error) {
      throw new Error(`Card image extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // Apply individual card cropping if specified
    let finalCanvas = cardCanvas;
    if (extractionSettings.cardCrop && 
        (extractionSettings.cardCrop.top > 0 || extractionSettings.cardCrop.right > 0 || 
         extractionSettings.cardCrop.bottom > 0 || extractionSettings.cardCrop.left > 0)) {
      
      const cardCrop = extractionSettings.cardCrop;
      const croppedCardWidth = Math.max(1, cardCanvas.width - cardCrop.left - cardCrop.right);
      const croppedCardHeight = Math.max(1, cardCanvas.height - cardCrop.top - cardCrop.bottom);
      
      // Only apply cropping if the result would be a valid size
      if (croppedCardWidth > 0 && croppedCardHeight > 0) {
        const croppedCanvas = document.createElement('canvas');
        croppedCanvas.width = croppedCardWidth;
        croppedCanvas.height = croppedCardHeight;
        const croppedContext = croppedCanvas.getContext('2d');
        
        if (croppedContext) {
          croppedContext.drawImage(
            cardCanvas,
            cardCrop.left, cardCrop.top, croppedCardWidth, croppedCardHeight,
            0, 0, croppedCardWidth, croppedCardHeight
          );
          
          finalCanvas = croppedCanvas;
        }
      }
    }

    // Apply image rotation if specified
    if (extractionSettings.imageRotation) {
      // Determine card type to get appropriate rotation
      const cardInfo = getCardInfo(cardIndex, activePages, extractionSettings, pdfMode, cardsPerPage);
      const cardType = cardInfo.type.toLowerCase() as 'front' | 'back';
      const rotation = extractionSettings.imageRotation[cardType] || 0;
      
      if (rotation !== 0) {
        // Create a new canvas for the rotated card
        const rotatedCanvas = document.createElement('canvas');
        const rotatedContext = rotatedCanvas.getContext('2d');
        
        if (rotatedContext) {
          // Set canvas dimensions based on rotation
          if (rotation === 90 || rotation === 270) {
            // Swap dimensions for 90° and 270° rotations
            rotatedCanvas.width = finalCanvas.height;
            rotatedCanvas.height = finalCanvas.width;
          } else {
            rotatedCanvas.width = finalCanvas.width;
            rotatedCanvas.height = finalCanvas.height;
          }
          
          // Apply rotation transformation
          rotatedContext.translate(rotatedCanvas.width / 2, rotatedCanvas.height / 2);
          rotatedContext.rotate((rotation * Math.PI) / 180);
          rotatedContext.drawImage(finalCanvas, -finalCanvas.width / 2, -finalCanvas.height / 2);
          
          finalCanvas = rotatedCanvas;
        }
      }
    }

    // Generate data URL with error handling
    try {
      const dataUrl = finalCanvas.toDataURL('image/png');
      
      if (!dataUrl || dataUrl === 'data:,') {
        throw new Error('Failed to generate valid image data URL');
      }
      
      // Check if the data URL is reasonably sized
      if (dataUrl.length < 100) {
        throw new Error('Generated image data URL is too small, likely invalid');
      }
      
      const maxSize = 50 * 1024 * 1024; // 50MB limit
      if (dataUrl.length > maxSize) {
        throw new Error(`Generated image data URL is too large (${Math.round(dataUrl.length / 1024 / 1024)}MB), exceeds ${Math.round(maxSize / 1024 / 1024)}MB limit`);
      }
      
      return dataUrl;
    } catch (error) {
      throw new Error(`Data URL generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    
  } catch (error) {
    console.error(`Card extraction from canvas failed for card ${cardIndex}:`, error);
    
    const cardsPerPageForContext = extractionSettings.grid.rows * extractionSettings.grid.columns;
    const pageIndexForContext = Math.floor(cardIndex / cardsPerPageForContext);
    const cardOnPageForContext = cardIndex % cardsPerPageForContext;
    
    console.error(`Card extraction context: cardIndex=${cardIndex}, pageIndex=${pageIndexForContext}, cardOnPage=${cardOnPageForContext}, fileName=${imageData.fileName}`);
    
    return null;
  }
}

/**
 * Get available card IDs for a specific view mode (front/back)
 * 
 * Generates a sorted list of unique card IDs that exist for the specified
 * card type (front or back), excluding any skipped cards. Used by UI components
 * to populate card selection dropdowns and navigation.
 * 
 * **Algorithm:**
 * 1. Iterate through all possible card positions
 * 2. Use getCardInfo() to determine card type and ID
 * 3. Filter by requested view mode (front/back)
 * 4. Exclude skipped card positions
 * 5. Remove duplicates and sort numerically
 * 
 * @param viewMode - Card type to filter by ('front' or 'back')
 * @param totalCards - Total number of unique cards in the document
 * @param pdfMode - PDF processing mode configuration
 * @param activePages - Array of non-skipped pages
 * @param cardsPerPage - Number of cards per page (grid rows × columns)
 * @param extractionSettings - Settings including grid config and skipped cards
 * @returns Sorted array of unique card ID numbers for the specified type
 * 
 * @example
 * ```typescript
 * const frontIds = getAvailableCardIds(
 *   'front', 12, duplexMode, activePages, 6, extractionSettings
 * ); // Returns [1, 2, 3, 4, 5, 6] (excluding any skipped cards)
 * 
 * const backIds = getAvailableCardIds(
 *   'back', 12, duplexMode, activePages, 6, extractionSettings
 * ); // Returns [1, 2, 3, 4, 5, 6] (same IDs, different card faces)
 * ```
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
 * Calculate card dimensions using new card size settings
 * 
 * Computes final card dimensions in pixels and inches based on the output
 * configuration. Handles bleed margins, scaling, and DPI conversion.
 * 
 * **Calculation Process:**
 * 1. Start with base card size (e.g., 2.5" × 3.5" for poker cards)
 * 2. Add bleed margin to each edge (target size = base + 2×bleed)
 * 3. Apply scale percentage to target size
 * 4. Convert final dimensions to pixels at extraction DPI (300)
 * 
 * @param outputSettings - Output configuration with card size, bleed, and scale
 * @returns Object containing various dimension calculations:
 *   - `width`/`height`: Final dimensions in pixels at 300 DPI
 *   - `scaleFactor`: Applied scale as decimal (e.g., 1.0 for 100%)
 *   - `aspectRatio`: Width/height ratio
 *   - `baseCard*Inches`: Original card size without bleed
 *   - `targetCard*Inches`: Card size with bleed, before scaling
 *   - `scaledCard*Inches`: Final card size with bleed and scaling
 *   - `bleedMarginInches`: Applied bleed margin
 * 
 * @example
 * ```typescript
 * const outputSettings = {
 *   cardSize: { widthInches: 2.5, heightInches: 3.5 },
 *   bleedMarginInches: 0.125, // 1/8" bleed
 *   cardScalePercent: 95
 * };
 * 
 * const dims = calculateCardDimensions(outputSettings);
 * // dims.scaledCardWidthInches = (2.5 + 0.25) * 0.95 = 2.6125"
 * // dims.width = 2.6125 * 300 = 783.75 pixels
 * ```
 */
export function calculateCardDimensions(
  outputSettings: OutputSettings
) {
  // Use new card size settings with bleed
  const baseCardWidthInches = outputSettings.cardSize?.widthInches || 2.5;
  const baseCardHeightInches = outputSettings.cardSize?.heightInches || 3.5;
  const bleedMarginInches = outputSettings.bleedMarginInches || 0;  // Add bleed to the target card size (this is the actual print target)
  // Bleed extends outward from each edge, so we add bleedMarginInches to each side
  const targetCardWidthInches = baseCardWidthInches + (bleedMarginInches * 2);
  const targetCardHeightInches = baseCardHeightInches + (bleedMarginInches * 2);
  
  // Apply scale percentage to the target card dimensions
  const scalePercent = outputSettings.cardScalePercent || 100;
  const scaledCardWidthInches = targetCardWidthInches * (scalePercent / 100);
  const scaledCardHeightInches = targetCardHeightInches * (scalePercent / 100);
  
  // Convert to pixels at extraction DPI (using the scaled dimensions)
  const cardWidthPx = scaledCardWidthInches * DPI_CONSTANTS.EXTRACTION_DPI;
  const cardHeightPx = scaledCardHeightInches * DPI_CONSTANTS.EXTRACTION_DPI;
  return {
    width: cardWidthPx,
    height: cardHeightPx,
    scaleFactor: scalePercent / 100,
    aspectRatio: cardWidthPx / cardHeightPx,
    // Return the base card dimensions (without bleed) for reference
    baseCardWidthInches,
    baseCardHeightInches,
    // Return the target dimensions (with bleed, before scaling)
    targetCardWidthInches,
    targetCardHeightInches,
    // Return the final scaled dimensions (with bleed and scale applied)
    scaledCardWidthInches,
    scaledCardHeightInches,
    bleedMarginInches
  };
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

/**
 * Calculate preview scale for display in UI
 */
export function calculatePreviewScale(
  pageWidth: number,
  pageHeight: number,
  maxWidth = 400,
  maxHeight = 500
): { scale: number; previewWidth: number; previewHeight: number } {
  let width = pageWidth * DPI_CONSTANTS.SCREEN_DPI;
  let height = pageHeight * DPI_CONSTANTS.SCREEN_DPI;
  
  let scale = 1;
  if (width > maxWidth || height > maxHeight) {
    const widthScale = maxWidth / width;
    const heightScale = maxHeight / height;
    scale = Math.min(widthScale, heightScale);
    
    width = width * scale;
    height = height * scale;
  }
  
  return { scale, previewWidth: width, previewHeight: height };
}

/**
 * Calculate DPI scale factor for preview calculations
 */
export function getDpiScaleFactor(): number {
  return DPI_CONSTANTS.EXTRACTION_DPI / DPI_CONSTANTS.SCREEN_DPI;
}

/**
 * Calculate card image dimensions based on sizing mode
 * 
 * Determines how a card image should be sized within the target card area
 * based on the selected sizing mode. Returns both the final image size
 * and the original image dimensions for reference.
 * 
 * **Sizing Modes:**
 * - `actual-size`: Use image at original extracted size (no scaling)
 * - `fit-to-card`: Scale to fit entirely within card bounds (letterboxed)
 * - `fill-card`: Scale to fill entire card area (may crop edges)
 * 
 * **Algorithm:**
 * 1. Load image to get natural pixel dimensions
 * 2. Convert pixels to inches using extraction DPI (300)
 * 3. Apply sizing mode calculations:
 *    - Actual: No change to dimensions
 *    - Fit: Scale down/up to fit within bounds, preserve aspect ratio
 *    - Fill: Scale to cover entire area, preserve aspect ratio
 * 
 * @param cardImageUrl - Data URL of the extracted card image
 * @param targetCardWidthInches - Target card width in inches
 * @param targetCardHeightInches - Target card height in inches
 * @param sizingMode - How to size the image within the card area
 * @returns Promise resolving to object with final and original dimensions in inches
 * 
 * @example
 * ```typescript
 * const result = await calculateCardImageDimensions(
 *   cardDataUrl,
 *   2.5, // target width
 *   3.5, // target height
 *   'fit-to-card'
 * );
 * 
 * // For an image that's 1.8" × 4.0" original:
 * // - Fit mode scales down to fit height: 1.575" × 3.5"
 * // result.width = 1.575, result.height = 3.5
 * // result.imageWidth = 1.8, result.imageHeight = 4.0
 * ```
 * 
 * @throws {Error} When image fails to load or has invalid dimensions
 */
export function calculateCardImageDimensions(
  cardImageUrl: string,
  targetCardWidthInches: number,
  targetCardHeightInches: number,
  sizingMode: 'actual-size' | 'fit-to-card' | 'fill-card' = 'actual-size'
): Promise<{ width: number; height: number; imageWidth: number; imageHeight: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const imageWidthPx = img.naturalWidth;
      const imageHeightPx = img.naturalHeight;
      
      // Convert image pixels to inches (assuming the image was extracted at EXTRACTION_DPI)
      const imageWidthInches = imageWidthPx / DPI_CONSTANTS.EXTRACTION_DPI;
      const imageHeightInches = imageHeightPx / DPI_CONSTANTS.EXTRACTION_DPI;
      
      let finalWidthInches = imageWidthInches;
      let finalHeightInches = imageHeightInches;
      
      switch (sizingMode) {
        case 'actual-size': {
          // Use the image at its original size (no scaling)
          finalWidthInches = imageWidthInches;
          finalHeightInches = imageHeightInches;
          break;
        }
          
        case 'fit-to-card': {
          // Scale the image to fit entirely within the card boundaries, maintaining aspect ratio
          const imageAspectRatio = imageWidthInches / imageHeightInches;
          const cardAspectRatio = targetCardWidthInches / targetCardHeightInches;
          
          if (imageAspectRatio > cardAspectRatio) {
            // Image is wider relative to its height than the card - fit to width
            finalWidthInches = targetCardWidthInches;
            finalHeightInches = targetCardWidthInches / imageAspectRatio;
          } else {
            // Image is taller relative to its width than the card - fit to height
            finalHeightInches = targetCardHeightInches;
            finalWidthInches = targetCardHeightInches * imageAspectRatio;
          }
          break;
        }
          
        case 'fill-card': {
          // Scale the image to fill the entire card area, maintaining aspect ratio (may crop edges)
          const imageAspectRatioFill = imageWidthInches / imageHeightInches;
          const cardAspectRatioFill = targetCardWidthInches / targetCardHeightInches;
          
          if (imageAspectRatioFill > cardAspectRatioFill) {
            // Image is wider - scale to fill height and crop width
            finalHeightInches = targetCardHeightInches;
            finalWidthInches = targetCardHeightInches * imageAspectRatioFill;
          } else {
            // Image is taller - scale to fill width and crop height
            finalWidthInches = targetCardWidthInches;
            finalHeightInches = targetCardWidthInches / imageAspectRatioFill;
          }
          break;
        }
      }
      
      resolve({
        width: finalWidthInches,
        height: finalHeightInches,
        imageWidth: imageWidthInches,
        imageHeight: imageHeightInches
      });
    };
    img.onerror = reject;
    img.src = cardImageUrl;
  });
}

/**
 * Toggle skip state for a specific card position
 */
export function toggleCardSkip(
  pageIndex: number,
  gridRow: number,
  gridColumn: number,
  cardType: 'front' | 'back' | undefined,
  skippedCards: SkippedCard[]
): SkippedCard[] {
  const existingIndex = skippedCards.findIndex(skip => 
    skip.pageIndex === pageIndex &&
    skip.gridRow === gridRow &&
    skip.gridColumn === gridColumn &&
    (cardType === undefined || skip.cardType === undefined || skip.cardType === cardType)
  );
  
  if (existingIndex >= 0) {
    // Remove from skipped cards
    return skippedCards.filter((_, index) => index !== existingIndex);
  } else {
    // Add to skipped cards
    const newSkip: SkippedCard = {
      pageIndex,
      gridRow,
      gridColumn,
      cardType
    };
    return [...skippedCards, newSkip];
  }
}

/**
 * Skip all cards in a specific row on a page
 */
export function skipAllInRow(
  pageIndex: number,
  gridRow: number,
  gridColumns: number,
  cardType: 'front' | 'back' | undefined,
  skippedCards: SkippedCard[]
): SkippedCard[] {
  const newSkips = [...skippedCards];
  
  for (let col = 0; col < gridColumns; col++) {
    const existingIndex = newSkips.findIndex(skip => 
      skip.pageIndex === pageIndex &&
      skip.gridRow === gridRow &&
      skip.gridColumn === col &&
      (cardType === undefined || skip.cardType === undefined || skip.cardType === cardType)
    );
    
    if (existingIndex < 0) {
      newSkips.push({
        pageIndex,
        gridRow,
        gridColumn: col,
        cardType
      });
    }
  }
  
  return newSkips;
}

/**
 * Skip all cards in a specific column on a page
 */
export function skipAllInColumn(
  pageIndex: number,
  gridColumn: number,
  gridRows: number,
  cardType: 'front' | 'back' | undefined,
  skippedCards: SkippedCard[]
): SkippedCard[] {
  const newSkips = [...skippedCards];
  
  for (let row = 0; row < gridRows; row++) {
    const existingIndex = newSkips.findIndex(skip => 
      skip.pageIndex === pageIndex &&
      skip.gridRow === row &&
      skip.gridColumn === gridColumn &&
      (cardType === undefined || skip.cardType === undefined || skip.cardType === cardType)
    );
    
    if (existingIndex < 0) {
      newSkips.push({
        pageIndex,
        gridRow: row,
        gridColumn,
        cardType
      });
    }
  }
  
  return newSkips;
}

/**
 * Clear all skipped cards
 */
export function clearAllSkips(): SkippedCard[] {
  return [];
}

/**
 * Render a page thumbnail for display in the Import Step
 * 
 * Creates a high-quality thumbnail preview of a PDF page for use in the page designation
 * interface. Generates larger images that can be scaled down in the table but displayed
 * at full resolution in the popup preview.
 * 
 * **Rendering Details:**
 * - Target size: 480x600px (roughly 4:5 aspect ratio) for high quality popup display
 * - Uses 200 DPI for good quality while maintaining reasonable performance
 * - Maintains aspect ratio with padding if needed
 * - Returns data URL for direct use in img elements
 * 
 * @param pdfData - PDF document object from PDF.js
 * @param pageNumber - 1-based page number to render
 * @param maxWidth - Maximum thumbnail width in pixels (default: 480)
 * @param maxHeight - Maximum thumbnail height in pixels (default: 600)
 * @returns Promise resolving to data URL of the thumbnail image
 * 
 * @throws {Error} When page loading or rendering fails
 * 
 * @example
 * ```typescript
 * const thumbnailUrl = await renderPageThumbnail(pdfData, 1, 480, 600);
 * setThumbnailState(prev => ({ ...prev, [pageIndex]: thumbnailUrl }));
 * ```
 */
export async function renderPageThumbnail(
  pdfData: PdfData,
  pageNumber: number,
  maxWidth = 480,
  maxHeight = 600
): Promise<string> {
  try {
    // Get PDF page with timeout
    const pagePromise = pdfData.getPage(pageNumber);
    const timeoutPromise = new Promise<never>((_, reject) => 
      setTimeout(() => reject(new Error(`Thumbnail loading timed out for page ${pageNumber}`)), 10000)
    );
    
    const page: PdfPage = await Promise.race([pagePromise, timeoutPromise]);
    
    if (!page) {
      throw new Error(`Failed to load PDF page ${pageNumber} for thumbnail`);
    }

    // Calculate scale for thumbnail rendering (use 200 DPI for better quality thumbnails)
    const thumbnailDPI = 200;
    const thumbnailScale = thumbnailDPI / DPI_CONSTANTS.SCREEN_DPI; // ~2.78 scale for higher quality
    
    // Get viewport at thumbnail scale
    const viewport = page.getViewport({ scale: thumbnailScale });
    
    if (!viewport || viewport.width <= 0 || viewport.height <= 0) {
      throw new Error(`Invalid viewport dimensions for page ${pageNumber}: ${viewport?.width} x ${viewport?.height}`);
    }
    
    // Calculate thumbnail dimensions maintaining aspect ratio
    const aspectRatio = viewport.width / viewport.height;
    let thumbnailWidth = maxWidth;
    let thumbnailHeight = maxHeight;
    
    if (aspectRatio > maxWidth / maxHeight) {
      // Page is wider - fit to width
      thumbnailHeight = Math.round(maxWidth / aspectRatio);
    } else {
      // Page is taller - fit to height  
      thumbnailWidth = Math.round(maxHeight * aspectRatio);
    }
    
    // Create canvas for rendering
    const canvas = document.createElement('canvas');
    canvas.width = thumbnailWidth;
    canvas.height = thumbnailHeight;
    
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Failed to get 2D rendering context for thumbnail');
    }
    
    // Scale viewport to fit thumbnail size
    const scaleToThumbnail = Math.min(thumbnailWidth / viewport.width, thumbnailHeight / viewport.height);
    const scaledViewport = page.getViewport({ scale: thumbnailScale * scaleToThumbnail });
    
    // Center the page in the canvas if there's padding
    const offsetX = (thumbnailWidth - scaledViewport.width) / 2;
    const offsetY = (thumbnailHeight - scaledViewport.height) / 2;
    
    // Clear canvas with white background
    context.fillStyle = 'white';
    context.fillRect(0, 0, thumbnailWidth, thumbnailHeight);
    
    // Render the page with proper positioning
    context.save();
    context.translate(offsetX, offsetY);
    
    const renderContext = {
      canvasContext: context,
      viewport: scaledViewport
    };
    
    // Render with timeout
    const renderPromise = page.render(renderContext).promise;
    const renderTimeout = new Promise<never>((_, reject) => 
      setTimeout(() => reject(new Error(`Thumbnail rendering timed out for page ${pageNumber}`)), 8000)
    );
    
    await Promise.race([renderPromise, renderTimeout]);
    
    context.restore();
    
    // Generate and return data URL
    const dataUrl = canvas.toDataURL('image/png', 0.8); // Slightly compressed for better performance
    
    if (!dataUrl || dataUrl === 'data:,') {
      throw new Error('Failed to generate thumbnail data URL');
    }
    
    return dataUrl;
    
  } catch (error) {
    console.error(`Thumbnail generation failed for page ${pageNumber}:`, error);
    throw new Error(`Failed to generate thumbnail for page ${pageNumber}: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Render thumbnail for image file
 * 
 * Creates a thumbnail for an image file that matches the styling and format
 * of PDF page thumbnails. This ensures consistent appearance in the UI
 * regardless of whether the source is a PDF or image file.
 * 
 * @param imageData - Processed image file data
 * @param maxWidth - Maximum thumbnail width in pixels (default: 480)
 * @param maxHeight - Maximum thumbnail height in pixels (default: 600)
 * @returns Promise that resolves to a data URL for the thumbnail
 * 
 * @throws {Error} When thumbnail generation fails
 * 
 * @example
 * ```typescript
 * const imageData = await processImageFile(file);
 * const thumbnailUrl = await renderImageThumbnail(imageData, 480, 600);
 * setThumbnailState(prev => ({ ...prev, [pageIndex]: thumbnailUrl }));
 * ```
 */
export async function renderImageThumbnail(
  imageData: ImageFileData,
  maxWidth = 480,
  maxHeight = 600
): Promise<string> {
  try {
    const { canvas: sourceCanvas, width, height } = imageData;
    
    // Calculate thumbnail dimensions maintaining aspect ratio
    const aspectRatio = width / height;
    let thumbnailWidth = maxWidth;
    let thumbnailHeight = maxHeight;
    
    if (aspectRatio > maxWidth / maxHeight) {
      // Image is wider - fit to width
      thumbnailHeight = Math.round(maxWidth / aspectRatio);
    } else {
      // Image is taller - fit to height  
      thumbnailWidth = Math.round(maxHeight * aspectRatio);
    }
    
    // Create thumbnail canvas
    const thumbnailCanvas = document.createElement('canvas');
    thumbnailCanvas.width = thumbnailWidth;
    thumbnailCanvas.height = thumbnailHeight;
    
    const context = thumbnailCanvas.getContext('2d');
    if (!context) {
      throw new Error('Failed to get 2D rendering context for image thumbnail');
    }
    
    // Clear canvas with white background (consistent with PDF thumbnails)
    context.fillStyle = 'white';
    context.fillRect(0, 0, thumbnailWidth, thumbnailHeight);
    
    // Calculate scaling and positioning to center the image
    const scale = Math.min(thumbnailWidth / width, thumbnailHeight / height);
    const scaledWidth = width * scale;
    const scaledHeight = height * scale;
    const offsetX = (thumbnailWidth - scaledWidth) / 2;
    const offsetY = (thumbnailHeight - scaledHeight) / 2;
    
    // Draw the scaled image centered on the canvas
    context.drawImage(sourceCanvas, offsetX, offsetY, scaledWidth, scaledHeight);
    
    // Generate and return data URL (same format as PDF thumbnails)
    const dataUrl = thumbnailCanvas.toDataURL('image/png', 0.8);
    
    if (!dataUrl || dataUrl === 'data:,') {
      throw new Error('Failed to generate image thumbnail data URL');
    }
    
    return dataUrl;
    
  } catch (error) {
    console.error(`Image thumbnail generation failed for ${imageData.fileName}:`, error);
    throw new Error(`Failed to generate thumbnail for image ${imageData.fileName}: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Universal thumbnail renderer for mixed content
 * 
 * Renders thumbnails for either PDF pages or image files, automatically
 * detecting the content type and using the appropriate rendering method.
 * This is the main function used by UI components for multi-file support.
 * 
 * @param pdfData - PDF document data (null for image files)
 * @param imageData - Image file data (null for PDF pages)
 * @param pageNumber - Page number for PDF files (1-based, ignored for images)
 * @param maxWidth - Maximum thumbnail width in pixels (default: 480)
 * @param maxHeight - Maximum thumbnail height in pixels (default: 600)
 * @returns Promise that resolves to a data URL for the thumbnail
 * 
 * @throws {Error} When neither PDF nor image data is provided, or when rendering fails
 * 
 * @example
 * ```typescript
 * // For PDF page
 * const pdfThumbnail = await renderUniversalThumbnail(pdfData, null, 1);
 * 
 * // For image file
 * const imageThumbnail = await renderUniversalThumbnail(null, imageData, 0);
 * ```
 */
export async function renderUniversalThumbnail(
  pdfData: PdfData | null,
  imageData: ImageFileData | null,
  pageNumber: number,
  maxWidth = 480,
  maxHeight = 600
): Promise<string> {
  if (pdfData && !imageData) {
    // Render PDF page thumbnail
    return renderPageThumbnail(pdfData, pageNumber, maxWidth, maxHeight);
  } else if (imageData && !pdfData) {
    // Render image thumbnail
    return renderImageThumbnail(imageData, maxWidth, maxHeight);
  } else {
    throw new Error('Invalid thumbnail request: must provide either PDF data or image data, but not both');
  }
}

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
  cardsPerPage: number,
  _skippedCards: SkippedCard[] = []
): Map<number, number[]> {
  const cardNumberMap = new Map<number, number[]>();
  let currentCardId = 1;
  
  // Process pages in their display order (not original file order)
  pages.forEach((page, displayIndex) => {
    if (page.skip) {
      // Skipped pages don't get card numbers
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
  return pageSettings.filter(page => !page?.skip);
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
