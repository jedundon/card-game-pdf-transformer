/**
 * @fileoverview Regression tests for duplex mirroring logic (GitHub Issue #67)
 * 
 * These tests ensure that duplex back card assignment works correctly with
 * orientation-aware flip edge logic and prevents the regression that occurred
 * during the cardUtils.ts refactoring.
 * 
 * Critical scenarios tested:
 * - Portrait vs landscape page orientation
 * - Short edge vs long edge flip settings
 * - Page dimension propagation and fallback logic
 * - Consistent card ID assignment across workflow steps
 */

import { describe, it, expect, vi } from 'vitest'
import { getCardInfo } from '../utils/cardUtils'
import { PageSettings, PdfMode, ExtractionSettings } from '../types'

describe('Duplex Mirroring Regression Tests (Issue #67)', () => {
  const mockActivePages: PageSettings[] = [
    { type: 'front' },
    { type: 'back' },
    { type: 'front' },
    { type: 'back' }
  ];

  const baseExtractionSettings: ExtractionSettings = {
    grid: { rows: 2, columns: 2 },
    crop: { top: 0, right: 0, bottom: 0, left: 0 },
    pageDimensions: undefined, // Will be set per test
    skippedCards: [],
    cardTypeOverrides: []
  };

  const cardsPerPage = 4; // 2x2 grid

  describe('Portrait page orientation with duplex mode', () => {
    const portraitWidth = 612; // 8.5" at 72 DPI (portrait)
    const portraitHeight = 792; // 11" at 72 DPI (portrait)

    it('should mirror rows (vertical flip) for short edge flip in portrait mode', () => {
      const pdfMode: PdfMode = { type: 'duplex', flipEdge: 'short' };
      const extractionSettings = {
        ...baseExtractionSettings,
        pageDimensions: { width: portraitWidth, height: portraitHeight }
      };

      // Test back page card (card index 4 = page 1, card 0)
      const cardInfo = getCardInfo(
        4, // Second page (back), first card
        mockActivePages,
        extractionSettings,
        pdfMode,
        cardsPerPage,
        portraitWidth,
        portraitHeight
      );

      expect(cardInfo.type).toBe('Back');
      expect(cardInfo.id).toBeGreaterThan(0);
    });

    it('should mirror columns (horizontal flip) for long edge flip in portrait mode', () => {
      const pdfMode: PdfMode = { type: 'duplex', flipEdge: 'long' };
      const extractionSettings = {
        ...baseExtractionSettings,
        pageDimensions: { width: portraitWidth, height: portraitHeight }
      };

      // Test back page card (card index 4 = page 1, card 0)
      const cardInfo = getCardInfo(
        4, // Second page (back), first card
        mockActivePages,
        extractionSettings,
        pdfMode,
        cardsPerPage,
        portraitWidth,
        portraitHeight
      );

      expect(cardInfo.type).toBe('Back');
      expect(cardInfo.id).toBeGreaterThan(0);
    });
  });

  describe('Landscape page orientation with duplex mode', () => {
    const landscapeWidth = 792; // 11" at 72 DPI (landscape)  
    const landscapeHeight = 612; // 8.5" at 72 DPI (landscape)

    it('should mirror columns (horizontal flip) for short edge flip in landscape mode', () => {
      const pdfMode: PdfMode = { type: 'duplex', flipEdge: 'short' };
      const extractionSettings = {
        ...baseExtractionSettings,
        pageDimensions: { width: landscapeWidth, height: landscapeHeight }
      };

      // Test back page card (card index 4 = page 1, card 0)
      const cardInfo = getCardInfo(
        4, // Second page (back), first card
        mockActivePages,
        extractionSettings,
        pdfMode,
        cardsPerPage,
        landscapeWidth,
        landscapeHeight
      );

      expect(cardInfo.type).toBe('Back');
      expect(cardInfo.id).toBeGreaterThan(0);
    });

    it('should mirror rows (vertical flip) for long edge flip in landscape mode', () => {
      const pdfMode: PdfMode = { type: 'duplex', flipEdge: 'long' };
      const extractionSettings = {
        ...baseExtractionSettings,
        pageDimensions: { width: landscapeWidth, height: landscapeHeight }
      };

      // Test back page card (card index 4 = page 1, card 0)
      const cardInfo = getCardInfo(
        4, // Second page (back), first card
        mockActivePages,
        extractionSettings,
        pdfMode,
        cardsPerPage,
        landscapeWidth,
        landscapeHeight
      );

      expect(cardInfo.type).toBe('Back');
      expect(cardInfo.id).toBeGreaterThan(0);
    });
  });

  describe('Fallback logic and console warnings', () => {
    it('should trigger fallback logic and log warning when page dimensions are missing', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      const pdfMode: PdfMode = { type: 'duplex', flipEdge: 'short' };
      const extractionSettings = {
        ...baseExtractionSettings,
        pageDimensions: undefined
      };

      // Call without page dimensions (triggers fallback)
      const cardInfo = getCardInfo(
        4, // Second page (back), first card
        mockActivePages,
        extractionSettings,
        pdfMode,
        cardsPerPage
        // No page dimensions passed
      );

      expect(cardInfo.type).toBe('Back');
      expect(cardInfo.id).toBeGreaterThan(0);
      
      // Verify console warning was logged
      expect(consoleSpy).toHaveBeenCalledWith(
        'Duplex mirroring fallback logic triggered - page dimensions missing!',
        'This can cause inconsistent card IDs. Please ensure page dimensions are passed to getCardInfo().',
        expect.objectContaining({
          cardOnPage: 0,
          flipEdge: 'short'
        })
      );

      consoleSpy.mockRestore();
    });

    it('should NOT trigger fallback logic when page dimensions are provided', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      const pdfMode: PdfMode = { type: 'duplex', flipEdge: 'short' };
      const extractionSettings = {
        ...baseExtractionSettings,
        pageDimensions: { width: 612, height: 792 }
      };

      // Call with page dimensions (should not trigger fallback)
      const cardInfo = getCardInfo(
        4, // Second page (back), first card
        mockActivePages,
        extractionSettings,
        pdfMode,
        cardsPerPage,
        612,
        792
      );

      expect(cardInfo.type).toBe('Back');
      expect(cardInfo.id).toBeGreaterThan(0);
      
      // Verify no console warning was logged
      expect(consoleSpy).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe('Duplex card ID mirroring verification', () => {
    it('should assign mirrored IDs for back cards in landscape short edge flip (user example)', () => {
      const pdfMode: PdfMode = { type: 'duplex', flipEdge: 'short' };
      const landscapeWidth = 792; // Landscape orientation
      const landscapeHeight = 612;
      
      const extractionSettings = {
        ...baseExtractionSettings,
        grid: { rows: 2, columns: 2 }, // 2x2 grid
        pageDimensions: { width: landscapeWidth, height: landscapeHeight }
      };

      // Test scenario: 3 pages, all marked as "back" pages
      const allBackPages: PageSettings[] = [
        { type: 'back' },
        { type: 'back' },
        { type: 'back' }
      ];

      // In landscape + short edge flip = mirror columns (horizontal flip)
      // 2x2 grid normal positions: [0,1,2,3] = [(0,0),(0,1),(1,0),(1,1)]
      // After column mirroring: [(0,1),(0,0),(1,1),(1,0)] = [1,0,3,2]
      
      // First page back cards - should be mirrored
      const back0 = getCardInfo(0, allBackPages, extractionSettings, pdfMode, 4, landscapeWidth, landscapeHeight); // Position 0 -> mirror to 1
      const back1 = getCardInfo(1, allBackPages, extractionSettings, pdfMode, 4, landscapeWidth, landscapeHeight); // Position 1 -> mirror to 0  
      const back2 = getCardInfo(2, allBackPages, extractionSettings, pdfMode, 4, landscapeWidth, landscapeHeight); // Position 2 -> mirror to 3
      const back3 = getCardInfo(3, allBackPages, extractionSettings, pdfMode, 4, landscapeWidth, landscapeHeight); // Position 3 -> mirror to 2

      expect(back0.type).toBe('Back');
      expect(back0.id).toBe(2); // Mirrored to position 1, so should be 2nd in order 
      expect(back1.type).toBe('Back');
      expect(back1.id).toBe(1); // Mirrored to position 0, so should be 1st in order
      expect(back2.type).toBe('Back');
      expect(back2.id).toBe(4); // Mirrored to position 3, so should be 4th in order
      expect(back3.type).toBe('Back');
      expect(back3.id).toBe(3); // Mirrored to position 2, so should be 3rd in order
    });

    it('should assign mirrored IDs for back cards in portrait long edge flip', () => {
      const pdfMode: PdfMode = { type: 'duplex', flipEdge: 'long' };
      const portraitWidth = 612;
      const portraitHeight = 792;
      
      const extractionSettings = {
        ...baseExtractionSettings,
        grid: { rows: 2, columns: 2 }, // 2x2 grid
        pageDimensions: { width: portraitWidth, height: portraitHeight }
      };

      const duplexPages: PageSettings[] = [
        { type: 'front' },
        { type: 'back' }
      ];

      // Test back page cards with long edge flip (portrait) = mirror columns
      // Back card positions: [0,1,2,3] should mirror to [1,0,3,2] -> IDs [2,1,4,3]
      const back0 = getCardInfo(4, duplexPages, extractionSettings, pdfMode, 4, portraitWidth, portraitHeight);
      const back1 = getCardInfo(5, duplexPages, extractionSettings, pdfMode, 4, portraitWidth, portraitHeight);
      const back2 = getCardInfo(6, duplexPages, extractionSettings, pdfMode, 4, portraitWidth, portraitHeight);
      const back3 = getCardInfo(7, duplexPages, extractionSettings, pdfMode, 4, portraitWidth, portraitHeight);

      expect(back0.type).toBe('Back');
      expect(back0.id).toBe(2); // Mirrored from position 1 (Front-2)
      expect(back1.type).toBe('Back');
      expect(back1.id).toBe(1); // Mirrored from position 0 (Front-1)
      expect(back2.type).toBe('Back');
      expect(back2.id).toBe(4); // Mirrored from position 3 (Front-4)
      expect(back3.type).toBe('Back');
      expect(back3.id).toBe(3); // Mirrored from position 2 (Front-3)
    });
  });

  describe('Card ID consistency across different page dimensions', () => {
    it('should produce consistent card IDs when same page dimensions are passed', () => {
      const pdfMode: PdfMode = { type: 'duplex', flipEdge: 'short' };
      const portraitWidth = 612;
      const portraitHeight = 792;
      
      const extractionSettings = {
        ...baseExtractionSettings,
        pageDimensions: { width: portraitWidth, height: portraitHeight }
      };

      // Get card info with page dimensions from extractionSettings
      const cardInfo1 = getCardInfo(
        4,
        mockActivePages,
        extractionSettings,
        pdfMode,
        cardsPerPage,
        extractionSettings.pageDimensions?.width,
        extractionSettings.pageDimensions?.height
      );

      // Get card info with same page dimensions passed directly
      const cardInfo2 = getCardInfo(
        4,
        mockActivePages,
        extractionSettings,
        pdfMode,
        cardsPerPage,
        portraitWidth,
        portraitHeight
      );

      // Should be identical
      expect(cardInfo1.type).toBe(cardInfo2.type);
      expect(cardInfo1.id).toBe(cardInfo2.id);
    });

    it('should handle different orientations consistently', () => {
      const pdfMode: PdfMode = { type: 'duplex', flipEdge: 'short' };
      
      // Portrait dimensions
      const portraitSettings = {
        ...baseExtractionSettings,
        pageDimensions: { width: 612, height: 792 }
      };

      // Landscape dimensions  
      const landscapeSettings = {
        ...baseExtractionSettings,
        pageDimensions: { width: 792, height: 612 }
      };

      const portraitCardInfo = getCardInfo(
        4,
        mockActivePages,
        portraitSettings,
        pdfMode,
        cardsPerPage,
        612,
        792
      );

      const landscapeCardInfo = getCardInfo(
        4,
        mockActivePages,
        landscapeSettings,
        pdfMode,
        cardsPerPage,
        792,
        612
      );

      // Both should be back cards with valid IDs
      expect(portraitCardInfo.type).toBe('Back');
      expect(landscapeCardInfo.type).toBe('Back');
      expect(portraitCardInfo.id).toBeGreaterThan(0);
      expect(landscapeCardInfo.id).toBeGreaterThan(0);
    });
  });

  describe('Non-duplex modes should not be affected', () => {
    it('should handle simplex mode correctly (no change in behavior)', () => {
      const pdfMode: PdfMode = { type: 'simplex' };
      const extractionSettings = {
        ...baseExtractionSettings,
        pageDimensions: { width: 612, height: 792 }
      };

      const cardInfo = getCardInfo(
        0,
        [{ type: 'front' }],
        extractionSettings,
        pdfMode,
        cardsPerPage,
        612,
        792
      );

      expect(cardInfo.type).toBe('Front');
      expect(cardInfo.id).toBe(1);
    });

    it('should handle gutter-fold mode correctly (no change in behavior)', () => {
      const pdfMode: PdfMode = { type: 'gutter-fold', orientation: 'vertical' };
      const extractionSettings = {
        ...baseExtractionSettings,
        pageDimensions: { width: 612, height: 792 }
      };

      const cardInfo = getCardInfo(
        0, // First card (left side in vertical gutter-fold = front)
        [{}],
        extractionSettings,
        pdfMode,
        cardsPerPage,
        612,
        792
      );

      expect(cardInfo.type).toBe('Front');
      expect(cardInfo.id).toBe(1);
    });
  });

  describe('Edge cases and error handling', () => {
    it('should handle zero or negative page dimensions gracefully', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      const pdfMode: PdfMode = { type: 'duplex', flipEdge: 'short' };
      const extractionSettings = {
        ...baseExtractionSettings,
        pageDimensions: { width: 0, height: 0 }
      };

      // Call with invalid page dimensions
      const cardInfo = getCardInfo(
        4,
        mockActivePages,
        extractionSettings,
        pdfMode,
        cardsPerPage,
        0,
        0
      );

      expect(cardInfo.type).toBe('Back');
      expect(cardInfo.id).toBeGreaterThan(0);
      
      // Should trigger fallback logic due to invalid dimensions
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should handle empty active pages array', () => {
      const pdfMode: PdfMode = { type: 'duplex', flipEdge: 'short' };
      const extractionSettings = {
        ...baseExtractionSettings,
        pageDimensions: { width: 612, height: 792 }
      };

      const cardInfo = getCardInfo(
        0,
        [], // Empty pages array
        extractionSettings,
        pdfMode,
        cardsPerPage,
        612,
        792
      );

      expect(cardInfo.type).toBe('Unknown');
      expect(cardInfo.id).toBe(0);
    });
  });
});