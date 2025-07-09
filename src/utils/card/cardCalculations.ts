/**
 * @fileoverview Card mathematical calculations
 * 
 * Contains functions for mathematical operations related to card processing,
 * including DPI conversions, scaling, dimension calculations, and counts.
 */

import { DPI_CONSTANTS } from '../../constants';
import { PdfMode, PageSettings, OutputSettings, SkippedCard } from '../../types';

/**
 * Calculate effective card count excluding skipped cards
 * 
 * This function computes the total number of unique cards that will be processed,
 * accounting for the PDF mode and any cards that have been marked as skipped.
 * 
 * @param pdfMode - PDF processing mode configuration
 * @param activePages - Array of non-skipped pages
 * @param cardsPerPage - Number of cards per page based on grid settings (rows × columns)
 * @param skippedCards - Array of individual card positions to skip
 * @returns Total number of cards that will be processed (total - skipped)
 * 
 * @example
 * ```typescript
 * const pdfMode = { type: 'duplex', orientation: 'vertical', flipEdge: 'short' };
 * const activePages = [{ type: 'front' }, { type: 'back' }];
 * const cardsPerPage = 6; // 2×3 grid
 * const skipped = [{ pageIndex: 0, gridRow: 0, gridColumn: 0 }];
 * const effective = getEffectiveCardCount(pdfMode, activePages, cardsPerPage, skipped); // 5 cards
 * ```
 */
export function getEffectiveCardCount(
  pdfMode: PdfMode,
  activePages: PageSettings[],
  cardsPerPage: number,
  skippedCards: SkippedCard[] = []
): number {
  const totalCards = calculateTotalCards(pdfMode, activePages, cardsPerPage);
  const skippedCount = skippedCards.length;
  return Math.max(0, totalCards - skippedCount);
}

/**
 * Calculate total unique cards based on PDF mode and settings
 * 
 * This is a core function that determines how many unique cards exist in the PDF
 * based on the processing mode. The algorithm varies significantly by mode:
 * 
 * - **Duplex Mode**: Each front page represents unique cards, back pages are duplicates
 *   Formula: (number of front pages) × (cards per page)
 * 
 * - **Gutter-fold Mode**: Each page contains unique cards for both front and back
 *   Formula: (total pages) × (cards per page)
 * 
 * - **Simplex Mode**: Each page is treated as containing unique cards
 *   Formula: (total pages) × (cards per page)
 * 
 * @param pdfMode - PDF processing mode configuration
 * @param activePages - Array of non-skipped pages with their types
 * @param cardsPerPage - Number of cards per page (grid rows × columns)
 * @returns Total number of unique cards in the PDF
 * 
 * @example
 * ```typescript
 * // Duplex mode with 2 front pages and 2 back pages, 6 cards per page
 * const duplexMode = { type: 'duplex', flipEdge: 'short' };
 * const duplexPages = [
 *   { type: 'front' }, { type: 'back' }, 
 *   { type: 'front' }, { type: 'back' }
 * ];
 * const total = calculateTotalCards(duplexMode, duplexPages, 6); // Returns 12 (2 front pages × 6)
 * 
 * // Gutter-fold mode with 3 pages, 8 cards per page
 * const gutterMode = { type: 'gutter-fold', orientation: 'vertical' };
 * const gutterPages = [{}, {}, {}];
 * const total2 = calculateTotalCards(gutterMode, gutterPages, 8); // Returns 24 (3 pages × 8)
 * ```
 */
export function calculateTotalCards(
  pdfMode: PdfMode,
  activePages: PageSettings[],
  cardsPerPage: number
): number {
  const totalPages = activePages.length;
  
  if (pdfMode.type === 'duplex') {
    // In duplex mode, each page contains real cards (front or back)
    // Total physical cards = total pages * cards per page
    return totalPages * cardsPerPage;
  } else if (pdfMode.type === 'gutter-fold') {
    // In gutter-fold mode, each page contains both front and back cards
    // Total unique cards = total pages * cards per page (each card is unique)
    return totalPages * cardsPerPage;
  } else {
    // Fallback: treat each image as a unique card
    return totalPages * cardsPerPage;
  }
}

/**
 * Calculate card dimensions with bleed and scaling
 * 
 * Computes final card dimensions in pixels based on output settings,
 * including bleed margins and scale percentages. This is used throughout
 * the application for consistent card sizing.
 * 
 * **Calculation Steps:**
 * 1. Start with base card dimensions (e.g., 2.5" × 3.5")
 * 2. Add bleed margins to all edges (extends outward)
 * 3. Apply scale percentage to the final dimensions
 * 4. Convert to pixels using extraction DPI (300)
 * 
 * @param outputSettings - Configuration including card size, bleed, and scale
 * @returns Object containing dimensions in pixels and inches, plus metadata
 * 
 * @example
 * ```typescript
 * const settings = {
 *   cardSize: { widthInches: 2.5, heightInches: 3.5 },
 *   bleedMarginInches: 0.125,
 *   cardScalePercent: 95
 * };
 * const dims = calculateCardDimensions(settings);
 * // dims.scaledCardWidthInches = (2.5 + 0.25) * 0.95 = 2.6125"
 * // dims.width = 2.6125 * 300 = 783.75 pixels
 * ```
 */
export function calculateCardDimensions(
  outputSettings: OutputSettings
) {
  // Use new card size settings with bleed
  const baseCardWidthInches = outputSettings.cardSize?.widthInches || 2.5;
  const baseCardHeightInches = outputSettings.cardSize?.heightInches || 3.5;
  const bleedMarginInches = outputSettings.bleedMarginInches || 0;  // Add bleed to the target card size (this is the actual print target)
  // Bleed extends outward from each edge, so we add bleedMarginInches to each side
  const targetCardWidthInches = baseCardWidthInches + (bleedMarginInches * 2);
  const targetCardHeightInches = baseCardHeightInches + (bleedMarginInches * 2);
  
  // Apply scale percentage to the target card dimensions
  const scalePercent = outputSettings.cardScalePercent || 100;
  const scaledCardWidthInches = targetCardWidthInches * (scalePercent / 100);
  const scaledCardHeightInches = targetCardHeightInches * (scalePercent / 100);
  
  // Convert to pixels at extraction DPI (using the scaled dimensions)
  const cardWidthPx = scaledCardWidthInches * DPI_CONSTANTS.EXTRACTION_DPI;
  const cardHeightPx = scaledCardHeightInches * DPI_CONSTANTS.EXTRACTION_DPI;
  return {
    width: cardWidthPx,
    height: cardHeightPx,
    scaleFactor: scalePercent / 100,
    aspectRatio: cardWidthPx / cardHeightPx,
    // Return the base card dimensions (without bleed) for reference
    baseCardWidthInches,
    baseCardHeightInches,
    // Return the target dimensions (with bleed, before scaling)
    targetCardWidthInches,
    targetCardHeightInches,
    // Return the final scaled dimensions (with bleed and scale applied)
    scaledCardWidthInches,
    scaledCardHeightInches,
    bleedMarginInches
  };
}

/**
 * Calculate preview scale for display in UI
 */
export function calculatePreviewScale(
  pageWidth: number,
  pageHeight: number,
  maxWidth = 400,
  maxHeight = 500
): { scale: number; previewWidth: number; previewHeight: number } {
  let width = pageWidth * DPI_CONSTANTS.SCREEN_DPI;
  let height = pageHeight * DPI_CONSTANTS.SCREEN_DPI;
  
  let scale = 1;
  if (width > maxWidth || height > maxHeight) {
    const widthScale = maxWidth / width;
    const heightScale = maxHeight / height;
    scale = Math.min(widthScale, heightScale);
    
    width = width * scale;
    height = height * scale;
  }
  
  return { scale, previewWidth: width, previewHeight: height };
}

/**
 * Calculate DPI scale factor for preview calculations
 */
export function getDpiScaleFactor(): number {
  return DPI_CONSTANTS.EXTRACTION_DPI / DPI_CONSTANTS.SCREEN_DPI;
}

/**
 * Calculate card image dimensions based on sizing mode
 * 
 * Determines how a card image should be sized within the target card area
 * based on the selected sizing mode. Returns both the final image size
 * and the original image dimensions for reference.
 * 
 * **Sizing Modes:**
 * - `actual-size`: Use image at original extracted size (no scaling)
 * - `fit-to-card`: Scale to fit entirely within card bounds (letterboxed)
 * - `fill-card`: Scale to fill entire card area (may crop edges)
 * 
 * **Algorithm:**
 * 1. Load image to get natural pixel dimensions
 * 2. Convert pixels to inches using extraction DPI (300)
 * 3. Apply sizing mode calculations:
 *    - Actual: No change to dimensions
 *    - Fit: Scale down/up to fit within bounds, preserve aspect ratio
 *    - Fill: Scale to cover entire area, preserve aspect ratio
 * 
 * @param cardImageUrl - Data URL of the extracted card image
 * @param targetCardWidthInches - Target card width in inches
 * @param targetCardHeightInches - Target card height in inches
 * @param sizingMode - How to size the image within the card area
 * @returns Promise resolving to object with final and original dimensions in inches
 * 
 * @example
 * ```typescript
 * const result = await calculateCardImageDimensions(
 *   cardDataUrl,
 *   2.5, // target width
 *   3.5, // target height
 *   'fit-to-card'
 * );
 * 
 * // For an image that's 1.8" × 4.0" original:
 * // - Fit mode scales down to fit height: 1.575" × 3.5"
 * // result.width = 1.575, result.height = 3.5
 * // result.imageWidth = 1.8, result.imageHeight = 4.0
 * ```
 * 
 * @throws {Error} When image fails to load or has invalid dimensions
 */
export function calculateCardImageDimensions(
  cardImageUrl: string,
  targetCardWidthInches: number,
  targetCardHeightInches: number,
  sizingMode: 'actual-size' | 'fit-to-card' | 'fill-card' = 'actual-size'
): Promise<{ width: number; height: number; imageWidth: number; imageHeight: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const imageWidthPx = img.naturalWidth;
      const imageHeightPx = img.naturalHeight;
      
      // Convert image pixels to inches (assuming the image was extracted at EXTRACTION_DPI)
      const imageWidthInches = imageWidthPx / DPI_CONSTANTS.EXTRACTION_DPI;
      const imageHeightInches = imageHeightPx / DPI_CONSTANTS.EXTRACTION_DPI;
      
      let finalWidthInches = imageWidthInches;
      let finalHeightInches = imageHeightInches;
      
      switch (sizingMode) {
        case 'actual-size': {
          // Use the image at its original size (no scaling)
          finalWidthInches = imageWidthInches;
          finalHeightInches = imageHeightInches;
          break;
        }
          
        case 'fit-to-card': {
          // Scale the image to fit entirely within the card boundaries, maintaining aspect ratio
          const imageAspectRatio = imageWidthInches / imageHeightInches;
          const cardAspectRatio = targetCardWidthInches / targetCardHeightInches;
          
          if (imageAspectRatio > cardAspectRatio) {
            // Image is wider relative to its height than the card - fit to width
            finalWidthInches = targetCardWidthInches;
            finalHeightInches = targetCardWidthInches / imageAspectRatio;
          } else {
            // Image is taller relative to its width than the card - fit to height
            finalHeightInches = targetCardHeightInches;
            finalWidthInches = targetCardHeightInches * imageAspectRatio;
          }
          break;
        }
          
        case 'fill-card': {
          // Scale the image to fill the entire card area, maintaining aspect ratio (may crop edges)
          const imageAspectRatioFill = imageWidthInches / imageHeightInches;
          const cardAspectRatioFill = targetCardWidthInches / targetCardHeightInches;
          
          if (imageAspectRatioFill > cardAspectRatioFill) {
            // Image is wider - scale to fill height and crop width
            finalHeightInches = targetCardHeightInches;
            finalWidthInches = targetCardHeightInches * imageAspectRatioFill;
          } else {
            // Image is taller - scale to fill width and crop height
            finalWidthInches = targetCardWidthInches;
            finalHeightInches = targetCardWidthInches / imageAspectRatioFill;
          }
          break;
        }
      }
      
      resolve({
        width: finalWidthInches,
        height: finalHeightInches,
        imageWidth: imageWidthInches,
        imageHeight: imageHeightInches
      });
    };
    img.onerror = reject;
    img.src = cardImageUrl;
  });
}