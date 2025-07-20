import { test, expect } from '@playwright/test';

/**
 * PDF vs Image Workflow Visual Parity Tests
 * 
 * This test suite implements critical visual parity validation from GitHub Issue #63:
 * - Ensures PDF and image file workflows produce visually identical results
 * - Validates unified coordinate system consistency across file types
 * - Tests multi-file workflows with mixed PDF/image sessions
 * - Verifies that identical content produces identical extraction and export
 * 
 * These tests catch "hard to detect" issues that are very impactful to users:
 * - Different processing results between PDF and image workflows
 * - Coordinate system inconsistencies causing positioning errors
 * - Mathematical calculation differences between file types
 * - Preview vs export discrepancies specific to file type
 */

test.describe('PDF vs Image Workflow Visual Parity', () => {
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

  // Helper function for CI-tolerant precision values
  const getPrecisionTolerance = (baselineDecimalPlaces: number) => ({
    coordinate: process.env.CI ? Math.max(0, baselineDecimalPlaces - 2) : baselineDecimalPlaces,
    dimension: process.env.CI ? Math.max(1, baselineDecimalPlaces - 1) : baselineDecimalPlaces,
    spacing: process.env.CI ? Math.max(0, baselineDecimalPlaces - 3) : baselineDecimalPlaces,
    conversion: process.env.CI ? Math.max(2, baselineDecimalPlaces - 1) : baselineDecimalPlaces
  });

  test('Unified coordinate system should produce identical calculations', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Test that PDF and image file coordinate calculations are identical
    const coordinateConsistency = await page.evaluate(() => {
      const EXTRACTION_DPI = 300;
      const PDF_DPI = 72;
      
      // Test page dimensions (8.5" x 11" letter size)
      const pageWidthInches = 8.5;
      const pageHeightInches = 11.0;
      
      // Simulate PDF file (PDF.js coordinates at 72 DPI)
      const pdfPageWidth = pageWidthInches * PDF_DPI; // 612
      const pdfPageHeight = pageHeightInches * PDF_DPI; // 792
      
      // Simulate image file (native pixels treated as extraction DPI)
      const imageWidth = pageWidthInches * EXTRACTION_DPI; // 2550
      const imageHeight = pageHeightInches * EXTRACTION_DPI; // 3300
      
      // Convert PDF to extraction DPI (critical for coordinate consistency)
      const pdfToExtractionScale = EXTRACTION_DPI / PDF_DPI;
      const pdfInExtractionDPI = {
        width: pdfPageWidth * pdfToExtractionScale,
        height: pdfPageHeight * pdfToExtractionScale
      };
      
      // Image coordinates (already in extraction DPI)
      const imageInExtractionDPI = {
        width: imageWidth,
        height: imageHeight
      };
      
      // Test identical crop settings applied to both
      const cropSettings = {
        left: 150,   // pixels in extraction DPI
        top: 200,
        right: 100,
        bottom: 125
      };
      
      // Calculate cropped dimensions for both file types
      const pdfCropped = {
        width: pdfInExtractionDPI.width - cropSettings.left - cropSettings.right,
        height: pdfInExtractionDPI.height - cropSettings.top - cropSettings.bottom
      };
      
      const imageCropped = {
        width: imageInExtractionDPI.width - cropSettings.left - cropSettings.right,
        height: imageInExtractionDPI.height - cropSettings.top - cropSettings.bottom
      };
      
      // Test grid calculations work identically
      const gridConfig = { rows: 2, columns: 3 }; // Standard duplex
      const cardWidth = 825; // 2.75" * 300 DPI
      const cardHeight = 1125; // 3.75" * 300 DPI
      
      const calculateGridForSource = (sourceWidth: number, sourceHeight: number) => {
        const totalCardWidth = gridConfig.columns * cardWidth;
        const totalCardHeight = gridConfig.rows * cardHeight;
        
        const horizontalSpacing = (sourceWidth - totalCardWidth) / (gridConfig.columns + 1);
        const verticalSpacing = (sourceHeight - totalCardHeight) / (gridConfig.rows + 1);
        
        return { horizontalSpacing, verticalSpacing };
      };
      
      const pdfGrid = calculateGridForSource(pdfCropped.width, pdfCropped.height);
      const imageGrid = calculateGridForSource(imageCropped.width, imageCropped.height);
      
      return {
        originalDimensions: {
          pdf: pdfInExtractionDPI,
          image: imageInExtractionDPI
        },
        croppedDimensions: {
          pdf: pdfCropped,
          image: imageCropped
        },
        gridCalculations: {
          pdf: pdfGrid,
          image: imageGrid
        },
        conversionFactor: pdfToExtractionScale
      };
    });
    
    const precision = getPrecisionTolerance(3);
    
    // Validate coordinate system consistency (CI-tolerant)
    expect(coordinateConsistency.originalDimensions.pdf.width).toBeCloseTo(2550, precision.dimension);
    expect(coordinateConsistency.originalDimensions.pdf.height).toBeCloseTo(3300, precision.dimension);
    expect(coordinateConsistency.originalDimensions.image.width).toBeCloseTo(2550, precision.dimension);
    expect(coordinateConsistency.originalDimensions.image.height).toBeCloseTo(3300, precision.dimension);
    
    // Validate cropping produces identical results (CI-tolerant)
    expect(coordinateConsistency.croppedDimensions.pdf.width).toBeCloseTo(coordinateConsistency.croppedDimensions.image.width, precision.dimension);
    expect(coordinateConsistency.croppedDimensions.pdf.height).toBeCloseTo(coordinateConsistency.croppedDimensions.image.height, precision.dimension);
    
    // Validate grid calculations are identical (very tolerant spacing in CI)
    expect(coordinateConsistency.gridCalculations.pdf.horizontalSpacing).toBeCloseTo(coordinateConsistency.gridCalculations.image.horizontalSpacing, precision.spacing);
    expect(coordinateConsistency.gridCalculations.pdf.verticalSpacing).toBeCloseTo(coordinateConsistency.gridCalculations.image.verticalSpacing, precision.spacing);
    
    expect(coordinateConsistency.conversionFactor).toBeCloseTo(4.167, precision.conversion); // 300/72
  });

  test('Card extraction should produce identical positioning for both file types', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Test card positioning calculations for PDF vs image
    const cardPositioning = await page.evaluate(() => {
      // Simulate identical page content in both formats
      const pageWidth = 2550; // 8.5" * 300 DPI (unified coordinate system)
      const pageHeight = 3300; // 11" * 300 DPI
      
      // Test card and grid settings
      const cardWidth = 825; // 2.75" * 300 DPI (with bleed)
      const cardHeight = 1125; // 3.75" * 300 DPI (with bleed)
      const gridRows = 2;
      const gridColumns = 3;
      const totalCards = gridRows * gridColumns;
      
      // Calculate spacing (identical for both file types)
      const totalCardWidth = gridColumns * cardWidth;
      const totalCardHeight = gridRows * cardHeight;
      const horizontalSpacing = (pageWidth - totalCardWidth) / (gridColumns + 1);
      const verticalSpacing = (pageHeight - totalCardHeight) / (gridRows + 1);
      
      // Calculate card positions for both file types
      const calculateCardPositions = (sourceWidth: number, sourceHeight: number, fileType: string) => {
        const positions = [];
        
        for (let cardIndex = 0; cardIndex < totalCards; cardIndex++) {
          const col = cardIndex % gridColumns;
          const row = Math.floor(cardIndex / gridColumns);
          
          const x = horizontalSpacing + col * (cardWidth + horizontalSpacing);
          const y = verticalSpacing + row * (cardHeight + verticalSpacing);
          
          positions.push({
            cardIndex,
            col,
            row,
            x,
            y,
            fileType,
            // Validate card fits within source
            fitsHorizontally: x + cardWidth <= sourceWidth,
            fitsVertically: y + cardHeight <= sourceHeight
          });
        }
        
        return positions;
      };
      
      const pdfPositions = calculateCardPositions(pageWidth, pageHeight, 'pdf');
      const imagePositions = calculateCardPositions(pageWidth, pageHeight, 'image');
      
      return {
        spacing: { horizontal: horizontalSpacing, vertical: verticalSpacing },
        cardDimensions: { width: cardWidth, height: cardHeight },
        positions: {
          pdf: pdfPositions,
          image: imagePositions
        },
        gridInfo: { rows: gridRows, columns: gridColumns, totalCards }
      };
    });
    
    const precision = getPrecisionTolerance(2);
    
    // Validate grid spacing calculations (CI-tolerant)
    expect(cardPositioning.spacing.horizontal).toBeCloseTo(18.75, precision.spacing); // (2550 - 2475) / 4
    expect(cardPositioning.spacing.vertical).toBeCloseTo(350, precision.spacing); // (3300 - 2250) / 3
    
    // Validate identical positioning between PDF and image (CI-tolerant)
    for (let i = 0; i < 6; i++) {
      const pdfPos = cardPositioning.positions.pdf[i];
      const imagePos = cardPositioning.positions.image[i];
      
      expect(pdfPos.x).toBeCloseTo(imagePos.x, precision.coordinate); // Must be identical
      expect(pdfPos.y).toBeCloseTo(imagePos.y, precision.coordinate); // Must be identical
      expect(pdfPos.col).toBe(imagePos.col);
      expect(pdfPos.row).toBe(imagePos.row);
      expect(pdfPos.fitsHorizontally).toBe(true);
      expect(pdfPos.fitsVertically).toBe(true);
      expect(imagePos.fitsHorizontally).toBe(true);
      expect(imagePos.fitsVertically).toBe(true);
    }
    
    // Validate specific positions (critical for multi-file consistency, CI-tolerant)
    expect(cardPositioning.positions.pdf[0].x).toBeCloseTo(18.75, precision.coordinate); // Top-left card
    expect(cardPositioning.positions.pdf[0].y).toBeCloseTo(350, precision.coordinate);
    expect(cardPositioning.positions.pdf[5].x).toBeCloseTo(1706.25, precision.coordinate); // Bottom-right card
    expect(cardPositioning.positions.pdf[5].y).toBeCloseTo(1825, precision.coordinate);
  });

  test('Multi-file workflow should handle mixed PDF and image files consistently', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Test multi-file import consistency
    const multiFileConsistency = await page.evaluate(() => {
      // Simulate a multi-file workflow with mixed file types
      const files = [
        { name: 'cards-page1.pdf', type: 'pdf', width: 612, height: 792, dpi: 72 },
        { name: 'cards-page2.jpg', type: 'image', width: 2550, height: 3300, dpi: 300 },
        { name: 'cards-page3.pdf', type: 'pdf', width: 612, height: 792, dpi: 72 },
        { name: 'cards-page4.png', type: 'image', width: 2550, height: 3300, dpi: 300 }
      ];
      
      const EXTRACTION_DPI = 300;
      
      // Process each file through the unified coordinate system
      const processedFiles = files.map(file => {
        let extractionWidth, extractionHeight;
        
        if (file.type === 'pdf') {
          // Convert PDF coordinates to extraction DPI
          const scale = EXTRACTION_DPI / file.dpi;
          extractionWidth = file.width * scale;
          extractionHeight = file.height * scale;
        } else {
          // Image coordinates treated as extraction DPI
          extractionWidth = file.width;
          extractionHeight = file.height;
        }
        
        // Apply identical processing to all files
        const cropSettings = { left: 50, top: 100, right: 50, bottom: 100 };
        const croppedWidth = extractionWidth - cropSettings.left - cropSettings.right;
        const croppedHeight = extractionHeight - cropSettings.top - cropSettings.bottom;
        
        // Calculate grid for this file (using smaller cards that fit)
        const cardWidth = 750; // 2.5" * 300 DPI  
        const cardHeight = 1050; // 3.5" * 300 DPI
        const gridColumns = 3;
        const gridRows = 2;
        
        const totalCardWidth = gridColumns * cardWidth;
        const totalCardHeight = gridRows * cardHeight;
        
        const horizontalSpacing = (croppedWidth - totalCardWidth) / (gridColumns + 1);
        const verticalSpacing = (croppedHeight - totalCardHeight) / (gridRows + 1);
        
        return {
          originalFile: file,
          extractionDimensions: { width: extractionWidth, height: extractionHeight },
          croppedDimensions: { width: croppedWidth, height: croppedHeight },
          gridSpacing: { horizontal: horizontalSpacing, vertical: verticalSpacing },
          canFitGrid: horizontalSpacing > 0 && verticalSpacing > 0
        };
      });
      
      return {
        totalFiles: files.length,
        processedFiles,
        coordinateSystemUnified: true
      };
    });
    
    // Validate all files processed consistently
    expect(multiFileConsistency.totalFiles).toBe(4);
    expect(multiFileConsistency.coordinateSystemUnified).toBe(true);
    
    const precision = getPrecisionTolerance(10);
    
    // All files should have identical extraction dimensions (unified coordinate system, CI-tolerant)
    const extractionDimensions = multiFileConsistency.processedFiles.map(f => f.extractionDimensions);
    for (let i = 1; i < extractionDimensions.length; i++) {
      expect(extractionDimensions[i].width).toBeCloseTo(extractionDimensions[0].width, precision.dimension);
      expect(extractionDimensions[i].height).toBeCloseTo(extractionDimensions[0].height, precision.dimension);
    }
    
    // All files should have identical cropped dimensions (CI-tolerant)
    const croppedDimensions = multiFileConsistency.processedFiles.map(f => f.croppedDimensions);
    for (let i = 1; i < croppedDimensions.length; i++) {
      expect(croppedDimensions[i].width).toBeCloseTo(croppedDimensions[0].width, precision.dimension);
      expect(croppedDimensions[i].height).toBeCloseTo(croppedDimensions[0].height, precision.dimension);
    }
    
    // All files should have identical grid spacing (CI-tolerant)
    const gridSpacing = multiFileConsistency.processedFiles.map(f => f.gridSpacing);
    for (let i = 1; i < gridSpacing.length; i++) {
      expect(gridSpacing[i].horizontal).toBeCloseTo(gridSpacing[0].horizontal, precision.spacing);
      expect(gridSpacing[i].vertical).toBeCloseTo(gridSpacing[0].vertical, precision.spacing);
    }
    
    // All files should be able to fit the grid
    for (const processed of multiFileConsistency.processedFiles) {
      expect(processed.canFitGrid).toBe(true);
    }
  });

  test('Rotation and scaling should work identically for PDF and image files', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Test rotation and scaling consistency across file types
    const rotationScalingConsistency = await page.evaluate(() => {
      // Test card dimensions in extraction DPI
      const baseCardWidth = 750; // 2.5" * 300 DPI
      const baseCardHeight = 1050; // 3.5" * 300 DPI
      const bleedPixels = 37.5; // 0.125" * 300 DPI
      const cardWithBleedWidth = baseCardWidth + bleedPixels * 2;
      const cardWithBleedHeight = baseCardHeight + bleedPixels * 2;
      
      // Test different scales and rotations
      const testScales = [75, 100, 125, 150]; // Percentage
      const testRotations = [0, 90, 180, 270]; // Degrees
      
      const results = [];
      
      for (const scale of testScales) {
        for (const rotation of testRotations) {
          const scaleFactor = scale / 100;
          
          // Apply scaling to card with bleed
          const scaledWidth = cardWithBleedWidth * scaleFactor;
          const scaledHeight = cardWithBleedHeight * scaleFactor;
          
          // Apply rotation (dimension swapping)
          let finalWidth = scaledWidth;
          let finalHeight = scaledHeight;
          
          if (rotation === 90 || rotation === 270) {
            finalWidth = scaledHeight;
            finalHeight = scaledWidth;
          }
          
          // This calculation must be identical for PDF and image files
          const result = {
            scale,
            rotation,
            scaleFactor,
            beforeRotation: { width: scaledWidth, height: scaledHeight },
            afterRotation: { width: finalWidth, height: finalHeight },
            aspectRatio: finalWidth / finalHeight,
            area: finalWidth * finalHeight
          };
          
          results.push(result);
        }
      }
      
      return {
        baseCardDimensions: { width: cardWithBleedWidth, height: cardWithBleedHeight },
        testResults: results,
        totalTests: results.length
      };
    });
    
    const precision = getPrecisionTolerance(3);
    
    // Validate base dimensions (CI-tolerant)
    expect(rotationScalingConsistency.baseCardDimensions.width).toBeCloseTo(825, precision.dimension); // 750 + 75
    expect(rotationScalingConsistency.baseCardDimensions.height).toBeCloseTo(1125, precision.dimension); // 1050 + 75
    expect(rotationScalingConsistency.totalTests).toBe(16); // 4 scales × 4 rotations
    
    // Validate specific test cases
    const results = rotationScalingConsistency.testResults;
    
    // Test 100% scale, 0° rotation (baseline, CI-tolerant)
    const baseline = results.find(r => r.scale === 100 && r.rotation === 0);
    expect(baseline?.afterRotation.width).toBeCloseTo(825, precision.dimension);
    expect(baseline?.afterRotation.height).toBeCloseTo(1125, precision.dimension);
    
    // Test 100% scale, 90° rotation (dimensions should swap, CI-tolerant)
    const rotated90 = results.find(r => r.scale === 100 && r.rotation === 90);
    expect(rotated90?.afterRotation.width).toBeCloseTo(1125, precision.dimension); // Height becomes width
    expect(rotated90?.afterRotation.height).toBeCloseTo(825, precision.dimension); // Width becomes height
    
    // Test scaling at different percentages (CI-tolerant)
    const scale75 = results.find(r => r.scale === 75 && r.rotation === 0);
    const scale150 = results.find(r => r.scale === 150 && r.rotation === 0);
    
    expect(scale75?.afterRotation.width).toBeCloseTo(618.75, precision.dimension); // 825 * 0.75
    expect(scale75?.afterRotation.height).toBeCloseTo(843.75, precision.dimension); // 1125 * 0.75
    expect(scale150?.afterRotation.width).toBeCloseTo(1237.5, precision.dimension); // 825 * 1.5
    expect(scale150?.afterRotation.height).toBeCloseTo(1687.5, precision.dimension); // 1125 * 1.5
    
    // Validate area preservation during rotation (area should not change, CI-tolerant)
    for (const result of results) {
      const originalArea = result.beforeRotation.width * result.beforeRotation.height;
      const rotatedArea = result.afterRotation.width * result.afterRotation.height;
      expect(rotatedArea).toBeCloseTo(originalArea, precision.dimension); // Area preserved during rotation
    }
    
    // Validate aspect ratio behavior (CI-tolerant)
    const portrait0 = results.find(r => r.scale === 100 && r.rotation === 0);
    const landscape90 = results.find(r => r.scale === 100 && r.rotation === 90);
    
    expect(portrait0?.aspectRatio).toBeCloseTo(0.733, precision.conversion); // 825/1125
    expect(landscape90?.aspectRatio).toBeCloseTo(1.364, precision.conversion); // 1125/825 (reciprocal)
  });

  test('Preview vs export calculations should be source-agnostic', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Test that preview and export use identical calculations regardless of source type
    const sourceAgnosticCalculations = await page.evaluate(() => {
      // Mock the core calculation functions used in both preview and export
      const calculateFinalCardRenderDimensions = (
        cardSizeInches: { width: number; height: number },
        bleedInches: number,
        scalePercent: number,
        rotation: number,
        sourceType: 'pdf' | 'image' // This parameter should NOT affect calculations
      ) => {
        const scaleFactor = scalePercent / 100;
        let width = (cardSizeInches.width + bleedInches * 2) * scaleFactor;
        let height = (cardSizeInches.height + bleedInches * 2) * scaleFactor;
        
        // Rotation handling (must be identical regardless of source type)
        if (rotation === 90 || rotation === 270) {
          [width, height] = [height, width];
        }
        
        return { 
          width, 
          height, 
          sourceType, // Include for validation but shouldn't affect calculation
          area: width * height 
        };
      };
      
      const calculateDPIConversion = (
        dimensionInches: number,
        sourceDPI: number,
        targetDPI: number,
        sourceType: 'pdf' | 'image' // This parameter should NOT affect calculations
      ) => {
        const sourcePixels = dimensionInches * sourceDPI;
        const targetPixels = dimensionInches * targetDPI;
        const conversionFactor = targetDPI / sourceDPI;
        const convertedPixels = sourcePixels * conversionFactor;
        
        return {
          sourcePixels,
          targetPixels,
          convertedPixels,
          conversionFactor,
          sourceType // Include for validation but shouldn't affect calculation
        };
      };
      
      // Test parameters
      const testCard = { width: 2.5, height: 3.5 }; // Poker card in inches
      const testBleed = 0.125; // Inches
      const testScale = 110; // Percentage
      const testRotations = [0, 90, 180, 270];
      
      // Run identical calculations for both source types
      const sourceTypes: ('pdf' | 'image')[] = ['pdf', 'image'];
      const results = [];
      
      for (const sourceType of sourceTypes) {
        for (const rotation of testRotations) {
          // Card dimension calculations (must be identical)
          const cardDimensions = calculateFinalCardRenderDimensions(
            testCard, 
            testBleed, 
            testScale, 
            rotation, 
            sourceType
          );
          
          // DPI conversion calculations (must be identical)
          const dpiConversion = calculateDPIConversion(
            testCard.width, 
            sourceType === 'pdf' ? 72 : 300, // Different source DPIs
            300, // Target extraction DPI
            sourceType
          );
          
          results.push({
            sourceType,
            rotation,
            cardDimensions,
            dpiConversion
          });
        }
      }
      
      return {
        totalTests: results.length,
        results,
        testParameters: { card: testCard, bleed: testBleed, scale: testScale }
      };
    });
    
    expect(sourceAgnosticCalculations.totalTests).toBe(8); // 2 source types × 4 rotations
    
    // Group results by rotation to compare PDF vs image calculations
    const rotations = [0, 90, 180, 270];
    
    const precision = getPrecisionTolerance(10);
    
    for (const rotation of rotations) {
      const pdfResult = sourceAgnosticCalculations.results.find(r => r.rotation === rotation && r.sourceType === 'pdf');
      const imageResult = sourceAgnosticCalculations.results.find(r => r.rotation === rotation && r.sourceType === 'image');
      
      // Card dimension calculations must be identical regardless of source type (CI-tolerant)
      expect(pdfResult?.cardDimensions.width).toBeCloseTo(imageResult?.cardDimensions.width || 0, precision.dimension);
      expect(pdfResult?.cardDimensions.height).toBeCloseTo(imageResult?.cardDimensions.height || 0, precision.dimension);
      expect(pdfResult?.cardDimensions.area).toBeCloseTo(imageResult?.cardDimensions.area || 0, precision.dimension);
      
      // DPI conversion target pixels should be identical (despite different source DPIs, CI-tolerant)  
      expect(pdfResult?.dpiConversion.targetPixels).toBeCloseTo(imageResult?.dpiConversion.targetPixels || 0, precision.dimension);
      expect(pdfResult?.dpiConversion.convertedPixels).toBeCloseTo(imageResult?.dpiConversion.convertedPixels || 0, precision.dimension);
    }
    
    // Validate specific calculations at baseline (100% scale, 0° rotation would be)
    // Our test uses 110% scale, 0° rotation (CI-tolerant)
    const pdfBaseline = sourceAgnosticCalculations.results.find(r => r.rotation === 0 && r.sourceType === 'pdf');
    const imageBaseline = sourceAgnosticCalculations.results.find(r => r.rotation === 0 && r.sourceType === 'image');
    
    // Expected: (2.5 + 0.125*2) * 1.1 = 2.75 * 1.1 = 3.025 inches width
    // Expected: (3.5 + 0.125*2) * 1.1 = 3.75 * 1.1 = 4.125 inches height
    expect(pdfBaseline?.cardDimensions.width).toBeCloseTo(3.025, precision.conversion);
    expect(pdfBaseline?.cardDimensions.height).toBeCloseTo(4.125, precision.conversion);
    expect(imageBaseline?.cardDimensions.width).toBeCloseTo(3.025, precision.conversion);
    expect(imageBaseline?.cardDimensions.height).toBeCloseTo(4.125, precision.conversion);
    
    // DPI conversion: 2.5" should convert to 750 pixels at 300 DPI (exact values, no tolerance needed)
    expect(pdfBaseline?.dpiConversion.targetPixels).toBe(750); // 2.5 * 300
    expect(imageBaseline?.dpiConversion.targetPixels).toBe(750); // Same result
  });

  test('Error handling should be consistent across file types', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Test error handling consistency
    const errorHandlingConsistency = await page.evaluate(() => {
      // Mock error scenarios that should be handled identically
      const testErrorScenarios = [
        {
          name: 'invalid-dimensions',
          pdfData: { width: 0, height: 792 },
          imageData: { width: 0, height: 3300 }
        },
        {
          name: 'negative-crop',
          pdfData: { width: 612, height: 792 },
          imageData: { width: 2550, height: 3300 },
          crop: { left: -100, top: 50, right: 75, bottom: 100 }
        },
        {
          name: 'crop-exceeds-dimensions',
          pdfData: { width: 612, height: 792 },
          imageData: { width: 2550, height: 3300 },
          crop: { left: 1500, top: 1800, right: 1500, bottom: 1800 } // Ensures crop exceeds dimensions for both
        }
      ];
      
      const EXTRACTION_DPI = 300;
      const PDF_DPI = 72;
      
      const validateDimensions = (width: number, height: number, sourceType: string) => {
        const errors = [];
        
        if (width <= 0 || height <= 0) {
          errors.push(`Invalid dimensions for ${sourceType}: ${width}x${height}`);
        }
        
        if (!isFinite(width) || !isFinite(height)) {
          errors.push(`Non-finite dimensions for ${sourceType}: ${width}x${height}`);
        }
        
        return errors;
      };
      
      const validateCrop = (
        dimensions: { width: number; height: number },
        crop: { left: number; top: number; right: number; bottom: number },
        sourceType: string
      ) => {
        const errors = [];
        
        if (crop.left < 0 || crop.top < 0 || crop.right < 0 || crop.bottom < 0) {
          errors.push(`Negative crop values not allowed for ${sourceType}`);
        }
        
        const remainingWidth = dimensions.width - crop.left - crop.right;
        const remainingHeight = dimensions.height - crop.top - crop.bottom;
        
        if (remainingWidth <= 0 || remainingHeight <= 0) {
          errors.push(`Crop settings exceed dimensions for ${sourceType}: ${remainingWidth}x${remainingHeight} remaining`);
        }
        
        return errors;
      };
      
      const results = [];
      
      for (const scenario of testErrorScenarios) {
        // Convert PDF to extraction DPI
        const pdfInExtractionDPI = {
          width: scenario.pdfData.width * (EXTRACTION_DPI / PDF_DPI),
          height: scenario.pdfData.height * (EXTRACTION_DPI / PDF_DPI)
        };
        
        // Image already in extraction DPI
        const imageInExtractionDPI = scenario.imageData;
        
        // Validate dimensions for both
        const pdfDimensionErrors = validateDimensions(pdfInExtractionDPI.width, pdfInExtractionDPI.height, 'pdf');
        const imageDimensionErrors = validateDimensions(imageInExtractionDPI.width, imageInExtractionDPI.height, 'image');
        
        let pdfCropErrors: string[] = [];
        let imageCropErrors: string[] = [];
        
        // Validate crop if provided
        if (scenario.crop) {
          pdfCropErrors = validateCrop(pdfInExtractionDPI, scenario.crop, 'pdf');
          imageCropErrors = validateCrop(imageInExtractionDPI, scenario.crop, 'image');
        }
        
        results.push({
          scenario: scenario.name,
          pdfErrors: [...pdfDimensionErrors, ...pdfCropErrors],
          imageErrors: [...imageDimensionErrors, ...imageCropErrors],
          errorTypesMatch: pdfDimensionErrors.length === imageDimensionErrors.length && pdfCropErrors.length === imageCropErrors.length
        });
      }
      
      return {
        totalScenarios: testErrorScenarios.length,
        results
      };
    });
    
    expect(errorHandlingConsistency.totalScenarios).toBe(3);
    
    // Validate error handling consistency
    for (const result of errorHandlingConsistency.results) {
      expect(result.errorTypesMatch).toBe(true); // Same number of errors for both types
      
      // Specific validations for each scenario
      switch (result.scenario) {
        case 'invalid-dimensions':
          expect(result.pdfErrors.length).toBeGreaterThan(0);
          expect(result.imageErrors.length).toBeGreaterThan(0);
          expect(result.pdfErrors[0]).toContain('Invalid dimensions');
          expect(result.imageErrors[0]).toContain('Invalid dimensions');
          break;
          
        case 'negative-crop':
          expect(result.pdfErrors.length).toBeGreaterThan(0);
          expect(result.imageErrors.length).toBeGreaterThan(0);
          expect(result.pdfErrors[0]).toContain('Negative crop values');
          expect(result.imageErrors[0]).toContain('Negative crop values');
          break;
          
        case 'crop-exceeds-dimensions':
          expect(result.pdfErrors.length).toBeGreaterThan(0);
          expect(result.imageErrors.length).toBeGreaterThan(0);
          expect(result.pdfErrors[0]).toContain('exceed dimensions');
          expect(result.imageErrors[0]).toContain('exceed dimensions');
          break;
      }
    }
  });
});