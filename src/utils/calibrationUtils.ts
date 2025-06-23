/**
 * @fileoverview Printer calibration utilities for accurate print alignment
 * 
 * This module provides tools for generating calibration PDFs that help users
 * measure and correct printer offset, scaling, and rotation issues. The calibration
 * process ensures that printed cards match the expected dimensions and positioning.
 * 
 * **Calibration Workflow:**
 * 1. Generate calibration PDF with known dimensions
 * 2. Print PDF on target printer with target settings
 * 3. Measure printed dimensions and compare to expected values
 * 4. Calculate correction factors for offset, scale, and rotation
 * 5. Apply corrections to final card output
 * 
 * **Key Features:**
 * - Precision crosshairs with known 1.0" measurements
 * - Card outline for cutting and positioning reference
 * - Scale-aware crosshairs that maintain accuracy under printer scaling
 * - Support for custom card sizes and media dimensions
 * - Offset and rotation testing capabilities
 * 
 * @author Card Game PDF Transformer
 */

import { jsPDF } from 'jspdf';
import { ColorTransformation, applyColorTransformation } from './colorUtils';
import { OutputSettings } from '../types';

/**
 * Generates a calibration PDF for printer offset and scale testing
 * 
 * Creates a precision calibration document with measurement crosshairs and
 * card outline for testing printer accuracy. The crosshairs are designed
 * to measure exactly 1.0" when printed correctly, allowing users to detect
 * and measure printer scaling, offset, and rotation issues.
 * 
 * **Calibration Elements:**
 * - Card outline in light gray for cutting reference
 * - Precision crosshairs with 1.0" measurement arms
 * - White center gap to improve measurement accuracy
 * - Scale-aware crosshairs that maintain proportions
 * - Clear labeling for measurement reference
 * 
 * **Usage Workflow:**
 * 1. Generate calibration PDF with target card dimensions
 * 2. Print on target printer using exact print settings
 * 3. Measure printed crosshairs with ruler (should be 1.0")
 * 4. Measure card outline dimensions
 * 5. Calculate correction factors from measurements
 * 6. Apply corrections to printer calibration settings
 * 
 * @param cardWidth - Width of the card in inches (default: 2.5" for poker cards)
 * @param cardHeight - Height of the card in inches (default: 3.5" for poker cards)
 * @param mediaWidth - Width of the paper/media in inches (e.g., 8.5" for letter)
 * @param mediaHeight - Height of the paper/media in inches (e.g., 11" for letter)
 * @param offsetX - Horizontal offset in inches (positive = right)
 * @param offsetY - Vertical offset in inches (positive = down)
 * @param rotation - Rotation angle in degrees (for future rotation testing)
 * @param scalePercent - Scale percentage to apply to crosshair (default: 100)
 * @returns PDF blob ready for download and printing
 * 
 * @example
 * ```typescript
 * // Generate standard poker card calibration for letter paper
 * const calibrationPdf = generateCalibrationPDF(2.5, 3.5, 8.5, 11);
 * 
 * // Generate with offset testing
 * const offsetTestPdf = generateCalibrationPDF(2.5, 3.5, 8.5, 11, 0.1, -0.05);
 * 
 * // Download the PDF
 * const url = URL.createObjectURL(calibrationPdf);
 * const link = document.createElement('a');
 * link.href = url;
 * link.download = 'printer-calibration.pdf';
 * link.click();
 * ```
 */
export function generateCalibrationPDF(
  cardWidth = 2.5,
  cardHeight = 3.5,
  mediaWidth = 8.5,
  mediaHeight = 11.0,
  offsetX = 0,
  offsetY = 0,
  rotation = 0,
  scalePercent = 100
): Blob {  // Create PDF with media dimensions to trick printer into borderless mode
  const doc = new jsPDF({
    unit: 'in',
    format: [mediaWidth, mediaHeight],
    compress: true
  });

  // Calculate the center position with applied offsets
  const baseCardX = (mediaWidth - cardWidth) / 2;
  const baseCardY = (mediaHeight - cardHeight) / 2;
  const cardX = baseCardX + offsetX;
  const cardY = baseCardY + offsetY;
  
  console.log(`Generating calibration PDF: ${cardWidth}" × ${cardHeight}" card at ${cardX.toFixed(3)}", ${cardY.toFixed(3)}" with ${rotation}° rotation on ${mediaWidth}" × ${mediaHeight}" media`);
  
  // 1. Draw card outline for cutting reference
  doc.setDrawColor(200, 200, 200); // Light gray
  doc.setLineWidth(0.01);
  doc.rect(cardX, cardY, cardWidth, cardHeight);
  
  // 2. Draw center crosshairs for measurement
  // Scale the crosshair by the same percentage as the card so when printer overscales, it measures exactly 1.0"
  const scaledCrossLength = 1.0 * (scalePercent / 100); // Scale crosshair by same factor as card
  const centerX = cardX + cardWidth/2;
  const centerY = cardY + cardHeight/2;
  
  // Draw crosshair arms with white center square
  doc.setLineWidth(0.04);
  doc.setDrawColor(0, 0, 0); // Black
  
  const gapSize = 0.04; // Size of white square in center
  
  // Horizontal crosshair arm - split into two segments with gap in center
  doc.line(centerX - scaledCrossLength/2, centerY, centerX - gapSize/2, centerY); // Left segment
  doc.line(centerX + gapSize/2, centerY, centerX + scaledCrossLength/2, centerY); // Right segment
  
  // Vertical crosshair arm - split into two segments with gap in center
  doc.line(centerX, centerY - scaledCrossLength/2, centerX, centerY - gapSize/2); // Top segment
  doc.line(centerX, centerY + gapSize/2, centerX, centerY + scaledCrossLength/2); // Bottom segment
  
  // Crosshair measurement labels
  doc.setFontSize(10);
  doc.text('1.0"', centerX + scaledCrossLength/2 + 0.05, centerY + 0.05); // Horizontal label
  doc.text('1.0"', centerX + 0.05, centerY - scaledCrossLength/2 - 0.05); // Vertical label
  
  // 3. Add minimal labeling
  doc.setFontSize(12);
  doc.setTextColor(0, 0, 0);
  
  doc.text('CALIBRATION CARD', centerX, cardY + 0.3, { align: 'center' });
  

  // Return the PDF as a blob
  return doc.output('blob');
}

/**
 * Calculates offset and scale corrections from simplified 3-measurement approach
 * @param measuredRightDistance Distance from center dot to right edge of card (inches) - expect ~1.25" for poker cards
 * @param measuredTopDistance Distance from center dot to top edge of card (inches) - expect ~1.75" for poker cards  
 * @param measuredCrosshairLength Actual printed length of crosshair arm (inches) - expect ~1.0"
 * @param cardWidth Width of the intended card (inches, default 2.5")
 * @param cardHeight Height of the intended card (inches, default 3.5")
 * @param currentHorizontalOffset Current horizontal offset setting (inches)
 * @param currentVerticalOffset Current vertical offset setting (inches)
 * @param currentScalePercent Current scale percentage setting
 * @returns Object with new offset values and scale adjustments
 */
export function calculateCalibrationSettings(
  measuredRightDistance: number,
  measuredTopDistance: number,
  measuredCrosshairLength: number,
  cardWidth = 2.5,
  cardHeight = 3.5,
  currentHorizontalOffset = 0,
  currentVerticalOffset = 0,
  currentScalePercent = 100
): {
  newHorizontalOffset: number;
  newVerticalOffset: number;
  newScalePercent: number;
  adjustments: {
    horizontalOffsetChange: number;
    verticalOffsetChange: number;
    scalePercentChange: number;
  };
  diagnostics: {
    horizontalCentering: string;
    verticalCentering: string;
    scaleAccuracy: string;
  };
} {
  // Expected distances from center if perfectly aligned
  const expectedRightDistance = cardWidth / 2;   // 1.25" for poker cards
  const expectedTopDistance = cardHeight / 2;    // 1.75" for poker cards
  const expectedCrosshairLength = 1.0;           // 1.0" crosshair arm
  
  // Calculate offset corrections
  // If measured distance is larger than expected, card is too far in that direction, so we need to move it back
  const horizontalShift = Math.round((measuredRightDistance - expectedRightDistance) * 1000) / 1000;
  const verticalShift = Math.round((expectedTopDistance - measuredTopDistance) * 1000) / 1000;
  
  // Apply corrections to current settings (round to avoid floating point precision issues)
  const newHorizontalOffset = Math.round((currentHorizontalOffset + horizontalShift) * 1000) / 1000;
  const newVerticalOffset = Math.round((currentVerticalOffset + verticalShift) * 1000) / 1000;
  
  // Scale correction based on crosshair measurement
  const scaleCorrection = expectedCrosshairLength / measuredCrosshairLength;
  const newScalePercent = Math.round(currentScalePercent * scaleCorrection);
  
  // Generate diagnostic messages
  const horizontalCentering = Math.abs(horizontalShift) < 0.01 ? 
    "Well centered" : 
    `Off by ${Math.abs(horizontalShift).toFixed(3)}" ${horizontalShift > 0 ? 'left' : 'right'}`;
    
  const verticalCentering = Math.abs(verticalShift) < 0.01 ? 
    "Well centered" : 
    `Off by ${Math.abs(verticalShift).toFixed(3)}" ${verticalShift > 0 ? 'up' : 'down'}`;
    
  const scaleAccuracy = Math.abs(measuredCrosshairLength - expectedCrosshairLength) < 0.01 ? 
    "Accurate scale" : 
    `Printer ${measuredCrosshairLength > expectedCrosshairLength ? 'enlarges' : 'shrinks'} by ${Math.abs((measuredCrosshairLength - expectedCrosshairLength) * 100).toFixed(1)}%`;
  
  return {
    newHorizontalOffset,
    newVerticalOffset,
    newScalePercent,
    adjustments: {
      horizontalOffsetChange: horizontalShift,
      verticalOffsetChange: verticalShift,
      scalePercentChange: newScalePercent - currentScalePercent
    },
    diagnostics: {
      horizontalCentering,
      verticalCentering,
      scaleAccuracy
    }
  };
}

/*
 * 3-MEASUREMENT CALIBRATION EXAMPLES:
 * 
 * Example 1: Card too far left (poker card 2.5" × 3.5")
 * - Measured right distance: 1.45" (expect 1.25")
 * - Measured top distance: 1.75" (expect 1.75")
 * - Measured crosshair: 1.0" (expect 1.0")
 * - horizontalShift = 1.25 - 1.45 = -0.2" (move left)
 * - verticalShift = 1.75 - 1.75 = 0" (no change)
 * - Result: Add -0.2" horizontal offset to move card left ✓
 * 
 * Example 2: Card too far up and printer enlarges
 * - Measured right distance: 1.25" (expect 1.25")
 * - Measured top distance: 1.95" (expect 1.75")
 * - Measured crosshair: 1.05" (expect 1.0")
 * - horizontalShift = 1.25 - 1.25 = 0" (no change)
 * - verticalShift = 1.75 - 1.95 = -0.2" (move up)
 * - scaleCorrection = 1.0 / 1.05 = 0.952 (95.2% scale)
 * - Result: Add -0.2" vertical offset, reduce scale by ~5% ✓
 * 
 * Example 3: Perfect alignment
 * - Measured right distance: 1.25" (expect 1.25")
 * - Measured top distance: 1.75" (expect 1.75")
 * - Measured crosshair: 1.0" (expect 1.0")
 * - All shifts = 0", scale = 100%
 * - Result: No adjustments needed ✓
 */

/**
 * Generate color calibration test PDF with transformation grid
 * 
 * Each grid cell starts with the user's current color settings as baseline,
 * then applies the specific horizontal/vertical transformations for that cell position.
 * This allows users to test variations around their current settings.
 * 
 * @param cropImageUrl - Data URL of the cropped card region
 * @param gridConfig - Grid configuration (columns, rows)
 * @param transformations - Column and row transformation configurations
 * @param outputSettings - Card positioning and layout settings
 * @param selectedRegion - Crop region information
 * @param userColorSettings - User's current color adjustments to use as baseline
 * @returns Promise resolving to PDF Blob
 */
export async function generateColorCalibrationPDF(
  cropImageUrl: string,
  gridConfig: { columns: number; rows: number },
  transformations: {
    horizontal: { type: string; min: number; max: number };
    vertical: { type: string; min: number; max: number };
  },
  outputSettings: OutputSettings,
  _selectedRegion: unknown,
  userColorSettings?: ColorTransformation
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    (async () => {
    try {
      // Create PDF with output page dimensions
      const doc = new jsPDF({
        unit: 'in',
        format: [outputSettings.pageSize.width, outputSettings.pageSize.height],
        compress: true
      });

      // Calculate card positioning (same as Configure Layout)
      const cardWidthInches = outputSettings.cardSize?.widthInches || 2.5;
      const cardHeightInches = outputSettings.cardSize?.heightInches || 3.5;
      const scalePercent = outputSettings.cardScalePercent || 100;
      const horizontalOffset = outputSettings.offset.horizontal || 0;
      const verticalOffset = outputSettings.offset.vertical || 0;

      // Apply scale percentage
      const scaledCardWidth = cardWidthInches * (scalePercent / 100);
      const scaledCardHeight = cardHeightInches * (scalePercent / 100);

      // Center card on page with offsets
      const cardX = (outputSettings.pageSize.width - scaledCardWidth) / 2 + horizontalOffset;
      const cardY = (outputSettings.pageSize.height - scaledCardHeight) / 2 + verticalOffset;

      // Draw card outline
      doc.setDrawColor(200, 200, 200);
      doc.setLineWidth(0.01);
      doc.rect(cardX, cardY, scaledCardWidth, scaledCardHeight);

      // Calculate available space within card for header, grid, and footer
      const headerHeight = 0.15; // Space reserved for header text within card
      const labelMargin = 0.1;   // Space reserved for parameter labels within card
      const footerHeight = 0.1;  // Space reserved for bottom instructions
      const gridStartY = cardY + headerHeight;
      const availableGridHeight = scaledCardHeight - headerHeight - labelMargin - footerHeight;
      const availableGridWidth = scaledCardWidth - labelMargin;

      // Calculate grid cell dimensions within available space
      const cellWidth = availableGridWidth / gridConfig.columns;
      const cellHeight = availableGridHeight / gridConfig.rows;

      // Generate transformation values for each axis
      const horizontalValues = generateTransformationValues(
        transformations.horizontal.min,
        transformations.horizontal.max,
        gridConfig.columns
      );

      const verticalValues = generateTransformationValues(
        transformations.vertical.min,
        transformations.vertical.max,
        gridConfig.rows
      );
      
      // Add header text within card boundaries
      doc.setFontSize(8);
      doc.setTextColor(0, 0, 0);
      doc.text('COLOR CALIBRATION TEST', cardX + scaledCardWidth / 2, cardY + 0.08, { align: 'center' });
      
      doc.setFontSize(6);
      doc.text(
        `${transformations.horizontal.type.toUpperCase()} × ${transformations.vertical.type.toUpperCase()}`,
        cardX + scaledCardWidth / 2,
        cardY + 0.13,
        { align: 'center' }
      );

      // Process and place grid cells
      for (let row = 0; row < gridConfig.rows; row++) {
        for (let col = 0; col < gridConfig.columns; col++) {
          // Calculate cell position within available grid area
          const cellX = cardX + labelMargin + col * cellWidth;
          const cellY = gridStartY + row * cellHeight;

          // Create transformation for this cell - start with user's current settings
          const transformation: ColorTransformation = userColorSettings 
            ? { ...userColorSettings }
            : createBaseTransformation();
          
          // Apply horizontal transformation (column-based)
          const horizontalValue = horizontalValues[col];
          applyTransformationValue(transformation, transformations.horizontal.type, horizontalValue);
          
          // Apply vertical transformation (row-based)
          const verticalValue = verticalValues[row];
          applyTransformationValue(transformation, transformations.vertical.type, verticalValue);

          // Apply color transformation to crop image
          const transformedImageUrl = await applyColorTransformation(cropImageUrl, transformation);
          
          // Add transformed image to PDF
          doc.addImage(
            transformedImageUrl,
            'PNG',
            cellX,
            cellY,
            cellWidth,
            cellHeight
          );

          // Add cell border
          doc.setDrawColor(150, 150, 150);
          doc.setLineWidth(0.005);
          doc.rect(cellX, cellY, cellWidth, cellHeight);

          // Add parameter labels within margin space
          doc.setFontSize(5);
          doc.setTextColor(0, 0, 0);
          
          // Column label (top margin area)
          if (row === 0) {
            const colLabel = formatTransformationValue(transformations.horizontal.type, horizontalValue);
            doc.text(colLabel, cellX + cellWidth / 2, gridStartY - 0.02, { align: 'center' });
          }
          
          // Row label (left margin area)
          if (col === 0) {
            const rowLabel = formatTransformationValue(transformations.vertical.type, verticalValue);
            doc.text(rowLabel, cardX + labelMargin - 0.02, cellY + cellHeight / 2, { 
              align: 'right',
              angle: 90 
            });
          }
        }
      }

      // Add compact instructions at bottom of card (within boundaries)
      const instructionY = cardY + scaledCardHeight - 0.08;
      doc.setFontSize(4);
      doc.setTextColor(100, 100, 100); // Gray text
      doc.text('Print → Compare → Select best cell → Apply settings', cardX + scaledCardWidth / 2, instructionY, { align: 'center' });

      // Return PDF as blob
      resolve(doc.output('blob'));
    } catch (error) {
      console.error('Failed to generate color calibration PDF:', error);
      reject(error);
    }
    })();
  });
}

/**
 * Generate evenly spaced transformation values between min and max
 */
function generateTransformationValues(min: number, max: number, count: number): number[] {
  if (count === 1) return [(min + max) / 2];
  
  const values: number[] = [];
  const step = (max - min) / (count - 1);
  
  for (let i = 0; i < count; i++) {
    values.push(min + i * step);
  }
  
  return values;
}

/**
 * Create base transformation with default values
 */
function createBaseTransformation(): ColorTransformation {
  return {
    brightness: 0,
    contrast: 1.0,
    saturation: 0,
    hue: 0,
    gamma: 1.0,
    vibrance: 0,
    redMultiplier: 1.0,
    greenMultiplier: 1.0,
    blueMultiplier: 1.0,
    shadows: 0,
    highlights: 0,
    midtoneBalance: 0,
    blackPoint: 0,
    whitePoint: 255,
    outputBlack: 0,
    outputWhite: 255
  };
}

/**
 * Apply a transformation value to a specific field
 */
function applyTransformationValue(
  transformation: ColorTransformation,
  type: string,
  value: number
): void {
  (transformation as unknown as Record<string, number>)[type] = value;
}

/**
 * Format transformation value for display labels
 */
function formatTransformationValue(type: string, value: number): string {
  switch (type) {
    case 'brightness':
    case 'saturation':
    case 'hue':
    case 'vibrance':
    case 'shadows':
    case 'highlights':
    case 'midtoneBalance':
      return `${value >= 0 ? '+' : ''}${Math.round(value)}`;
    case 'contrast':
    case 'gamma':
    case 'redMultiplier':
    case 'greenMultiplier':
    case 'blueMultiplier':
      return `${value.toFixed(2)}x`;
    case 'blackPoint':
    case 'whitePoint':
    case 'outputBlack':
    case 'outputWhite':
      return `${Math.round(value)}`;
    default:
      return `${value.toFixed(1)}`;
  }
}
