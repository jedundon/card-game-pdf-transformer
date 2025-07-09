/**
 * Debug test to understand card counting issues
 */

import { describe, it, expect } from 'vitest';
import { getAvailableCardIds, getCardInfo, countCardsByType } from '../utils/card/cardIdentification';
import { calculateTotalCards } from '../utils/card/cardCalculations';
import { DEFAULT_SETTINGS } from '../defaults';
import type { PageSettings, PdfMode, ExtractionSettings } from '../types';

describe('Debug Card Counting', () => {
  it('should debug the exact user scenario step by step', () => {
    console.log('=== DEBUGGING USER SCENARIO ===');
    
    // User scenario: 6 pages: back, front, back, front, back, front
    // Each page has 6 cards (2x3 grid)
    // Expected: 18 front cards, 18 back cards
    
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
    
    console.log('Pages:', activePages.map(p => p.type));
    console.log('PDF Mode:', pdfMode);
    console.log('Cards per page:', cardsPerPage);
    
    // Step 1: Check calculateTotalCards
    const totalCards = calculateTotalCards(pdfMode, activePages, cardsPerPage);
    console.log('calculateTotalCards result:', totalCards);
    
    // Step 2: Check getAvailableCardIds
    const frontCardIds = getAvailableCardIds('front', totalCards, pdfMode, activePages, cardsPerPage, extractionSettings);
    const backCardIds = getAvailableCardIds('back', totalCards, pdfMode, activePages, cardsPerPage, extractionSettings);
    
    console.log('Front card IDs:', frontCardIds);
    console.log('Back card IDs:', backCardIds);
    console.log('Front count:', frontCardIds.length);
    console.log('Back count:', backCardIds.length);
    
    // Step 3: Check individual card info for first few cards
    console.log('\n=== INDIVIDUAL CARD INFO ===');
    const maxIndex = activePages.length * cardsPerPage;
    for (let i = 0; i < Math.min(maxIndex, 12); i++) {
      const cardInfo = getCardInfo(
        i,
        activePages,
        extractionSettings,
        pdfMode,
        cardsPerPage,
        612, // pageWidth
        792  // pageHeight
      );
      const pageIndex = Math.floor(i / cardsPerPage);
      const cardOnPage = i % cardsPerPage;
      console.log(`Card ${i}: Page ${pageIndex} (${activePages[pageIndex]?.type}), Card ${cardOnPage}, Type: ${cardInfo.type}, ID: ${cardInfo.id}`);
    }
    
    // Step 4: Check countCardsByType
    const frontCount = countCardsByType('front', activePages, cardsPerPage, pdfMode, extractionSettings, 612, 792);
    const backCount = countCardsByType('back', activePages, cardsPerPage, pdfMode, extractionSettings, 612, 792);
    
    console.log('\n=== COUNTCARDSBYTYPE ===');
    console.log('Front count:', frontCount);
    console.log('Back count:', backCount);
    
    // Expectations
    expect(frontCardIds.length).toBe(18);
    expect(backCardIds.length).toBe(18);
    expect(frontCount).toBe(18);
    expect(backCount).toBe(18);
  });
});