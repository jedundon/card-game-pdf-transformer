/**
 * @fileoverview Card identification and information utilities
 * 
 * Contains functions for card type identification, ID mapping, and card information
 * calculation. The core function `getCardInfo` handles complex card identification
 * logic for different PDF modes (duplex, gutter-fold, simplex).
 */

import { PageSettings, ExtractionSettings, PdfMode, CardInfo } from '../../types';
import { isCardSkipped } from './cardValidation';
import { getCardTypeOverride } from './cardOverrides';


/**
 * Get effective card type considering manual overrides and processing mode logic
 * 
 * This function determines the final card type by first checking for manual overrides,
 * then falling back to the processing mode's automatic assignment logic.
 * 
 * @param cardIndex - Global card index across all pages (0-based)
 * @param activePages - Array of active pages with type information
 * @param extractionSettings - Grid and override configuration
 * @param pdfMode - PDF processing mode and orientation settings
 * @param cardsPerPage - Number of cards per page (grid rows × columns)
 * @param pageWidth - Optional page width for flip edge calculations
 * @param pageHeight - Optional page height for flip edge calculations
 * @returns Effective card type ('front' or 'back')
 * 
 * @internal
 */
function getEffectiveCardType(
  cardIndex: number,
  activePages: PageSettings[],
  extractionSettings: ExtractionSettings,
  pdfMode: PdfMode,
  cardsPerPage: number,
  pageWidth?: number,
  pageHeight?: number
): 'front' | 'back' {
  const pageIndex = Math.floor(cardIndex / cardsPerPage);
  const cardOnPage = cardIndex % cardsPerPage;
  
  // Check for manual override first
  const gridRow = Math.floor(cardOnPage / extractionSettings.grid.columns);
  const gridCol = cardOnPage % extractionSettings.grid.columns;
  const override = getCardTypeOverride(
    pageIndex,
    gridRow,
    gridCol,
    extractionSettings.cardTypeOverrides || []
  );
  
  if (override) {
    return override.cardType;
  }
  
  // Fall back to automatic assignment based on processing mode
  return getAutoAssignedCardType(cardIndex, activePages, extractionSettings, pdfMode, cardsPerPage, pageWidth, pageHeight);
}

/**
 * Get automatically assigned card type based on processing mode logic
 * 
 * This function implements the original card type assignment logic without
 * considering manual overrides. Used as fallback when no override exists.
 * 
 * @param cardIndex - Global card index across all pages (0-based)
 * @param activePages - Array of active pages with type information
 * @param extractionSettings - Grid and override configuration
 * @param pdfMode - PDF processing mode and orientation settings
 * @param cardsPerPage - Number of cards per page (grid rows × columns)
 * @param pageWidth - Optional page width for flip edge calculations
 * @param pageHeight - Optional page height for flip edge calculations
 * @returns Auto-assigned card type ('front' or 'back')
 * 
 * @internal
 */
function getAutoAssignedCardType(
  cardIndex: number,
  activePages: PageSettings[],
  extractionSettings: ExtractionSettings,
  pdfMode: PdfMode,
  cardsPerPage: number,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _pageWidth?: number,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _pageHeight?: number
): 'front' | 'back' {
  const pageIndex = Math.floor(cardIndex / cardsPerPage);
  const cardOnPage = cardIndex % cardsPerPage;
  
  if (pageIndex >= activePages.length) return 'front';
  
  const pageType = activePages[pageIndex]?.type || 'front';
  
  if (pdfMode.type === 'gutter-fold') {
    // Gutter-fold logic: determine front/back based on position within page
    if (pdfMode.orientation === 'vertical') {
      // Vertical gutter: left=front, right=back
      const col = cardOnPage % extractionSettings.grid.columns;
      const halfColumns = extractionSettings.grid.columns / 2;
      return col < halfColumns ? 'front' : 'back';
    } else {
      // Horizontal gutter: top=front, bottom=back
      const row = Math.floor(cardOnPage / extractionSettings.grid.columns);
      const halfRows = extractionSettings.grid.rows / 2;
      return row < halfRows ? 'front' : 'back';
    }
  }
  
  if (pdfMode.type === 'duplex' && pageType === 'back') {
    // For duplex, we're dealing with back pages, so this is definitely a back card
    return 'back';
  }
  
  // Duplex and simplex modes: use page type
  return pageType === 'back' ? 'back' : 'front';
}

/**
 * Calculate sequential ID for a card within its type group
 * 
 * For duplex back cards, this function calculates the ID based on the mirrored
 * position to ensure proper alignment with corresponding front cards during printing.
 * 
 * @param cardIndex - Global card index across all pages (0-based)
 * @param effectiveType - The effective type of the current card
 * @param activePages - Array of active pages with type information
 * @param extractionSettings - Grid and override configuration
 * @param pdfMode - PDF processing mode and orientation settings
 * @param cardsPerPage - Number of cards per page (grid rows × columns)
 * @param pageWidth - Optional page width for flip edge calculations
 * @param pageHeight - Optional page height for flip edge calculations
 * @returns Sequential ID within the type group (1-based)
 * 
 * @internal
 */
function calculateSequentialId(
  cardIndex: number,
  effectiveType: 'front' | 'back',
  activePages: PageSettings[],
  extractionSettings: ExtractionSettings,
  pdfMode: PdfMode,
  cardsPerPage: number,
  pageWidth?: number,
  pageHeight?: number
): number {
  // Special handling for duplex back cards - use mirrored position for ID calculation
  if (pdfMode.type === 'duplex' && effectiveType === 'back') {
    const pageIndex = Math.floor(cardIndex / cardsPerPage);
    const cardOnPage = cardIndex % cardsPerPage;
    const gridRow = Math.floor(cardOnPage / extractionSettings.grid.columns);
    const gridCol = cardOnPage % extractionSettings.grid.columns;
    
    // Check if this specific card has a manual override
    const hasOverride = extractionSettings.cardTypeOverrides?.some(override =>
      override.pageIndex === pageIndex &&
      override.gridRow === gridRow &&
      override.gridColumn === gridCol
    );
    
    // Only apply mirroring logic if there's no manual override for this card AND
    // the duplex pattern hasn't been significantly altered by overrides
    const hasSignificantOverrides = extractionSettings.cardTypeOverrides && extractionSettings.cardTypeOverrides.length > 0;
    
    if (!hasOverride && !hasSignificantOverrides && pageIndex < activePages.length && activePages[pageIndex]?.type === 'back') {
      // Calculate the mirrored position for this back card
      const mirroredCardIndex = calculateMirroredCardIndex(
        cardOnPage,
        extractionSettings,
        pdfMode,
        pageWidth,
        pageHeight
      );
      
      // For back cards, we want to assign IDs based on their mirrored position within the page
      // Calculate how many back cards from this page and previous pages come before the mirrored position
      let backCardsBefore = 0;
      
      // Count back cards from previous pages
      for (let prevPageIndex = 0; prevPageIndex < pageIndex; prevPageIndex++) {
        if (activePages[prevPageIndex]?.type === 'back') {
          backCardsBefore += cardsPerPage; // All cards from previous back pages
        }
      }
      
      // Add cards from current page that come before the mirrored position
      for (let currentPageCard = 0; currentPageCard < mirroredCardIndex; currentPageCard++) {
        const currentCardIndex = pageIndex * cardsPerPage + currentPageCard;
        const currentType = getEffectiveCardType(
          currentCardIndex,
          activePages,
          extractionSettings,
          pdfMode,
          cardsPerPage,
          pageWidth,
          pageHeight
        );
        if (currentType === 'back') {
          backCardsBefore++;
        }
      }
      
      return backCardsBefore + 1; // 1-based ID based on mirrored position
    }
  }
  
  // Standard sequential numbering for non-duplex or front cards
  let count = 0;
  
  // Count cards of same effective type that come before this position
  for (let i = 0; i < cardIndex; i++) {
    const priorType = getEffectiveCardType(
      i, 
      activePages, 
      extractionSettings, 
      pdfMode, 
      cardsPerPage,
      pageWidth,
      pageHeight
    );
    if (priorType === effectiveType) {
      count++;
    }
  }
  
  return count + 1; // Sequential ID within type group (1-based)
}

/**
 * Calculate the mirrored card position for duplex back cards
 * 
 * @param cardOnPage - Card position within the page (0-based)
 * @param extractionSettings - Grid configuration
 * @param pdfMode - PDF processing mode with flip edge setting
 * @param pageWidth - Page width for orientation detection
 * @param pageHeight - Page height for orientation detection
 * @returns Mirrored card position on the page
 * 
 * @internal
 */
function calculateMirroredCardIndex(
  cardOnPage: number,
  extractionSettings: ExtractionSettings,
  pdfMode: PdfMode,
  pageWidth?: number,
  pageHeight?: number
): number {
  const gridRow = Math.floor(cardOnPage / extractionSettings.grid.columns);
  const gridCol = cardOnPage % extractionSettings.grid.columns;
  
  let shouldFlipRows = false;
  
  // Determine mirroring direction based on page orientation and flip edge
  if (pageWidth !== undefined && pageHeight !== undefined && pageWidth > 0 && pageHeight > 0) {
    const isPortraitPage = pageHeight > pageWidth;
    if (isPortraitPage) {
      shouldFlipRows = (pdfMode.flipEdge === 'short'); 
    } else {
      shouldFlipRows = (pdfMode.flipEdge === 'long');  
    }
  } else {
    // Fallback logic
    console.warn(
      'Duplex mirroring fallback logic triggered - page dimensions missing!',
      'This can cause inconsistent card IDs. Please ensure page dimensions are passed to getCardInfo().',
      { cardOnPage, flipEdge: pdfMode.flipEdge }
    );
    shouldFlipRows = (pdfMode.flipEdge === 'long');
  }
  
  let mirroredRow = gridRow;
  let mirroredCol = gridCol;
  
  if (shouldFlipRows) {
    // Mirror rows (vertical flip)
    mirroredRow = (extractionSettings.grid.rows - 1) - gridRow;
  } else {
    // Mirror columns (horizontal flip)
    mirroredCol = (extractionSettings.grid.columns - 1) - gridCol;
  }
  
  return mirroredRow * extractionSettings.grid.columns + mirroredCol;
}

/**
 * Calculate card front/back identification based on PDF mode
 * 
 * This is the core algorithm for identifying whether a card is a front or back,
 * and determining its unique ID. The logic now uses sequential numbering within
 * each type group, properly handling manual overrides.
 * 
 * **Sequential ID Logic:**
 * - Front cards are numbered 1, 2, 3... in document order
 * - Back cards are numbered 1, 2, 3... in document order
 * - Manual overrides change the type and cause renumbering of all affected cards
 * 
 * **Processing Modes:**
 * - **Duplex**: Front/back pages determine default type, with sequential numbering and orientation-aware mirroring
 * - **Gutter-fold**: Position within page determines type, with sequential numbering
 * - **Simplex**: All cards treated as fronts by default, with sequential numbering
 * 
 * **CRITICAL for Duplex Mode:**
 * Always pass pageWidth and pageHeight for correct duplex back card mirroring.
 * Missing dimensions trigger fallback logic that may cause inconsistent card IDs.
 * 
 * @param cardIndex - Global card index across all pages (0-based)
 * @param activePages - Array of non-skipped pages with type information
 * @param extractionSettings - Grid and override configuration
 * @param pdfMode - PDF processing mode and orientation settings
 * @param cardsPerPage - Number of cards per page (grid rows × columns)
 * @param pageWidth - Page width for duplex flip edge calculations (required for consistent duplex mirroring)
 * @param pageHeight - Page height for duplex flip edge calculations (required for consistent duplex mirroring)
 * @returns Object containing card type ('Front'/'Back') and sequential ID number
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
  
  if (pageIndex >= activePages.length) return { type: 'Unknown', id: 0 };
  
  // Get effective card type (considering manual overrides and processing mode logic)
  const effectiveType = getEffectiveCardType(
    cardIndex,
    activePages,
    extractionSettings,
    pdfMode,
    cardsPerPage,
    pageWidth,
    pageHeight
  );
  
  // Calculate sequential ID within the type group
  const sequentialId = calculateSequentialId(
    cardIndex,
    effectiveType,
    activePages,
    extractionSettings,
    pdfMode,
    cardsPerPage,
    pageWidth,
    pageHeight
  );
  
  // Format type for display (capitalize first letter)
  const displayType = effectiveType.charAt(0).toUpperCase() + effectiveType.slice(1);
  
  return { type: displayType, id: sequentialId };
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
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _totalCards: number, // Note: parameter kept for API compatibility but not used
  pdfMode: PdfMode,
  activePages: PageSettings[],
  cardsPerPage: number,
  extractionSettings: ExtractionSettings
): number[] {
  const cardIds: number[] = [];
  // Always use activePages.length * cardsPerPage for consistent card indexing
  // This ensures Front and Back cards are numbered independently within their type groups
  // without making assumptions about paired relationships
  const maxIndex = activePages.length * cardsPerPage;
  const skippedCards = extractionSettings.skippedCards || [];

  for (let cardIndex = 0; cardIndex < maxIndex; cardIndex++) {
    // Check if card is skipped
    const pageIndex = Math.floor(cardIndex / cardsPerPage);
    const cardOnPage = cardIndex % cardsPerPage;
    const gridRow = Math.floor(cardOnPage / extractionSettings.grid.columns);
    const gridCol = cardOnPage % extractionSettings.grid.columns;
    
    const cardType = viewMode.toLowerCase() as 'front' | 'back';
    if (isCardSkipped(pageIndex, gridRow, gridCol, skippedCards, cardType)) {
      continue;
    }
    
    // Get card info with new sequential logic
    const cardInfo = getCardInfo(
      cardIndex, 
      activePages, 
      extractionSettings, 
      pdfMode, 
      cardsPerPage,
      extractionSettings.pageDimensions?.width,
      extractionSettings.pageDimensions?.height
    );
    
    if (cardInfo.type.toLowerCase() === viewMode) {
      cardIds.push(cardInfo.id);
    }
  }
  
  // Remove duplicates and sort
  return [...new Set(cardIds)].sort((a, b) => a - b);
}

/**
 * Get rotation angle for a specific card type from output settings
 * 
 * Determines the appropriate rotation angle for front or back cards
 * based on the output settings configuration.
 * 
 * @param outputSettings - Output settings containing rotation configuration
 * @param cardType - Card type ('front' or 'back')
 * @returns Rotation angle in degrees from output settings
 */
export function getRotationForCardType(outputSettings: { rotation?: { front?: number; back?: number } }, cardType: 'front' | 'back'): number {
  return outputSettings.rotation?.[cardType] || 0;
}

/**
 * Count total cards of a specific type in the document
 * 
 * Counts how many cards of the specified type exist in the document
 * based on the current settings and processing mode.
 * 
 * @param cardType - Type of cards to count ('front' or 'back')
 * @param activePages - Array of non-skipped pages
 * @param cardsPerPage - Number of cards per page
 * @param pdfMode - PDF processing mode configuration
 * @param extractionSettings - Grid and override configuration
 * @param pageWidth - Optional page width for duplex calculations
 * @param pageHeight - Optional page height for duplex calculations
 * @returns Number of cards of the specified type
 */
export function countCardsByType(
  cardType: 'front' | 'back',
  activePages: PageSettings[],
  cardsPerPage: number,
  pdfMode: PdfMode,
  extractionSettings: ExtractionSettings,
  pageWidth?: number,
  pageHeight?: number
): number {
  const maxIndex = activePages.length * cardsPerPage;
  let count = 0;
  
  for (let cardIndex = 0; cardIndex < maxIndex; cardIndex++) {
    const effectiveType = getEffectiveCardType(
      cardIndex,
      activePages,
      extractionSettings,
      pdfMode,
      cardsPerPage,
      pageWidth,
      pageHeight
    );
    
    if (effectiveType === cardType) {
      count++;
    }
  }
  
  return count;
}