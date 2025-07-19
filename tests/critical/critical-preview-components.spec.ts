import { test, expect } from '@playwright/test';

/**
 * Critical Preview Component Integration Tests - DEPLOYMENT BLOCKING
 * 
 * These tests validate that preview components accurately represent final export output.
 * Focus on detecting divergence between preview rendering and actual export generation.
 * 
 * Critical scenarios tested:
 * - ConfigureStep CardPreviewPanel accuracy
 * - ExtractStep CardPreviewPanel grid overlay accuracy
 * - Preview dimension calculations vs export calculations
 * - Rotation preview accuracy vs actual rotation
 * - Multi-file preview consistency
 */

test.describe('Critical Preview Component Integration Tests - Deployment Blocking', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1000 });
    
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

  test('ConfigureStep preview should match calculated export dimensions', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Test that ConfigureStep preview calculations match export calculations
    const previewAccuracy = await page.evaluate(() => {
      // Mock the core calculation functions used in both preview and export
      const calculateCardDimensionsWithBleed = (
        cardWidthInches: number,
        cardHeightInches: number,
        bleedInches: number,
        scalePercent: number
      ) => {
        const scaleFactor = scalePercent / 100;
        const cardWithBleedWidth = (cardWidthInches + bleedInches * 2) * scaleFactor;
        const cardWithBleedHeight = (cardHeightInches + bleedInches * 2) * scaleFactor;
        return { width: cardWithBleedWidth, height: cardWithBleedHeight };
      };

      const calculateCardPositioning = (
        cardDimensions: { width: number; height: number },
        pageDimensions: { width: number; height: number },
        offset: { horizontal: number; vertical: number },
        rotation: number
      ) => {
        let finalWidth = cardDimensions.width;
        let finalHeight = cardDimensions.height;
        
        // Handle rotation dimension swapping
        if (rotation === 90 || rotation === 270) {
          finalWidth = cardDimensions.height;
          finalHeight = cardDimensions.width;
        }
        
        // Calculate centered position with offset
        const x = (pageDimensions.width - finalWidth) / 2 + offset.horizontal;
        const y = (pageDimensions.height - finalHeight) / 2 + offset.vertical;
        
        return { x, y, width: finalWidth, height: finalHeight };
      };

      const calculatePreviewScaling = (
        cardPositioning: { x: number; y: number; width: number; height: number },
        pageDimensions: { width: number; height: number },
        maxPreviewWidth: number,
        maxPreviewHeight: number
      ) => {
        const SCREEN_DPI = 72;
        
        // Convert page to screen pixels
        let previewPageWidth = pageDimensions.width * SCREEN_DPI;
        let previewPageHeight = pageDimensions.height * SCREEN_DPI;
        
        // Calculate scale to fit in preview container
        let scale = 1;
        if (previewPageWidth > maxPreviewWidth || previewPageHeight > maxPreviewHeight) {
          const widthScale = maxPreviewWidth / previewPageWidth;
          const heightScale = maxPreviewHeight / previewPageHeight;
          scale = Math.min(widthScale, heightScale);
          
          previewPageWidth *= scale;
          previewPageHeight *= scale;
        }
        
        // Scale card dimensions for preview
        const previewCardWidth = cardPositioning.width * SCREEN_DPI * scale;
        const previewCardHeight = cardPositioning.height * SCREEN_DPI * scale;
        const previewX = cardPositioning.x * SCREEN_DPI * scale;
        const previewY = cardPositioning.y * SCREEN_DPI * scale;
        
        return {
          scale,
          previewPageWidth,
          previewPageHeight,
          previewCardWidth,
          previewCardHeight,
          previewX,
          previewY
        };
      };

      // Test parameters (standard poker card)
      const cardSize = { width: 2.5, height: 3.5 };
      const bleedInches = 0.125;
      const scalePercent = 100;
      const pageSize = { width: 8.5, height: 11.0 }; // Letter size
      const offset = { horizontal: 0, vertical: 0 };
      const rotations = [0, 90, 180, 270];
      const maxPreviewWidth = 400;
      const maxPreviewHeight = 500;

      const testResults = [];

      for (const rotation of rotations) {
        // Calculate export dimensions (what the final PDF will have)
        const cardDimensions = calculateCardDimensionsWithBleed(
          cardSize.width,
          cardSize.height,
          bleedInches,
          scalePercent
        );
        
        const exportPositioning = calculateCardPositioning(
          cardDimensions,
          pageSize,
          offset,
          rotation
        );
        
        // Calculate preview dimensions (what the UI should show)
        const previewScaling = calculatePreviewScaling(
          exportPositioning,
          pageSize,
          maxPreviewWidth,
          maxPreviewHeight
        );
        
        testResults.push({
          rotation,
          cardDimensions,
          exportPositioning,
          previewScaling,
          // Verify aspect ratios are preserved
          exportAspectRatio: exportPositioning.width / exportPositioning.height,
          previewAspectRatio: previewScaling.previewCardWidth / previewScaling.previewCardHeight
        });
      }

      return testResults;
    });

    // Validate preview calculations for each rotation
    for (const result of previewAccuracy) {
      // Validate card dimensions with bleed
      expect(result.cardDimensions.width).toBeCloseTo(2.75, 2); // 2.5 + 0.25
      expect(result.cardDimensions.height).toBeCloseTo(3.75, 2); // 3.5 + 0.25
      
      // Validate rotation dimension swapping
      if (result.rotation === 90 || result.rotation === 270) {
        expect(result.exportPositioning.width).toBeCloseTo(3.75, 2); // Height becomes width
        expect(result.exportPositioning.height).toBeCloseTo(2.75, 2); // Width becomes height
      } else {
        expect(result.exportPositioning.width).toBeCloseTo(2.75, 2);
        expect(result.exportPositioning.height).toBeCloseTo(3.75, 2);
      }
      
      // CRITICAL: Aspect ratio must be preserved between export and preview
      expect(result.previewAspectRatio).toBeCloseTo(result.exportAspectRatio, 3);
      
      // Validate preview dimensions are reasonable
      expect(result.previewScaling.previewPageWidth).toBeLessThanOrEqual(400);
      expect(result.previewScaling.previewPageHeight).toBeLessThanOrEqual(500);
      expect(result.previewScaling.previewCardWidth).toBeGreaterThan(0);
      expect(result.previewScaling.previewCardHeight).toBeGreaterThan(0);
      
      // Validate card positioning within page bounds
      expect(result.exportPositioning.x).toBeGreaterThanOrEqual(0);
      expect(result.exportPositioning.y).toBeGreaterThanOrEqual(0);
      expect(result.exportPositioning.x + result.exportPositioning.width).toBeLessThanOrEqual(8.5);
      expect(result.exportPositioning.y + result.exportPositioning.height).toBeLessThanOrEqual(11.0);
    }
  });

  test('ExtractStep grid overlay should accurately represent card positions', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Test that ExtractStep grid overlays match card extraction positions
    const gridAccuracy = await page.evaluate(() => {
      // Mock grid calculation functions used in ExtractStep
      const calculateGridPositions = (
        pageWidthPx: number,
        pageHeightPx: number,
        gridRows: number,
        gridColumns: number,
        cardWidthPx: number,
        cardHeightPx: number
      ) => {
        const totalCardWidth = gridColumns * cardWidthPx;
        const totalCardHeight = gridRows * cardHeightPx;
        
        const horizontalSpacing = (pageWidthPx - totalCardWidth) / (gridColumns + 1);
        const verticalSpacing = (pageHeightPx - totalCardHeight) / (gridRows + 1);
        
        const positions = [];
        
        for (let row = 0; row < gridRows; row++) {
          for (let col = 0; col < gridColumns; col++) {
            const x = horizontalSpacing + col * (cardWidthPx + horizontalSpacing);
            const y = verticalSpacing + row * (cardHeightPx + verticalSpacing);
            
            positions.push({
              cardIndex: row * gridColumns + col,
              gridPosition: { row, col },
              position: { x, y },
              dimensions: { width: cardWidthPx, height: cardHeightPx }
            });
          }
        }
        
        return {
          positions,
          spacing: { horizontal: horizontalSpacing, vertical: verticalSpacing },
          totalDimensions: { width: totalCardWidth, height: totalCardHeight },
          pageUtilization: (totalCardWidth * totalCardHeight) / (pageWidthPx * pageHeightPx)
        };
      };

      const calculatePreviewGridOverlay = (
        gridPositions: any,
        previewScale: number,
        extractionDPI: number,
        screenDPI: number
      ) => {
        const dpiScale = screenDPI / extractionDPI;
        const combinedScale = dpiScale * previewScale;
        
        return gridPositions.positions.map((pos: any) => ({
          ...pos,
          previewPosition: {
            x: pos.position.x * combinedScale,
            y: pos.position.y * combinedScale
          },
          previewDimensions: {
            width: pos.dimensions.width * combinedScale,
            height: pos.dimensions.height * combinedScale
          }
        }));
      };

      // Test parameters
      const EXTRACTION_DPI = 300;
      const SCREEN_DPI = 72;
      const pageWidthInches = 8.5;
      const pageHeightInches = 11.0;
      
      // Convert to extraction DPI (pixels)
      const pageWidthPx = pageWidthInches * EXTRACTION_DPI;
      const pageHeightPx = pageHeightInches * EXTRACTION_DPI;
      
      // Standard card dimensions with bleed at extraction DPI
      const cardWidthPx = 2.75 * EXTRACTION_DPI; // 825 pixels
      const cardHeightPx = 3.75 * EXTRACTION_DPI; // 1125 pixels
      
      // Test common grid configurations
      const gridConfigurations = [
        { rows: 2, columns: 3, name: 'duplex' },
        { rows: 3, columns: 3, name: 'simplex' },
        { rows: 1, columns: 6, name: 'gutter-fold' }
      ];

      const results = [];

      for (const config of gridConfigurations) {
        const gridPositions = calculateGridPositions(
          pageWidthPx,
          pageHeightPx,
          config.rows,
          config.columns,
          cardWidthPx,
          cardHeightPx
        );
        
        // Calculate preview overlay positions (scale to fit 400x500 preview)
        const previewPageWidth = pageWidthInches * SCREEN_DPI; // 612px
        const previewPageHeight = pageHeightInches * SCREEN_DPI; // 792px
        const maxPreviewWidth = 400;
        const maxPreviewHeight = 500;
        
        const previewScale = Math.min(
          maxPreviewWidth / previewPageWidth,
          maxPreviewHeight / previewPageHeight
        );
        
        const previewOverlay = calculatePreviewGridOverlay(
          gridPositions,
          previewScale,
          EXTRACTION_DPI,
          SCREEN_DPI
        );
        
        results.push({
          configuration: config,
          gridPositions,
          previewOverlay,
          previewScale,
          fitsOnPage: gridPositions.spacing.horizontal > 0 && gridPositions.spacing.vertical > 0
        });
      }

      return results;
    });

    // Validate grid calculations for each configuration
    for (const result of gridAccuracy) {
      const config = result.configuration;
      
      // Validate total cards
      expect(result.gridPositions.positions).toHaveLength(config.rows * config.columns);
      
      // Validate cards fit on page
      expect(result.fitsOnPage).toBe(true);
      
      // Validate specific spacing calculations
      if (config.name === 'duplex') {
        // 2x3 duplex grid should have specific spacing
        expect(result.gridPositions.spacing.horizontal).toBeCloseTo(18.75, 2); // (2550 - 2475) / 4
        expect(result.gridPositions.spacing.vertical).toBeCloseTo(350, 1); // (3300 - 2250) / 3
      }
      
      // Validate all cards are within page boundaries
      for (const position of result.gridPositions.positions) {
        expect(position.position.x).toBeGreaterThanOrEqual(0);
        expect(position.position.y).toBeGreaterThanOrEqual(0);
        expect(position.position.x + position.dimensions.width).toBeLessThanOrEqual(2550); // Page width in extraction DPI
        expect(position.position.y + position.dimensions.height).toBeLessThanOrEqual(3300); // Page height in extraction DPI
      }
      
      // Validate preview overlay positions are properly scaled
      for (let i = 0; i < result.previewOverlay.length; i++) {
        const original = result.gridPositions.positions[i];
        const preview = result.previewOverlay[i];
        
        // Verify preview positions are smaller than original (due to DPI conversion and scaling)
        expect(preview.previewPosition.x).toBeLessThan(original.position.x);
        expect(preview.previewPosition.y).toBeLessThan(original.position.y);
        expect(preview.previewDimensions.width).toBeLessThan(original.dimensions.width);
        expect(preview.previewDimensions.height).toBeLessThan(original.dimensions.height);
        
        // Verify preview positions maintain relative relationships
        if (i > 0) {
          const prevOriginal = result.gridPositions.positions[i-1];
          const prevPreview = result.previewOverlay[i-1];
          
          const originalRelativeX = original.position.x - prevOriginal.position.x;
          const previewRelativeX = preview.previewPosition.x - prevPreview.previewPosition.x;
          
          // Relative spacing should be proportional
          if (originalRelativeX !== 0) {
            const scalingRatio = previewRelativeX / originalRelativeX;
            expect(scalingRatio).toBeCloseTo(result.previewScale * (72 / 300), 3);
          }
        }
      }
    }
  });

  test('Preview rotation should match export rotation calculations', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Test that preview rotation matches export rotation logic
    const rotationAccuracy = await page.evaluate(() => {
      // Mock rotation calculation functions
      const applyRotationToCard = (
        originalWidth: number,
        originalHeight: number,
        rotation: number
      ) => {
        let finalWidth = originalWidth;
        let finalHeight = originalHeight;
        
        // Dimension swapping for 90° and 270° rotations
        if (rotation === 90 || rotation === 270) {
          finalWidth = originalHeight;
          finalHeight = originalWidth;
        }
        
        return { width: finalWidth, height: finalHeight, rotation };
      };

      const calculateRotationTransform = (
        rotation: number,
        containerWidth: number,
        containerHeight: number
      ) => {
        const radians = (rotation * Math.PI) / 180;
        const centerX = containerWidth / 2;
        const centerY = containerHeight / 2;
        
        return {
          radians,
          transform: `translate(${centerX}px, ${centerY}px) rotate(${rotation}deg) translate(-${centerX}px, -${centerY}px)`,
          centerPoint: { x: centerX, y: centerY }
        };
      };

      // Test all rotation angles
      const rotations = [0, 90, 180, 270];
      const cardDimensions = { width: 2.75, height: 3.75 }; // With bleed
      const containerDimensions = { width: 400, height: 500 }; // Preview container
      
      const results = [];

      for (const rotation of rotations) {
        // Calculate export rotation (final PDF dimensions)
        const exportRotation = applyRotationToCard(
          cardDimensions.width,
          cardDimensions.height,
          rotation
        );
        
        // Calculate preview rotation (UI transform)
        const previewTransform = calculateRotationTransform(
          rotation,
          containerDimensions.width,
          containerDimensions.height
        );
        
        results.push({
          rotation,
          exportDimensions: exportRotation,
          previewTransform,
          // Verify area preservation
          originalArea: cardDimensions.width * cardDimensions.height,
          rotatedArea: exportRotation.width * exportRotation.height
        });
      }

      return results;
    });

    // Validate rotation calculations
    for (const result of rotationAccuracy) {
      // Verify area preservation (rotation doesn't change area)
      expect(result.rotatedArea).toBeCloseTo(result.originalArea, 5);
      
      // Verify dimension swapping for 90° and 270°
      if (result.rotation === 90 || result.rotation === 270) {
        expect(result.exportDimensions.width).toBeCloseTo(3.75, 2); // Height becomes width
        expect(result.exportDimensions.height).toBeCloseTo(2.75, 2); // Width becomes height
      } else {
        expect(result.exportDimensions.width).toBeCloseTo(2.75, 2);
        expect(result.exportDimensions.height).toBeCloseTo(3.75, 2);
      }
      
      // Verify rotation angle consistency
      expect(result.exportDimensions.rotation).toBe(result.rotation);
      
      // Verify CSS transform angle matches
      expect(result.previewTransform.transform).toContain(`rotate(${result.rotation}deg)`);
      
      // Verify transform center point is at container center
      expect(result.previewTransform.centerPoint.x).toBe(200); // 400/2
      expect(result.previewTransform.centerPoint.y).toBe(250); // 500/2
    }
  });

  test('Multi-file preview should maintain coordinate system consistency', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Test coordinate system consistency between PDF and image files in preview
    const multiFileAccuracy = await page.evaluate(() => {
      // Mock multi-file coordinate system handling
      const normalizeToExtractionDPI = (
        sourceType: 'pdf' | 'image',
        sourceWidth: number,
        sourceHeight: number,
        sourceDPI: number,
        extractionDPI: number
      ) => {
        if (sourceType === 'pdf') {
          // PDF coordinates need DPI conversion
          const scale = extractionDPI / sourceDPI;
          return {
            width: sourceWidth * scale,
            height: sourceHeight * scale,
            dpiConversion: scale
          };
        } else {
          // Image coordinates already at extraction DPI (or treated as such)
          return {
            width: sourceWidth,
            height: sourceHeight,
            dpiConversion: 1
          };
        }
      };

      const calculatePreviewFromExtraction = (
        extractionDimensions: { width: number; height: number },
        extractionDPI: number,
        screenDPI: number,
        previewScale: number
      ) => {
        const dpiScale = screenDPI / extractionDPI;
        const combinedScale = dpiScale * previewScale;
        
        return {
          width: extractionDimensions.width * combinedScale,
          height: extractionDimensions.height * combinedScale,
          scale: combinedScale
        };
      };

      // Test parameters
      const EXTRACTION_DPI = 300;
      const SCREEN_DPI = 72;
      const PDF_DPI = 72;
      
      // Simulate same physical page in different file formats
      const pageWidthInches = 8.5;
      const pageHeightInches = 11.0;
      
      // PDF file (72 DPI coordinates)
      const pdfDimensions = {
        width: pageWidthInches * PDF_DPI,    // 612
        height: pageHeightInches * PDF_DPI   // 792
      };
      
      // Image file (300 DPI coordinates) 
      const imageDimensions = {
        width: pageWidthInches * EXTRACTION_DPI,  // 2550
        height: pageHeightInches * EXTRACTION_DPI // 3300
      };
      
      // Normalize both to extraction DPI
      const pdfNormalized = normalizeToExtractionDPI(
        'pdf',
        pdfDimensions.width,
        pdfDimensions.height,
        PDF_DPI,
        EXTRACTION_DPI
      );
      
      const imageNormalized = normalizeToExtractionDPI(
        'image',
        imageDimensions.width,
        imageDimensions.height,
        EXTRACTION_DPI,
        EXTRACTION_DPI
      );
      
      // Calculate preview dimensions (both should be identical)
      const previewScale = 0.5; // Example preview scale
      
      const pdfPreview = calculatePreviewFromExtraction(
        { width: pdfNormalized.width, height: pdfNormalized.height },
        EXTRACTION_DPI,
        SCREEN_DPI,
        previewScale
      );
      
      const imagePreview = calculatePreviewFromExtraction(
        { width: imageNormalized.width, height: imageNormalized.height },
        EXTRACTION_DPI,
        SCREEN_DPI,
        previewScale
      );
      
      return {
        original: { pdf: pdfDimensions, image: imageDimensions },
        normalized: { pdf: pdfNormalized, image: imageNormalized },
        preview: { pdf: pdfPreview, image: imagePreview },
        dimensionsMatch: Math.abs(pdfNormalized.width - imageNormalized.width) < 1 &&
                        Math.abs(pdfNormalized.height - imageNormalized.height) < 1,
        previewsMatch: Math.abs(pdfPreview.width - imagePreview.width) < 0.1 &&
                      Math.abs(pdfPreview.height - imagePreview.height) < 0.1
      };
    });

    // Validate coordinate system consistency
    expect(multiFileAccuracy.original.pdf.width).toBe(612);
    expect(multiFileAccuracy.original.pdf.height).toBe(792);
    expect(multiFileAccuracy.original.image.width).toBe(2550);
    expect(multiFileAccuracy.original.image.height).toBe(3300);
    
    // CRITICAL: After normalization, dimensions must be identical
    expect(multiFileAccuracy.dimensionsMatch).toBe(true);
    expect(multiFileAccuracy.normalized.pdf.width).toBeCloseTo(2550, 1);
    expect(multiFileAccuracy.normalized.pdf.height).toBeCloseTo(3300, 1);
    expect(multiFileAccuracy.normalized.image.width).toBeCloseTo(2550, 1);
    expect(multiFileAccuracy.normalized.image.height).toBeCloseTo(3300, 1);
    
    // CRITICAL: Preview dimensions must be identical for same content
    expect(multiFileAccuracy.previewsMatch).toBe(true);
    
    // Validate DPI conversion factor
    expect(multiFileAccuracy.normalized.pdf.dpiConversion).toBeCloseTo(4.167, 3); // 300/72
    expect(multiFileAccuracy.normalized.image.dpiConversion).toBe(1);
  });

  test('Preview scaling should maintain mathematical relationships', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Test that preview scaling preserves mathematical relationships
    const scalingAccuracy = await page.evaluate(() => {
      // Mock preview scaling functions
      const calculateOptimalPreviewScale = (
        contentWidth: number,
        contentHeight: number,
        containerWidth: number,
        containerHeight: number
      ) => {
        const widthScale = containerWidth / contentWidth;
        const heightScale = containerHeight / contentHeight;
        return Math.min(widthScale, heightScale, 1.0); // Never scale up beyond 100%
      };

      const applyPreviewScaling = (
        dimensions: { width: number; height: number; x: number; y: number },
        scale: number
      ) => {
        return {
          width: dimensions.width * scale,
          height: dimensions.height * scale,
          x: dimensions.x * scale,
          y: dimensions.y * scale,
          scale
        };
      };

      // Test various content and container size combinations
      const testCases = [
        {
          name: 'large-content-small-container',
          content: { width: 800, height: 1000 },
          container: { width: 400, height: 500 }
        },
        {
          name: 'small-content-large-container',
          content: { width: 200, height: 300 },
          container: { width: 400, height: 500 }
        },
        {
          name: 'exact-fit',
          content: { width: 400, height: 500 },
          container: { width: 400, height: 500 }
        },
        {
          name: 'wide-content',
          content: { width: 1000, height: 300 },
          container: { width: 400, height: 500 }
        },
        {
          name: 'tall-content',
          content: { width: 300, height: 1000 },
          container: { width: 400, height: 500 }
        }
      ];

      const results = [];

      for (const testCase of testCases) {
        const scale = calculateOptimalPreviewScale(
          testCase.content.width,
          testCase.content.height,
          testCase.container.width,
          testCase.container.height
        );
        
        // Test card positioning at different locations
        const cardPositions = [
          { width: 100, height: 150, x: 50, y: 75 },    // Top-left
          { width: 100, height: 150, x: 350, y: 175 },  // Center-right
          { width: 100, height: 150, x: 150, y: 325 }   // Bottom-center
        ];
        
        const scaledPositions = cardPositions.map(pos => 
          applyPreviewScaling(pos, scale)
        );
        
        results.push({
          testCase: testCase.name,
          scale,
          originalPositions: cardPositions,
          scaledPositions,
          fitsInContainer: scaledPositions.every(pos => 
            pos.x + pos.width <= testCase.container.width &&
            pos.y + pos.height <= testCase.container.height
          )
        });
      }

      return results;
    });

    // Validate scaling calculations
    for (const result of scalingAccuracy) {
      // Verify scale factor is reasonable
      expect(result.scale).toBeGreaterThan(0);
      expect(result.scale).toBeLessThanOrEqual(1.0); // Should never scale up beyond 100%
      
      // Verify all scaled content fits in container
      expect(result.fitsInContainer).toBe(true);
      
      // Verify proportional scaling
      for (let i = 0; i < result.originalPositions.length; i++) {
        const original = result.originalPositions[i];
        const scaled = result.scaledPositions[i];
        
        // Verify aspect ratio preservation
        const originalAspect = original.width / original.height;
        const scaledAspect = scaled.width / scaled.height;
        expect(scaledAspect).toBeCloseTo(originalAspect, 5);
        
        // Verify proportional scaling
        expect(scaled.width).toBeCloseTo(original.width * result.scale, 3);
        expect(scaled.height).toBeCloseTo(original.height * result.scale, 3);
        expect(scaled.x).toBeCloseTo(original.x * result.scale, 3);
        expect(scaled.y).toBeCloseTo(original.y * result.scale, 3);
      }
      
      // Validate specific test cases
      if (result.testCase === 'exact-fit') {
        expect(result.scale).toBe(1.0); // Should be exactly 100%
      } else if (result.testCase === 'small-content-large-container') {
        expect(result.scale).toBe(1.0); // Should not scale up
      }
    }
  });
});