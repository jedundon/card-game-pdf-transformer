import { DPI_CONSTANTS } from '../constants';

// Utility functions for card calculations and extraction
// Shared between ExtractStep and ConfigureStep components

interface PageSettings {
  skip?: boolean;
  type?: string;
}

interface PdfMode {
  type: string;
  orientation?: string;
  flipEdge?: string;
}

interface ExtractionSettings {
  grid: {
    rows: number;
    columns: number;
  };
  crop: {
    left: number;
    right: number;
    top: number;
    bottom: number;
  };
  gutterWidth?: number;
  cardCrop?: {
    left: number;
    right: number;
    top: number;
    bottom: number;
  };
}

interface CardInfo {
  type: string;
  id: number;
}

/**
 * Calculate active pages (non-skipped pages)
 */
export function getActivePages(pageSettings: PageSettings[]): PageSettings[] {
  return pageSettings.filter((page: PageSettings) => !page?.skip);
}

/**
 * Calculate total unique cards based on PDF mode and settings
 */
export function calculateTotalCards(
  pdfMode: PdfMode,
  activePages: PageSettings[],
  cardsPerPage: number
): number {
  const totalPages = activePages.length;
  
  if (pdfMode.type === 'duplex') {
    // In duplex mode, front and back pages alternate
    const frontPages = activePages.filter((page: PageSettings) => page.type === 'front').length;
    return frontPages * cardsPerPage; // Each front card has a corresponding back card
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
 * Calculate card front/back identification based on PDF mode
 */
export function getCardInfo(
  cardIndex: number,
  activePages: PageSettings[],
  extractionSettings: ExtractionSettings,
  pdfMode: PdfMode,
  cardsPerPage: number
): CardInfo {
  if (!activePages.length) return { type: 'Unknown', id: 0 };
  
  const pageIndex = Math.floor(cardIndex / cardsPerPage);
  const cardOnPage = cardIndex % cardsPerPage;
  
  if (pageIndex >= activePages.length) return { type: 'Unknown', id: 0 };
  
  const pageType = activePages[pageIndex]?.type || 'front';
  
  if (pdfMode.type === 'duplex') {
    // In duplex mode, front and back pages alternate
    // Calculate global card ID based on which front page this card logically belongs to
    
    if (pageType === 'front') {
      // Front cards: global sequential numbering
      // Find which front page this is (0-indexed)
      const frontPageIndex = Math.floor(pageIndex / 2);
      const globalCardId = frontPageIndex * cardsPerPage + cardOnPage + 1;
      return { type: 'Front', id: globalCardId };
    } else {
      // Back cards: need to map physical position to logical card ID
      // Find which front page this back page corresponds to
      const correspondingFrontPageIndex = Math.floor((pageIndex - 1) / 2);
      
      if (pdfMode.flipEdge === 'short') {
        // Short edge flip: horizontally mirrored
        // Top-left becomes top-right, etc.
        const row = Math.floor(cardOnPage / extractionSettings.grid.columns);
        const col = cardOnPage % extractionSettings.grid.columns;
        const flippedCol = extractionSettings.grid.columns - 1 - col;
        const logicalCardOnPage = row * extractionSettings.grid.columns + flippedCol;
        const globalCardId = correspondingFrontPageIndex * cardsPerPage + logicalCardOnPage + 1;
        return { type: 'Back', id: globalCardId };
      } else {
        // Long edge flip: vertically mirrored
        // Top-left becomes bottom-left, etc.
        const row = Math.floor(cardOnPage / extractionSettings.grid.columns);
        const col = cardOnPage % extractionSettings.grid.columns;
        const flippedRow = extractionSettings.grid.rows - 1 - row;
        const logicalCardOnPage = flippedRow * extractionSettings.grid.columns + col;
        const globalCardId = correspondingFrontPageIndex * cardsPerPage + logicalCardOnPage + 1;
        return { type: 'Back', id: globalCardId };
      }
    }
  } else if (pdfMode.type === 'gutter-fold') {
    // In gutter-fold mode, each page contains both front and back cards
    // Front and back cards have matching IDs (e.g., Front 1 and Back 1 are the same logical card)
    // Card IDs should continue across pages
    
    if (pdfMode.orientation === 'vertical') {
      // Portrait gutter-fold: left side is front, right side is back
      // Cards should be mirrored across the vertical gutter line
      const row = Math.floor(cardOnPage / extractionSettings.grid.columns);
      const col = cardOnPage % extractionSettings.grid.columns;
      const halfColumns = extractionSettings.grid.columns / 2;
      const isLeftSide = col < halfColumns;
      
      // Calculate cards per half-page (only count front or back cards)
      const cardsPerHalfPage = extractionSettings.grid.rows * halfColumns;
      const pageOffset = pageIndex * cardsPerHalfPage;
      
      if (isLeftSide) {
        // Front card: calculate ID based on position in left half + page offset
        const cardIdInSection = row * halfColumns + col + 1;
        const globalCardId = pageOffset + cardIdInSection;
        return { type: 'Front', id: globalCardId };
      } else {
        // Back card: mirror position across gutter line
        // Rightmost card (col = columns-1) matches leftmost (col = 0)
        const rightCol = col - halfColumns; // Position within right half (0-based)
        const mirroredCol = halfColumns - 1 - rightCol; // Mirror across the gutter
        const cardIdInSection = row * halfColumns + mirroredCol + 1;
        const globalCardId = pageOffset + cardIdInSection;
        return { type: 'Back', id: globalCardId };
      }
    } else {
      // Landscape gutter-fold: top is front, bottom is back
      // Cards should be mirrored across the horizontal gutter line
      const row = Math.floor(cardOnPage / extractionSettings.grid.columns);
      const col = cardOnPage % extractionSettings.grid.columns;
      const halfRows = extractionSettings.grid.rows / 2;
      const isTopHalf = row < halfRows;
      
      // Calculate cards per half-page (only count front or back cards)
      const cardsPerHalfPage = halfRows * extractionSettings.grid.columns;
      const pageOffset = pageIndex * cardsPerHalfPage;
      
      if (isTopHalf) {
        // Front card: calculate ID based on position in top half + page offset
        const cardIdInSection = row * extractionSettings.grid.columns + col + 1;
        const globalCardId = pageOffset + cardIdInSection;
        return { type: 'Front', id: globalCardId };
      } else {
        // Back card: mirror position across gutter line
        // Bottom row matches top row in mirrored fashion
        const bottomRow = row - halfRows; // Position within bottom half (0-based)
        const mirroredRow = halfRows - 1 - bottomRow; // Mirror across the gutter
        const cardIdInSection = mirroredRow * extractionSettings.grid.columns + col + 1;
        const globalCardId = pageOffset + cardIdInSection;
        return { type: 'Back', id: globalCardId };
      }
    }
  }
  
  // Fallback - use global card indexing
  return { type: pageType.charAt(0).toUpperCase() + pageType.slice(1), id: cardIndex + 1 };
}

/**
 * Get the actual page number from active pages
 */
export function getActualPageNumber(
  pageIndex: number,
  pageSettings: PageSettings[]
): number {
  return pageSettings.findIndex((page: PageSettings, index: number) => 
    !page?.skip && pageSettings.slice(0, index + 1).filter((p: PageSettings) => !p?.skip).length === pageIndex + 1
  ) + 1;
}

/**
 * Extract individual card from PDF at 300 DPI
 */
export async function extractCardImage(
  cardIndex: number,
  pdfData: any,
  pdfMode: PdfMode,
  activePages: PageSettings[],
  pageSettings: PageSettings[],
  extractionSettings: ExtractionSettings
): Promise<string | null> {
  if (!pdfData || !activePages.length) {
    return null;
  }

  try {
    const cardsPerPage = extractionSettings.grid.rows * extractionSettings.grid.columns;
    
    // Calculate which page and card position this cardIndex represents
    const pageIndex = Math.floor(cardIndex / cardsPerPage);
    const cardOnPage = cardIndex % cardsPerPage;

    if (pageIndex >= activePages.length) {
      return null;
    }

    // Get the actual page number from active pages
    const actualPageNumber = getActualPageNumber(pageIndex, pageSettings);

    const page = await pdfData.getPage(actualPageNumber);
      // Calculate scale for extraction DPI (PDF.js uses 72 DPI as base)
    const highResScale = DPI_CONSTANTS.EXTRACTION_DPI / DPI_CONSTANTS.SCREEN_DPI;
    
    const viewport = page.getViewport({ scale: highResScale });
    
    // Create a high-resolution canvas
    const highResCanvas = document.createElement('canvas');
    highResCanvas.width = viewport.width;
    highResCanvas.height = viewport.height;
    const highResContext = highResCanvas.getContext('2d');
    
    if (!highResContext) {
      console.error('Card extraction failed: could not get high-res canvas context');
      return null;
    }
    
    // Render the page at high resolution
    const renderContext = {
      canvasContext: highResContext,
      viewport: viewport
    };
    
    await page.render(renderContext).promise;
      // Calculate card dimensions after cropping at high resolution
    // Crop settings are in extraction DPI pixels, so they can be used directly
    const croppedWidth = viewport.width - extractionSettings.crop.left - extractionSettings.crop.right;
    const croppedHeight = viewport.height - extractionSettings.crop.top - extractionSettings.crop.bottom;
    
    // Validate cropped dimensions
    if (croppedWidth <= 0 || croppedHeight <= 0) {
      console.error('Card extraction failed: invalid cropped dimensions');
      return null;
    }
    
    let cardWidth, cardHeight;
    let adjustedX, adjustedY;
    
    // Handle gutter-fold mode with gutter width
    if (pdfMode.type === 'gutter-fold' && (extractionSettings.gutterWidth || 0) > 0) {
      const gutterWidth = extractionSettings.gutterWidth || 0;
      
      if (pdfMode.orientation === 'vertical') {
        // Vertical gutter-fold: gutter runs vertically down the middle
        const availableWidthForCards = croppedWidth - gutterWidth;
        const halfWidth = availableWidthForCards / 2;
        cardWidth = halfWidth / (extractionSettings.grid.columns / 2);
        cardHeight = croppedHeight / extractionSettings.grid.rows;
        
        // Calculate card position accounting for gutter
        const row = Math.floor(cardOnPage / extractionSettings.grid.columns);
        const col = cardOnPage % extractionSettings.grid.columns;
        const halfColumns = extractionSettings.grid.columns / 2;
        const isLeftSide = col < halfColumns;
        
        if (isLeftSide) {
          // Left side (front cards) - no gutter offset needed
          adjustedX = extractionSettings.crop.left + (col * cardWidth);
        } else {
          // Right side (back cards) - add gutter width and adjust column position
          const rightCol = col - halfColumns;
          adjustedX = extractionSettings.crop.left + halfWidth + gutterWidth + (rightCol * cardWidth);
        }
        adjustedY = extractionSettings.crop.top + (row * cardHeight);
      } else {
        // Horizontal gutter-fold: gutter runs horizontally across the middle
        const availableHeightForCards = croppedHeight - gutterWidth;
        const halfHeight = availableHeightForCards / 2;
        cardWidth = croppedWidth / extractionSettings.grid.columns;
        cardHeight = halfHeight / (extractionSettings.grid.rows / 2);
        
        // Calculate card position accounting for gutter
        const row = Math.floor(cardOnPage / extractionSettings.grid.columns);
        const col = cardOnPage % extractionSettings.grid.columns;
        const halfRows = extractionSettings.grid.rows / 2;
        const isTopHalf = row < halfRows;
        
        adjustedX = extractionSettings.crop.left + (col * cardWidth);
        if (isTopHalf) {
          // Top half (front cards) - no gutter offset needed
          adjustedY = extractionSettings.crop.top + (row * cardHeight);
        } else {
          // Bottom half (back cards) - add gutter height and adjust row position
          const bottomRow = row - halfRows;
          adjustedY = extractionSettings.crop.top + halfHeight + gutterWidth + (bottomRow * cardHeight);
        }
      }
    } else {
      // Standard mode or gutter-fold without gutter width
      cardWidth = croppedWidth / extractionSettings.grid.columns;
      cardHeight = croppedHeight / extractionSettings.grid.rows;
      
      // Calculate card position at high resolution using cardOnPage (not cardIndex)
      const row = Math.floor(cardOnPage / extractionSettings.grid.columns);
      const col = cardOnPage % extractionSettings.grid.columns;
      
      adjustedX = extractionSettings.crop.left + (col * cardWidth);
      adjustedY = extractionSettings.crop.top + (row * cardHeight);
    }
    
    // Validate card dimensions
    if (cardWidth <= 0 || cardHeight <= 0) {
      console.error('Card extraction failed: invalid card dimensions at high resolution');
      return null;
    }
    
    // Ensure extraction coordinates are within canvas bounds
    const sourceX = Math.max(0, Math.min(Math.floor(adjustedX), viewport.width - 1));
    const sourceY = Math.max(0, Math.min(Math.floor(adjustedY), viewport.height - 1));
    const sourceWidth = Math.max(1, Math.min(Math.floor(cardWidth), viewport.width - sourceX));
    const sourceHeight = Math.max(1, Math.min(Math.floor(cardHeight), viewport.height - sourceY));
    
    // Create a new canvas for the extracted card
    const cardCanvas = document.createElement('canvas');
    cardCanvas.width = Math.max(1, sourceWidth);
    cardCanvas.height = Math.max(1, sourceHeight);
    const cardContext = cardCanvas.getContext('2d');
    
    if (!cardContext) {
      console.error('Card extraction failed: could not get card canvas context');
      return null;
    }
    
    // Extract the card area from the high-resolution canvas
    cardContext.drawImage(
      highResCanvas,
      sourceX, sourceY, sourceWidth, sourceHeight,
      0, 0, cardCanvas.width, cardCanvas.height
    );

    // Apply individual card cropping if specified
    if (extractionSettings.cardCrop && 
        (extractionSettings.cardCrop.top > 0 || extractionSettings.cardCrop.right > 0 || 
         extractionSettings.cardCrop.bottom > 0 || extractionSettings.cardCrop.left > 0)) {
      
      const cardCrop = extractionSettings.cardCrop;
      const croppedCardWidth = Math.max(1, cardCanvas.width - cardCrop.left - cardCrop.right);
      const croppedCardHeight = Math.max(1, cardCanvas.height - cardCrop.top - cardCrop.bottom);
      
      // Only apply cropping if the result would be a valid size
      if (croppedCardWidth > 0 && croppedCardHeight > 0) {
        // Create a new canvas for the cropped card
        const croppedCanvas = document.createElement('canvas');
        croppedCanvas.width = croppedCardWidth;
        croppedCanvas.height = croppedCardHeight;
        const croppedContext = croppedCanvas.getContext('2d');
        
        if (croppedContext) {
          // Extract the cropped area from the original card
          croppedContext.drawImage(
            cardCanvas,
            cardCrop.left, cardCrop.top, croppedCardWidth, croppedCardHeight,
            0, 0, croppedCardWidth, croppedCardHeight
          );
          
          const dataUrl = croppedCanvas.toDataURL('image/png');
          return dataUrl;
        }
      }
    }

    const dataUrl = cardCanvas.toDataURL('image/png');
    return dataUrl;
  } catch (error) {
    console.error('Error in high-DPI card extraction:', error);
    return null;
  }
}

/**
 * Get available card IDs for a specific view mode (front/back)
 */
export function getAvailableCardIds(
  viewMode: 'front' | 'back',
  totalCards: number,
  pdfMode: PdfMode,
  activePages: PageSettings[],
  cardsPerPage: number,
  extractionSettings: ExtractionSettings
): number[] {
  const cardIds: number[] = [];
  const maxIndex = pdfMode.type === 'duplex' || pdfMode.type === 'gutter-fold' 
    ? activePages.length * cardsPerPage 
    : totalCards;
  
  for (let i = 0; i < maxIndex; i++) {
    const cardInfo = getCardInfo(i, activePages, extractionSettings, pdfMode, cardsPerPage);
    if (cardInfo.type.toLowerCase() === viewMode) {
      if (!cardIds.includes(cardInfo.id)) {
        cardIds.push(cardInfo.id);
      }
    }
  }
  
  return cardIds.sort((a, b) => a - b); // Sort card IDs numerically
}

/**
 * Get rotation value for a specific card type from settings
 */
export function getRotationForCardType(
  outputSettings: any,
  cardType: 'front' | 'back'
): number {
  if (typeof outputSettings.rotation === 'object' && outputSettings.rotation !== null) {
    return outputSettings.rotation[cardType] || 0;
  }
  return outputSettings.rotation || 0;
}

/**
 * Calculate card dimensions using new card size settings
 */
export function calculateCardDimensions(
  outputSettings: any
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
 * Count cards of a specific type (front/back) in the given parameters
 */
export function countCardsByType(
  cardType: 'front' | 'back',
  activePages: PageSettings[],
  cardsPerPage: number,
  pdfMode: PdfMode,
  extractionSettings: ExtractionSettings
): number {
  let count = 0;
  const maxIndex = pdfMode.type === 'duplex' || pdfMode.type === 'gutter-fold' 
    ? activePages.length * cardsPerPage 
    : calculateTotalCards(pdfMode, activePages, cardsPerPage);
  
  for (let i = 0; i < maxIndex; i++) {
    const cardInfo = getCardInfo(i, activePages, extractionSettings, pdfMode, cardsPerPage);
    if (cardInfo.type.toLowerCase() === cardType) {
      count++;
    }
  }
  
  return count;
}

/**
 * Calculate preview scale for display in UI
 */
export function calculatePreviewScale(
  pageWidth: number,
  pageHeight: number,
  maxWidth: number = 400,
  maxHeight: number = 500
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
        case 'actual-size':
          // Use the image at its original size (no scaling)
          finalWidthInches = imageWidthInches;
          finalHeightInches = imageHeightInches;
          break;
          
        case 'fit-to-card':
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
          
        case 'fill-card':
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
