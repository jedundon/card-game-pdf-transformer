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
  cardsPerPage: number
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
  return getAutoAssignedCardType(cardIndex, activePages, extractionSettings, pdfMode, cardsPerPage);
}

/**
 * Get automatically assigned card type based on processing mode logic
 * 
 * This function implements the original card type assignment logic without
 * considering manual overrides. Used as fallback when no override exists.
 * 
 * @param cardIndex - Global card index across all pages (0-based)
 * @param activePages - Array of active pages with type information
 * @param pdfMode - PDF processing mode and orientation settings
 * @param cardsPerPage - Number of cards per page (grid rows × columns)
 * @returns Auto-assigned card type ('front' or 'back')
 * 
 * @internal
 */
function getAutoAssignedCardType(
  cardIndex: number,
  activePages: PageSettings[],
  extractionSettings: ExtractionSettings,
  pdfMode: PdfMode,
  cardsPerPage: number
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
  
  // Duplex and simplex modes: use page type
  return pageType === 'back' ? 'back' : 'front';
}

/**
 * Calculate sequential ID for a card within its type group
 * 
 * This function counts how many cards of the same effective type come before
 * the current card in document order, then assigns a sequential ID.
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
  cardsPerPage: number
): number {
  let count = 0;
  
  // Count cards of same effective type that come before this position
  for (let i = 0; i < cardIndex; i++) {
    const priorType = getEffectiveCardType(
      i, 
      activePages, 
      extractionSettings, 
      pdfMode, 
      cardsPerPage
    );
    if (priorType === effectiveType) {
      count++;
    }
  }
  
  return count + 1; // Sequential ID within type group (1-based)
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
 * - **Duplex**: Front/back pages determine default type, with sequential numbering
 * - **Gutter-fold**: Position within page determines type, with sequential numbering
 * - **Simplex**: All cards treated as fronts by default, with sequential numbering
 * 
 * @param cardIndex - Global card index across all pages (0-based)
 * @param activePages - Array of non-skipped pages with type information
 * @param extractionSettings - Grid and override configuration
 * @param pdfMode - PDF processing mode and orientation settings
 * @param cardsPerPage - Number of cards per page (grid rows × columns)
 * @returns Object containing card type ('Front'/'Back') and sequential ID number
 */
export function getCardInfo(
  cardIndex: number,
  activePages: PageSettings[],
  extractionSettings: ExtractionSettings,
  pdfMode: PdfMode,
  cardsPerPage: number
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
    cardsPerPage
  );
  
  // Calculate sequential ID within the type group
  const sequentialId = calculateSequentialId(
    cardIndex,
    effectiveType,
    activePages,
    extractionSettings,
    pdfMode,
    cardsPerPage
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
 * @returns Number of cards of the specified type
 */
export function countCardsByType(
  cardType: 'front' | 'back',
  activePages: PageSettings[],
  cardsPerPage: number,
  pdfMode: PdfMode,
  extractionSettings: ExtractionSettings
): number {
  const maxIndex = activePages.length * cardsPerPage;
  let count = 0;
  
  for (let cardIndex = 0; cardIndex < maxIndex; cardIndex++) {
    const effectiveType = getEffectiveCardType(
      cardIndex,
      activePages,
      extractionSettings,
      pdfMode,
      cardsPerPage
    );
    
    if (effectiveType === cardType) {
      count++;
    }
  }
  
  return count;
}