import { DPI_CONSTANTS } from '../constants';
import { DEFAULT_SETTINGS } from '../defaults';

/**
 * Unified rendering utilities for card processing
 * 
 * This module provides consistent rendering logic shared between preview (ConfigureStep)
 * and final output (ExportStep) to ensure visual consistency and eliminate duplicate code.
 */

// Types for render calculations
export interface CardRenderDimensions {
  /** Card container width in inches (target card size with bleed and scale) */
  cardWidthInches: number;
  /** Card container height in inches (target card size with bleed and scale) */
  cardHeightInches: number;
  /** Image width in inches (how large the image should be rendered) */
  imageWidthInches: number;
  /** Image height in inches (how large the image should be rendered) */
  imageHeightInches: number;
  /** Original extracted image width in inches */
  originalImageWidthInches: number;
  /** Original extracted image height in inches */
  originalImageHeightInches: number;
  /** Applied sizing mode */
  sizingMode: 'actual-size' | 'fit-to-card' | 'fill-card';
}

export interface CardPositioning {
  /** Final X position in inches */
  x: number;
  /** Final Y position in inches */
  y: number;
  /** Final width in inches (after rotation if applicable) */
  width: number;
  /** Final height in inches (after rotation if applicable) */
  height: number;
  /** Applied rotation in degrees */
  rotation: number;
}

export interface RotatedImageData {
  /** Data URL of the rotated image */
  imageUrl: string;
  /** Width of rotated image in inches */
  width: number;
  /** Height of rotated image in inches */
  height: number;
}

/**
 * Calculate final card render dimensions based on sizing mode
 * 
 * This is the unified function that both ConfigureStep and ExportStep should use
 * to ensure consistent sizing behavior between preview and final output.
 */
export async function calculateFinalCardRenderDimensions(
  cardImageUrl: string,
  outputSettings: any
): Promise<CardRenderDimensions> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    
    img.onload = () => {
      // Get image dimensions in pixels
      const imageWidthPx = img.naturalWidth;
      const imageHeightPx = img.naturalHeight;
      
      // Convert to inches using extraction DPI (this is how the image was extracted)
      const originalImageWidthInches = imageWidthPx / DPI_CONSTANTS.EXTRACTION_DPI;
      const originalImageHeightInches = imageHeightPx / DPI_CONSTANTS.EXTRACTION_DPI;
      
      // Get target card dimensions from output settings
      const cardWidthInches = outputSettings.cardSize?.widthInches || DEFAULT_SETTINGS.outputSettings.cardSize.widthInches;
      const cardHeightInches = outputSettings.cardSize?.heightInches || DEFAULT_SETTINGS.outputSettings.cardSize.heightInches;
      const bleedMarginInches = outputSettings.bleedMarginInches || DEFAULT_SETTINGS.outputSettings.bleedMarginInches;
      const scalePercent = outputSettings.cardScalePercent || DEFAULT_SETTINGS.outputSettings.cardScalePercent;
      
      // Calculate target dimensions with bleed
      const targetCardWidthInches = cardWidthInches + (bleedMarginInches * 2);
      const targetCardHeightInches = cardHeightInches + (bleedMarginInches * 2);
      
      // Calculate final card container dimensions (with bleed and scale)
      const finalCardWidthInches = targetCardWidthInches * (scalePercent / 100);
      const finalCardHeightInches = targetCardHeightInches * (scalePercent / 100);
      
      // Apply sizing mode to determine image dimensions
      const sizingMode = outputSettings.cardImageSizingMode || DEFAULT_SETTINGS.outputSettings.cardImageSizingMode;
      let imageWidthInches = originalImageWidthInches;
      let imageHeightInches = originalImageHeightInches;
      
      switch (sizingMode) {
        case 'actual-size': {
          // Use image at its original extracted size
          imageWidthInches = originalImageWidthInches;
          imageHeightInches = originalImageHeightInches;
          break;
        }
          
        case 'fit-to-card': {
          // Scale to fit entirely within card boundaries, maintaining aspect ratio
          const imageAspectRatio = originalImageWidthInches / originalImageHeightInches;
          const cardAspectRatio = targetCardWidthInches / targetCardHeightInches;
          
          if (imageAspectRatio > cardAspectRatio) {
            // Image is wider - fit to width
            imageWidthInches = targetCardWidthInches;
            imageHeightInches = targetCardWidthInches / imageAspectRatio;
          } else {
            // Image is taller - fit to height
            imageHeightInches = targetCardHeightInches;
            imageWidthInches = targetCardHeightInches * imageAspectRatio;
          }
          break;
        }
          
        case 'fill-card': {
          // Scale to fill entire card area, maintaining aspect ratio (may crop)
          const imageAspectRatioFill = originalImageWidthInches / originalImageHeightInches;
          const cardAspectRatioFill = targetCardWidthInches / targetCardHeightInches;
          
          if (imageAspectRatioFill > cardAspectRatioFill) {
            // Image is wider - scale to fill height, crop width
            imageHeightInches = targetCardHeightInches;
            imageWidthInches = targetCardHeightInches * imageAspectRatioFill;
          } else {
            // Image is taller - scale to fill width, crop height
            imageWidthInches = targetCardWidthInches;
            imageHeightInches = targetCardWidthInches / imageAspectRatioFill;
          }
          break;
        }
      }
      
      // Apply scale percentage to image dimensions
      imageWidthInches *= (scalePercent / 100);
      imageHeightInches *= (scalePercent / 100);
      
      resolve({
        cardWidthInches: finalCardWidthInches,
        cardHeightInches: finalCardHeightInches,
        imageWidthInches,
        imageHeightInches,
        originalImageWidthInches,
        originalImageHeightInches,
        sizingMode
      });
    };
    
    img.onerror = reject;
    img.src = cardImageUrl;
  });
}

/**
 * Calculate card positioning on the page
 * 
 * Takes into account page size, offsets, and rotation to determine final positioning.
 */
export function calculateCardPositioning(
  renderDimensions: CardRenderDimensions,
  outputSettings: any,
  cardType: 'front' | 'back'
): CardPositioning {
  const pageWidth = outputSettings.pageSize.width;
  const pageHeight = outputSettings.pageSize.height;
  const horizontalOffset = outputSettings.offset.horizontal || 0;
  const verticalOffset = outputSettings.offset.vertical || 0;
  
  // Get rotation for this card type
  const rotation = getRotationForCardType(outputSettings, cardType);
  
  // Determine final dimensions after rotation (use card dimensions, not image dimensions)
  let finalWidth = renderDimensions.cardWidthInches;
  let finalHeight = renderDimensions.cardHeightInches;
  
  // For 90° or 270° rotations, swap width/height
  if (rotation === 90 || rotation === 270) {
    finalWidth = renderDimensions.cardHeightInches;
    finalHeight = renderDimensions.cardWidthInches;
  }
  
  // Calculate centered position with offsets
  const x = (pageWidth - finalWidth) / 2 + horizontalOffset;
  const y = (pageHeight - finalHeight) / 2 + verticalOffset;
  
  return {
    x,
    y,
    width: finalWidth,
    height: finalHeight,
    rotation
  };
}

/**
 * Process card image for rendering (handle rotation and clipping)
 * 
 * Creates a processed version of the image with proper sizing, rotation, and clipping
 * to match the card boundaries.
 */
export async function processCardImageForRendering(
  cardImageUrl: string,
  renderDimensions: CardRenderDimensions,
  rotation: number
): Promise<RotatedImageData> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    
    img.onload = () => {
      try {
        // Create canvas for processing (sizing, clipping, and rotation)
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          throw new Error('Could not get canvas context');
        }
        
        // Convert dimensions to pixels
        const cardWidthPx = renderDimensions.cardWidthInches * DPI_CONSTANTS.EXTRACTION_DPI;
        const cardHeightPx = renderDimensions.cardHeightInches * DPI_CONSTANTS.EXTRACTION_DPI;
        const imageWidthPx = renderDimensions.imageWidthInches * DPI_CONSTANTS.EXTRACTION_DPI;
        const imageHeightPx = renderDimensions.imageHeightInches * DPI_CONSTANTS.EXTRACTION_DPI;
        
        // Set canvas size to card dimensions (this defines the clipping area)
        let finalCanvasWidth = cardWidthPx;
        let finalCanvasHeight = cardHeightPx;
        
        // For 90° or 270° rotations, swap canvas dimensions
        if (rotation === 90 || rotation === 270) {
          finalCanvasWidth = cardHeightPx;
          finalCanvasHeight = cardWidthPx;
        }
        
        canvas.width = finalCanvasWidth;
        canvas.height = finalCanvasHeight;
        
        // Clear canvas
        ctx.clearRect(0, 0, finalCanvasWidth, finalCanvasHeight);
        ctx.save();
        
        // Move to center and apply rotation
        ctx.translate(finalCanvasWidth / 2, finalCanvasHeight / 2);
        if (rotation !== 0) {
          const radians = (rotation * Math.PI) / 180;
          ctx.rotate(radians);
        }
        
        // Calculate image position to center it in the card
        const drawX = -imageWidthPx / 2;
        const drawY = -imageHeightPx / 2;
        
        // Draw the image scaled and centered
        ctx.drawImage(img, drawX, drawY, imageWidthPx, imageHeightPx);
        
        ctx.restore();
        
        // Get processed image as data URL
        const processedImageUrl = canvas.toDataURL('image/png');
        
        // Return final canvas dimensions in inches
        const finalWidthInches = finalCanvasWidth / DPI_CONSTANTS.EXTRACTION_DPI;
        const finalHeightInches = finalCanvasHeight / DPI_CONSTANTS.EXTRACTION_DPI;
        
        resolve({
          imageUrl: processedImageUrl,
          width: finalWidthInches,
          height: finalHeightInches
        });
      } catch (error) {
        console.warn(`Failed to process image (rotation: ${rotation}°):`, error);
        // Fallback to original image with card dimensions
        resolve({
          imageUrl: cardImageUrl,
          width: renderDimensions.cardWidthInches,
          height: renderDimensions.cardHeightInches
        });
      }
    };
    
    img.onerror = reject;
    img.src = cardImageUrl;
  });
}

/**
 * Helper function to get rotation for a specific card type
 * 
 * Extracted from cardUtils.ts for consistency
 */
function getRotationForCardType(outputSettings: any, cardType: 'front' | 'back'): number {
  if (typeof outputSettings.rotation === 'object' && outputSettings.rotation !== null) {
    return outputSettings.rotation[cardType] || 0;
  }
  return outputSettings.rotation || 0;
}

/**
 * Calculate preview scaling for ConfigureStep display
 * 
 * Converts render dimensions to screen pixels for preview display
 */
export function calculatePreviewScaling(
  _renderDimensions: CardRenderDimensions,
  positioning: CardPositioning,
  pageWidth: number,
  pageHeight: number,
  maxPreviewWidth = 400,
  maxPreviewHeight = 500
): {
  scale: number;
  previewPageWidth: number;
  previewPageHeight: number;
  previewCardWidth: number;
  previewCardHeight: number;
  previewX: number;
  previewY: number;
} {
  // Calculate page preview size
  let previewPageWidth = pageWidth * DPI_CONSTANTS.SCREEN_DPI;
  let previewPageHeight = pageHeight * DPI_CONSTANTS.SCREEN_DPI;
  
  let scale = 1;
  if (previewPageWidth > maxPreviewWidth || previewPageHeight > maxPreviewHeight) {
    const widthScale = maxPreviewWidth / previewPageWidth;
    const heightScale = maxPreviewHeight / previewPageHeight;
    scale = Math.min(widthScale, heightScale);
    
    previewPageWidth *= scale;
    previewPageHeight *= scale;
  }
  
  // Scale card dimensions and position for preview
  const previewCardWidth = positioning.width * DPI_CONSTANTS.SCREEN_DPI * scale;
  const previewCardHeight = positioning.height * DPI_CONSTANTS.SCREEN_DPI * scale;
  const previewX = positioning.x * DPI_CONSTANTS.SCREEN_DPI * scale;
  const previewY = positioning.y * DPI_CONSTANTS.SCREEN_DPI * scale;
  
  return {
    scale,
    previewPageWidth,
    previewPageHeight,
    previewCardWidth,
    previewCardHeight,
    previewX,
    previewY
  };
}