/**
 * Test the actual ExportStep logic to match user scenario
 */

import { describe, it, expect } from 'vitest';
import { getAvailableCardIds, getCardInfo, countCardsByType } from '../utils/card/cardIdentification';
import { calculateTotalCards } from '../utils/card/cardCalculations';
import { getActivePagesWithSource } from '../utils/card/cardMultiFile';
import { DEFAULT_SETTINGS } from '../defaults';
import type { PageSettings, PdfMode, ExtractionSettings, PageSource } from '../types';

describe('ExportStep Logic Simulation', () => {
  it('should simulate the exact ExportStep groupStats calculation', () => {
    console.log('=== SIMULATING EXPORT STEP LOGIC ===');
    
    // Simulate the user's scenario as it would appear in the ExportStep
    const unifiedPages: (PageSettings & PageSource)[] = [
      { type: 'back', skip: false, originalPageIndex: 0, fileName: 'test.pdf', fileType: 'pdf', displayOrder: 0 },
      { type: 'front', skip: false, originalPageIndex: 1, fileName: 'test.pdf', fileType: 'pdf', displayOrder: 1 },
      { type: 'back', skip: false, originalPageIndex: 2, fileName: 'test.pdf', fileType: 'pdf', displayOrder: 2 },
      { type: 'front', skip: false, originalPageIndex: 3, fileName: 'test.pdf', fileType: 'pdf', displayOrder: 3 },
      { type: 'back', skip: false, originalPageIndex: 4, fileName: 'test.pdf', fileType: 'pdf', displayOrder: 4 },
      { type: 'front', skip: false, originalPageIndex: 5, fileName: 'test.pdf', fileType: 'pdf', displayOrder: 5 }
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
    
    console.log('Unified pages:', unifiedPages.map(p => p.type));
    
    // Simulate getPagesForGroup for default group (no groups configured)
    const allPages = getActivePagesWithSource(unifiedPages);
    console.log('Active pages:', allPages.map(p => p.type));
    
    // Simulate default group (no specific groups configured)
    const groupPages = allPages.filter((page, index) => !page.skip && !page.removed);
    console.log('Group pages:', groupPages.map(p => p.type));
    
    // Simulate the groupStats calculation
    const groupSettings = {
      extraction: extractionSettings,
      pdfMode: pdfMode
    };
    
    const cardsPerPage = groupSettings.extraction.grid.rows * groupSettings.extraction.grid.columns;
    const totalCards = calculateTotalCards(groupSettings.pdfMode, groupPages, cardsPerPage);
    
    console.log('Cards per page:', cardsPerPage);
    console.log('Total cards:', totalCards);
    
    // This is the exact call that ExportStep makes
    const frontCards = getAvailableCardIds('front', totalCards, groupSettings.pdfMode, groupPages, cardsPerPage, groupSettings.extraction).length;
    const backCards = getAvailableCardIds('back', totalCards, groupSettings.pdfMode, groupPages, cardsPerPage, groupSettings.extraction).length;
    
    console.log('Front cards:', frontCards);
    console.log('Back cards:', backCards);
    
    // This should match the user's expected outcome
    expect(frontCards).toBe(18);
    expect(backCards).toBe(18);
  });
  
  it('should test with different group configurations', () => {
    console.log('\n=== TESTING WITH EXPLICIT GROUP CONFIGURATION ===');
    
    // Test if there could be issues with multiple groups
    const unifiedPages: (PageSettings & PageSource)[] = [
      { type: 'back', skip: false, originalPageIndex: 0, fileName: 'test.pdf', fileType: 'pdf', displayOrder: 0 },
      { type: 'front', skip: false, originalPageIndex: 1, fileName: 'test.pdf', fileType: 'pdf', displayOrder: 1 },
      { type: 'back', skip: false, originalPageIndex: 2, fileName: 'test.pdf', fileType: 'pdf', displayOrder: 2 },
      { type: 'front', skip: false, originalPageIndex: 3, fileName: 'test.pdf', fileType: 'pdf', displayOrder: 3 },
      { type: 'back', skip: false, originalPageIndex: 4, fileName: 'test.pdf', fileType: 'pdf', displayOrder: 4 },
      { type: 'front', skip: false, originalPageIndex: 5, fileName: 'test.pdf', fileType: 'pdf', displayOrder: 5 }
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
    
    // Test with groups that might have different page assignments
    const mockGroups = [
      { id: 'group1', pageIndices: [0, 1, 2] }, // first 3 pages: back, front, back
      { id: 'group2', pageIndices: [3, 4, 5] }  // last 3 pages: front, back, front
    ];
    
    let totalFrontCards = 0;
    let totalBackCards = 0;
    
    mockGroups.forEach((group, index) => {
      const groupPages = group.pageIndices.map(idx => unifiedPages[idx]);
      console.log(`Group ${index + 1} pages:`, groupPages.map(p => p.type));
      
      const cardsPerPage = 6;
      const totalCards = calculateTotalCards(pdfMode, groupPages, cardsPerPage);
      
      const frontCards = getAvailableCardIds('front', totalCards, pdfMode, groupPages, cardsPerPage, extractionSettings).length;
      const backCards = getAvailableCardIds('back', totalCards, pdfMode, groupPages, cardsPerPage, extractionSettings).length;
      
      console.log(`Group ${index + 1} - Front: ${frontCards}, Back: ${backCards}`);
      
      totalFrontCards += frontCards;
      totalBackCards += backCards;
    });
    
    console.log('Total across groups - Front:', totalFrontCards, 'Back:', totalBackCards);
    
    // Should still total 18 front and 18 back
    expect(totalFrontCards).toBe(18);
    expect(totalBackCards).toBe(18);
  });
});