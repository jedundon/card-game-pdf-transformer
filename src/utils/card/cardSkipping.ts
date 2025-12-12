/**
 * @fileoverview Card skipping and pairing management utilities
 * 
 * Contains functions for managing card skip states, including support for
 * gutter-fold mode pairing where front and back cards are connected.
 */

import { PageSettings, ExtractionSettings, PdfMode, SkippedCard } from '../../types';
import { isCardSkipped } from './cardValidation';

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
 * Find the paired card position for a given card in gutter-fold mode
 * 
 * In gutter-fold mode, front and back cards are paired (same logical card).
 * This function finds the corresponding card position for a given card position.
 * 
 * @param pageIndex - Page index of the source card
 * @param gridRow - Grid row of the source card
 * @param gridColumn - Grid column of the source card
 * @param activePages - Array of active pages
 * @param extractionSettings - Extraction settings with grid configuration
 * @param pdfMode - PDF mode configuration
 * @param cardsPerPage - Number of cards per page
 * @returns Paired card position or null if not in gutter-fold mode or no pair found
 */
export function findPairedCard(
  pageIndex: number,
  gridRow: number,
  gridColumn: number,
  _activePages: PageSettings[],
  extractionSettings: ExtractionSettings,
  pdfMode: PdfMode
): { pageIndex: number; gridRow: number; gridColumn: number; cardType: 'front' | 'back' } | null {
  // Only handle pairing in gutter-fold mode
  if (pdfMode.type !== 'gutter-fold') {
    return null;
  }

  // Pairing logic uses position-based calculations directly

  if (pdfMode.orientation === 'vertical') {
    // Vertical gutter-fold: left side is front, right side is back
    const halfColumns = extractionSettings.grid.columns / 2;
    const isLeftSide = gridColumn < halfColumns;

    if (isLeftSide) {
      // Current card is on left (front), find corresponding right (back) card
      const rightCol = halfColumns - 1 - gridColumn + halfColumns; // Mirror across gutter
      return {
        pageIndex,
        gridRow,
        gridColumn: rightCol,
        cardType: 'back'
      };
    } else {
      // Current card is on right (back), find corresponding left (front) card
      const rightCol = gridColumn - halfColumns; // Position within right half
      const leftCol = halfColumns - 1 - rightCol; // Mirror to left half
      return {
        pageIndex,
        gridRow,
        gridColumn: leftCol,
        cardType: 'front'
      };
    }
  } else {
    // Horizontal gutter-fold: top is front, bottom is back
    const halfRows = extractionSettings.grid.rows / 2;
    const isTopHalf = gridRow < halfRows;

    if (isTopHalf) {
      // Current card is on top (front), find corresponding bottom (back) card
      const bottomRow = halfRows - 1 - gridRow + halfRows; // Mirror across gutter
      return {
        pageIndex,
        gridRow: bottomRow,
        gridColumn,
        cardType: 'back'
      };
    } else {
      // Current card is on bottom (back), find corresponding top (front) card
      const bottomRow = gridRow - halfRows; // Position within bottom half
      const topRow = halfRows - 1 - bottomRow; // Mirror to top half
      return {
        pageIndex,
        gridRow: topRow,
        gridColumn,
        cardType: 'front'
      };
    }
  }
}

/**
 * Toggle skip state for a card and its pair in gutter-fold mode
 * 
 * This function extends toggleCardSkip to automatically handle paired cards
 * in gutter-fold mode. When a front card is skipped, its corresponding back
 * card is also skipped, and vice versa.
 * 
 * @param pageIndex - Page index of the clicked card
 * @param gridRow - Grid row of the clicked card
 * @param gridColumn - Grid column of the clicked card
 * @param cardType - Type of the clicked card
 * @param skippedCards - Current array of skipped cards
 * @param activePages - Array of active pages
 * @param extractionSettings - Extraction settings with grid configuration
 * @param pdfMode - PDF mode configuration
 * @param cardsPerPage - Number of cards per page
 * @returns Updated array of skipped cards
 */
export function toggleCardSkipWithPairing(
  pageIndex: number,
  gridRow: number,
  gridColumn: number,
  cardType: 'front' | 'back' | undefined,
  skippedCards: SkippedCard[],
  activePages: PageSettings[],
  extractionSettings: ExtractionSettings,
  pdfMode: PdfMode
): SkippedCard[] {
  // Start with the basic toggle for the clicked card
  let newSkippedCards = toggleCardSkip(pageIndex, gridRow, gridColumn, cardType, skippedCards);

  // If we're in gutter-fold mode, also toggle the paired card
  if (pdfMode.type === 'gutter-fold') {
    const pairedCard = findPairedCard(
      pageIndex, gridRow, gridColumn, 
      activePages, extractionSettings, pdfMode
    );

    if (pairedCard) {
      // Check if the clicked card is now skipped or unskipped
      const isClickedCardSkipped = isCardSkipped(
        pageIndex, gridRow, gridColumn, newSkippedCards, cardType
      );

      if (isClickedCardSkipped) {
        // Clicked card was skipped, so skip the paired card too
        const pairedAlreadySkipped = isCardSkipped(
          pairedCard.pageIndex, pairedCard.gridRow, pairedCard.gridColumn, 
          newSkippedCards, pairedCard.cardType
        );

        if (!pairedAlreadySkipped) {
          newSkippedCards = toggleCardSkip(
            pairedCard.pageIndex, pairedCard.gridRow, pairedCard.gridColumn,
            pairedCard.cardType, newSkippedCards
          );
        }
      } else {
        // Clicked card was unskipped, so unskip the paired card too
        const pairedIsSkipped = isCardSkipped(
          pairedCard.pageIndex, pairedCard.gridRow, pairedCard.gridColumn,
          newSkippedCards, pairedCard.cardType
        );

        if (pairedIsSkipped) {
          newSkippedCards = toggleCardSkip(
            pairedCard.pageIndex, pairedCard.gridRow, pairedCard.gridColumn,
            pairedCard.cardType, newSkippedCards
          );
        }
      }
    }
  }

  return newSkippedCards;
}

/**
 * Skip all cards in a specific row on a page with pairing support
 *
 * Enhanced version of skipAllInRow that also handles paired cards in gutter-fold mode.
 * When skipping a row of front cards, the corresponding back cards are also skipped.
 *
 * This function EXPLICITLY skips all cards in the row, not toggles them. Already-skipped
 * cards remain skipped.
 */
export function skipAllInRowWithPairing(
  pageIndex: number,
  gridRow: number,
  gridColumns: number,
  cardType: 'front' | 'back' | undefined,
  skippedCards: SkippedCard[],
  activePages: PageSettings[],
  extractionSettings: ExtractionSettings,
  pdfMode: PdfMode
): SkippedCard[] {
  let newSkips = [...skippedCards];

  for (let col = 0; col < gridColumns; col++) {
    // Explicitly skip this card if not already skipped
    const alreadySkipped = isCardSkipped(pageIndex, gridRow, col, newSkips, cardType);

    if (!alreadySkipped) {
      newSkips.push({
        pageIndex,
        gridRow,
        gridColumn: col,
        cardType
      });
    }

    // If in gutter-fold mode, also explicitly skip the paired card
    if (pdfMode.type === 'gutter-fold') {
      const pairedCard = findPairedCard(
        pageIndex, gridRow, col,
        activePages, extractionSettings, pdfMode
      );

      if (pairedCard) {
        const pairedAlreadySkipped = isCardSkipped(
          pairedCard.pageIndex, pairedCard.gridRow, pairedCard.gridColumn,
          newSkips, pairedCard.cardType
        );

        if (!pairedAlreadySkipped) {
          newSkips.push({
            pageIndex: pairedCard.pageIndex,
            gridRow: pairedCard.gridRow,
            gridColumn: pairedCard.gridColumn,
            cardType: pairedCard.cardType
          });
        }
      }
    }
  }

  return newSkips;
}

/**
 * Skip all cards in a specific column on a page with pairing support
 *
 * Enhanced version of skipAllInColumn that also handles paired cards in gutter-fold mode.
 * When skipping a column of front cards, the corresponding back cards are also skipped.
 *
 * This function EXPLICITLY skips all cards in the column, not toggles them. Already-skipped
 * cards remain skipped.
 */
export function skipAllInColumnWithPairing(
  pageIndex: number,
  gridColumn: number,
  gridRows: number,
  cardType: 'front' | 'back' | undefined,
  skippedCards: SkippedCard[],
  activePages: PageSettings[],
  extractionSettings: ExtractionSettings,
  pdfMode: PdfMode
): SkippedCard[] {
  let newSkips = [...skippedCards];

  for (let row = 0; row < gridRows; row++) {
    // Explicitly skip this card if not already skipped
    const alreadySkipped = isCardSkipped(pageIndex, row, gridColumn, newSkips, cardType);

    if (!alreadySkipped) {
      newSkips.push({
        pageIndex,
        gridRow: row,
        gridColumn,
        cardType
      });
    }

    // If in gutter-fold mode, also explicitly skip the paired card
    if (pdfMode.type === 'gutter-fold') {
      const pairedCard = findPairedCard(
        pageIndex, row, gridColumn,
        activePages, extractionSettings, pdfMode
      );

      if (pairedCard) {
        const pairedAlreadySkipped = isCardSkipped(
          pairedCard.pageIndex, pairedCard.gridRow, pairedCard.gridColumn,
          newSkips, pairedCard.cardType
        );

        if (!pairedAlreadySkipped) {
          newSkips.push({
            pageIndex: pairedCard.pageIndex,
            gridRow: pairedCard.gridRow,
            gridColumn: pairedCard.gridColumn,
            cardType: pairedCard.cardType
          });
        }
      }
    }
  }

  return newSkips;
}