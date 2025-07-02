import { describe, it, expect } from 'vitest';
import { getCardInfo } from '../utils/card/cardIdentification';
import type { PageSettings, ExtractionSettings, PdfMode, CardTypeOverride } from '../types';

describe('Card Identification with Overrides', () => {
  const mockPages: PageSettings[] = [
    { type: 'front' },
    { type: 'back' }
  ];

  const baseSettings: ExtractionSettings = {
    grid: { rows: 2, columns: 3 },
    crop: { top: 0, right: 0, bottom: 0, left: 0 },
    skippedCards: [],
    cardTypeOverrides: []
  };

  const duplexMode: PdfMode = {
    type: 'duplex',
    flipEdge: 'short'
  };

  it('should respect manual override over processing mode logic', () => {
    const overrides: CardTypeOverride[] = [{
      pageIndex: 0,
      gridRow: 0,
      gridColumn: 0,
      cardType: 'back'
    }];

    const settings = {
      ...baseSettings,
      cardTypeOverrides: overrides
    };

    // Without override, first card on first page should be Front
    const normalResult = getCardInfo(0, mockPages, baseSettings, duplexMode, 6);
    expect(normalResult.type).toBe('Front');

    // With override, same card should be Back
    const overrideResult = getCardInfo(0, mockPages, settings, duplexMode, 6);
    expect(overrideResult.type).toBe('Back');
    expect(overrideResult.id).toBe(1); // ID should be sequential within type (first back card)
  });

  it('should fall back to processing mode when no override exists', () => {
    const settings = {
      ...baseSettings,
      cardTypeOverrides: []
    };

    // Card on back page should follow normal duplex logic
    const result = getCardInfo(6, mockPages, settings, duplexMode, 6);
    expect(result.type).toBe('Back');
  });

  it('should handle multiple overrides correctly', () => {
    const overrides: CardTypeOverride[] = [
      {
        pageIndex: 0,
        gridRow: 0,
        gridColumn: 0,
        cardType: 'back'
      },
      {
        pageIndex: 0,
        gridRow: 1,
        gridColumn: 2,
        cardType: 'front'
      }
    ];

    const settings = {
      ...baseSettings,
      cardTypeOverrides: overrides
    };

    // First card should be overridden to Back
    const result1 = getCardInfo(0, mockPages, settings, duplexMode, 6);
    expect(result1.type).toBe('Back');

    // Last card on first page should be overridden to Front
    const result2 = getCardInfo(5, mockPages, settings, duplexMode, 6);
    expect(result2.type).toBe('Front');

    // Middle card should follow normal logic (no override)
    const result3 = getCardInfo(2, mockPages, settings, duplexMode, 6);
    expect(result3.type).toBe('Front'); // Normal front page card
  });

  it('should work with different processing modes', () => {
    const gutterMode: PdfMode = {
      type: 'gutter-fold',
      orientation: 'vertical'
    };

    const overrides: CardTypeOverride[] = [{
      pageIndex: 0,
      gridRow: 0,
      gridColumn: 0,
      cardType: 'back'
    }];

    const settings = {
      ...baseSettings,
      cardTypeOverrides: overrides
    };

    // In gutter-fold, left side is normally front, but override should make it back
    const result = getCardInfo(0, [{}], settings, gutterMode, 6);
    expect(result.type).toBe('Back');
  });

  it('should renumber cards sequentially when overrides are applied', () => {
    // User's example: [Front 1, Back 1, Front 2, Back 2] → override Back 1 to Front → [Front 1, Front 2, Front 3, Back 1]
    const pages: PageSettings[] = [
      { type: 'front' },
      { type: 'back' },
      { type: 'front' },
      { type: 'back' }
    ];

    // Grid with 1 card per page for simplicity
    const settings = {
      ...baseSettings,
      grid: { rows: 1, columns: 1 }
    };

    // Original numbering (no overrides)
    const original0 = getCardInfo(0, pages, settings, duplexMode, 1); // Should be Front 1
    const original1 = getCardInfo(1, pages, settings, duplexMode, 1); // Should be Back 1
    const original2 = getCardInfo(2, pages, settings, duplexMode, 1); // Should be Front 2
    const original3 = getCardInfo(3, pages, settings, duplexMode, 1); // Should be Back 2

    expect(original0).toEqual({ type: 'Front', id: 1 });
    expect(original1).toEqual({ type: 'Back', id: 1 });
    expect(original2).toEqual({ type: 'Front', id: 2 });
    expect(original3).toEqual({ type: 'Back', id: 2 });

    // Override: Change position 1 (Back 1) to Front
    const overrides: CardTypeOverride[] = [{
      pageIndex: 1, // Second page (0-indexed)
      gridRow: 0,
      gridColumn: 0,
      cardType: 'front'
    }];

    const overrideSettings = {
      ...settings,
      cardTypeOverrides: overrides
    };

    // New numbering after override
    const new0 = getCardInfo(0, pages, overrideSettings, duplexMode, 1); // Should be Front 1
    const new1 = getCardInfo(1, pages, overrideSettings, duplexMode, 1); // Should be Front 2 (was Back 1)
    const new2 = getCardInfo(2, pages, overrideSettings, duplexMode, 1); // Should be Front 3 (was Front 2)
    const new3 = getCardInfo(3, pages, overrideSettings, duplexMode, 1); // Should be Back 1 (was Back 2)

    expect(new0).toEqual({ type: 'Front', id: 1 });
    expect(new1).toEqual({ type: 'Front', id: 2 }); // Changed type and renumbered
    expect(new2).toEqual({ type: 'Front', id: 3 }); // Renumbered due to override
    expect(new3).toEqual({ type: 'Back', id: 1 }); // Renumbered due to override
  });
});