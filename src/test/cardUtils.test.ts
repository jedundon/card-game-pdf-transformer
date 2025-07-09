import { describe, it, expect } from 'vitest'
import { 
  getActivePages, 
  isCardSkipped, 
  calculateTotalCards, 
  getCardInfo
} from '../utils/cardUtils'
import { PageSettings, SkippedCard, PdfMode, ExtractionSettings } from '../types'

describe('cardUtils - Critical Card Logic Functions', () => {
  describe('getActivePages', () => {
    it('should filter out skipped pages', () => {
      const pages: PageSettings[] = [
        { skip: false },
        { skip: true },
        { skip: false },
        { skip: true },
        { skip: false }
      ]

      const result = getActivePages(pages)

      expect(result).toHaveLength(3)
      expect(result.every(page => !page.skip)).toBe(true)
    })

    it('should return all pages when none are skipped', () => {
      const pages: PageSettings[] = [
        { skip: false },
        { skip: false },
        { skip: false }
      ]

      const result = getActivePages(pages)

      expect(result).toHaveLength(3)
      expect(result).toEqual(pages)
    })

    it('should return empty array when all pages are skipped', () => {
      const pages: PageSettings[] = [
        { skip: true },
        { skip: true }
      ]

      const result = getActivePages(pages)

      expect(result).toHaveLength(0)
    })
  })

  describe('isCardSkipped', () => {
    const skippedCards: SkippedCard[] = [
      { pageIndex: 0, gridRow: 1, gridColumn: 1 },
      { pageIndex: 1, gridRow: 0, gridColumn: 2 }
    ]

    it('should return true for skipped cards', () => {
      expect(isCardSkipped(0, 1, 1, skippedCards)).toBe(true)
      expect(isCardSkipped(1, 0, 2, skippedCards)).toBe(true)
    })

    it('should return false for non-skipped cards', () => {
      expect(isCardSkipped(0, 0, 0, skippedCards)).toBe(false)
      expect(isCardSkipped(1, 1, 1, skippedCards)).toBe(false)
    })

    it('should handle empty skipped cards array', () => {
      expect(isCardSkipped(0, 0, 0, [])).toBe(false)
      expect(isCardSkipped(5, 10, 15, [])).toBe(false)
    })
  })

  describe('calculateTotalCards', () => {
    it('should calculate total cards for simplex mode', () => {
      const pdfMode: PdfMode = { type: 'simplex' }
      const activePages: PageSettings[] = [{}, {}, {}] // 3 pages
      const cardsPerPage = 9 // 3×3 grid

      const result = calculateTotalCards(pdfMode, activePages, cardsPerPage)

      // 3 pages × 9 cards per page = 27 cards
      expect(result).toBe(27)
    })

    it('should calculate total cards for duplex mode', () => {
      const pdfMode: PdfMode = { type: 'duplex', flipEdge: 'short' }
      const activePages: PageSettings[] = [
        { type: 'front' },
        { type: 'back' },
        { type: 'front' },
        { type: 'back' }
      ] // 2 front pages, 2 back pages
      const cardsPerPage = 4 // 2×2 grid

      const result = calculateTotalCards(pdfMode, activePages, cardsPerPage)

      // Duplex mode: count all pages, so 4 pages × 4 cards = 16 cards
      expect(result).toBe(16)
    })

    it('should calculate total cards for gutter-fold mode', () => {
      const pdfMode: PdfMode = { type: 'gutter-fold', orientation: 'vertical' }
      const activePages: PageSettings[] = [{}, {}] // 2 pages
      const cardsPerPage = 4 // 2×2 grid

      const result = calculateTotalCards(pdfMode, activePages, cardsPerPage)

      // Gutter-fold: 2 pages × 4 cards per page = 8 cards
      expect(result).toBe(8)
    })

    it('should handle edge case with zero pages', () => {
      const pdfMode: PdfMode = { type: 'simplex' }
      const result = calculateTotalCards(pdfMode, [], 9)
      expect(result).toBe(0)
    })

    it('should handle edge case with zero cards per page', () => {
      const pdfMode: PdfMode = { type: 'simplex' }
      const activePages: PageSettings[] = [{}, {}, {}]
      const result = calculateTotalCards(pdfMode, activePages, 0)
      expect(result).toBe(0)
    })
  })


  describe('getCardInfo', () => {
    const mockExtractionSettings: ExtractionSettings = {
      grid: { rows: 2, columns: 2 },
      crop: { top: 0, bottom: 0, left: 0, right: 0 }
    }

    it('should generate correct card info for simplex mode', () => {
      const pdfMode: PdfMode = { type: 'simplex' }
      const activePages: PageSettings[] = [{}, {}] // 2 pages
      const cardsPerPage = 4 // 2×2 grid

      const result = getCardInfo(
        1, // cardIndex
        activePages,
        mockExtractionSettings,
        pdfMode,
        cardsPerPage
      )

      // Card index 1 should be on page 0, position (0,1) in 2x2 grid
      expect(result.type).toBe('Front')
      expect(result.id).toBeGreaterThan(0)
    })

    it('should generate correct card info for duplex mode', () => {
      const pdfMode: PdfMode = { type: 'duplex', flipEdge: 'short' }
      const activePages: PageSettings[] = [
        { type: 'front' },
        { type: 'back' },
        { type: 'front' },
        { type: 'back' }
      ]
      const cardsPerPage = 4

      const frontCardResult = getCardInfo(0, activePages, mockExtractionSettings, pdfMode, cardsPerPage)
      expect(frontCardResult.type).toBe('Front')
      expect(frontCardResult.id).toBeGreaterThan(0)

      const backCardResult = getCardInfo(4, activePages, mockExtractionSettings, pdfMode, cardsPerPage)
      expect(backCardResult.type).toBe('Back')
      expect(backCardResult.id).toBeGreaterThan(0)
    })

    it('should handle invalid card indices gracefully', () => {
      const pdfMode: PdfMode = { type: 'simplex' }
      const activePages: PageSettings[] = [{}]
      const cardsPerPage = 4

      const result = getCardInfo(
        999, // Invalid large index
        activePages,
        mockExtractionSettings,
        pdfMode,
        cardsPerPage
      )

      // Should not crash, should return reasonable defaults
      expect(result.type).toBe('Unknown')
      expect(result.id).toBe(0)
    })
  })

  describe('Basic Grid Math Edge Cases', () => {
    it('should handle single card grids', () => {
      const extractionSettings: ExtractionSettings = {
        grid: { rows: 1, columns: 1 },
        crop: { top: 0, bottom: 0, left: 0, right: 0 }
      }
      const pdfMode: PdfMode = { type: 'simplex' }
      const activePages: PageSettings[] = [{}]

      const result = getCardInfo(0, activePages, extractionSettings, pdfMode, 1)

      expect(result.type).toBe('Front')
      expect(result.id).toBe(1)
    })

    it('should handle large grids correctly', () => {
      const extractionSettings: ExtractionSettings = {
        grid: { rows: 10, columns: 10 },
        crop: { top: 0, bottom: 0, left: 0, right: 0 }
      }
      const pdfMode: PdfMode = { type: 'simplex' }
      const activePages: PageSettings[] = [{}]

      // Test last card on first page (index 99 for 100-card grid)
      const result = getCardInfo(99, activePages, extractionSettings, pdfMode, 100)

      expect(result.type).toBe('Front')
      expect(result.id).toBe(100)
    })
  })
})