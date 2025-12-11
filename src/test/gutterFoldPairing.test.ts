/**
 * @fileoverview Tests for gutter-fold pairing logic
 *
 * Verifies that cards are correctly paired when using gutter-fold mode,
 * ensuring that front and back cards align properly when the page is folded.
 */

import { describe, it, expect } from 'vitest';
import { getCardInfo } from '../utils/card/cardIdentification';
import { ExtractionSettings, PdfMode } from '../types';

describe('Gutter-Fold Pairing Logic', () => {
  describe('Vertical Gutter-Fold', () => {
    it('should pair leftmost front card with rightmost back card', () => {
      // Setup: 4 cards in a row (A, B, C, D where A,B=fronts, C,D=backs)
      // Expected pairing: A(Front 1) with D(Back 1), B(Front 2) with C(Back 2)

      const pdfMode: PdfMode = {
        type: 'gutter-fold',
        orientation: 'vertical'
      };

      const extractionSettings: ExtractionSettings = {
        grid: { rows: 1, columns: 4 },
        crop: { top: 0, left: 0, right: 0, bottom: 0 },
        cardTypeOverrides: []
      };

      const activePages = [{}];
      const cardsPerPage = 4;

      // Card positions (in a single row):
      // Col 0 (A) - Front
      // Col 1 (B) - Front
      // Col 2 (C) - Back
      // Col 3 (D) - Back

      const cardA = getCardInfo(0, activePages, extractionSettings, pdfMode, cardsPerPage);
      const cardB = getCardInfo(1, activePages, extractionSettings, pdfMode, cardsPerPage);
      const cardC = getCardInfo(2, activePages, extractionSettings, pdfMode, cardsPerPage);
      const cardD = getCardInfo(3, activePages, extractionSettings, pdfMode, cardsPerPage);

      // Verify card types
      expect(cardA.type).toBe('Front');
      expect(cardB.type).toBe('Front');
      expect(cardC.type).toBe('Back');
      expect(cardD.type).toBe('Back');

      // Verify correct pairing through IDs
      // A (Front 1) should pair with D (Back 1)
      // B (Front 2) should pair with C (Back 2)
      expect(cardA.id).toBe(1); // Front 1
      expect(cardB.id).toBe(2); // Front 2
      expect(cardD.id).toBe(1); // Back 1 (pairs with A)
      expect(cardC.id).toBe(2); // Back 2 (pairs with B)
    });

    it('should handle 2x4 grid (2 rows, 4 columns) correctly', () => {
      const pdfMode: PdfMode = {
        type: 'gutter-fold',
        orientation: 'vertical'
      };

      const extractionSettings: ExtractionSettings = {
        grid: { rows: 2, columns: 4 },
        crop: { top: 0, left: 0, right: 0, bottom: 0 },
        cardTypeOverrides: []
      };

      const activePages = [{}];
      const cardsPerPage = 8;

      // Row 0: A(0,0) B(0,1) | C(0,2) D(0,3)
      // Row 1: E(1,0) F(1,1) | G(1,2) H(1,3)
      // Expected pairing: A-D, B-C, E-H, F-G

      const cards = Array.from({ length: 8 }, (_, i) =>
        getCardInfo(i, activePages, extractionSettings, pdfMode, cardsPerPage)
      );

      // Row 0 fronts
      expect(cards[0]).toEqual({ type: 'Front', id: 1 }); // A
      expect(cards[1]).toEqual({ type: 'Front', id: 2 }); // B

      // Row 0 backs (reversed)
      expect(cards[3]).toEqual({ type: 'Back', id: 1 }); // D pairs with A
      expect(cards[2]).toEqual({ type: 'Back', id: 2 }); // C pairs with B

      // Row 1 fronts
      expect(cards[4]).toEqual({ type: 'Front', id: 3 }); // E
      expect(cards[5]).toEqual({ type: 'Front', id: 4 }); // F

      // Row 1 backs (reversed)
      expect(cards[7]).toEqual({ type: 'Back', id: 3 }); // H pairs with E
      expect(cards[6]).toEqual({ type: 'Back', id: 4 }); // G pairs with F
    });
  });

  describe('Horizontal Gutter-Fold', () => {
    it('should pair topmost front card with bottommost back card', () => {
      // Setup: 4 cards in a column (A, B, C, D where A,B=fronts, C,D=backs)
      // Expected pairing: A(Front 1) with D(Back 1), B(Front 2) with C(Back 2)

      const pdfMode: PdfMode = {
        type: 'gutter-fold',
        orientation: 'horizontal'
      };

      const extractionSettings: ExtractionSettings = {
        grid: { rows: 4, columns: 1 },
        crop: { top: 0, left: 0, right: 0, bottom: 0 },
        cardTypeOverrides: []
      };

      const activePages = [{}];
      const cardsPerPage = 4;

      // Card positions (in a single column):
      // Row 0 (A) - Front
      // Row 1 (B) - Front
      // Row 2 (C) - Back
      // Row 3 (D) - Back

      const cardA = getCardInfo(0, activePages, extractionSettings, pdfMode, cardsPerPage);
      const cardB = getCardInfo(1, activePages, extractionSettings, pdfMode, cardsPerPage);
      const cardC = getCardInfo(2, activePages, extractionSettings, pdfMode, cardsPerPage);
      const cardD = getCardInfo(3, activePages, extractionSettings, pdfMode, cardsPerPage);

      // Verify card types
      expect(cardA.type).toBe('Front');
      expect(cardB.type).toBe('Front');
      expect(cardC.type).toBe('Back');
      expect(cardD.type).toBe('Back');

      // Verify correct pairing through IDs
      expect(cardA.id).toBe(1); // Front 1
      expect(cardB.id).toBe(2); // Front 2
      expect(cardD.id).toBe(1); // Back 1 (pairs with A)
      expect(cardC.id).toBe(2); // Back 2 (pairs with B)
    });
  });
});
