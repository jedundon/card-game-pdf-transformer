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
 * Calculate total cards of current type for navigation display
 */
export function calculateTotalCardsOfCurrentType(
  pdfMode: PdfMode,
  activePages: PageSettings[],
  cardsPerPage: number,
  totalCards: number
): number {
  const totalPages = activePages.length;
  
  if (pdfMode.type === 'duplex') {
    // In duplex mode, both front and back have the same count
    const frontPages = activePages.filter((page: PageSettings) => page.type === 'front').length;
    return frontPages * cardsPerPage;
  } else if (pdfMode.type === 'gutter-fold') {
    // In gutter-fold mode, each page has front/back pairs
    // Count unique cards (each page contributes half the cards since they're mirrored)
    const cardsPerHalfPage = Math.floor(cardsPerPage / 2);
    return totalPages * cardsPerHalfPage;
  } else {
    // For other modes, use the total cards calculation
    return totalCards;
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
    
    // Calculate scale for 300 DPI (PDF.js uses 72 DPI as base, so 300/72 = ~4.17)
    const targetDPI = 300;
    const baseDPI = 72;
    const highResScale = targetDPI / baseDPI;
    
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
    // Crop settings are in 300 DPI pixels, so they can be used directly
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
 * Find card index for a specific card ID and view mode
 */
export function findCardIndexByIdAndMode(
  cardId: number,
  viewMode: 'front' | 'back',
  totalCards: number,
  pdfMode: PdfMode,
  activePages: PageSettings[],
  cardsPerPage: number,
  extractionSettings: ExtractionSettings
): number | null {
  const maxIndex = pdfMode.type === 'duplex' || pdfMode.type === 'gutter-fold' 
    ? activePages.length * cardsPerPage 
    : totalCards;
  
  for (let i = 0; i < maxIndex; i++) {
    const cardInfo = getCardInfo(i, activePages, extractionSettings, pdfMode, cardsPerPage);
    if (cardInfo.id === cardId && cardInfo.type.toLowerCase() === viewMode) {
      return i;
    }
  }
  
  return null;
}
