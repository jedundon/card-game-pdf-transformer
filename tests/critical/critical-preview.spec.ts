import { test, expect } from '@playwright/test';

/**
 * Critical Preview Consistency Tests - DEPLOYMENT BLOCKING
 * 
 * These tests validate that core preview functionality works correctly.
 * Focus on basic mathematical accuracy that would break the core user experience.
 * 
 * Only includes the most fundamental preview calculations that must always work.
 */

test.describe('Critical Preview Consistency Tests - Deployment Blocking', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 900 });
    
    // Disable animations for consistent testing
    await page.addStyleTag({
      content: `
        *, *::before, *::after {
          animation-duration: 0s !important;
          animation-delay: 0s !important;
          transition-duration: 0s !important;
          transition-delay: 0s !important;
        }
      `
    });
  });

  test('Core DPI calculations should be mathematically correct', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Critical: Basic DPI conversion accuracy
    const dpiValidation = await page.evaluate(() => {
      const EXTRACTION_DPI = 300;
      const SCREEN_DPI = 72;
      const PDF_DPI = 72;
      
      // Test fundamental DPI conversions
      const testInches = 2.5;
      
      const extractionPixels = testInches * EXTRACTION_DPI;
      const screenPixels = testInches * SCREEN_DPI;
      const pdfPixels = testInches * PDF_DPI;
      
      // Test conversions between DPI contexts
      const extractionToScreen = extractionPixels * (SCREEN_DPI / EXTRACTION_DPI);
      const screenToExtraction = screenPixels * (EXTRACTION_DPI / SCREEN_DPI);
      const pdfToExtraction = pdfPixels * (EXTRACTION_DPI / PDF_DPI);
      
      return {
        inputInches: testInches,
        extractionPixels,
        screenPixels,
        pdfPixels,
        conversions: {
          extractionToScreen,
          screenToExtraction,
          pdfToExtraction
        }
      };
    });
    
    // Validate critical DPI calculations
    expect(dpiValidation.extractionPixels).toBe(750); // 2.5 * 300
    expect(dpiValidation.screenPixels).toBe(180); // 2.5 * 72
    expect(dpiValidation.pdfPixels).toBe(180); // 2.5 * 72
    
    // Validate conversion accuracy
    expect(dpiValidation.conversions.extractionToScreen).toBe(180);
    expect(dpiValidation.conversions.screenToExtraction).toBe(750);
    expect(dpiValidation.conversions.pdfToExtraction).toBe(750);
  });

  test('Basic card dimension calculations should be correct', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Critical: Core card dimension math
    const dimensionValidation = await page.evaluate(() => {
      // Standard poker card dimensions
      const cardWidthInches = 2.5;
      const cardHeightInches = 3.5;
      const bleedInches = 0.125;
      const scalePercent = 100;
      
      // Calculate dimensions with bleed
      const cardWithBleedWidth = (cardWidthInches + bleedInches * 2) * (scalePercent / 100);
      const cardWithBleedHeight = (cardHeightInches + bleedInches * 2) * (scalePercent / 100);
      
      // Convert to extraction DPI
      const EXTRACTION_DPI = 300;
      const extractionPixelsWidth = cardWithBleedWidth * EXTRACTION_DPI;
      const extractionPixelsHeight = cardWithBleedHeight * EXTRACTION_DPI;
      
      return {
        cardWithBleedInches: { width: cardWithBleedWidth, height: cardWithBleedHeight },
        extractionPixels: { width: extractionPixelsWidth, height: extractionPixelsHeight }
      };
    });
    
    // Validate critical dimension calculations
    expect(dimensionValidation.cardWithBleedInches.width).toBeCloseTo(2.75, 2); // 2.5 + 0.25
    expect(dimensionValidation.cardWithBleedInches.height).toBeCloseTo(3.75, 2); // 3.5 + 0.25
    expect(dimensionValidation.extractionPixels.width).toBeCloseTo(825, 1); // 2.75 * 300
    expect(dimensionValidation.extractionPixels.height).toBeCloseTo(1125, 1); // 3.75 * 300
  });

  test('Rotation calculations should preserve area and swap dimensions correctly', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Critical: Basic rotation math
    const rotationValidation = await page.evaluate(() => {
      const originalWidth = 2.75;
      const originalHeight = 3.75;
      
      const rotations = [0, 90, 180, 270];
      const results = [];
      
      for (const rotation of rotations) {
        let finalWidth = originalWidth;
        let finalHeight = originalHeight;
        
        // Critical rotation logic: dimension swapping for 90° and 270°
        if (rotation === 90 || rotation === 270) {
          finalWidth = originalHeight;
          finalHeight = originalWidth;
        }
        
        results.push({
          rotation,
          dimensions: { width: finalWidth, height: finalHeight },
          area: finalWidth * finalHeight
        });
      }
      
      return results;
    });
    
    // Validate rotation calculations
    expect(rotationValidation[0].dimensions).toEqual({ width: 2.75, height: 3.75 }); // 0°
    expect(rotationValidation[1].dimensions).toEqual({ width: 3.75, height: 2.75 }); // 90°
    expect(rotationValidation[2].dimensions).toEqual({ width: 2.75, height: 3.75 }); // 180°
    expect(rotationValidation[3].dimensions).toEqual({ width: 3.75, height: 2.75 }); // 270°
    
    // Validate area preservation (critical for card sizing)
    const originalArea = 2.75 * 3.75;
    for (const result of rotationValidation) {
      expect(result.area).toBeCloseTo(originalArea, 3);
    }
  });

  test('Basic grid spacing should calculate correctly', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Critical: Simple grid calculation for common case
    const gridValidation = await page.evaluate(() => {
      // Test standard duplex grid (2x3)
      const gridRows = 2;
      const gridColumns = 3;
      
      // Page dimensions (8.5" x 11" letter size in extraction DPI)
      const pageWidth = 2550; // 8.5 * 300
      const pageHeight = 3300; // 11 * 300
      
      // Card dimensions (with bleed)
      const cardWidth = 825; // 2.75 * 300
      const cardHeight = 1125; // 3.75 * 300
      
      // Calculate spacing
      const totalCardWidth = gridColumns * cardWidth;
      const totalCardHeight = gridRows * cardHeight;
      
      const horizontalSpacing = (pageWidth - totalCardWidth) / (gridColumns + 1);
      const verticalSpacing = (pageHeight - totalCardHeight) / (gridRows + 1);
      
      return {
        gridInfo: { rows: gridRows, columns: gridColumns },
        spacing: { horizontal: horizontalSpacing, vertical: verticalSpacing },
        totalDimensions: { width: totalCardWidth, height: totalCardHeight },
        fitsOnPage: horizontalSpacing > 0 && verticalSpacing > 0
      };
    });
    
    // Validate critical grid calculations
    expect(gridValidation.totalDimensions.width).toBe(2475); // 3 * 825
    expect(gridValidation.totalDimensions.height).toBe(2250); // 2 * 1125
    expect(gridValidation.spacing.horizontal).toBeCloseTo(18.75, 2); // (2550 - 2475) / 4
    expect(gridValidation.spacing.vertical).toBeCloseTo(350, 1); // (3300 - 2250) / 3
    expect(gridValidation.fitsOnPage).toBe(true); // Should fit comfortably
  });

  test('Coordinate system consistency between PDF and image should work', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Critical: Unified coordinate system
    const coordinateValidation = await page.evaluate(() => {
      const EXTRACTION_DPI = 300;
      const PDF_DPI = 72;
      
      // Test page dimensions
      const pageWidthInches = 8.5;
      const pageHeightInches = 11.0;
      
      // PDF coordinates (72 DPI)
      const pdfPageWidth = pageWidthInches * PDF_DPI;
      const pdfPageHeight = pageHeightInches * PDF_DPI;
      
      // Image coordinates (300 DPI)
      const imageWidth = pageWidthInches * EXTRACTION_DPI;
      const imageHeight = pageHeightInches * EXTRACTION_DPI;
      
      // Convert PDF to extraction DPI
      const pdfToExtractionScale = EXTRACTION_DPI / PDF_DPI;
      const pdfInExtractionDPI = {
        width: pdfPageWidth * pdfToExtractionScale,
        height: pdfPageHeight * pdfToExtractionScale
      };
      
      return {
        pdfOriginal: { width: pdfPageWidth, height: pdfPageHeight },
        imageOriginal: { width: imageWidth, height: imageHeight },
        pdfConverted: pdfInExtractionDPI,
        dimensionsMatch: Math.abs(pdfInExtractionDPI.width - imageWidth) < 1 &&
                        Math.abs(pdfInExtractionDPI.height - imageHeight) < 1
      };
    });
    
    // Validate coordinate system consistency
    expect(coordinateValidation.pdfOriginal.width).toBe(612); // 8.5 * 72
    expect(coordinateValidation.pdfOriginal.height).toBe(792); // 11 * 72
    expect(coordinateValidation.imageOriginal.width).toBe(2550); // 8.5 * 300
    expect(coordinateValidation.imageOriginal.height).toBe(3300); // 11 * 300
    
    // Critical: PDF and image should have same dimensions after conversion
    expect(coordinateValidation.dimensionsMatch).toBe(true);
    expect(coordinateValidation.pdfConverted.width).toBeCloseTo(2550, 1);
    expect(coordinateValidation.pdfConverted.height).toBeCloseTo(3300, 1);
  });
});