import { describe, it, expect } from 'vitest';
import { 
  toggleCardTypeOverride,
  setCardTypeOverride,
  removeCardTypeOverride,
  getCardTypeOverride,
  clearAllCardTypeOverrides,
  getCardTypeOverrideStatus
} from '../utils/card/cardOverrides';
import type { CardTypeOverride } from '../types';

describe('Card Type Override Utilities', () => {
  describe('toggleCardTypeOverride', () => {
    it('should add front override for new card position', () => {
      const overrides: CardTypeOverride[] = [];
      const result = toggleCardTypeOverride(0, 1, 2, overrides);
      
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        pageIndex: 0,
        gridRow: 1,
        gridColumn: 2,
        cardType: 'front'
      });
    });

    it('should cycle from front to back to none', () => {
      let overrides: CardTypeOverride[] = [];
      
      // Add front
      overrides = toggleCardTypeOverride(0, 1, 2, overrides);
      expect(overrides[0].cardType).toBe('front');
      
      // Change to back
      overrides = toggleCardTypeOverride(0, 1, 2, overrides);
      expect(overrides[0].cardType).toBe('back');
      
      // Remove override
      overrides = toggleCardTypeOverride(0, 1, 2, overrides);
      expect(overrides).toHaveLength(0);
    });
  });

  describe('setCardTypeOverride', () => {
    it('should add new override for specified type', () => {
      const overrides: CardTypeOverride[] = [];
      const result = setCardTypeOverride(0, 1, 2, 'back', overrides);
      
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        pageIndex: 0,
        gridRow: 1,
        gridColumn: 2,
        cardType: 'back'
      });
    });

    it('should update existing override', () => {
      const overrides: CardTypeOverride[] = [{
        pageIndex: 0,
        gridRow: 1,
        gridColumn: 2,
        cardType: 'front'
      }];
      
      const result = setCardTypeOverride(0, 1, 2, 'back', overrides);
      
      expect(result).toHaveLength(1);
      expect(result[0].cardType).toBe('back');
    });
  });

  describe('getCardTypeOverride', () => {
    it('should find existing override', () => {
      const overrides: CardTypeOverride[] = [{
        pageIndex: 0,
        gridRow: 1,
        gridColumn: 2,
        cardType: 'front'
      }];
      
      const result = getCardTypeOverride(0, 1, 2, overrides);
      expect(result).toEqual(overrides[0]);
    });

    it('should return undefined for non-existent override', () => {
      const overrides: CardTypeOverride[] = [];
      const result = getCardTypeOverride(0, 1, 2, overrides);
      expect(result).toBeUndefined();
    });
  });

  describe('getCardTypeOverrideStatus', () => {
    it('should return correct status for override', () => {
      const overrides: CardTypeOverride[] = [{
        pageIndex: 0,
        gridRow: 1,
        gridColumn: 2,
        cardType: 'back'
      }];
      
      const result = getCardTypeOverrideStatus(0, 1, 2, overrides);
      expect(result).toEqual({
        hasOverride: true,
        overrideType: 'back'
      });
    });

    it('should return correct status for no override', () => {
      const overrides: CardTypeOverride[] = [];
      const result = getCardTypeOverrideStatus(0, 1, 2, overrides);
      expect(result).toEqual({
        hasOverride: false,
        overrideType: undefined
      });
    });
  });

  describe('removeCardTypeOverride', () => {
    it('should remove specific override', () => {
      const overrides: CardTypeOverride[] = [
        { pageIndex: 0, gridRow: 1, gridColumn: 2, cardType: 'front' },
        { pageIndex: 1, gridRow: 0, gridColumn: 1, cardType: 'back' }
      ];
      
      const result = removeCardTypeOverride(0, 1, 2, overrides);
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(overrides[1]);
    });
  });

  describe('clearAllCardTypeOverrides', () => {
    it('should return empty array', () => {
      const result = clearAllCardTypeOverrides();
      expect(result).toEqual([]);
    });
  });
});