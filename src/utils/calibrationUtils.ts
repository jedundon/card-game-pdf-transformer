import { jsPDF } from 'jspdf';

/**
 * Generates a calibration PDF for printer offset and scale testing
 * @param cardWidth Width of the card in inches (default: 2.5")
 * @param cardHeight Height of the card in inches (default: 3.5") 
 * @returns Blob PDF blob for download
 */
export function generateCalibrationPDF(
  cardWidth: number = 2.5,
  cardHeight: number = 3.5,
  mediaWidth: number = 8.5,
  mediaHeight: number = 11.0
): Blob {
  // Create PDF with media dimensions to trick printer into borderless mode
  const doc = new jsPDF({
    unit: 'in',
    format: [mediaWidth, mediaHeight],
    compress: true
  });

  // Center the card on the media
  const cardX = (mediaWidth - cardWidth) / 2;
  const cardY = (mediaHeight - cardHeight) / 2;
  
  console.log(`Generating calibration PDF: ${cardWidth}" × ${cardHeight}" card centered on ${mediaWidth}" × ${mediaHeight}" media`);
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
  doc.circle(centerX, centerY, centerDot, 'F');  // 4. Add instructions text (positioned safely within card)
  doc.setFontSize(12);
  doc.setTextColor(0, 0, 0);
  
  doc.text('CALIBRATION CARD', centerX, cardY + 0.4, { align: 'center' });
  
  doc.setFontSize(8);
  doc.text('1. Print borderless on poker card stock', cardX + 0.2, cardY + cardHeight - 0.6);
  doc.text('2. Measure from card edge to reference lines', cardX + 0.2, cardY + cardHeight - 0.5);
  doc.text('3. Measure center crosshair scale bars', cardX + 0.2, cardY + cardHeight - 0.4);
  
  // Add note about card dimensions (positioned safely)
  doc.setFontSize(8);
  doc.text(`Card: ${cardWidth}" × ${cardHeight}"`, cardX + 0.2, cardY + 0.6);
  
  // Add media information outside the card area
  doc.setFontSize(8);
  doc.text(`Media: ${mediaWidth}" × ${mediaHeight}"`, 0.1, 0.3);
  doc.text('Place poker card in center', 0.1, 0.5);

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
 * @returns Object with horizontal/vertical offsets and scale factors
 */
export function calculateCalibrationSettings(
  measuredLeftMargin: number,
  measuredRightMargin: number,
  measuredTopMargin: number,
  measuredBottomMargin: number,
  measuredHorizontalScale: number,
  measuredVerticalScale: number = measuredHorizontalScale // Default to horizontal if not provided
): {
  horizontalOffset: number;
  verticalOffset: number;
  horizontalScaleFactor: number;
  verticalScaleFactor: number;
} {
  // Expected margin if perfectly aligned (safe inset distance)
  const expectedMargin = 0.5;
  
  // Calculate offsets from margin differences relative to expected position
  const leftOffset = measuredLeftMargin - expectedMargin;
  const rightOffset = measuredRightMargin - expectedMargin;
  const topOffset = measuredTopMargin - expectedMargin;
  const bottomOffset = measuredBottomMargin - expectedMargin;
  
  // Calculate net offsets (average of opposite sides)
  const horizontalOffset = (rightOffset - leftOffset) / 2;
  const verticalOffset = (bottomOffset - topOffset) / 2;
  
  // Calculate scale factors from crosshair measurements
  const intendedScaleLength = 1.0; // inches
  const horizontalScaleFactor = intendedScaleLength / measuredHorizontalScale;
  const verticalScaleFactor = intendedScaleLength / measuredVerticalScale;
  
  return {
    horizontalOffset,
    verticalOffset,
    horizontalScaleFactor,
    verticalScaleFactor
  };
}
