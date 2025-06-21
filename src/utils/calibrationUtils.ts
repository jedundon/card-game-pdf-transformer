import { jsPDF } from 'jspdf';

/**
 * Generates a calibration PDF for printer offset and scale testing
 * @param cardWidth Width of the card in inches (default: 2.5")
 * @param cardHeight Height of the card in inches (default: 3.5") 
 * @param mediaWidth Width of the media in inches
 * @param mediaHeight Height of the media in inches
 * @param offsetX Horizontal offset in inches
 * @param offsetY Vertical offset in inches
 * @param rotation Rotation angle in degrees
 * @param scalePercent Scale percentage to apply to crosshair (default: 100)
 * @returns Blob PDF blob for download
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
  
  // Draw crosshair arms
  doc.setLineWidth(0.04);
  doc.setDrawColor(0, 0, 0); // Black
  
  // Horizontal crosshair arm (scaled length each direction from center)
  doc.line(centerX - scaledCrossLength/2, centerY, centerX + scaledCrossLength/2, centerY);
  
  // Vertical crosshair arm (scaled length each direction from center)  
  doc.line(centerX, centerY - scaledCrossLength/2, centerX, centerY + scaledCrossLength/2);
  
  // Add prominent end caps for precise measurement
  const capSize = 0.04;
  doc.setLineWidth(0.03);
  // Horizontal caps
  doc.line(centerX - scaledCrossLength/2, centerY - capSize, centerX - scaledCrossLength/2, centerY + capSize);
  doc.line(centerX + scaledCrossLength/2, centerY - capSize, centerX + scaledCrossLength/2, centerY + capSize);
  // Vertical caps
  doc.line(centerX - capSize, centerY - scaledCrossLength/2, centerX + capSize, centerY - scaledCrossLength/2);
  doc.line(centerX - capSize, centerY + scaledCrossLength/2, centerX + capSize, centerY + scaledCrossLength/2);
  
  // Crosshair measurement labels
  doc.setFontSize(10);
  doc.text('1.0"', centerX + scaledCrossLength/2 + 0.05, centerY + 0.05); // Horizontal label
  doc.text('1.0"', centerX + 0.05, centerY - scaledCrossLength/2 - 0.05); // Vertical label
  
  // Center point for measurement reference
  doc.setDrawColor(0, 0, 0); // Black
  doc.setLineWidth(0.02);
  const centerDot = 0.03;
  doc.circle(centerX, centerY, centerDot, 'F');
  
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
  // If measured distance is larger than expected, card is too far in that direction
  const horizontalShift = Math.round((expectedRightDistance - measuredRightDistance) * 1000) / 1000;
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
