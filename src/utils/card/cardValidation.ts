/**
 * @fileoverview Card validation utilities
 * 
 * Contains functions for validating card states, page settings, and filtering logic.
 * These functions are used throughout the application to determine card availability
 * and skip states.
 */

import { PageSettings, SkippedCard } from '../../types';

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