/**
 * @fileoverview Card type override management utilities
 * 
 * Contains functions for managing manual card type overrides that allow users
 * to designate specific cards as front or back, superseding processing mode logic.
 */

import { CardTypeOverride } from '../../types';

/**
 * Toggle card type override for a specific card position
 * 
 * Cycles through: no override → front → back → no override
 * 
 * @param pageIndex - Index in activePages array (0-based)
 * @param gridRow - Row position in extraction grid (0-based)
 * @param gridColumn - Column position in extraction grid (0-based)
 * @param currentOverrides - Array of existing overrides
 * @returns Updated array of overrides
 */
export function toggleCardTypeOverride(
  pageIndex: number,
  gridRow: number,
  gridColumn: number,
  currentOverrides: CardTypeOverride[]
): CardTypeOverride[] {
  const existingIndex = currentOverrides.findIndex(override => 
    override.pageIndex === pageIndex &&
    override.gridRow === gridRow &&
    override.gridColumn === gridColumn
  );
  
  if (existingIndex >= 0) {
    const existing = currentOverrides[existingIndex];
    
    if (existing.cardType === 'front') {
      // Change front to back
      const updated = [...currentOverrides];
      updated[existingIndex] = { ...existing, cardType: 'back' };
      return updated;
    } else {
      // Remove back override (cycle back to auto)
      return currentOverrides.filter((_, index) => index !== existingIndex);
    }
  } else {
    // Add new front override
    const newOverride: CardTypeOverride = {
      pageIndex,
      gridRow,
      gridColumn,
      cardType: 'front'
    };
    return [...currentOverrides, newOverride];
  }
}

/**
 * Set specific card type override
 * 
 * @param pageIndex - Index in activePages array (0-based)
 * @param gridRow - Row position in extraction grid (0-based)
 * @param gridColumn - Column position in extraction grid (0-based)
 * @param cardType - Card type to set ('front' or 'back')
 * @param currentOverrides - Array of existing overrides
 * @returns Updated array of overrides
 */
export function setCardTypeOverride(
  pageIndex: number,
  gridRow: number,
  gridColumn: number,
  cardType: 'front' | 'back',
  currentOverrides: CardTypeOverride[]
): CardTypeOverride[] {
  const existingIndex = currentOverrides.findIndex(override => 
    override.pageIndex === pageIndex &&
    override.gridRow === gridRow &&
    override.gridColumn === gridColumn
  );
  
  if (existingIndex >= 0) {
    // Update existing override
    const updated = [...currentOverrides];
    updated[existingIndex] = { ...updated[existingIndex], cardType };
    return updated;
  } else {
    // Add new override
    const newOverride: CardTypeOverride = {
      pageIndex,
      gridRow,
      gridColumn,
      cardType
    };
    return [...currentOverrides, newOverride];
  }
}

/**
 * Remove card type override for a specific position
 * 
 * @param pageIndex - Index in activePages array (0-based)
 * @param gridRow - Row position in extraction grid (0-based)
 * @param gridColumn - Column position in extraction grid (0-based)
 * @param currentOverrides - Array of existing overrides
 * @returns Updated array of overrides
 */
export function removeCardTypeOverride(
  pageIndex: number,
  gridRow: number,
  gridColumn: number,
  currentOverrides: CardTypeOverride[]
): CardTypeOverride[] {
  return currentOverrides.filter(override => 
    !(override.pageIndex === pageIndex &&
      override.gridRow === gridRow &&
      override.gridColumn === gridColumn)
  );
}

/**
 * Get card type override for a specific position
 * 
 * @param pageIndex - Index in activePages array (0-based)
 * @param gridRow - Row position in extraction grid (0-based)
 * @param gridColumn - Column position in extraction grid (0-based)
 * @param currentOverrides - Array of existing overrides
 * @returns Card type override if exists, undefined otherwise
 */
export function getCardTypeOverride(
  pageIndex: number,
  gridRow: number,
  gridColumn: number,
  currentOverrides: CardTypeOverride[]
): CardTypeOverride | undefined {
  return currentOverrides.find(override => 
    override.pageIndex === pageIndex &&
    override.gridRow === gridRow &&
    override.gridColumn === gridColumn
  );
}

/**
 * Clear all card type overrides
 * 
 * @returns Empty array of overrides
 */
export function clearAllCardTypeOverrides(): CardTypeOverride[] {
  return [];
}

/**
 * Get override status for display
 * 
 * @param pageIndex - Index in activePages array (0-based)
 * @param gridRow - Row position in extraction grid (0-based)
 * @param gridColumn - Column position in extraction grid (0-based)
 * @param currentOverrides - Array of existing overrides
 * @returns Object with override status and type
 */
export function getCardTypeOverrideStatus(
  pageIndex: number,
  gridRow: number,
  gridColumn: number,
  currentOverrides: CardTypeOverride[]
): { hasOverride: boolean; overrideType?: 'front' | 'back' } {
  const override = getCardTypeOverride(pageIndex, gridRow, gridColumn, currentOverrides);
  
  return {
    hasOverride: !!override,
    overrideType: override?.cardType
  };
}