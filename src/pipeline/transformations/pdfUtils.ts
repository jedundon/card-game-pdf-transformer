/**
 * PDF processing utilities for card extraction and rendering
 */

import { DPI_CONSTANTS } from '../../constants';

export interface RenderOptions {
  dpi?: number;
  scale?: number;
  quality?: number;
}

export interface PageInfo {
  width: number;
  height: number;
  rotation: number;
}

/**
 * Render a PDF page to canvas with specified options
 */
export async function renderPageToCanvas(
  page: any,
  canvas: HTMLCanvasElement,
  options: RenderOptions = {}
): Promise<void> {
  const { dpi = DPI_CONSTANTS.SCREEN_DPI, scale = 1.0, quality = 1.0 } = options;
  
  // Calculate scale based on DPI
  const pdfScale = (dpi / DPI_CONSTANTS.PDF_BASE_DPI) * scale;
  const viewport = page.getViewport({ scale: pdfScale });
  
  // Set canvas dimensions
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Failed to get 2D rendering context');
  }
  
  // Configure context for quality
  if (quality < 1.0) {
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
  }
  
  const renderContext = {
    canvasContext: context,
    viewport: viewport,
  };
  
  await page.render(renderContext).promise;
}

/**
 * Get page information including dimensions and rotation
 */
export function getPageInfo(page: any, dpi: number = DPI_CONSTANTS.SCREEN_DPI): PageInfo {
  const viewport = page.getViewport({ scale: dpi / DPI_CONSTANTS.PDF_BASE_DPI });
  
  return {
    width: viewport.width,
    height: viewport.height,
    rotation: page.rotate || 0,
  };
}

/**
 * Create an optimized canvas for rendering
 */
export function createOptimizedCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  
  const context = canvas.getContext('2d');
  if (context) {
    // Optimize for performance and quality
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
  }
  
  return canvas;
}

/**
 * Extract a region from a canvas as a new canvas
 */
export function extractCanvasRegion(
  sourceCanvas: HTMLCanvasElement,
  x: number,
  y: number,
  width: number,
  height: number
): HTMLCanvasElement {
  const targetCanvas = createOptimizedCanvas(width, height);
  const context = targetCanvas.getContext('2d');
  
  if (!context) {
    throw new Error('Failed to create extraction canvas context');
  }
  
  // Ensure coordinates are within bounds
  const clampedX = Math.max(0, Math.min(x, sourceCanvas.width - 1));
  const clampedY = Math.max(0, Math.min(y, sourceCanvas.height - 1));
  const clampedWidth = Math.max(1, Math.min(width, sourceCanvas.width - clampedX));
  const clampedHeight = Math.max(1, Math.min(height, sourceCanvas.height - clampedY));
  
  context.drawImage(
    sourceCanvas,
    clampedX, clampedY, clampedWidth, clampedHeight,
    0, 0, width, height
  );
  
  return targetCanvas;
}

/**
 * Convert canvas to data URL with compression options
 */
export function canvasToDataUrl(
  canvas: HTMLCanvasElement,
  format: 'png' | 'jpeg' = 'png',
  quality: number = 0.9
): string {
  if (format === 'jpeg') {
    return canvas.toDataURL('image/jpeg', quality);
  }
  return canvas.toDataURL('image/png');
}

/**
 * Estimate memory usage of a canvas
 */
export function estimateCanvasMemory(canvas: HTMLCanvasElement): number {
  // RGBA = 4 bytes per pixel
  return canvas.width * canvas.height * 4;
}

/**
 * Clear canvas and release memory
 */
export function clearCanvas(canvas: HTMLCanvasElement): void {
  const context = canvas.getContext('2d');
  if (context) {
    context.clearRect(0, 0, canvas.width, canvas.height);
  }
  
  // Reset dimensions to minimum to free memory
  canvas.width = 1;
  canvas.height = 1;
}
