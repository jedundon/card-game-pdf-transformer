/**
 * Test for export card count regression fix
 * 
 * This test verifies that the export step correctly counts Front and Back cards
 * without over-counting due to incorrect pairing assumptions.
 */

import { describe, it, expect } from 'vitest';
import { getAvailableCardIds, countCardsByType } from '../utils/card/cardIdentification';
import { DEFAULT_SETTINGS } from '../defaults';
import type { PageSettings, PdfMode, ExtractionSettings } from '../types';

describe('Export Card Count Regression Fix', () => {
  it('should correctly count Front and Back cards for atypical page ordering', () => {
    // Test case from user: 6 pages with types: back, front, back, front, back, front
    // Each page has 6 cards (2x3 grid)
    // Should result in 18 front cards and 18 back cards (not 24 fronts)
    
    const activePages: PageSettings[] = [
      { type: 'back', skip: false, originalPageIndex: 0 },
      { type: 'front', skip: false, originalPageIndex: 1 },
      { type: 'back', skip: false, originalPageIndex: 2 },
      { type: 'front', skip: false, originalPageIndex: 3 },
      { type: 'back', skip: false, originalPageIndex: 4 },
      { type: 'front', skip: false, originalPageIndex: 5 }
    ];
    
    const pdfMode: PdfMode = {
      type: 'duplex',
      flipEdge: 'short'
    };
    
    const extractionSettings: ExtractionSettings = {
      ...DEFAULT_SETTINGS.extractionSettings,
      grid: { rows: 2, columns: 3 }, // 6 cards per page
      pageDimensions: { width: 612, height: 792 } // Standard page dimensions
    };
    
    const cardsPerPage = 6;
    const totalCards = 36; // 6 pages * 6 cards per page
    
    // Get available card IDs for each type
    const frontCardIds = getAvailableCardIds('front', totalCards, pdfMode, activePages, cardsPerPage, extractionSettings);
    const backCardIds = getAvailableCardIds('back', totalCards, pdfMode, activePages, cardsPerPage, extractionSettings);
    
    // Verify counts
    expect(frontCardIds.length).toBe(18); // Should be 18, not 24
    expect(backCardIds.length).toBe(18);
    
    // Verify the IDs are sequential within each type
    expect(frontCardIds).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18]);
    expect(backCardIds).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18]);
  });
  
  it('should correctly count cards using countCardsByType function', () => {
    // Same test scenario using the countCardsByType function
    const activePages: PageSettings[] = [
      { type: 'back', skip: false, originalPageIndex: 0 },
      { type: 'front', skip: false, originalPageIndex: 1 },
      { type: 'back', skip: false, originalPageIndex: 2 },
      { type: 'front', skip: false, originalPageIndex: 3 },
      { type: 'back', skip: false, originalPageIndex: 4 },
      { type: 'front', skip: false, originalPageIndex: 5 }
    ];
    
    const pdfMode: PdfMode = {
      type: 'duplex',
      flipEdge: 'short'
    };
    
    const extractionSettings: ExtractionSettings = {
      ...DEFAULT_SETTINGS.extractionSettings,
      grid: { rows: 2, columns: 3 }, // 6 cards per page
      pageDimensions: { width: 612, height: 792 }
    };
    
    const cardsPerPage = 6;
    
    // Count cards by type
    const frontCardCount = countCardsByType('front', activePages, cardsPerPage, pdfMode, extractionSettings, 612, 792);
    const backCardCount = countCardsByType('back', activePages, cardsPerPage, pdfMode, extractionSettings, 612, 792);
    
    // Verify counts
    expect(frontCardCount).toBe(18); // Should be 18, not 24
    expect(backCardCount).toBe(18);
    
    // Total should be 36 (6 pages * 6 cards per page)
    expect(frontCardCount + backCardCount).toBe(36);
  });
  
  it('should work correctly with standard front-back-front-back ordering', () => {
    // Test with standard ordering for comparison
    const activePages: PageSettings[] = [
      { type: 'front', skip: false, originalPageIndex: 0 },
      { type: 'back', skip: false, originalPageIndex: 1 },
      { type: 'front', skip: false, originalPageIndex: 2 },
      { type: 'back', skip: false, originalPageIndex: 3 },
      { type: 'front', skip: false, originalPageIndex: 4 },
      { type: 'back', skip: false, originalPageIndex: 5 }
    ];
    
    const pdfMode: PdfMode = {
      type: 'duplex',
      flipEdge: 'short'
    };
    
    const extractionSettings: ExtractionSettings = {
      ...DEFAULT_SETTINGS.extractionSettings,
      grid: { rows: 2, columns: 3 }, // 6 cards per page
      pageDimensions: { width: 612, height: 792 }
    };
    
    const cardsPerPage = 6;
    const totalCards = 36;
    
    // Get available card IDs for each type
    const frontCardIds = getAvailableCardIds('front', totalCards, pdfMode, activePages, cardsPerPage, extractionSettings);
    const backCardIds = getAvailableCardIds('back', totalCards, pdfMode, activePages, cardsPerPage, extractionSettings);
    
    // Should still be 18 each regardless of ordering
    expect(frontCardIds.length).toBe(18);
    expect(backCardIds.length).toBe(18);
  });
  
  it('should work correctly with simplex mode', () => {
    // Test simplex mode to ensure it wasn't broken
    const activePages: PageSettings[] = [
      { type: 'front', skip: false, originalPageIndex: 0 },
      { type: 'front', skip: false, originalPageIndex: 1 },
      { type: 'front', skip: false, originalPageIndex: 2 },
      { type: 'front', skip: false, originalPageIndex: 3 },
      { type: 'front', skip: false, originalPageIndex: 4 },
      { type: 'front', skip: false, originalPageIndex: 5 }
    ];
    
    const pdfMode: PdfMode = {
      type: 'simplex'
    };
    
    const extractionSettings: ExtractionSettings = {
      ...DEFAULT_SETTINGS.extractionSettings,
      grid: { rows: 2, columns: 3 }, // 6 cards per page
      pageDimensions: { width: 612, height: 792 }
    };
    
    const cardsPerPage = 6;
    const totalCards = 36;
    
    // Get available card IDs for each type
    const frontCardIds = getAvailableCardIds('front', totalCards, pdfMode, activePages, cardsPerPage, extractionSettings);
    const backCardIds = getAvailableCardIds('back', totalCards, pdfMode, activePages, cardsPerPage, extractionSettings);
    
    // Simplex should have all fronts, no backs
    expect(frontCardIds.length).toBe(36);
    expect(backCardIds.length).toBe(0);
  });
});