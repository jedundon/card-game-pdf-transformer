/**
 * @fileoverview Page Groups + Card ID Integration Tests
 * 
 * Critical tests for ensuring page groups functionality doesn't break card ID assignment,
 * especially duplex mirroring logic. These tests protect against regressions that could
 * impact core user workflows involving complex page organization.
 * 
 * Key areas tested:
 * - Card ID consistency when pages are grouped/ungrouped
 * - Duplex mirroring accuracy with page groups
 * - Override behavior with page groups
 * - Settings inheritance through page groups
 */

import { describe, it, expect, vi } from 'vitest'
import { getCardInfo } from '../utils/cardUtils'
import { PageSettings, PdfMode, ExtractionSettings, PageGroup } from '../types'

describe('Page Groups + Card ID Integration Tests', () => {
  const baseExtractionSettings: ExtractionSettings = {
    grid: { rows: 2, columns: 3 },
    crop: { top: 0, right: 0, bottom: 0, left: 0 },
    skippedCards: [],
    cardTypeOverrides: []
  };

  const cardsPerPage = 6; // 2x3 grid

  describe('Card ID Consistency with Page Groups', () => {
    it('should maintain consistent card IDs when pages are grouped', () => {
      const pdfMode: PdfMode = { type: 'duplex', flipEdge: 'short' };
      const portraitWidth = 612;
      const portraitHeight = 792;
      
      // Test scenario: 4 pages (2 duplex pairs)
      const activePages: PageSettings[] = [
        { type: 'front' },  // Page 0
        { type: 'back' },   // Page 1  
        { type: 'front' },  // Page 2
        { type: 'back' }    // Page 3
      ];

      const extractionSettings = {
        ...baseExtractionSettings,
        pageDimensions: { width: portraitWidth, height: portraitHeight }
      };

      // Get card IDs without groups (baseline)
      const cardsWithoutGroups = [];
      for (let i = 0; i < 24; i++) { // 4 pages × 6 cards = 24 cards
        const cardInfo = getCardInfo(
          i,
          activePages,
          extractionSettings,
          pdfMode,
          cardsPerPage,
          portraitWidth,
          portraitHeight
        );
        cardsWithoutGroups.push(cardInfo);
      }

      // Simulate page groups (should not affect card ID calculation)
      const pageGroups: PageGroup[] = [
        {
          id: 'group1',
          name: 'First Pair',
          pageIndices: [0, 1],
          type: 'manual',
          order: 0,
          processingMode: { type: 'duplex', flipEdge: 'short' },
          color: '#FF0000',
          createdAt: Date.now(),
          modifiedAt: Date.now()
        },
        {
          id: 'group2', 
          name: 'Second Pair',
          pageIndices: [2, 3],
          type: 'manual',
          order: 1,
          processingMode: { type: 'duplex', flipEdge: 'short' },
          color: '#00FF00',
          createdAt: Date.now(),
          modifiedAt: Date.now()
        }
      ];

      const extractionSettingsWithGroups = {
        ...extractionSettings,
        pageGroups // Groups should not affect core card ID logic
      };

      // Get card IDs with groups (should be identical)
      const cardsWithGroups = [];
      for (let i = 0; i < 24; i++) {
        const cardInfo = getCardInfo(
          i,
          activePages,
          extractionSettingsWithGroups,
          pdfMode,
          cardsPerPage,
          portraitWidth,
          portraitHeight
        );
        cardsWithGroups.push(cardInfo);
      }

      // CRITICAL: Card IDs must be identical regardless of grouping
      expect(cardsWithGroups).toHaveLength(cardsWithoutGroups.length);
      
      for (let i = 0; i < cardsWithoutGroups.length; i++) {
        expect(cardsWithGroups[i].id).toBe(cardsWithoutGroups[i].id);
        expect(cardsWithGroups[i].type).toBe(cardsWithoutGroups[i].type);
      }

      // Validate specific duplex mirroring still works
      // Back cards on page 1 should have mirrored IDs
      const backCard0Page1 = cardsWithGroups[6]; // Page 1, Card 0
      const backCard1Page1 = cardsWithGroups[7]; // Page 1, Card 1
      
      expect(backCard0Page1.type).toBe('Back');
      expect(backCard1Page1.type).toBe('Back');
      expect(backCard0Page1.id).toBeGreaterThan(0);
      expect(backCard1Page1.id).toBeGreaterThan(0);
    });

    it('should handle duplex mirroring correctly with page groups in landscape mode', () => {
      const pdfMode: PdfMode = { type: 'duplex', flipEdge: 'short' };
      const landscapeWidth = 792; // Landscape orientation
      const landscapeHeight = 612;
      
      const activePages: PageSettings[] = [
        { type: 'front' },
        { type: 'back' }
      ];

      // Create page group for duplex pair
      const pageGroups: PageGroup[] = [
        {
          id: 'duplex-group',
          name: 'Duplex Pair',
          pageIndices: [0, 1],
          type: 'duplex',
          order: 0,
          processingMode: { type: 'duplex', flipEdge: 'short' },
          color: '#0066CC',
          createdAt: Date.now(),
          modifiedAt: Date.now()
        }
      ];

      const extractionSettings = {
        ...baseExtractionSettings,
        grid: { rows: 2, columns: 2 }, // 2x2 for clearer testing
        pageDimensions: { width: landscapeWidth, height: landscapeHeight },
        pageGroups
      };

      // Test landscape + short edge flip = mirror columns (horizontal flip)
      // 2x2 grid positions: [0,1,2,3] should mirror to [1,0,3,2] for back cards
      
      const backCard0 = getCardInfo(4, activePages, extractionSettings, pdfMode, 4, landscapeWidth, landscapeHeight); 
      const backCard1 = getCardInfo(5, activePages, extractionSettings, pdfMode, 4, landscapeWidth, landscapeHeight); 
      const backCard2 = getCardInfo(6, activePages, extractionSettings, pdfMode, 4, landscapeWidth, landscapeHeight); 
      const backCard3 = getCardInfo(7, activePages, extractionSettings, pdfMode, 4, landscapeWidth, landscapeHeight);

      expect(backCard0.type).toBe('Back');
      expect(backCard0.id).toBe(2); // Position 0 mirrors to position 1 → Front-2
      expect(backCard1.type).toBe('Back');
      expect(backCard1.id).toBe(1); // Position 1 mirrors to position 0 → Front-1
      expect(backCard2.type).toBe('Back');
      expect(backCard2.id).toBe(4); // Position 2 mirrors to position 3 → Front-4
      expect(backCard3.type).toBe('Back');
      expect(backCard3.id).toBe(3); // Position 3 mirrors to position 2 → Front-3
    });
  });

  describe('Page Groups with Card Type Overrides', () => {
    it('should respect card type overrides within page groups', () => {
      const pdfMode: PdfMode = { type: 'duplex', flipEdge: 'short' };
      const portraitWidth = 612;
      const portraitHeight = 792;
      
      const activePages: PageSettings[] = [
        { type: 'front' },
        { type: 'back' }
      ];

      // Add card type overrides
      const extractionSettings = {
        ...baseExtractionSettings,
        pageDimensions: { width: portraitWidth, height: portraitHeight },
        cardTypeOverrides: [
          { pageIndex: 0, gridRow: 0, gridColumn: 0, cardType: 'back' as const }, // Override front card to back
          { pageIndex: 1, gridRow: 1, gridColumn: 1, cardType: 'front' as const }  // Override back card to front
        ],
        pageGroups: [
          {
            id: 'test-group',
            name: 'Test Group',
            pageIndices: [0, 1],
            type: 'manual',
            order: 0,
            processingMode: { type: 'duplex', flipEdge: 'short' },
            color: '#FFAA00',
            createdAt: Date.now(),
            modifiedAt: Date.now()
          }
        ]
      };

      // Test overridden card (should be back despite being on front page)
      const overriddenCard = getCardInfo(
        0, // Page 0, Card 0 - overridden to 'back'
        activePages,
        extractionSettings,
        pdfMode,
        cardsPerPage,
        portraitWidth,
        portraitHeight
      );

      expect(overriddenCard.type).toBe('Back'); // Should respect override
      expect(overriddenCard.id).toBeGreaterThan(0);

      // Test normal card (should follow duplex logic)
      const normalCard = getCardInfo(
        1, // Page 0, Card 1 - no override, should be front
        activePages,
        extractionSettings,
        pdfMode,
        cardsPerPage,
        portraitWidth,
        portraitHeight
      );

      expect(normalCard.type).toBe('Front'); // Should follow normal duplex logic
      expect(normalCard.id).toBeGreaterThan(0);

      // Test back page override (back→front)
      const backPageOverride = getCardInfo(
        cardsPerPage + 4, // Page 1, Card 4 (row 1, col 1) - overridden to 'front'
        activePages,
        extractionSettings,
        pdfMode,
        cardsPerPage,
        portraitWidth,
        portraitHeight
      );

      expect(backPageOverride.type).toBe('Front'); // Should respect override
      expect(backPageOverride.id).toBeGreaterThan(0);
    });

    it('should handle overrides consistently when page grouping changes', () => {
      const pdfMode: PdfMode = { type: 'simplex' };
      const portraitWidth = 612;
      const portraitHeight = 792;
      
      const activePages: PageSettings[] = [
        {},
        {},
        {}
      ];

      const cardTypeOverrides = [
        { pageIndex: 1, gridRow: 0, gridColumn: 1, cardType: 'back' as const }
      ];

      // Test with no groups
      const extractionSettingsNoGroups = {
        ...baseExtractionSettings,
        pageDimensions: { width: portraitWidth, height: portraitHeight },
        cardTypeOverrides
      };

      const cardNoGroups = getCardInfo(
        7, // Page 1, Card 1 - overridden to back
        activePages,
        extractionSettingsNoGroups,
        pdfMode,
        cardsPerPage,
        portraitWidth,
        portraitHeight
      );

      // Test with groups (should give same result)
      const extractionSettingsWithGroups = {
        ...extractionSettingsNoGroups,
        pageGroups: [
          {
            id: 'group-all',
            name: 'All Pages',
            pageIndices: [0, 1, 2],
            type: 'manual',
            order: 0,
            processingMode: { type: 'simplex' },
            color: '#9966CC',
            createdAt: Date.now(),
            modifiedAt: Date.now()
          }
        ]
      };

      const cardWithGroups = getCardInfo(
        7, // Same card - should have identical result
        activePages,
        extractionSettingsWithGroups,
        pdfMode,
        cardsPerPage,
        portraitWidth,
        portraitHeight
      );

      // CRITICAL: Override behavior must be identical regardless of grouping
      expect(cardWithGroups.type).toBe(cardNoGroups.type);
      expect(cardWithGroups.id).toBe(cardNoGroups.id);
      expect(cardWithGroups.type).toBe('Back'); // Verify override worked
    });
  });

  describe('Complex Page Group Scenarios', () => {
    it('should handle mixed processing modes within page groups correctly', () => {
      const activePages: PageSettings[] = [
        { type: 'front' },  // Page 0
        { type: 'back' },   // Page 1
        {},                 // Page 2 (simplex)
        {}                  // Page 3 (simplex)
      ];

      const portraitWidth = 612;
      const portraitHeight = 792;

      // Create groups with different processing modes
      const pageGroups: PageGroup[] = [
        {
          id: 'duplex-group',
          name: 'Duplex Pages',
          pageIndices: [0, 1],
          type: 'duplex',
          order: 0,
          processingMode: { type: 'duplex', flipEdge: 'short' },
          color: '#FF6600',
          createdAt: Date.now(),
          modifiedAt: Date.now()
        },
        {
          id: 'simplex-group',
          name: 'Simplex Pages', 
          pageIndices: [2, 3],
          type: 'manual',
          order: 1,
          processingMode: { type: 'simplex' },
          color: '#0066FF',
          createdAt: Date.now(),
          modifiedAt: Date.now()
        }
      ];

      const extractionSettings = {
        ...baseExtractionSettings,
        pageDimensions: { width: portraitWidth, height: portraitHeight },
        pageGroups
      };

      // Test duplex cards (pages 0-1) - should use duplex logic
      const duplexPdfMode: PdfMode = { type: 'duplex', flipEdge: 'short' };
      
      const frontCard = getCardInfo(0, activePages, extractionSettings, duplexPdfMode, cardsPerPage, portraitWidth, portraitHeight);
      const backCard = getCardInfo(6, activePages, extractionSettings, duplexPdfMode, cardsPerPage, portraitWidth, portraitHeight);
      
      expect(frontCard.type).toBe('Front');
      expect(backCard.type).toBe('Back');
      
      // Test simplex cards (pages 2-3) - should use simplex logic
      const simplexPdfMode: PdfMode = { type: 'simplex' };
      
      const simplexCard1 = getCardInfo(12, activePages, extractionSettings, simplexPdfMode, cardsPerPage, portraitWidth, portraitHeight);
      const simplexCard2 = getCardInfo(18, activePages, extractionSettings, simplexPdfMode, cardsPerPage, portraitWidth, portraitHeight);
      
      expect(simplexCard1.type).toBe('Front'); // Simplex cards are always front
      expect(simplexCard2.type).toBe('Front');
      
      // Verify card IDs are sequential within each mode
      expect(frontCard.id).toBe(1);
      expect(backCard.id).toBeGreaterThan(0); // Depends on mirroring
      expect(simplexCard1.id).toBeGreaterThan(backCard.id); // Should continue sequence
      expect(simplexCard2.id).toBeGreaterThan(simplexCard1.id);
    });

    it('should handle page dimension propagation with page groups', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      const pdfMode: PdfMode = { type: 'duplex', flipEdge: 'short' };
      const activePages: PageSettings[] = [
        { type: 'front' },
        { type: 'back' }
      ];

      // Test with page groups but missing page dimensions
      const extractionSettingsNoDimensions = {
        ...baseExtractionSettings,
        pageDimensions: undefined, // Missing dimensions
        pageGroups: [
          {
            id: 'test-group',
            name: 'Test Group',
            pageIndices: [0, 1],
            type: 'duplex',
            order: 0,
            processingMode: { type: 'duplex', flipEdge: 'short' },
            color: '#CC00CC',
            createdAt: Date.now(),
            modifiedAt: Date.now()
          }
        ]
      };

      // Should trigger fallback logic and warning
      const cardInfo = getCardInfo(
        6, // Back page, first card
        activePages,
        extractionSettingsNoDimensions,
        pdfMode,
        cardsPerPage
        // No page dimensions passed
      );

      expect(cardInfo.type).toBe('Back');
      expect(cardInfo.id).toBeGreaterThan(0);
      
      // Should have triggered fallback warning
      expect(consoleSpy).toHaveBeenCalled();

      // Test with page dimensions provided - should not trigger warning
      consoleSpy.mockClear();
      
      const extractionSettingsWithDimensions = {
        ...extractionSettingsNoDimensions,
        pageDimensions: { width: 612, height: 792 }
      };

      const cardInfoWithDimensions = getCardInfo(
        6,
        activePages,
        extractionSettingsWithDimensions,
        pdfMode,
        cardsPerPage,
        612,
        792
      );

      expect(cardInfoWithDimensions.type).toBe('Back');
      expect(cardInfoWithDimensions.id).toBeGreaterThan(0);
      
      // Should NOT have triggered fallback warning
      expect(consoleSpy).not.toHaveBeenCalled();
      
      consoleSpy.mockRestore();
    });
  });

  describe('Edge Cases with Page Groups', () => {
    it('should handle empty page groups gracefully', () => {
      const pdfMode: PdfMode = { type: 'simplex' };
      const activePages: PageSettings[] = [{}];
      
      const extractionSettings = {
        ...baseExtractionSettings,
        pageDimensions: { width: 612, height: 792 },
        pageGroups: [] // Empty groups array
      };

      const cardInfo = getCardInfo(
        0,
        activePages,
        extractionSettings,
        pdfMode,
        cardsPerPage,
        612,
        792
      );

      expect(cardInfo.type).toBe('Front');
      expect(cardInfo.id).toBe(1);
    });

    it('should handle page groups with invalid page indices', () => {
      const pdfMode: PdfMode = { type: 'simplex' };
      const activePages: PageSettings[] = [{}];
      
      const extractionSettings = {
        ...baseExtractionSettings,
        pageDimensions: { width: 612, height: 792 },
        pageGroups: [
          {
            id: 'invalid-group',
            name: 'Invalid Group',
            pageIndices: [0, 5, 10], // Pages 5 and 10 don't exist
            type: 'manual',
            order: 0,
            processingMode: { type: 'simplex' },
            color: '#999999',
            createdAt: Date.now(),
            modifiedAt: Date.now()
          }
        ]
      };

      // Should not crash
      const cardInfo = getCardInfo(
        0,
        activePages,
        extractionSettings,
        pdfMode,
        cardsPerPage,
        612,
        792
      );

      expect(cardInfo.type).toBe('Front');
      expect(cardInfo.id).toBe(1);
    });

    it('should maintain card ID sequence integrity with complex grouping', () => {
      const pdfMode: PdfMode = { type: 'simplex' };
      const activePages: PageSettings[] = [{}, {}, {}, {}, {}]; // 5 pages
      
      const extractionSettings = {
        ...baseExtractionSettings,
        pageDimensions: { width: 612, height: 792 },
        pageGroups: [
          {
            id: 'group1',
            name: 'Group 1',
            pageIndices: [0, 2, 4], // Odd pages
            type: 'manual',
            order: 0,
            processingMode: { type: 'simplex' },
            color: '#FF0000',
            createdAt: Date.now(),
            modifiedAt: Date.now()
          },
          {
            id: 'group2',
            name: 'Group 2',
            pageIndices: [1, 3], // Even pages
            type: 'manual',
            order: 1,
            processingMode: { type: 'simplex' },
            color: '#00FF00',
            createdAt: Date.now(),
            modifiedAt: Date.now()
          }
        ]
      };

      // Test all cards to ensure sequential ID assignment
      const allCards = [];
      for (let i = 0; i < 30; i++) { // 5 pages × 6 cards = 30 cards
        const cardInfo = getCardInfo(
          i,
          activePages,
          extractionSettings,
          pdfMode,
          cardsPerPage,
          612,
          792
        );
        allCards.push(cardInfo);
      }

      // Verify all cards are Front type (simplex)
      expect(allCards.every(card => card.type === 'Front')).toBe(true);
      
      // Verify sequential ID assignment (should be 1 through 30)
      const expectedIds = Array.from({ length: 30 }, (_, i) => i + 1);
      const actualIds = allCards.map(card => card.id).sort((a, b) => a - b);
      
      expect(actualIds).toEqual(expectedIds);
      
      // Verify no duplicate IDs
      const uniqueIds = new Set(allCards.map(card => card.id));
      expect(uniqueIds.size).toBe(30);
    });
  });
});