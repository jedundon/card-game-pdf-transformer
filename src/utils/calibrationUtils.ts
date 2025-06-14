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
 * @returns Blob PDF blob for download
 */
export function generateCalibrationPDF(
  cardWidth: number = 2.5,
  cardHeight: number = 3.5,
  mediaWidth: number = 8.5,
  mediaHeight: number = 11.0,
  offsetX: number = 0,
  offsetY: number = 0,
  rotation: number = 0
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
  
  // For rotation, we'll apply it manually to all coordinates
  // Note: For simplicity in this calibration, we'll focus on position and scale first
  // Full rotation support can be added in a future iteration if needed
  // 1. Draw card outline (border of the intended card area with safe margin)
  doc.setDrawColor(0, 0, 0); // Black
  doc.setLineWidth(0.03);
  doc.rect(cardX + 0.1, cardY + 0.1, cardWidth - 0.2, cardHeight - 0.2);
  // 2. Draw measurement reference lines and ticks within the safe card area
  const tickLength = 0.06;
  const safeInset = 0.5; // Large inset for reliable measurement and scaling tolerance
  
  doc.setLineWidth(0.02); // Make thicker so they're visible
  doc.setDrawColor(0, 0, 0); // Black
  
  // Top edge reference line and ticks
  const topLineY = cardY + safeInset;
  doc.line(cardX + safeInset, topLineY, cardX + cardWidth - safeInset, topLineY);
  for (let x = 0.5; x < cardWidth; x += 0.5) {
    if (x > safeInset && x < cardWidth - safeInset) {
      const tickX = cardX + x;
      doc.line(tickX, topLineY - tickLength/2, tickX, topLineY + tickLength/2);
      doc.setFontSize(8);
      doc.text(x.toFixed(1), tickX - 0.05, topLineY - tickLength/2 - 0.05);
    }
  }  
  // Bottom edge reference line and ticks
  const bottomLineY = cardY + cardHeight - safeInset;
  doc.line(cardX + safeInset, bottomLineY, cardX + cardWidth - safeInset, bottomLineY);
  for (let x = 0.5; x < cardWidth; x += 0.5) {
    if (x > safeInset && x < cardWidth - safeInset) {
      const tickX = cardX + x;
      doc.line(tickX, bottomLineY - tickLength/2, tickX, bottomLineY + tickLength/2);
      doc.setFontSize(8);
      doc.text(x.toFixed(1), tickX - 0.05, bottomLineY + tickLength/2 + 0.1);
    }
  }
  
  // Left edge reference line and ticks
  const leftLineX = cardX + safeInset;
  doc.line(leftLineX, cardY + safeInset, leftLineX, cardY + cardHeight - safeInset);
  for (let y = 0.5; y < cardHeight; y += 0.5) {
    if (y > safeInset && y < cardHeight - safeInset) {
      const tickY = cardY + y;
      doc.line(leftLineX - tickLength/2, tickY, leftLineX + tickLength/2, tickY);
      doc.setFontSize(8);
      doc.text(y.toFixed(1), leftLineX + tickLength/2 + 0.02, tickY + 0.03);
    }
  }
  
  // Right edge reference line and ticks
  const rightLineX = cardX + cardWidth - safeInset;
  doc.line(rightLineX, cardY + safeInset, rightLineX, cardY + cardHeight - safeInset);
  for (let y = 0.5; y < cardHeight; y += 0.5) {
    if (y > safeInset && y < cardHeight - safeInset) {
      const tickY = cardY + y;
      doc.line(rightLineX - tickLength/2, tickY, rightLineX + tickLength/2, tickY);
      doc.setFontSize(8);
      doc.text(y.toFixed(1), rightLineX - tickLength/2 - 0.15, tickY + 0.03);
    }
  }
    // 3. Draw center crosshairs as measurement scale bars
  const crossLength = 1.0; // 1 inch each direction from center
  const centerX = cardX + cardWidth/2;
  const centerY = cardY + cardHeight/2;
  
  doc.setLineWidth(0.03);
  doc.setDrawColor(0, 0, 0); // Black
  
  // Horizontal scale bar (1" each direction from center)
  doc.line(centerX - crossLength/2, centerY, centerX + crossLength/2, centerY);
  
  // Vertical scale bar (1" each direction from center)  
  doc.line(centerX, centerY - crossLength/2, centerX, centerY + crossLength/2);
  
  // Add end caps for precise measurement
  const capSize = 0.03;
  // Horizontal caps
  doc.line(centerX - crossLength/2, centerY - capSize, centerX - crossLength/2, centerY + capSize);
  doc.line(centerX + crossLength/2, centerY - capSize, centerX + crossLength/2, centerY + capSize);
  // Vertical caps
  doc.line(centerX - capSize, centerY - crossLength/2, centerX + capSize, centerY - crossLength/2);
  doc.line(centerX - capSize, centerY + crossLength/2, centerX + capSize, centerY + crossLength/2);
  
  // Scale bar labels
  doc.setFontSize(8);
  doc.text('1.0"', centerX + crossLength/2 + 0.05, centerY - 0.05); // Horizontal label
  doc.text('1.0"', centerX - 0.05, centerY - crossLength/2 - 0.05); // Vertical label
    // Center point
  doc.setDrawColor(100, 100, 100); // Gray
  doc.setLineWidth(0.01);
  const centerDot = 0.02;
  doc.circle(centerX, centerY, centerDot, 'F');
  
  // 4. Add instructions text (positioned safely within card)
  doc.setFontSize(12);
  doc.setTextColor(0, 0, 0);
  
  doc.text('CALIBRATION CARD', centerX, cardY + 0.4, { align: 'center' });
  
  doc.setFontSize(8);
  doc.text('1. Print borderless on poker card stock', cardX + 0.2, cardY + cardHeight - 0.6);
  doc.text('2. Measure from card edge to reference lines', cardX + 0.2, cardY + cardHeight - 0.5);
  doc.text('3. Measure center crosshair scale bars', cardX + 0.2, cardY + cardHeight - 0.4);
  doc.text('4. Enter measurements to refine settings', cardX + 0.2, cardY + cardHeight - 0.3);
  
  // Add note about card dimensions (positioned safely)
  doc.setFontSize(8);
  doc.text(`Card: ${cardWidth}" × ${cardHeight}"`, cardX + 0.2, cardY + 0.6);
  
  // Add current settings information outside the card area
  doc.setFontSize(8);
  doc.text(`Media: ${mediaWidth}" × ${mediaHeight}"`, 0.1, 0.3);
  doc.text('Place poker card in center', 0.1, 0.5);
  
  // Current app settings being tested
  doc.text('Current Settings:', 0.1, 0.8);
  doc.text(`Offset: ${offsetX >= 0 ? '+' : ''}${offsetX.toFixed(3)}", ${offsetY >= 0 ? '+' : ''}${offsetY.toFixed(3)}"`, 0.1, 0.9);
  if (rotation !== 0) {
    doc.text(`Rotation: ${rotation}°`, 0.1, 1.0);
  }
  doc.text('Expected margins: ~0.5" if aligned', 0.1, rotation !== 0 ? 1.1 : 1.0);

  // Return the PDF as a blob
  return doc.output('blob');
}

/**
 * Calculates offset and scale corrections from user measurements
 * @param measuredLeftMargin Distance from left edge of card to left reference line (inches) - should be ~0.5" if aligned
 * @param measuredRightMargin Distance from right edge of card to right reference line (inches) - should be ~0.5" if aligned
 * @param measuredTopMargin Distance from top edge of card to top reference line (inches) - should be ~0.5" if aligned
 * @param measuredBottomMargin Distance from bottom edge of card to bottom reference line (inches) - should be ~0.5" if aligned
 * @param measuredHorizontalScale Actual printed length of the horizontal 1" crosshair scale bar (inches)
 * @param measuredVerticalScale Actual printed length of the vertical 1" crosshair scale bar (inches)
 * @param currentHorizontalOffset Current horizontal offset setting (inches)
 * @param currentVerticalOffset Current vertical offset setting (inches)
 * @param currentScalePercent Current scale percentage setting
 * @returns Object with new offset values and scale adjustments
 */
export function calculateCalibrationSettings(
  measuredLeftMargin: number,
  measuredRightMargin: number,
  measuredTopMargin: number,
  measuredBottomMargin: number,
  measuredHorizontalScale: number,
  measuredVerticalScale: number = measuredHorizontalScale, // Default to horizontal if not provided
  currentHorizontalOffset: number = 0,
  currentVerticalOffset: number = 0,
  currentScalePercent: number = 100
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
} {  // Expected margin if perfectly aligned (safe inset distance)
  const expectedMargin = 0.5;
  
  // CORRECTED APPROACH: Calculate how far the card is shifted from center
  // 
  // If left margin is small and right margin is large:
  //   - Card is positioned too far left
  //   - Need positive offset to move card right
  // 
  // If left margin is large and right margin is small:
  //   - Card is positioned too far right  
  //   - Need negative offset to move card left
  
  const leftError = measuredLeftMargin - expectedMargin;   // negative = less margin than expected
  const rightError = measuredRightMargin - expectedMargin; // negative = less margin than expected  // Calculate actual position shift:
  // If left margin is too small by 0.2" and right margin is too large by 0.2",
  // the card is shifted left by 0.2" (need +0.2" offset to fix)
  const horizontalShift = Math.round(((rightError - leftError) / 2) * 1000) / 1000;
  const verticalShift = Math.round(((measuredBottomMargin - expectedMargin - (measuredTopMargin - expectedMargin)) / 2) * 1000) / 1000;
    
  // Apply corrections to current settings (round to avoid floating point precision issues)
  const newHorizontalOffset = Math.round((currentHorizontalOffset + horizontalShift) * 1000) / 1000;
  const newVerticalOffset = Math.round((currentVerticalOffset + verticalShift) * 1000) / 1000;
  
  // SIMPLIFIED SCALE CALCULATION: Use the more accurate measurement
  // Instead of averaging, use the measurement that's closer to expected (more reliable)
  const horizontalScaleError = Math.abs(measuredHorizontalScale - 1.0);
  const verticalScaleError = Math.abs(measuredVerticalScale - 1.0);
  
  // Use the measurement with smaller error (more accurate)
  const bestScaleMeasurement = horizontalScaleError <= verticalScaleError ? 
    measuredHorizontalScale : measuredVerticalScale;
  
  const scaleCorrection = 1.0 / bestScaleMeasurement;
  const newScalePercent = Math.round(currentScalePercent * scaleCorrection);
    // Generate diagnostic messages
  const horizontalCentering = Math.abs(horizontalShift) < 0.01 ? 
    "Well centered" : 
    `Off by ${Math.abs(horizontalShift).toFixed(3)}" ${horizontalShift > 0 ? 'right' : 'left'}`;
    
  const verticalCentering = Math.abs(verticalShift) < 0.01 ? 
    "Well centered" : 
    `Off by ${Math.abs(verticalShift).toFixed(3)}" ${verticalShift > 0 ? 'down' : 'up'}`;
      const scaleAccuracy = Math.abs(bestScaleMeasurement - 1.0) < 0.01 ? 
    "Accurate scale" : 
    `Printer ${bestScaleMeasurement > 1.0 ? 'enlarges' : 'shrinks'} by ${Math.abs((bestScaleMeasurement - 1.0) * 100).toFixed(1)}%`;
  
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
 * OFFSET CALCULATION EXAMPLES:
 * 
 * Example 1: Card too far left
 * - Left margin: 0.3" (0.2" less than expected 0.5")
 * - Right margin: 0.7" (0.2" more than expected 0.5")
 * - leftError = 0.3 - 0.5 = -0.2"
 * - rightError = 0.7 - 0.5 = +0.2"
 * - horizontalShift = (+0.2 - (-0.2)) / 2 = +0.2"
 * - Result: Add +0.2" offset to move card right ✓
 * 
 * Example 2: Card too far right  
 * - Left margin: 0.7" (0.2" more than expected 0.5")
 * - Right margin: 0.3" (0.2" less than expected 0.5")
 * - leftError = 0.7 - 0.5 = +0.2"
 * - rightError = 0.3 - 0.5 = -0.2"
 * - horizontalShift = (-0.2 - (+0.2)) / 2 = -0.2"
 * - Result: Add -0.2" offset to move card left ✓
 * 
 * Example 3: Card centered but scaled
 * - Left margin: 0.4" (0.1" less than expected 0.5")
 * - Right margin: 0.4" (0.1" less than expected 0.5")  
 * - leftError = 0.4 - 0.5 = -0.1"
 * - rightError = 0.4 - 0.5 = -0.1"
 * - horizontalShift = (-0.1 - (-0.1)) / 2 = 0"
 * - Result: No offset change needed (just scale issue) ✓
 */
