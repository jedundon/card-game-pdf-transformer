/**
 * Layout calculation utilities for card arrangement and sizing
 */

export interface LayoutDimensions {
  width: number;
  height: number;
}

export interface CardLayout {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
}

export interface GridLayout {
  rows: number;
  columns: number;
  cardWidth: number;
  cardHeight: number;
  spacing?: {
    horizontal: number;
    vertical: number;
  };
}

export interface SheetLayout {
  sheetWidth: number;
  sheetHeight: number;
  margin: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
  cards: CardLayout[];
}

/**
 * Calculate optimal grid layout for given constraints
 */
export function calculateOptimalGrid(
  cardCount: number,
  cardAspectRatio: number,
  containerWidth: number,
  containerHeight: number,
  minCardSize: number = 50
): GridLayout {
  let bestLayout: GridLayout | null = null;
  let bestScore = 0;
  
  // Try different grid configurations
  for (let cols = 1; cols <= Math.ceil(Math.sqrt(cardCount)); cols++) {
    const rows = Math.ceil(cardCount / cols);
    
    const cardWidth = containerWidth / cols;
    const cardHeight = containerHeight / rows;
    
    // Skip if cards would be too small
    if (cardWidth < minCardSize || cardHeight < minCardSize) {
      continue;
    }
    
    // Calculate how well this layout preserves aspect ratio
    const layoutAspectRatio = cardWidth / cardHeight;
    const aspectRatioScore = 1 / (1 + Math.abs(layoutAspectRatio - cardAspectRatio));
    
    // Calculate space utilization
    const usedCards = Math.min(cardCount, rows * cols);
    const utilizationScore = usedCards / (rows * cols);
    
    // Calculate size score (bigger cards are better)
    const sizeScore = Math.min(cardWidth, cardHeight) / Math.max(containerWidth, containerHeight);
    
    // Combined score
    const score = aspectRatioScore * 0.5 + utilizationScore * 0.3 + sizeScore * 0.2;
    
    if (score > bestScore) {
      bestScore = score;
      bestLayout = {
        rows,
        columns: cols,
        cardWidth,
        cardHeight,
      };
    }
  }
  
  return bestLayout || {
    rows: Math.ceil(Math.sqrt(cardCount)),
    columns: Math.ceil(Math.sqrt(cardCount)),
    cardWidth: containerWidth / Math.ceil(Math.sqrt(cardCount)),
    cardHeight: containerHeight / Math.ceil(Math.sqrt(cardCount)),
  };
}

/**
 * Calculate card positions in a grid layout
 */
export function calculateGridPositions(
  grid: GridLayout,
  cardCount: number,
  startX: number = 0,
  startY: number = 0
): CardLayout[] {
  const positions: CardLayout[] = [];
  
  for (let i = 0; i < cardCount; i++) {
    const row = Math.floor(i / grid.columns);
    const col = i % grid.columns;
    
    const x = startX + col * (grid.cardWidth + (grid.spacing?.horizontal || 0));
    const y = startY + row * (grid.cardHeight + (grid.spacing?.vertical || 0));
    
    positions.push({
      x,
      y,
      width: grid.cardWidth,
      height: grid.cardHeight,
    });
  }
  
  return positions;
}

/**
 * Calculate sheet layout for printing multiple cards
 */
export function calculateSheetLayout(
  cardCount: number,
  cardDimensions: LayoutDimensions,
  sheetDimensions: LayoutDimensions,
  margin: number = 36 // 0.5 inch at 72 DPI
): SheetLayout {
  const usableWidth = sheetDimensions.width - (margin * 2);
  const usableHeight = sheetDimensions.height - (margin * 2);
  
  // Calculate how many cards fit per row and column
  const cardsPerRow = Math.floor(usableWidth / cardDimensions.width);
  const cardsPerColumn = Math.floor(usableHeight / cardDimensions.height);
  const cardsPerSheet = cardsPerRow * cardsPerColumn;
  
  if (cardsPerSheet === 0) {
    // Cards don't fit, return single card layout
    return {
      sheetWidth: sheetDimensions.width,
      sheetHeight: sheetDimensions.height,
      margin: { top: margin, right: margin, bottom: margin, left: margin },
      cards: [{
        x: margin,
        y: margin,
        width: Math.min(cardDimensions.width, usableWidth),
        height: Math.min(cardDimensions.height, usableHeight),
      }],
    };
  }
  
  // Calculate actual spacing to center cards
  const totalCardWidth = cardsPerRow * cardDimensions.width;
  const totalCardHeight = cardsPerColumn * cardDimensions.height;
  const extraHorizontalSpace = usableWidth - totalCardWidth;
  const extraVerticalSpace = usableHeight - totalCardHeight;
  
  const horizontalSpacing = extraHorizontalSpace / (cardsPerRow + 1);
  const verticalSpacing = extraVerticalSpace / (cardsPerColumn + 1);
  
  const cards: CardLayout[] = [];
  
  for (let i = 0; i < Math.min(cardCount, cardsPerSheet); i++) {
    const row = Math.floor(i / cardsPerRow);
    const col = i % cardsPerRow;
    
    const x = margin + horizontalSpacing + col * (cardDimensions.width + horizontalSpacing);
    const y = margin + verticalSpacing + row * (cardDimensions.height + verticalSpacing);
    
    cards.push({
      x,
      y,
      width: cardDimensions.width,
      height: cardDimensions.height,
    });
  }
  
  return {
    sheetWidth: sheetDimensions.width,
    sheetHeight: sheetDimensions.height,
    margin: { top: margin, right: margin, bottom: margin, left: margin },
    cards,
  };
}

/**
 * Calculate layout for individual card export
 */
export function calculateIndividualLayout(
  cardDimensions: LayoutDimensions,
  bleed: number = 0,
  cropMarks: boolean = false
): SheetLayout {
  const cropMarkSize = cropMarks ? 18 : 0; // 0.25 inch at 72 DPI
  const totalBleed = bleed * 2; // Bleed extends on all sides
  
  const sheetWidth = cardDimensions.width + totalBleed + (cropMarkSize * 2);
  const sheetHeight = cardDimensions.height + totalBleed + (cropMarkSize * 2);
  
  return {
    sheetWidth,
    sheetHeight,
    margin: { top: cropMarkSize, right: cropMarkSize, bottom: cropMarkSize, left: cropMarkSize },
    cards: [{
      x: cropMarkSize + bleed,
      y: cropMarkSize + bleed,
      width: cardDimensions.width,
      height: cardDimensions.height,
    }],
  };
}

/**
 * Convert inches to pixels at given DPI
 */
export function inchesToPixels(inches: number, dpi: number): number {
  return inches * dpi;
}

/**
 * Convert pixels to inches at given DPI
 */
export function pixelsToInches(pixels: number, dpi: number): number {
  return pixels / dpi;
}

/**
 * Calculate scale factor to fit dimensions within constraints
 */
export function calculateScaleToFit(
  sourceDimensions: LayoutDimensions,
  targetDimensions: LayoutDimensions,
  maintainAspectRatio: boolean = true
): number {
  if (!maintainAspectRatio) {
    return Math.min(
      targetDimensions.width / sourceDimensions.width,
      targetDimensions.height / sourceDimensions.height
    );
  }
  
  const scaleX = targetDimensions.width / sourceDimensions.width;
  const scaleY = targetDimensions.height / sourceDimensions.height;
  
  return Math.min(scaleX, scaleY);
}

/**
 * Calculate layout bounds (bounding box)
 */
export function calculateLayoutBounds(cards: CardLayout[]): LayoutDimensions & { x: number; y: number } {
  if (cards.length === 0) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }
  
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  
  for (const card of cards) {
    minX = Math.min(minX, card.x);
    minY = Math.min(minY, card.y);
    maxX = Math.max(maxX, card.x + card.width);
    maxY = Math.max(maxY, card.y + card.height);
  }
  
  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

/**
 * Standard paper sizes in points (72 DPI)
 */
export const PAPER_SIZES = {
  'Letter': { width: 612, height: 792 },
  'Legal': { width: 612, height: 1008 },
  'Tabloid': { width: 792, height: 1224 },
  'A3': { width: 842, height: 1191 },
  'A4': { width: 595, height: 842 },
  'A5': { width: 420, height: 595 },
  'B4': { width: 729, height: 1032 },
  'B5': { width: 516, height: 729 },
} as const;

export type PaperSize = keyof typeof PAPER_SIZES;
