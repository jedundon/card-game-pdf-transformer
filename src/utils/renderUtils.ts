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
  /** Final render width in inches */
  finalWidthInches: number;
  /** Final render height in inches */
  finalHeightInches: number;
  /** Original image width in inches (before sizing mode applied) */
  originalImageWidthInches: number;
  /** Original image height in inches (before sizing mode applied) */
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
      
      // Apply sizing mode
      const sizingMode = outputSettings.cardImageSizingMode || DEFAULT_SETTINGS.outputSettings.cardImageSizingMode;
      let finalWidthInches = originalImageWidthInches;
      let finalHeightInches = originalImageHeightInches;
      
      switch (sizingMode) {
        case 'actual-size': {
          // Use image at its original extracted size
          finalWidthInches = originalImageWidthInches;
          finalHeightInches = originalImageHeightInches;
          break;
        }
          
        case 'fit-to-card': {
          // Scale to fit entirely within card boundaries, maintaining aspect ratio
          const imageAspectRatio = originalImageWidthInches / originalImageHeightInches;
          const cardAspectRatio = targetCardWidthInches / targetCardHeightInches;
          
          if (imageAspectRatio > cardAspectRatio) {
            // Image is wider - fit to width
            finalWidthInches = targetCardWidthInches;
            finalHeightInches = targetCardWidthInches / imageAspectRatio;
          } else {
            // Image is taller - fit to height
            finalHeightInches = targetCardHeightInches;
            finalWidthInches = targetCardHeightInches * imageAspectRatio;
          }
          break;
        }
          
        case 'fill-card': {
          // Scale to fill entire card area, maintaining aspect ratio (may crop)
          const imageAspectRatioFill = originalImageWidthInches / originalImageHeightInches;
          const cardAspectRatioFill = targetCardWidthInches / targetCardHeightInches;
          
          if (imageAspectRatioFill > cardAspectRatioFill) {
            // Image is wider - scale to fill height, crop width
            finalHeightInches = targetCardHeightInches;
            finalWidthInches = targetCardHeightInches * imageAspectRatioFill;
          } else {
            // Image is taller - scale to fill width, crop height
            finalWidthInches = targetCardWidthInches;
            finalHeightInches = targetCardWidthInches / imageAspectRatioFill;
          }
          break;
        }
      }
      
      // Apply scale percentage to final dimensions
      finalWidthInches *= (scalePercent / 100);
      finalHeightInches *= (scalePercent / 100);
      
      resolve({
        finalWidthInches,
        finalHeightInches,
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
  
  // Determine final dimensions after rotation
  let finalWidth = renderDimensions.finalWidthInches;
  let finalHeight = renderDimensions.finalHeightInches;
  
  // For 90° or 270° rotations, swap width/height
  if (rotation === 90 || rotation === 270) {
    finalWidth = renderDimensions.finalHeightInches;
    finalHeight = renderDimensions.finalWidthInches;
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
 * Process card image for rendering (handle rotation)
 * 
 * If rotation is needed, creates a rotated version of the image and returns the new image data.
 * If no rotation needed, returns the original image.
 */
export async function processCardImageForRendering(
  cardImageUrl: string,
  rotation: number
): Promise<RotatedImageData> {
  if (rotation === 0) {
    // No rotation needed - determine dimensions of original image
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const widthInches = img.naturalWidth / DPI_CONSTANTS.EXTRACTION_DPI;
        const heightInches = img.naturalHeight / DPI_CONSTANTS.EXTRACTION_DPI;
        resolve({
          imageUrl: cardImageUrl,
          width: widthInches,
          height: heightInches
        });
      };
      img.onerror = reject;
      img.src = cardImageUrl;
    });
  }
  
  // Apply rotation using canvas
  return new Promise((resolve, reject) => {
    const img = new Image();
    
    img.onload = () => {
      try {
        // Create canvas for rotation
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          throw new Error('Could not get canvas context');
        }
        
        // Calculate rotated canvas dimensions
        const radians = (rotation * Math.PI) / 180;
        const cos = Math.abs(Math.cos(radians));
        const sin = Math.abs(Math.sin(radians));
        
        const rotatedCanvasWidth = img.width * cos + img.height * sin;
        const rotatedCanvasHeight = img.width * sin + img.height * cos;
        
        canvas.width = rotatedCanvasWidth;
        canvas.height = rotatedCanvasHeight;
        
        // Clear and setup transformation
        ctx.clearRect(0, 0, rotatedCanvasWidth, rotatedCanvasHeight);
        ctx.save();
        
        // Move to center, rotate, then draw image centered
        ctx.translate(rotatedCanvasWidth / 2, rotatedCanvasHeight / 2);
        ctx.rotate(radians);
        ctx.drawImage(img, -img.width / 2, -img.height / 2);
        
        ctx.restore();
        
        // Get rotated image as data URL
        const rotatedImageUrl = canvas.toDataURL('image/png');
        
        // Calculate dimensions in inches after rotation
        const widthInches = rotatedCanvasWidth / DPI_CONSTANTS.EXTRACTION_DPI;
        const heightInches = rotatedCanvasHeight / DPI_CONSTANTS.EXTRACTION_DPI;
        
        resolve({
          imageUrl: rotatedImageUrl,
          width: widthInches,
          height: heightInches
        });
      } catch (error) {
        console.warn(`Failed to apply rotation (${rotation}°):`, error);
        // Fallback to original image
        const widthInches = img.naturalWidth / DPI_CONSTANTS.EXTRACTION_DPI;
        const heightInches = img.naturalHeight / DPI_CONSTANTS.EXTRACTION_DPI;
        resolve({
          imageUrl: cardImageUrl,
          width: widthInches,
          height: heightInches
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