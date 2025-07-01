/**
 * @fileoverview Card image extraction utilities
 * 
 * Contains functions for extracting high-resolution card images from PDF pages
 * and image files. Handles complex extraction logic including grid positioning,
 * cropping, rotation, and gutter-fold layouts.
 */

import { DPI_CONSTANTS } from '../../constants';
import { PdfData, PdfPage, PageSettings, PdfMode, ExtractionSettings, ImageFileData, PageSource } from '../../types';
import { getCardInfo } from './cardIdentification';
import { getActualPageNumber } from './cardIdentification';

/**
 * Extract individual card from PDF at 300 DPI
 * 
 * This is the core image extraction function that converts a card position
 * into a high-resolution image. The process involves multiple steps:
 * 
 * **Extraction Pipeline:**
 * 1. Validate inputs and calculate page/card positions
 * 2. Load PDF page at high resolution (300 DPI)
 * 3. Render page to canvas with error handling and timeouts
 * 4. Calculate card boundaries based on grid and crop settings
 * 5. Handle special cases (gutter-fold with gutter width)
 * 6. Extract card region from rendered page
 * 7. Apply individual card cropping if specified
 * 8. Apply image rotation based on card type
 * 9. Generate final data URL with validation
 * 
 * **DPI Handling:**
 * - PDF.js uses 72 DPI as base, scales to 300 DPI for extraction
 * - Crop settings are in extraction DPI pixels (300 DPI)
 * - Final output maintains 300 DPI for print quality
 * 
 * **Error Handling:**
 * - Comprehensive validation of all inputs
 * - Timeout protection for PDF operations (15s page load, 30s render)
 * - Canvas size limits to prevent memory issues
 * - Graceful fallbacks for extraction failures
 * 
 * @param cardIndex - Global card index across all pages (0-based)
 * @param pdfData - PDF.js document object for page access
 * @param pdfMode - PDF processing mode and settings
 * @param activePages - Array of non-skipped pages
 * @param pageSettings - Complete array of page settings (including skipped)
 * @param extractionSettings - Grid, crop, and rotation settings
 * @returns Promise<string | null> - Data URL of extracted card image, or null on failure
 * 
 * @example
 * ```typescript
 * // Extract first card from first page
 * const cardImage = await extractCardImage(
 *   0, // first card
 *   pdfData,
 *   { type: 'duplex', flipEdge: 'short' },
 *   activePages,
 *   allPageSettings,
 *   extractionSettings
 * );
 * 
 * if (cardImage) {
 *   const imgElement = document.getElementById('preview');
 *   imgElement.src = cardImage;
 * }
 * ```
 * 
 * @throws {Error} When PDF operations fail, canvas creation fails, or invalid settings provided
 */
export async function extractCardImage(
  cardIndex: number,
  pdfData: PdfData,
  pdfMode: PdfMode,
  activePages: PageSettings[],
  pageSettings: PageSettings[],
  extractionSettings: ExtractionSettings
): Promise<string | null> {
  // Validate inputs
  if (!pdfData) {
    console.error('Card extraction failed: No PDF data provided');
    return null;
  }
  
  if (!activePages || activePages.length === 0) {
    console.error('Card extraction failed: No active pages available');
    return null;
  }
  
  if (!extractionSettings || !extractionSettings.grid) {
    console.error('Card extraction failed: Invalid extraction settings');
    return null;
  }
  
  if (cardIndex < 0) {
    console.error(`Card extraction failed: Invalid card index ${cardIndex}`);
    return null;
  }

  try {
    const cardsPerPage = extractionSettings.grid.rows * extractionSettings.grid.columns;
    
    if (cardsPerPage <= 0) {
      throw new Error('Invalid grid configuration: cards per page must be greater than 0');
    }
    
    // Calculate which page and card position this cardIndex represents
    const pageIndex = Math.floor(cardIndex / cardsPerPage);
    const cardOnPage = cardIndex % cardsPerPage;

    if (pageIndex >= activePages.length) {
      console.warn(`Card extraction failed: Page index ${pageIndex} exceeds active pages (${activePages.length})`);
      return null;
    }

    // Get the actual page number from active pages
    const actualPageNumber = getActualPageNumber(pageIndex, pageSettings);
    
    if (actualPageNumber <= 0) {
      throw new Error(`Invalid page number calculated: ${actualPageNumber}`);
    }

    // Get PDF page with timeout and validation
    let page: PdfPage;
    try {
      const pagePromise = pdfData.getPage(actualPageNumber);
      const timeoutPromise = new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error(`PDF page ${actualPageNumber} loading timed out`)), 15000)
      );
      
      page = await Promise.race([pagePromise, timeoutPromise]);
      
      if (!page) {
        throw new Error(`Failed to load PDF page ${actualPageNumber}`);
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes('timed out')) {
        throw error;
      }
      throw new Error(`Failed to access PDF page ${actualPageNumber}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    // Calculate scale for extraction DPI (PDF.js uses 72 DPI as base)
    const highResScale = DPI_CONSTANTS.EXTRACTION_DPI / DPI_CONSTANTS.SCREEN_DPI;
    
    if (highResScale <= 0) {
      throw new Error('Invalid DPI configuration: scale must be greater than 0');
    }
    
    // Get viewport with error handling
    let viewport: any;
    try {
      viewport = page.getViewport({ scale: highResScale });
      
      if (!viewport || viewport.width <= 0 || viewport.height <= 0) {
        throw new Error(`Invalid viewport dimensions: ${viewport?.width} x ${viewport?.height}`);
      }
      
      // Check for reasonable viewport size (prevent memory issues)
      const maxDimension = 50000; // 50k pixels max
      if (viewport.width > maxDimension || viewport.height > maxDimension) {
        throw new Error(`Viewport too large: ${viewport.width} x ${viewport.height}. Maximum allowed: ${maxDimension} x ${maxDimension}`);
      }
    } catch (error) {
      throw new Error(`Failed to get page viewport: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    
    // Create a high-resolution canvas with validation
    let highResCanvas: HTMLCanvasElement;
    let highResContext: CanvasRenderingContext2D;
    
    try {
      highResCanvas = document.createElement('canvas');
      
      if (!highResCanvas) {
        throw new Error('Failed to create canvas element');
      }
      
      highResCanvas.width = viewport.width;
      highResCanvas.height = viewport.height;
      
      const context = highResCanvas.getContext('2d');
      if (!context) {
        throw new Error('Failed to get 2D rendering context from canvas');
      }
      
      highResContext = context;
    } catch (error) {
      throw new Error(`Canvas creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    
    // Render the page at high resolution with timeout
    try {
      const renderContext = {
        canvasContext: highResContext,
        viewport: viewport
      };
      
      const renderPromise = page.render(renderContext).promise;
      const renderTimeout = new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error(`Page rendering timed out for page ${actualPageNumber}`)), 30000)
      );
      
      await Promise.race([renderPromise, renderTimeout]);
    } catch (error) {
      throw new Error(`Page rendering failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
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
      throw new Error(`Invalid card dimensions calculated: ${cardWidth} x ${cardHeight}`);
    }
    
    // Ensure extraction coordinates are within canvas bounds
    const sourceX = Math.max(0, Math.min(Math.floor(adjustedX), viewport.width - 1));
    const sourceY = Math.max(0, Math.min(Math.floor(adjustedY), viewport.height - 1));
    const sourceWidth = Math.max(1, Math.min(Math.floor(cardWidth), viewport.width - sourceX));
    const sourceHeight = Math.max(1, Math.min(Math.floor(cardHeight), viewport.height - sourceY));
    
    // Validate extraction bounds
    if (sourceWidth <= 0 || sourceHeight <= 0) {
      throw new Error(`Invalid extraction dimensions: ${sourceWidth} x ${sourceHeight} at position (${sourceX}, ${sourceY})`);
    }
    
    // Create a new canvas for the extracted card
    let cardCanvas: HTMLCanvasElement;
    let cardContext: CanvasRenderingContext2D;
    
    try {
      cardCanvas = document.createElement('canvas');
      cardCanvas.width = Math.max(1, sourceWidth);
      cardCanvas.height = Math.max(1, sourceHeight);
      
      const context = cardCanvas.getContext('2d');
      if (!context) {
        throw new Error('Failed to get 2D rendering context for card canvas');
      }
      
      cardContext = context;
    } catch (error) {
      throw new Error(`Card canvas creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    
    // Extract the card area from the high-resolution canvas
    try {
      cardContext.drawImage(
        highResCanvas,
        sourceX, sourceY, sourceWidth, sourceHeight,
        0, 0, cardCanvas.width, cardCanvas.height
      );
    } catch (error) {
      throw new Error(`Card image extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // Apply individual card cropping if specified
    let finalCanvas = cardCanvas;
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
          
          finalCanvas = croppedCanvas;
        }
      }
    }

    // Apply image rotation if specified
    if (extractionSettings.imageRotation) {
      // Determine card type to get appropriate rotation
      const cardInfo = getCardInfo(cardIndex, activePages, extractionSettings, pdfMode, cardsPerPage);
      const cardType = cardInfo.type.toLowerCase() as 'front' | 'back';
      const rotation = extractionSettings.imageRotation[cardType] || 0;
      
      if (rotation !== 0) {
        // Create a new canvas for the rotated card
        const rotatedCanvas = document.createElement('canvas');
        const rotatedContext = rotatedCanvas.getContext('2d');
        
        if (rotatedContext) {
          // For 90° or 270° rotations, swap width and height
          if (rotation === 90 || rotation === 270) {
            rotatedCanvas.width = finalCanvas.height;
            rotatedCanvas.height = finalCanvas.width;
          } else {
            rotatedCanvas.width = finalCanvas.width;
            rotatedCanvas.height = finalCanvas.height;
          }
          
          // Clear canvas and apply rotation
          rotatedContext.clearRect(0, 0, rotatedCanvas.width, rotatedCanvas.height);
          rotatedContext.save();
          
          // Move to center and apply rotation
          rotatedContext.translate(rotatedCanvas.width / 2, rotatedCanvas.height / 2);
          const radians = (rotation * Math.PI) / 180;
          rotatedContext.rotate(radians);
          
          // Draw the image centered
          rotatedContext.drawImage(
            finalCanvas, 
            -finalCanvas.width / 2, 
            -finalCanvas.height / 2
          );
          
          rotatedContext.restore();
          finalCanvas = rotatedCanvas;
        }
      }
    }

    // Generate data URL with error handling
    try {
      const dataUrl = finalCanvas.toDataURL('image/png');
      
      if (!dataUrl || dataUrl === 'data:,') {
        throw new Error('Failed to generate valid image data URL');
      }
      
      // Check if the data URL is reasonably sized (not empty but not too large)
      if (dataUrl.length < 100) {
        throw new Error('Generated image data URL is too small, likely invalid');
      }
      
      const maxSize = 50 * 1024 * 1024; // 50MB limit
      if (dataUrl.length > maxSize) {
        throw new Error(`Generated image data URL is too large (${Math.round(dataUrl.length / 1024 / 1024)}MB), exceeds ${Math.round(maxSize / 1024 / 1024)}MB limit`);
      }
      
      return dataUrl;
    } catch (error) {
      throw new Error(`Data URL generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    
  } catch (error) {
    console.error(`Card extraction failed for card ${cardIndex}:`, error);
    
    // Provide more specific error context (calculate pageIndex and cardOnPage for context)
    const cardsPerPageForContext = extractionSettings.grid.rows * extractionSettings.grid.columns;
    const pageIndexForContext = Math.floor(cardIndex / cardsPerPageForContext);
    const cardOnPageForContext = cardIndex % cardsPerPageForContext;
    
    console.error(`Card extraction context: cardIndex=${cardIndex}, pageIndex=${pageIndexForContext}, cardOnPage=${cardOnPageForContext}, pdfMode=${pdfMode.type}`);
    
    return null;
  }
}

/**
 * Extract a card image from a canvas source (for image files)
 * 
 * This function extracts individual cards from image files loaded into canvas elements.
 * It handles grid-based card extraction similar to PDF extraction but operates on
 * canvas data instead of PDF pages.
 * 
 * @param cardIndex - Global card index to extract
 * @param imageData - Image data containing the source canvas
 * @param pdfMode - PDF mode configuration for card layout
 * @param activePages - Array of active page settings
 * @param extractionSettings - Grid and cropping settings
 * @returns Promise<string | null> - Data URL of the extracted card or null on error
 */
export async function extractCardImageFromCanvas(
  cardIndex: number,
  imageData: ImageFileData,
  pdfMode: PdfMode,
  activePages: (PageSettings & PageSource)[],
  extractionSettings: ExtractionSettings
): Promise<string | null> {
  // Validate inputs
  if (!imageData || !imageData.canvas) {
    console.error('Card extraction failed: No image data or canvas provided');
    return null;
  }
  
  if (!activePages || activePages.length === 0) {
    console.error('Card extraction failed: No active pages available');
    return null;
  }
  
  if (!extractionSettings || !extractionSettings.grid) {
    console.error('Card extraction failed: Invalid extraction settings');
    return null;
  }
  
  if (cardIndex < 0) {
    console.error(`Card extraction failed: Invalid card index ${cardIndex}`);
    return null;
  }

  try {
    const cardsPerPage = extractionSettings.grid.rows * extractionSettings.grid.columns;
    
    if (cardsPerPage <= 0) {
      throw new Error('Invalid grid configuration: cards per page must be greater than 0');
    }
    
    // Calculate which page and card position this cardIndex represents
    const pageIndex = Math.floor(cardIndex / cardsPerPage);
    const cardOnPage = cardIndex % cardsPerPage;

    if (pageIndex >= activePages.length) {
      console.warn(`Card extraction failed: Page index ${pageIndex} exceeds active pages (${activePages.length})`);
      return null;
    }

    const sourceCanvas = imageData.canvas;
    const sourceWidth = sourceCanvas.width;
    const sourceHeight = sourceCanvas.height;
    
    // Convert image to extraction DPI coordinate system for consistent crop application
    // Images are stored at their native resolution, but crop values are in extraction DPI pixels
    // This ensures crop values mean the same thing for both PDF and image files
    const extractionDpiWidth = sourceWidth; // Assume images are already at extraction DPI
    const extractionDpiHeight = sourceHeight; // TODO: Add proper DPI conversion if needed
    
    // Apply page-level cropping (crop settings are in extraction DPI pixels)
    const cropLeft = extractionSettings.crop?.left || 0;
    const cropTop = extractionSettings.crop?.top || 0;  
    const cropRight = extractionSettings.crop?.right || 0;
    const cropBottom = extractionSettings.crop?.bottom || 0;
    
    const croppedWidth = Math.max(1, extractionDpiWidth - cropLeft - cropRight);
    const croppedHeight = Math.max(1, extractionDpiHeight - cropTop - cropBottom);
    
    // Calculate card dimensions and position
    let cardWidth: number;
    let cardHeight: number;
    let adjustedX: number;
    let adjustedY: number;
    
    if (pdfMode.type === 'gutter-fold' && extractionSettings.gutterWidth && extractionSettings.gutterWidth > 0) {
      // Gutter-fold mode with gutter width
      const availableWidth = croppedWidth - extractionSettings.gutterWidth;
      cardWidth = availableWidth / (extractionSettings.grid.columns || 1);
      cardHeight = croppedHeight / extractionSettings.grid.rows;
      
      const row = Math.floor(cardOnPage / extractionSettings.grid.columns);
      const col = cardOnPage % extractionSettings.grid.columns;
      
      adjustedX = cropLeft + (col * cardWidth) + (col >= extractionSettings.grid.columns / 2 ? extractionSettings.gutterWidth : 0);
      adjustedY = cropTop + (row * cardHeight);
    } else {
      // Standard mode or gutter-fold without gutter width
      cardWidth = croppedWidth / extractionSettings.grid.columns;
      cardHeight = croppedHeight / extractionSettings.grid.rows;
      
      const row = Math.floor(cardOnPage / extractionSettings.grid.columns);
      const col = cardOnPage % extractionSettings.grid.columns;
      
      adjustedX = cropLeft + (col * cardWidth);
      adjustedY = cropTop + (row * cardHeight);
    }
    
    // Validate card dimensions
    if (cardWidth <= 0 || cardHeight <= 0) {
      throw new Error(`Invalid card dimensions calculated: ${cardWidth} x ${cardHeight}`);
    }
    
    // Extraction coordinates are calculated in extraction DPI, but canvas operations need source pixels
    // For now, assume 1:1 mapping (images treated as extraction DPI)
    // TODO: Add proper coordinate conversion if images have different native DPI
    const sourceX = Math.max(0, Math.min(Math.floor(adjustedX), sourceWidth - 1));
    const sourceY = Math.max(0, Math.min(Math.floor(adjustedY), sourceHeight - 1));
    const extractWidth = Math.max(1, Math.min(Math.floor(cardWidth), sourceWidth - sourceX));
    const extractHeight = Math.max(1, Math.min(Math.floor(cardHeight), sourceHeight - sourceY));
    
    // Validate extraction bounds
    if (extractWidth <= 0 || extractHeight <= 0) {
      throw new Error(`Invalid extraction dimensions: ${extractWidth} x ${extractHeight} at position (${sourceX}, ${sourceY})`);
    }
    
    // Create a new canvas for the extracted card
    let cardCanvas: HTMLCanvasElement;
    let cardContext: CanvasRenderingContext2D;
    
    try {
      cardCanvas = document.createElement('canvas');
      cardCanvas.width = Math.max(1, extractWidth);
      cardCanvas.height = Math.max(1, extractHeight);
      
      const context = cardCanvas.getContext('2d');
      if (!context) {
        throw new Error('Failed to get 2D rendering context for card canvas');
      }
      
      cardContext = context;
    } catch (error) {
      throw new Error(`Card canvas creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    
    // Extract the card area from the source canvas
    try {
      cardContext.drawImage(
        sourceCanvas,
        sourceX, sourceY, extractWidth, extractHeight,
        0, 0, cardCanvas.width, cardCanvas.height
      );
    } catch (error) {
      throw new Error(`Card image extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // Apply individual card cropping if specified
    let finalCanvas = cardCanvas;
    if (extractionSettings.cardCrop && 
        (extractionSettings.cardCrop.top > 0 || extractionSettings.cardCrop.right > 0 || 
         extractionSettings.cardCrop.bottom > 0 || extractionSettings.cardCrop.left > 0)) {
      
      const cardCrop = extractionSettings.cardCrop;
      const croppedCardWidth = Math.max(1, cardCanvas.width - cardCrop.left - cardCrop.right);
      const croppedCardHeight = Math.max(1, cardCanvas.height - cardCrop.top - cardCrop.bottom);
      
      // Only apply cropping if the result would be a valid size
      if (croppedCardWidth > 0 && croppedCardHeight > 0) {
        const croppedCanvas = document.createElement('canvas');
        croppedCanvas.width = croppedCardWidth;
        croppedCanvas.height = croppedCardHeight;
        const croppedContext = croppedCanvas.getContext('2d');
        
        if (croppedContext) {
          croppedContext.drawImage(
            cardCanvas,
            cardCrop.left, cardCrop.top, croppedCardWidth, croppedCardHeight,
            0, 0, croppedCardWidth, croppedCardHeight
          );
          
          finalCanvas = croppedCanvas;
        }
      }
    }

    // Apply image rotation if specified
    if (extractionSettings.imageRotation) {
      // Determine card type to get appropriate rotation
      const cardInfo = getCardInfo(cardIndex, activePages, extractionSettings, pdfMode, cardsPerPage);
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
            rotatedCanvas.width = finalCanvas.height;
            rotatedCanvas.height = finalCanvas.width;
          } else {
            rotatedCanvas.width = finalCanvas.width;
            rotatedCanvas.height = finalCanvas.height;
          }
          
          // Apply rotation transformation
          rotatedContext.translate(rotatedCanvas.width / 2, rotatedCanvas.height / 2);
          rotatedContext.rotate((rotation * Math.PI) / 180);
          rotatedContext.drawImage(finalCanvas, -finalCanvas.width / 2, -finalCanvas.height / 2);
          
          finalCanvas = rotatedCanvas;
        }
      }
    }

    // Generate data URL with error handling
    try {
      const dataUrl = finalCanvas.toDataURL('image/png');
      
      if (!dataUrl || dataUrl === 'data:,') {
        throw new Error('Failed to generate valid image data URL');
      }
      
      // Check if the data URL is reasonably sized
      if (dataUrl.length < 100) {
        throw new Error('Generated image data URL is too small, likely invalid');
      }
      
      const maxSize = 50 * 1024 * 1024; // 50MB limit
      if (dataUrl.length > maxSize) {
        throw new Error(`Generated image data URL is too large (${Math.round(dataUrl.length / 1024 / 1024)}MB), exceeds ${Math.round(maxSize / 1024 / 1024)}MB limit`);
      }
      
      return dataUrl;
    } catch (error) {
      throw new Error(`Data URL generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    
  } catch (error) {
    console.error(`Card extraction from canvas failed for card ${cardIndex}:`, error);
    
    const cardsPerPageForContext = extractionSettings.grid.rows * extractionSettings.grid.columns;
    const pageIndexForContext = Math.floor(cardIndex / cardsPerPageForContext);
    const cardOnPageForContext = cardIndex % cardsPerPageForContext;
    
    console.error(`Card extraction context: cardIndex=${cardIndex}, pageIndex=${pageIndexForContext}, cardOnPage=${cardOnPageForContext}, fileName=${imageData.fileName}`);
    
    return null;
  }
}