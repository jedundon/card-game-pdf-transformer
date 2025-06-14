/**
 * Card extraction utilities for extracting individual cards from PDF pages
 */

import { DPI_CONSTANTS } from '../../constants';
import { renderPageToCanvas, extractCanvasRegion, canvasToDataUrl, createOptimizedCanvas } from './pdfUtils';
import type { CardData } from '../types';

export interface ExtractionRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface GridSettings {
  rows: number;
  columns: number;
}

export interface CropSettings {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export interface GutterSettings {
  width?: number;
  orientation?: 'vertical' | 'horizontal';
}

/**
 * Calculate grid layout for cards on a page
 */
export function calculateGridLayout(
  pageWidth: number,
  pageHeight: number,
  grid: GridSettings,
  crop: CropSettings,
  gutter?: GutterSettings
): ExtractionRegion[] {
  const regions: ExtractionRegion[] = [];
  
  // Calculate usable area after cropping
  const usableWidth = pageWidth - crop.left - crop.right;
  const usableHeight = pageHeight - crop.top - crop.bottom;
  
  if (usableWidth <= 0 || usableHeight <= 0) {
    return regions;
  }
  
  let cardWidth: number;
  let cardHeight: number;
  
  // Handle gutter-fold layouts
  if (gutter && gutter.width && gutter.width > 0) {
    if (gutter.orientation === 'vertical') {
      // Vertical gutter: split columns in half
      const availableWidth = usableWidth - gutter.width;
      cardWidth = availableWidth / grid.columns;
      cardHeight = usableHeight / grid.rows;
    } else {
      // Horizontal gutter: split rows in half
      const availableHeight = usableHeight - gutter.width;
      cardWidth = usableWidth / grid.columns;
      cardHeight = availableHeight / grid.rows;
    }
  } else {
    // Standard grid layout
    cardWidth = usableWidth / grid.columns;
    cardHeight = usableHeight / grid.rows;
  }
  
  // Generate extraction regions
  for (let row = 0; row < grid.rows; row++) {
    for (let col = 0; col < grid.columns; col++) {
      let x: number;
      let y: number;
      
      if (gutter && gutter.width && gutter.width > 0) {
        if (gutter.orientation === 'vertical') {
          const halfColumns = grid.columns / 2;
          const isLeftSide = col < halfColumns;
          
          if (isLeftSide) {
            x = crop.left + (col * cardWidth);
          } else {
            const rightCol = col - halfColumns;
            const leftSideWidth = halfColumns * cardWidth;
            x = crop.left + leftSideWidth + gutter.width + (rightCol * cardWidth);
          }
          y = crop.top + (row * cardHeight);
        } else {
          // Horizontal gutter
          const halfRows = grid.rows / 2;
          const isTopHalf = row < halfRows;
          
          x = crop.left + (col * cardWidth);
          if (isTopHalf) {
            y = crop.top + (row * cardHeight);
          } else {
            const bottomRow = row - halfRows;
            const topHalfHeight = halfRows * cardHeight;
            y = crop.top + topHalfHeight + gutter.width + (bottomRow * cardHeight);
          }
        }
      } else {
        // Standard layout
        x = crop.left + (col * cardWidth);
        y = crop.top + (row * cardHeight);
      }
      
      regions.push({
        x: Math.floor(x),
        y: Math.floor(y),
        width: Math.floor(cardWidth),
        height: Math.floor(cardHeight),
      });
    }
  }
  
  return regions;
}

/**
 * Extract a single card from a PDF page
 */
export async function extractCard(
  page: any,
  region: ExtractionRegion,
  options: {
    dpi?: number;
    quality?: number;
    format?: 'png' | 'jpeg';
  } = {}
): Promise<string> {
  const { dpi = DPI_CONSTANTS.EXTRACTION_DPI, quality = 0.9, format = 'png' } = options;
  
  // Create high-resolution canvas for the entire page
  const scale = dpi / DPI_CONSTANTS.PDF_BASE_DPI;
  const viewport = page.getViewport({ scale });
  const pageCanvas = createOptimizedCanvas(viewport.width, viewport.height);
  
  // Render the page
  await renderPageToCanvas(page, pageCanvas, { dpi });
  
  // Extract the card region
  const cardCanvas = extractCanvasRegion(
    pageCanvas,
    region.x * scale,
    region.y * scale,
    region.width * scale,
    region.height * scale
  );
  
  // Convert to data URL
  return canvasToDataUrl(cardCanvas, format, quality);
}

/**
 * Extract multiple cards from a PDF page
 */
export async function extractCardsFromPage(
  page: any,
  regions: ExtractionRegion[],
  options: {
    dpi?: number;
    quality?: number;
    format?: 'png' | 'jpeg';
  } = {}
): Promise<string[]> {
  const { dpi = DPI_CONSTANTS.EXTRACTION_DPI, quality = 0.9, format = 'png' } = options;
  
  // Render page once at high resolution
  const scale = dpi / DPI_CONSTANTS.PDF_BASE_DPI;
  const viewport = page.getViewport({ scale });
  const pageCanvas = createOptimizedCanvas(viewport.width, viewport.height);
  
  await renderPageToCanvas(page, pageCanvas, { dpi });
  
  // Extract all cards from the rendered page
  const cardImages: string[] = [];
  
  for (const region of regions) {
    const cardCanvas = extractCanvasRegion(
      pageCanvas,
      region.x * scale,
      region.y * scale,
      region.width * scale,
      region.height * scale
    );
    
    const dataUrl = canvasToDataUrl(cardCanvas, format, quality);
    cardImages.push(dataUrl);
  }
  
  return cardImages;
}

/**
 * Calculate card dimensions in inches and pixels
 */
export function calculateCardDimensions(
  region: ExtractionRegion,
  dpi: number = DPI_CONSTANTS.EXTRACTION_DPI
) {
  return {
    widthPx: region.width,
    heightPx: region.height,
    widthInches: region.width / dpi,
    heightInches: region.height / dpi,
    aspectRatio: region.width / region.height,
  };
}

/**
 * Validate extraction region bounds
 */
export function validateRegion(
  region: ExtractionRegion,
  pageWidth: number,
  pageHeight: number
): boolean {
  return (
    region.x >= 0 &&
    region.y >= 0 &&
    region.x + region.width <= pageWidth &&
    region.y + region.height <= pageHeight &&
    region.width > 0 &&
    region.height > 0
  );
}

/**
 * Convert grid position to card index
 */
export function gridPositionToIndex(row: number, col: number, columns: number): number {
  return row * columns + col;
}

/**
 * Convert card index to grid position
 */
export function indexToGridPosition(index: number, columns: number): { row: number; col: number } {
  return {
    row: Math.floor(index / columns),
    col: index % columns,
  };
}

/**
 * Generate card data from extraction regions
 */
export function createCardDataFromRegions(
  regions: ExtractionRegion[],
  pageIndex: number = 0
): CardData[] {
  return regions.map((region, index) => ({
    id: `page-${pageIndex}-card-${index}`,
    x: region.x,
    y: region.y,
    width: region.width,
    height: region.height,
    rotation: 0,
    selected: false,
    extracted: false,
    sourcePageIndex: pageIndex,
  }));
}
