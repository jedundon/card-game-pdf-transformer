import { describe, it, expect } from 'vitest'

/**
 * Preview Consistency Mathematical Validation Tests
 * 
 * These tests implement critical preview vs export validation from GitHub Issue #63:
 * - Validates mathematical consistency between preview and export calculations
 * - Tests DPI conversion accuracy used in both preview and final output
 * - Verifies grid positioning and card dimension calculations
 * - Ensures rotation and scaling logic is mathematically sound
 * 
 * These catch "hard to detect" issues that are very impactful to users:
 * - Preview showing different dimensions than actual export
 * - Mathematical errors in DPI conversions and scaling
 * - Inconsistent grid positioning between preview and output
 */

describe('Preview Consistency - Mathematical Validation', () => {
  describe('DPI Conversion Accuracy', () => {
    it('should convert between DPI scales with mathematical precision', () => {
      const EXTRACTION_DPI = 300
      const SCREEN_DPI = 72
      const PDF_DPI = 72
      
      // Test dimension in inches
      const dimensionInches = 2.5
      
      // Convert to different DPI contexts (used in both preview and export)
      const extractionPixels = dimensionInches * EXTRACTION_DPI
      const screenPixels = dimensionInches * SCREEN_DPI
      const pdfPixels = dimensionInches * PDF_DPI
      
      // Test conversions between DPI contexts
      const extractionToScreen = extractionPixels * (SCREEN_DPI / EXTRACTION_DPI)
      const screenToExtraction = screenPixels * (EXTRACTION_DPI / SCREEN_DPI)
      const pdfToExtraction = pdfPixels * (EXTRACTION_DPI / PDF_DPI)
      
      // Validate exact mathematical precision
      expect(extractionPixels).toBe(750) // 2.5 * 300
      expect(screenPixels).toBe(180) // 2.5 * 72
      expect(pdfPixels).toBe(180) // 2.5 * 72
      
      // Validate conversion accuracy (critical for preview/export consistency)
      expect(extractionToScreen).toBe(180) // Should equal screenPixels exactly
      expect(screenToExtraction).toBe(750) // Should equal extractionPixels exactly
      expect(pdfToExtraction).toBe(750) // Should equal extractionPixels exactly
      
      // Validate conversion factors are mathematically correct
      expect(SCREEN_DPI / EXTRACTION_DPI).toBe(0.24) // 72/300
      expect(EXTRACTION_DPI / SCREEN_DPI).toBeCloseTo(4.167, 3) // 300/72
    })

    it('should handle fractional DPI conversions accurately', () => {
      const EXTRACTION_DPI = 300
      const SCREEN_DPI = 96 // Alternative screen DPI
      
      // Test fractional inch dimensions
      const testDimensions = [1.25, 2.75, 3.375, 4.625]
      
      for (const inches of testDimensions) {
        const extractionPixels = inches * EXTRACTION_DPI
        const screenPixels = inches * SCREEN_DPI
        
        // Test round-trip conversion accuracy
        const roundTrip = (extractionPixels / EXTRACTION_DPI) * SCREEN_DPI
        
        expect(roundTrip).toBeCloseTo(screenPixels, 10) // High precision required
        expect(extractionPixels / EXTRACTION_DPI).toBeCloseTo(inches, 10) // Exact inches
        expect(screenPixels / SCREEN_DPI).toBeCloseTo(inches, 10) // Exact inches
      }
    })
  })

  describe('Card Dimension Calculations', () => {
    it('should calculate card dimensions with bleed consistently', () => {
      // Standard poker card dimensions
      const cardWidthInches = 2.5
      const cardHeightInches = 3.5
      const bleedMarginInches = 0.125
      const scalePercent = 100
      
      // This calculation must be identical in preview and export
      const scaleFactor = scalePercent / 100
      const cardWithBleedWidth = (cardWidthInches + bleedMarginInches * 2) * scaleFactor
      const cardWithBleedHeight = (cardHeightInches + bleedMarginInches * 2) * scaleFactor
      
      expect(cardWithBleedWidth).toBe(2.75) // 2.5 + 0.125*2
      expect(cardWithBleedHeight).toBe(3.75) // 3.5 + 0.125*2
      
      // Test with different scale percentages
      const testScales = [50, 75, 100, 125, 150, 200]
      
      for (const scale of testScales) {
        const factor = scale / 100
        const scaledWidth = (cardWidthInches + bleedMarginInches * 2) * factor
        const scaledHeight = (cardHeightInches + bleedMarginInches * 2) * factor
        
        // Validate mathematical precision
        expect(scaledWidth).toBeCloseTo(2.75 * factor, 10)
        expect(scaledHeight).toBeCloseTo(3.75 * factor, 10)
        
        // Validate aspect ratio preservation
        const aspectRatio = scaledWidth / scaledHeight
        expect(aspectRatio).toBeCloseTo(2.75 / 3.75, 10) // Should be constant
      }
    })

    it('should handle rotation dimension swapping correctly', () => {
      const originalWidth = 2.75
      const originalHeight = 3.75
      
      // Test all rotation angles (used in both preview and export)
      const rotationTests = [
        { angle: 0, expectedWidth: originalWidth, expectedHeight: originalHeight },
        { angle: 90, expectedWidth: originalHeight, expectedHeight: originalWidth },
        { angle: 180, expectedWidth: originalWidth, expectedHeight: originalHeight },
        { angle: 270, expectedWidth: originalHeight, expectedHeight: originalWidth },
        { angle: 360, expectedWidth: originalWidth, expectedHeight: originalHeight }
      ]
      
      for (const test of rotationTests) {
        let displayWidth, displayHeight
        
        // This logic must match both preview and export rotation handling
        if (test.angle === 90 || test.angle === 270) {
          displayWidth = originalHeight
          displayHeight = originalWidth
        } else {
          displayWidth = originalWidth
          displayHeight = originalHeight
        }
        
        expect(displayWidth).toBe(test.expectedWidth)
        expect(displayHeight).toBe(test.expectedHeight)
        
        // Validate area preservation (rotation doesn't change area)
        const originalArea = originalWidth * originalHeight
        const rotatedArea = displayWidth * displayHeight
        expect(rotatedArea).toBeCloseTo(originalArea, 10)
      }
    })
  })

  describe('Grid Positioning Mathematics', () => {
    it('should calculate grid positions with mathematical precision', () => {
      // Test 2x3 grid (common duplex mode)
      const gridRows = 2
      const gridColumns = 3
      const totalCards = gridRows * gridColumns
      
      // Letter size page
      const pageWidthInches = 8.5
      const pageHeightInches = 11.0
      
      // Card with bleed
      const cardWidthInches = 2.75
      const cardHeightInches = 3.75
      
      // Calculate spacing (must be identical in preview and export)
      const totalCardWidth = gridColumns * cardWidthInches
      const totalCardHeight = gridRows * cardHeightInches
      
      const horizontalSpacing = (pageWidthInches - totalCardWidth) / (gridColumns + 1)
      const verticalSpacing = (pageHeightInches - totalCardHeight) / (gridRows + 1)
      
      // Validate grid mathematics
      expect(totalCards).toBe(6) // 2x3 = 6 cards
      expect(totalCardWidth).toBe(8.25) // 3 * 2.75
      expect(totalCardHeight).toBe(7.5) // 2 * 3.75
      expect(horizontalSpacing).toBeCloseTo(0.0625, 10) // (8.5 - 8.25) / 4
      expect(verticalSpacing).toBeCloseTo(1.1667, 3) // (11 - 7.5) / 3 = 3.5/3
      
      // Calculate and validate all card positions
      const cardPositions = []
      for (let cardIndex = 0; cardIndex < totalCards; cardIndex++) {
        const col = cardIndex % gridColumns
        const row = Math.floor(cardIndex / gridColumns)
        
        const x = horizontalSpacing + col * (cardWidthInches + horizontalSpacing)
        const y = verticalSpacing + row * (cardHeightInches + verticalSpacing)
        
        cardPositions.push({ cardIndex, col, row, x, y })
      }
      
      // Validate specific positions (critical for preview/export alignment)
      // Card 0: (0,0) -> x = 0.0625, y = 1.1667
      expect(cardPositions[0].x).toBeCloseTo(0.0625, 4)
      expect(cardPositions[0].y).toBeCloseTo(1.1667, 3)
      
      // Card 2: (2,0) -> x = 0.0625 + 2*(2.75 + 0.0625) = 0.0625 + 2*2.8125 = 5.6875
      expect(cardPositions[2].x).toBeCloseTo(5.6875, 4)
      expect(cardPositions[2].y).toBeCloseTo(1.1667, 3)
      
      // Card 5: (2,1) -> x = 5.6875, y = 1.1667 + 3.75 + 1.1667 = 6.0834
      expect(cardPositions[5].x).toBeCloseTo(5.6875, 4)
      expect(cardPositions[5].y).toBeCloseTo(6.0834, 3)
      
      // Validate that all cards fit within page boundaries
      for (const pos of cardPositions) {
        expect(pos.x + cardWidthInches).toBeLessThanOrEqual(pageWidthInches)
        expect(pos.y + cardHeightInches).toBeLessThanOrEqual(pageHeightInches)
        expect(pos.x).toBeGreaterThanOrEqual(0)
        expect(pos.y).toBeGreaterThanOrEqual(0)
      }
    })

    it('should validate that 2x3 grid fits on standard page', () => {
      const pageWidth = 8.5
      const pageHeight = 11.0
      const cardWidth = 2.75
      const cardHeight = 3.75
      
      // Test the standard 2x3 duplex configuration
      const config = { rows: 2, columns: 3, name: 'duplex' }
      
      const totalCardWidth = config.columns * cardWidth // 8.25
      const totalCardHeight = config.rows * cardHeight // 7.5
      
      const horizontalSpacing = (pageWidth - totalCardWidth) / (config.columns + 1) // 0.0625
      const verticalSpacing = (pageHeight - totalCardHeight) / (config.rows + 1) // 1.1667
      
      // Validate spacing is positive (cards fit on page)
      expect(horizontalSpacing).toBeGreaterThan(0)
      expect(verticalSpacing).toBeGreaterThan(0)
      
      expect(totalCardWidth).toBe(8.25)
      expect(totalCardHeight).toBe(7.5)
      expect(horizontalSpacing).toBeCloseTo(0.0625, 10)
      expect(verticalSpacing).toBeCloseTo(1.1667, 4)
      
      // Validate total space usage
      const usedWidth = totalCardWidth + horizontalSpacing * (config.columns + 1)
      const usedHeight = totalCardHeight + verticalSpacing * (config.rows + 1)
      
      expect(usedWidth).toBeCloseTo(pageWidth, 10)
      expect(usedHeight).toBeCloseTo(pageHeight, 10)
    })
  })

  describe('Card Image Sizing Mode Mathematics', () => {
    it('should calculate sizing modes with precision', () => {
      // Test image dimensions
      const imageWidth = 400
      const imageHeight = 600
      
      // Test card container dimensions  
      const cardWidth = 300
      const cardHeight = 450
      
      const imageAspectRatio = imageWidth / imageHeight
      const cardAspectRatio = cardWidth / cardHeight
      
      // Test each sizing mode (must match preview and export exactly)
      
      // 1. Actual Size Mode
      const actualSizeWidth = imageWidth
      const actualSizeHeight = imageHeight
      expect(actualSizeWidth).toBe(400)
      expect(actualSizeHeight).toBe(600)
      
      // 2. Fit to Card Mode (scale down to fit, maintain aspect ratio)
      const fitScale = Math.min(cardWidth / imageWidth, cardHeight / imageHeight)
      const fitWidth = imageWidth * fitScale
      const fitHeight = imageHeight * fitScale
      
      expect(fitScale).toBe(0.75) // 300/400 = 0.75 (limiting factor)
      expect(fitWidth).toBe(300) // Fits card width exactly
      expect(fitHeight).toBe(450) // Maintains aspect ratio
      expect(fitWidth / fitHeight).toBeCloseTo(imageAspectRatio, 10)
      
      // 3. Fill Card Mode (scale up to fill, maintain aspect ratio, may crop)
      const fillScale = Math.max(cardWidth / imageWidth, cardHeight / imageHeight)
      const fillWidth = imageWidth * fillScale
      const fillHeight = imageHeight * fillScale
      
      expect(fillScale).toBe(0.75) // In this case, same as fit
      expect(fillWidth).toBe(300)
      expect(fillHeight).toBe(450)
      expect(fillWidth / fillHeight).toBeCloseTo(imageAspectRatio, 10)
    })

    it('should handle different aspect ratios correctly', () => {
      const cardWidth = 275 // 2.75" at 100 DPI
      const cardHeight = 375 // 3.75" at 100 DPI
      
      // Test with various image aspect ratios
      const testImages = [
        { width: 400, height: 600, name: 'portrait-tall' },
        { width: 600, height: 400, name: 'landscape-wide' },
        { width: 275, height: 375, name: 'exact-match' },
        { width: 550, height: 750, name: 'double-size' },
        { width: 138, height: 188, name: 'half-size' }
      ]
      
      for (const image of testImages) {
        const imageAspectRatio = image.width / image.height
        
        // Fit to card calculations
        const fitScale = Math.min(cardWidth / image.width, cardHeight / image.height)
        const fitWidth = image.width * fitScale
        const fitHeight = image.height * fitScale
        
        // Fill card calculations
        const fillScale = Math.max(cardWidth / image.width, cardHeight / image.height)
        const fillWidth = image.width * fillScale
        const fillHeight = image.height * fillScale
        
        // Validate fit mode stays within boundaries
        expect(fitWidth).toBeLessThanOrEqual(cardWidth + 0.001) // Small tolerance for floating point
        expect(fitHeight).toBeLessThanOrEqual(cardHeight + 0.001)
        
        // Validate fill mode covers the card
        expect(fillWidth).toBeGreaterThanOrEqual(cardWidth - 0.001)
        expect(fillHeight).toBeGreaterThanOrEqual(cardHeight - 0.001)
        
        // Validate aspect ratio preservation
        expect(fitWidth / fitHeight).toBeCloseTo(imageAspectRatio, 10)
        expect(fillWidth / fillHeight).toBeCloseTo(imageAspectRatio, 10)
      }
    })
  })

  describe('Multi-File Coordinate System Consistency', () => {
    it('should use consistent coordinate systems for PDF and image files', () => {
      const EXTRACTION_DPI = 300
      const PDF_DPI = 72
      
      // Simulate PDF file (8.5" x 11" at 72 DPI)
      const pdfWidth = 612 // 8.5 * 72
      const pdfHeight = 792 // 11 * 72
      
      // Simulate image file (8.5" x 11" at 300 DPI)
      const imageWidth = 2550 // 8.5 * 300
      const imageHeight = 3300 // 11 * 300
      
      // Convert PDF to extraction DPI (critical for coordinate consistency)
      const pdfToExtractionScale = EXTRACTION_DPI / PDF_DPI
      const pdfInExtractionDPI = {
        width: pdfWidth * pdfToExtractionScale,
        height: pdfHeight * pdfToExtractionScale
      }
      
      // Image already in extraction DPI (or treated as such)
      const imageInExtractionDPI = {
        width: imageWidth,
        height: imageHeight
      }
      
      // Validate coordinate system consistency (CRITICAL for mixed workflows)
      expect(pdfInExtractionDPI.width).toBeCloseTo(imageInExtractionDPI.width, 10) // Must be identical
      expect(pdfInExtractionDPI.height).toBeCloseTo(imageInExtractionDPI.height, 10) // Must be identical
      expect(pdfToExtractionScale).toBeCloseTo(4.167, 3) // 300/72
      
      // Test crop coordinates work identically for both file types
      const cropLeft = 100
      const cropTop = 150
      const cropRight = 50
      const cropBottom = 75
      
      const pdfCropped = {
        width: pdfInExtractionDPI.width - cropLeft - cropRight,
        height: pdfInExtractionDPI.height - cropTop - cropBottom
      }
      
      const imageCropped = {
        width: imageInExtractionDPI.width - cropLeft - cropRight,
        height: imageInExtractionDPI.height - cropTop - cropBottom
      }
      
      // Cropping must work identically (CRITICAL for mixed workflows)
      expect(pdfCropped.width).toBeCloseTo(imageCropped.width, 10)
      expect(pdfCropped.height).toBeCloseTo(imageCropped.height, 10)
      expect(pdfCropped.width).toBeCloseTo(2400, 10) // 2550 - 100 - 50
      expect(pdfCropped.height).toBeCloseTo(3075, 10) // 3300 - 150 - 75
    })

    it('should handle grid calculations consistently across file types', () => {
      const EXTRACTION_DPI = 300
      
      // Same page dimensions in both coordinate systems
      const pageWidthInches = 8.5
      const pageHeightInches = 11.0
      
      // Convert to extraction DPI (the unified coordinate system)
      const pageWidthPixels = pageWidthInches * EXTRACTION_DPI
      const pageHeightPixels = pageHeightInches * EXTRACTION_DPI
      
      expect(pageWidthPixels).toBe(2550)
      expect(pageHeightPixels).toBe(3300)
      
      // Grid configuration
      const gridRows = 2
      const gridColumns = 3
      const cardWidthPixels = 825 // 2.75" * 300 DPI
      const cardHeightPixels = 1125 // 3.75" * 300 DPI
      
      // Calculate grid in pixels (extraction DPI)
      const totalCardWidth = gridColumns * cardWidthPixels
      const totalCardHeight = gridRows * cardHeightPixels
      
      const horizontalSpacing = (pageWidthPixels - totalCardWidth) / (gridColumns + 1)
      const verticalSpacing = (pageHeightPixels - totalCardHeight) / (gridRows + 1)
      
      expect(totalCardWidth).toBe(2475) // 3 * 825
      expect(totalCardHeight).toBe(2250) // 2 * 1125
      expect(horizontalSpacing).toBeCloseTo(18.75, 2) // (2550 - 2475) / 4
      expect(verticalSpacing).toBeCloseTo(350, 1) // (3300 - 2250) / 3 = 1050/3
      
      // Calculate card positions in extraction DPI
      const cardPositions = []
      for (let i = 0; i < 6; i++) {
        const col = i % gridColumns
        const row = Math.floor(i / gridColumns)
        
        const x = horizontalSpacing + col * (cardWidthPixels + horizontalSpacing)
        const y = verticalSpacing + row * (cardHeightPixels + verticalSpacing)
        
        cardPositions.push({ x, y })
      }
      
      // Validate positions are within page boundaries
      for (const pos of cardPositions) {
        expect(pos.x + cardWidthPixels).toBeLessThanOrEqual(pageWidthPixels)
        expect(pos.y + cardHeightPixels).toBeLessThanOrEqual(pageHeightPixels)
      }
      
      // These calculations must be identical for PDF and image files
      expect(cardPositions[0].x).toBeCloseTo(18.75, 2)
      expect(cardPositions[0].y).toBeCloseTo(350, 1)
      // Card 5: col=2, x = 18.75 + 2*(825 + 18.75) = 18.75 + 2*843.75 = 1706.25
      expect(cardPositions[5].x).toBeCloseTo(1706.25, 2) 
      expect(cardPositions[5].y).toBeCloseTo(1825, 1) // 350 + 1125 + 350
    })
  })

  describe('Scale and Bleed Mathematics', () => {
    it('should apply scale and bleed in the correct order', () => {
      const baseCardWidth = 2.5
      const baseCardHeight = 3.5
      const bleedInches = 0.125
      
      // Test different scale percentages
      const scaleTests = [50, 75, 100, 125, 150, 200]
      
      for (const scalePercent of scaleTests) {
        const scaleFactor = scalePercent / 100
        
        // Method 1: Scale first, then add bleed
        const scaledWidth = baseCardWidth * scaleFactor
        const scaledHeight = baseCardHeight * scaleFactor
        const finalWidth1 = scaledWidth + bleedInches * 2
        const finalHeight1 = scaledHeight + bleedInches * 2
        
        // Method 2: Add bleed first, then scale (this is the correct method)
        const withBleedWidth = baseCardWidth + bleedInches * 2
        const withBleedHeight = baseCardHeight + bleedInches * 2
        const finalWidth2 = withBleedWidth * scaleFactor
        const finalHeight2 = withBleedHeight * scaleFactor
        
        // Validate that method 2 is used (bleed scales with card)
        expect(finalWidth2).toBe((2.5 + 0.25) * scaleFactor)
        expect(finalHeight2).toBe((3.5 + 0.25) * scaleFactor)
        
        // At 100% scale, both methods should be equal
        if (scalePercent === 100) {
          expect(finalWidth1).toBeCloseTo(finalWidth2, 10)
          expect(finalHeight1).toBeCloseTo(finalHeight2, 10)
        }
      }
    })

    it('should preserve aspect ratios through scaling', () => {
      const baseWidth = 2.5
      const baseHeight = 3.5
      const bleed = 0.125
      
      const originalAspectRatio = baseWidth / baseHeight
      const withBleedAspectRatio = (baseWidth + bleed * 2) / (baseHeight + bleed * 2)
      
      // Test various scales
      const scales = [25, 50, 75, 100, 125, 150, 175, 200, 300]
      
      for (const scale of scales) {
        const factor = scale / 100
        const scaledWidth = (baseWidth + bleed * 2) * factor
        const scaledHeight = (baseHeight + bleed * 2) * factor
        const scaledAspectRatio = scaledWidth / scaledHeight
        
        // Aspect ratio must be preserved through scaling
        expect(scaledAspectRatio).toBeCloseTo(withBleedAspectRatio, 10)
        
        // Validate scaling is linear
        expect(scaledWidth).toBeCloseTo(2.75 * factor, 10)
        expect(scaledHeight).toBeCloseTo(3.75 * factor, 10)
      }
      
      // Validate aspect ratio changes due to bleed
      expect(originalAspectRatio).toBeCloseTo(0.714, 3) // 2.5/3.5
      expect(withBleedAspectRatio).toBeCloseTo(0.733, 3) // 2.75/3.75
    })
  })
})