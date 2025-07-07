/**
 * @fileoverview PDF Card Extraction Utilities
 * 
 * Centralized utilities for extracting individual cards from PDF pages.
 * This module consolidates the duplicate card extraction logic that was
 * previously scattered across ExtractStep, ConfigureStep, and ExportStep.
 * 
 * **Key Functions:**
 * - High-resolution PDF page rendering at 300 DPI
 * - Grid-based card positioning and extraction
 * - Page-level and card-level cropping
 * - Canvas-based image processing
 * 
 * **Technical Details:**
 * - All operations use EXTRACTION_DPI (300) for print-quality output
 * - Supports both page-level cropping and individual card cropping
 * - Handles error cases gracefully with detailed error messages
 * - Optimized for memory usage with proper canvas cleanup
 * 
 * @author Card Game PDF Transformer
 */

import { DPI_CONSTANTS } from '../constants';
import type { PdfData, ExtractionSettings, PdfMode, PageSettings } from '../types';
import { getCardInfo } from './cardUtils';

/**
 * Extract a single card from a specific PDF page
 * 
 * This function renders a PDF page at high resolution (300 DPI) and extracts
 * a specific card based on grid positioning and cropping settings.
 * 
 * **Process:**
 * 1. Render PDF page to canvas at extraction DPI
 * 2. Apply page-level cropping
 * 3. Calculate card position within grid
 * 4. Apply individual card cropping if specified
 * 5. Extract card area to separate canvas
 * 6. Return as data URL for further processing
 * 
 * **Error Handling:**
 * - Validates all dimensions to prevent negative or zero sizes
 * - Provides detailed error messages for debugging
 * - Properly cleans up canvas resources on failure
 * 
 * @param pdfData - PDF document proxy from PDF.js
 * @param pageNumber - 1-based page number to extract from
 * @param cardOnPage - 0-based card index within the page grid
 * @param extractionSettings - Grid and cropping configuration
 * @returns Promise resolving to card image data URL, or null on failure
 * 
 * @example
 * ```typescript
 * const cardUrl = await extractCardImageFromPdfPage(
 *   pdfDocument,
 *   1, // First page
 *   2, // Third card (0-based)
 *   {
 *     grid: { rows: 2, columns: 3 },
 *     crop: { top: 10, right: 10, bottom: 10, left: 10 },
 *     cardCrop: { top: 5, right: 5, bottom: 5, left: 5 }
 *   }
 * );
 * ```
 */
export async function extractCardImageFromPdfPage(
  pdfData: PdfData,
  pageNumber: number,
  cardOnPage: number,
  extractionSettings: ExtractionSettings,
  globalCardIndex?: number,
  activePages?: PageSettings[],
  pdfMode?: PdfMode
): Promise<string | null> {
  let canvas: HTMLCanvasElement | null = null;
  let cardCanvas: HTMLCanvasElement | null = null;
  
  try {
    // Validate inputs
    if (!pdfData || pageNumber < 1) {
      throw new Error('Invalid PDF data or page number');
    }
    
    if (cardOnPage < 0) {
      throw new Error('Card index must be non-negative');
    }
    
    if (!extractionSettings?.grid || extractionSettings.grid.rows <= 0 || extractionSettings.grid.columns <= 0) {
      throw new Error('Invalid grid settings');
    }
    
    // Get the PDF page
    const page = await pdfData.getPage(pageNumber);
    
    // Calculate scale for extraction DPI (300 DPI for print quality)
    const extractionScale = DPI_CONSTANTS.EXTRACTION_DPI / DPI_CONSTANTS.SCREEN_DPI;
    const viewport = page.getViewport({ scale: extractionScale });
    
    // Create canvas for rendering the full page
    canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Failed to get canvas context');
    }
    
    // Set canvas dimensions to rendered page size
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    
    // Render the PDF page to canvas
    const renderContext = {
      canvasContext: context,
      viewport: viewport
    };
    
    await page.render(renderContext).promise;
    
    // Apply page-level cropping
    const cropSettings = extractionSettings.crop || { top: 0, right: 0, bottom: 0, left: 0 };
    const sourceWidth = viewport.width - cropSettings.left - cropSettings.right;
    const sourceHeight = viewport.height - cropSettings.top - cropSettings.bottom;
    
    if (sourceWidth <= 0 || sourceHeight <= 0) {
      throw new Error(`Invalid dimensions after page cropping: ${sourceWidth}x${sourceHeight}px`);
    }
    
    // Calculate card grid position
    const { rows, columns } = extractionSettings.grid;
    
    // Validate card fits within grid
    if (cardOnPage >= rows * columns) {
      throw new Error(`Card index ${cardOnPage} exceeds grid capacity ${rows * columns}`);
    }
    
    const cardRow = Math.floor(cardOnPage / columns);
    const cardCol = cardOnPage % columns;
    
    // Calculate card dimensions and position with gutter-fold awareness
    let cardWidthPx: number;
    let cardHeightPx: number;
    let cardX: number;
    let cardY: number;
    
    if (pdfMode?.type === 'gutter-fold' && extractionSettings.gutterWidth && extractionSettings.gutterWidth > 0) {
      // Gutter-fold mode with gutter width - use gutter-aware calculations
      if (pdfMode.orientation === 'vertical') {
        // Vertical gutter: splits page left/right
        const gutterWidth = extractionSettings.gutterWidth;
        const availableWidthForCards = sourceWidth - gutterWidth;
        cardWidthPx = availableWidthForCards / columns;
        cardHeightPx = sourceHeight / rows;
        
        // Adjust X position for cards after the gutter
        const halfColumns = columns / 2;
        if (cardCol >= halfColumns) {
          // Right side cards: add gutter offset
          cardX = cropSettings.left + (cardCol * cardWidthPx) + gutterWidth;
        } else {
          // Left side cards: no gutter offset
          cardX = cropSettings.left + (cardCol * cardWidthPx);
        }
        cardY = cropSettings.top + (cardRow * cardHeightPx);
      } else {
        // Horizontal gutter: splits page top/bottom
        const gutterWidth = extractionSettings.gutterWidth;
        const availableHeightForCards = sourceHeight - gutterWidth;
        cardWidthPx = sourceWidth / columns;
        cardHeightPx = availableHeightForCards / rows;
        
        // Adjust Y position for cards after the gutter
        const halfRows = rows / 2;
        if (cardRow >= halfRows) {
          // Bottom cards: add gutter offset
          cardY = cropSettings.top + (cardRow * cardHeightPx) + gutterWidth;
        } else {
          // Top cards: no gutter offset
          cardY = cropSettings.top + (cardRow * cardHeightPx);
        }
        cardX = cropSettings.left + (cardCol * cardWidthPx);
      }
    } else {
      // Standard mode or gutter-fold without gutter width
      cardWidthPx = sourceWidth / columns;
      cardHeightPx = sourceHeight / rows;
      cardX = cropSettings.left + cardCol * cardWidthPx;
      cardY = cropSettings.top + cardRow * cardHeightPx;
    }
    
    // Apply individual card cropping if specified
    let finalCardWidth = cardWidthPx;
    let finalCardHeight = cardHeightPx;
    let finalCardX = cardX;
    let finalCardY = cardY;
    
    if (extractionSettings.cardCrop) {
      const cardCrop = extractionSettings.cardCrop;
      finalCardX += cardCrop.left || 0;
      finalCardY += cardCrop.top || 0;
      finalCardWidth -= (cardCrop.left || 0) + (cardCrop.right || 0);
      finalCardHeight -= (cardCrop.top || 0) + (cardCrop.bottom || 0);
    }
    
    if (finalCardWidth <= 0 || finalCardHeight <= 0) {
      throw new Error(`Invalid card dimensions after card cropping: ${finalCardWidth}x${finalCardHeight}px`);
    }
    
    // Create a new canvas for the extracted card
    cardCanvas = document.createElement('canvas');
    const cardContext = cardCanvas.getContext('2d');
    if (!cardContext) {
      throw new Error('Failed to get card canvas context');
    }
    
    // Set card canvas dimensions to final card size
    cardCanvas.width = finalCardWidth;
    cardCanvas.height = finalCardHeight;
    
    // Extract the card area from the main canvas
    cardContext.drawImage(
      canvas,
      finalCardX, finalCardY, finalCardWidth, finalCardHeight,
      0, 0, finalCardWidth, finalCardHeight
    );
    
    // Apply image rotation if specified
    let finalCanvas = cardCanvas;
    if (extractionSettings.imageRotation && globalCardIndex !== undefined && activePages && pdfMode) {
      // Determine card type to get appropriate rotation
      const cardsPerPage = extractionSettings.grid.rows * extractionSettings.grid.columns;
      const cardInfo = getCardInfo(
        globalCardIndex, 
        activePages, 
        extractionSettings, 
        pdfMode, 
        cardsPerPage,
        extractionSettings.pageDimensions?.width,
        extractionSettings.pageDimensions?.height
      );
      const cardType = cardInfo.type.toLowerCase() as 'front' | 'back';
      const rotation = extractionSettings.imageRotation[cardType] || 0;
      
      if (rotation !== 0) {
        // Create a new canvas for the rotated card
        const rotatedCanvas = document.createElement('canvas');
        const rotatedContext = rotatedCanvas.getContext('2d');
        
        if (rotatedContext) {
          // Set canvas dimensions based on rotation
          if (rotation === 90 || rotation === 270) {
            // Swap dimensions for 90° and 270° rotations
            rotatedCanvas.width = cardCanvas.height;
            rotatedCanvas.height = cardCanvas.width;
          } else {
            rotatedCanvas.width = cardCanvas.width;
            rotatedCanvas.height = cardCanvas.height;
          }
          
          // Apply rotation transformation
          rotatedContext.translate(rotatedCanvas.width / 2, rotatedCanvas.height / 2);
          rotatedContext.rotate((rotation * Math.PI) / 180);
          rotatedContext.drawImage(cardCanvas, -cardCanvas.width / 2, -cardCanvas.height / 2);
          
          finalCanvas = rotatedCanvas;
        }
      }
    }
    
    // Convert final canvas to data URL for use in other components
    const dataUrl = finalCanvas.toDataURL('image/png', 1.0); // Maximum quality
    
    return dataUrl;
    
  } catch (error) {
    // Log detailed error information for debugging
    console.error('Failed to extract card from PDF page:', {
      pageNumber,
      cardOnPage,
      extractionSettings,
      error: error instanceof Error ? error.message : String(error)
    });
    
    // Re-throw with additional context
    throw new Error(
      `PDF card extraction failed (page ${pageNumber}, card ${cardOnPage}): ${
        error instanceof Error ? error.message : 'Unknown error'
      }`
    );
  } finally {
    // Clean up canvas resources to prevent memory leaks
    if (canvas) {
      const context = canvas.getContext('2d');
      if (context) {
        context.clearRect(0, 0, canvas.width, canvas.height);
      }
    }
    if (cardCanvas) {
      const cardContext = cardCanvas.getContext('2d');
      if (cardContext) {
        cardContext.clearRect(0, 0, cardCanvas.width, cardCanvas.height);
      }
    }
  }
}

/**
 * Validate extraction settings for PDF card extraction
 * 
 * Performs comprehensive validation of extraction settings to ensure
 * they are suitable for PDF card extraction operations.
 * 
 * @param settings - Extraction settings to validate
 * @returns Validation result with success flag and error messages
 * 
 * @example
 * ```typescript
 * const validation = validateExtractionSettings(extractionSettings);
 * if (!validation.isValid) {
 *   console.error('Invalid settings:', validation.errors);
 * }
 * ```
 */
export function validateExtractionSettings(settings: ExtractionSettings): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  
  // Validate grid settings
  if (!settings.grid) {
    errors.push('Grid settings are required');
  } else {
    if (settings.grid.rows <= 0 || !Number.isInteger(settings.grid.rows)) {
      errors.push('Grid rows must be a positive integer');
    }
    if (settings.grid.columns <= 0 || !Number.isInteger(settings.grid.columns)) {
      errors.push('Grid columns must be a positive integer');
    }
    if (settings.grid.rows > 10) {
      errors.push('Grid rows should not exceed 10 for practical use');
    }
    if (settings.grid.columns > 10) {
      errors.push('Grid columns should not exceed 10 for practical use');
    }
  }
  
  // Validate crop settings
  if (settings.crop) {
    if (settings.crop.top < 0 || settings.crop.right < 0 || 
        settings.crop.bottom < 0 || settings.crop.left < 0) {
      errors.push('Crop values must be non-negative');
    }
    if (settings.crop.top + settings.crop.bottom > 2000) {
      errors.push('Total vertical crop exceeds reasonable page height');
    }
    if (settings.crop.left + settings.crop.right > 2000) {
      errors.push('Total horizontal crop exceeds reasonable page width');
    }
  }
  
  // Validate card crop settings
  if (settings.cardCrop) {
    if (settings.cardCrop.top < 0 || settings.cardCrop.right < 0 || 
        settings.cardCrop.bottom < 0 || settings.cardCrop.left < 0) {
      errors.push('Card crop values must be non-negative');
    }
  }
  
  // Validate gutter width
  if (settings.gutterWidth !== undefined && settings.gutterWidth < 0) {
    errors.push('Gutter width must be non-negative');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}