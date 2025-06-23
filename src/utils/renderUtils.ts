import { DPI_CONSTANTS } from '../constants';
import { DEFAULT_SETTINGS } from '../defaults';
import { OutputSettings } from '../types';

/**
 * @fileoverview Unified rendering utilities for card processing
 * 
 * This module provides consistent rendering logic shared between preview (ConfigureStep)
 * and final output (ExportStep) to ensure visual consistency and eliminate duplicate code.
 * 
 * **Core Design Principles:**
 * - **Unified Pipeline**: Same functions used for both preview and final export
 * - **Card vs Image Separation**: Card container defines clipping; image size handles scaling
 * - **Canvas-Based Processing**: All rotation and clipping via canvas for pixel-perfect control
 * - **DPI Consistency**: Proper scaling between extraction (300), screen (72/96), and output
 * 
 * **Rendering Pipeline:**
 * 1. `calculateFinalCardRenderDimensions()` - Determine card container and image sizes
 * 2. `processCardImageForRendering()` - Apply sizing, rotation, and clipping via canvas
 * 3. `calculateCardPositioning()` - Handle placement and rotation-aware dimensions
 * 4. `calculatePreviewScaling()` - Convert to screen display format for UI
 * 
 * **Key Features:**
 * - Support for multiple image sizing modes (actual-size, fit-to-card, fill-card)
 * - Proper handling of image rotation with dimension swapping
 * - Canvas-based clipping to card boundaries
 * - DPI-aware scaling for different contexts
 * - Comprehensive error handling and validation
 * 
 * @author Card Game PDF Transformer
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
 * This is the unified function that both ConfigureStep and ExportStep use
 * to ensure consistent sizing behavior between preview and final output.
 * 
 * **Calculation Process:**
 * 1. Load image to get natural pixel dimensions
 * 2. Convert to inches using extraction DPI (300)
 * 3. Apply bleed margin to card dimensions (base + 2×bleed)
 * 4. Apply scale percentage to target dimensions
 * 5. Calculate image size based on sizing mode:
 *    - `actual-size`: Use original extracted size
 *    - `fit-to-card`: Scale to fit within card bounds (letterbox)
 *    - `fill-card`: Scale to fill card area (may crop)
 * 6. Apply scale percentage to final image dimensions
 * 
 * **DPI Handling:**
 * - Input image assumed to be at extraction DPI (300)
 * - All calculations done in inches for consistency
 * - Output dimensions in inches for downstream processing
 * 
 * @param cardImageUrl - Data URL of the extracted card image
 * @param outputSettings - Complete output configuration including card size, bleed, scale, and sizing mode
 * @returns Promise resolving to CardRenderDimensions with card container and image sizes
 * 
 * @example
 * ```typescript
 * const dimensions = await calculateFinalCardRenderDimensions(
 *   cardDataUrl,
 *   {
 *     cardSize: { widthInches: 2.5, heightInches: 3.5 },
 *     bleedMarginInches: 0.125,
 *     cardScalePercent: 95,
 *     cardImageSizingMode: 'fit-to-card'
 *   }
 * );
 * 
 * // For a 2.0" × 4.0" extracted image:
 * // - Card container: 2.6125" × 3.4625" (with bleed and scale)
 * // - Image size: 1.73125" × 3.4625" (fit-to-card mode, scaled)
 * ```
 * 
 * @throws {Error} When image fails to load, has invalid dimensions, or settings are invalid
 */
export async function calculateFinalCardRenderDimensions(
  cardImageUrl: string,
  outputSettings: OutputSettings
): Promise<CardRenderDimensions> {
  // Validate inputs
  if (!cardImageUrl || typeof cardImageUrl !== 'string') {
    throw new Error('Invalid card image URL provided');
  }
  
  if (!outputSettings) {
    throw new Error('No output settings provided');
  }

  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error('Image loading timed out'));
    }, 10000); // 10 second timeout

    const img = new Image();
    
    img.onload = () => {
      clearTimeout(timeoutId);
      
      try {
        // Get image dimensions in pixels
        const imageWidthPx = img.naturalWidth;
        const imageHeightPx = img.naturalHeight;
        
        // Validate image dimensions
        if (!imageWidthPx || !imageHeightPx || imageWidthPx <= 0 || imageHeightPx <= 0) {
          throw new Error(`Invalid image dimensions: ${imageWidthPx} x ${imageHeightPx}`);
        }

        // Check for reasonable image size (prevent memory issues)
        const maxDimension = 20000; // 20k pixels max
        if (imageWidthPx > maxDimension || imageHeightPx > maxDimension) {
          throw new Error(`Image too large: ${imageWidthPx} x ${imageHeightPx}. Maximum allowed: ${maxDimension} x ${maxDimension}`);
        }
        
        // Convert to inches using extraction DPI (this is how the image was extracted)
        const originalImageWidthInches = imageWidthPx / DPI_CONSTANTS.EXTRACTION_DPI;
        const originalImageHeightInches = imageHeightPx / DPI_CONSTANTS.EXTRACTION_DPI;
        
        if (originalImageWidthInches <= 0 || originalImageHeightInches <= 0) {
          throw new Error(`Invalid calculated image dimensions in inches: ${originalImageWidthInches}" x ${originalImageHeightInches}"`);
        }
        
        // Get target card dimensions from output settings with validation
        const cardWidthInches = outputSettings.cardSize?.widthInches || DEFAULT_SETTINGS.outputSettings.cardSize.widthInches;
        const cardHeightInches = outputSettings.cardSize?.heightInches || DEFAULT_SETTINGS.outputSettings.cardSize.heightInches;
        const bleedMarginInches = outputSettings.bleedMarginInches || DEFAULT_SETTINGS.outputSettings.bleedMarginInches;
        const scalePercent = outputSettings.cardScalePercent || DEFAULT_SETTINGS.outputSettings.cardScalePercent;
        
        // Validate settings
        if (cardWidthInches <= 0 || cardHeightInches <= 0) {
          throw new Error(`Invalid card dimensions: ${cardWidthInches}" x ${cardHeightInches}"`);
        }
        
        if (bleedMarginInches < 0 || bleedMarginInches > 2) {
          throw new Error(`Invalid bleed margin: ${bleedMarginInches}" (must be between 0 and 2 inches)`);
        }
        
        if (scalePercent <= 0 || scalePercent > 500) {
          throw new Error(`Invalid scale percentage: ${scalePercent}% (must be between 1% and 500%)`);
        }
        
        // Calculate target dimensions with bleed
        const targetCardWidthInches = cardWidthInches + (bleedMarginInches * 2);
        const targetCardHeightInches = cardHeightInches + (bleedMarginInches * 2);
        
        if (targetCardWidthInches <= 0 || targetCardHeightInches <= 0) {
          throw new Error(`Invalid target card dimensions with bleed: ${targetCardWidthInches}" x ${targetCardHeightInches}"`);
        }
        
        // Calculate final card container dimensions (with bleed and scale)
        const finalCardWidthInches = targetCardWidthInches * (scalePercent / 100);
        const finalCardHeightInches = targetCardHeightInches * (scalePercent / 100);
        
        // Apply sizing mode to determine image dimensions
        const sizingMode = outputSettings.cardImageSizingMode || DEFAULT_SETTINGS.outputSettings.cardImageSizingMode;
        let imageWidthInches = originalImageWidthInches;
        let imageHeightInches = originalImageHeightInches;
        
        try {
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
              
              if (!isFinite(imageAspectRatio) || !isFinite(cardAspectRatio)) {
                throw new Error('Invalid aspect ratio calculation');
              }
              
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
              
              if (!isFinite(imageAspectRatioFill) || !isFinite(cardAspectRatioFill)) {
                throw new Error('Invalid aspect ratio calculation for fill mode');
              }
              
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
            
            default:
              throw new Error(`Invalid sizing mode: ${sizingMode}`);
          }
        } catch (error) {
          throw new Error(`Sizing mode calculation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
        
        // Apply scale percentage to image dimensions
        imageWidthInches *= (scalePercent / 100);
        imageHeightInches *= (scalePercent / 100);
        
        // Final validation
        if (!isFinite(imageWidthInches) || !isFinite(imageHeightInches) || 
            imageWidthInches <= 0 || imageHeightInches <= 0) {
          throw new Error(`Invalid final image dimensions: ${imageWidthInches}" x ${imageHeightInches}"`);
        }
        
        if (!isFinite(finalCardWidthInches) || !isFinite(finalCardHeightInches) || 
            finalCardWidthInches <= 0 || finalCardHeightInches <= 0) {
          throw new Error(`Invalid final card dimensions: ${finalCardWidthInches}" x ${finalCardHeightInches}"`);
        }
        
        resolve({
          cardWidthInches: finalCardWidthInches,
          cardHeightInches: finalCardHeightInches,
          imageWidthInches,
          imageHeightInches,
          originalImageWidthInches,
          originalImageHeightInches,
          sizingMode
        });
        
      } catch (error) {
        reject(new Error(`Render dimension calculation failed: ${error instanceof Error ? error.message : 'Unknown error'}`));
      }
    };
    
    img.onerror = (error) => {
      clearTimeout(timeoutId);
      reject(new Error(`Failed to load image: ${error instanceof Error ? error.message : 'Image load error'}`));
    };
    
    // Set source after setting up event handlers
    try {
      img.src = cardImageUrl;
    } catch (error) {
      clearTimeout(timeoutId);
      reject(new Error(`Failed to set image source: ${error instanceof Error ? error.message : 'Unknown error'}`));
    }
  });
}

/**
 * Calculate card positioning on the page
 * 
 * Determines the final position and dimensions of a card on the output page,
 * taking into account page size, user offsets, and rotation effects.
 * 
 * **Positioning Logic:**
 * 1. Get rotation value for the specified card type (front/back)
 * 2. Calculate final dimensions after rotation (swap width/height for 90°/270°)
 * 3. Center card on page and apply user-specified offsets
 * 4. Return position and dimensions for rendering
 * 
 * **Rotation Handling:**
 * - 0°/180°: Width and height remain unchanged
 * - 90°/270°: Width and height are swapped to account for rotation
 * - Position calculation uses post-rotation dimensions
 * 
 * @param renderDimensions - Card container and image dimensions from calculateFinalCardRenderDimensions()
 * @param outputSettings - Output configuration including page size and offsets
 * @param cardType - Card type to determine rotation ('front' or 'back')
 * @returns CardPositioning object with final position, dimensions, and rotation
 * 
 * @example
 * ```typescript
 * const positioning = calculateCardPositioning(
 *   renderDimensions,
 *   {
 *     pageSize: { width: 8.5, height: 11 },
 *     offset: { horizontal: 0.25, vertical: -0.125 },
 *     rotation: { front: 0, back: 180 }
 *   },
 *   'front'
 * );
 * 
 * // For a 2.5" × 3.5" card on 8.5" × 11" page with 0.25" right, 0.125" up offset:
 * // positioning = {
 * //   x: 3.25,    // (8.5 - 2.5) / 2 + 0.25
 * //   y: 3.625,   // (11 - 3.5) / 2 - 0.125
 * //   width: 2.5,
 * //   height: 3.5,
 * //   rotation: 0
 * // }
 * ```
 */
export function calculateCardPositioning(
  renderDimensions: CardRenderDimensions,
  outputSettings: OutputSettings,
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
 * to match the card boundaries. This is the core image processing function that ensures
 * pixel-perfect output for both preview and final export.
 * 
 * **Processing Pipeline:**
 * 1. Load source image and validate dimensions
 * 2. Create canvas with card container dimensions (clipping bounds)
 * 3. Convert all dimensions from inches to pixels at extraction DPI
 * 4. Apply image rotation using canvas transforms:
 *    - Center canvas transformation origin
 *    - Apply rotation in radians
 *    - Draw image centered in rotated coordinate system
 * 5. Clip image to card boundaries automatically via canvas size
 * 6. Generate final data URL for use in rendering
 * 
 * **Key Features:**
 * - **Pixel-Perfect**: All calculations done at extraction DPI (300)
 * - **Canvas Clipping**: Card container size automatically clips image
 * - **Rotation Support**: Handles arbitrary rotation angles with proper centering
 * - **Memory Management**: Validates canvas size to prevent memory issues
 * - **Error Handling**: Comprehensive validation with helpful error messages
 * 
 * @param cardImageUrl - Data URL of the extracted card image
 * @param renderDimensions - Calculated dimensions from calculateFinalCardRenderDimensions()
 * @param rotation - Rotation angle in degrees (0-359)
 * @returns Promise resolving to RotatedImageData with processed image and final dimensions
 * 
 * @example
 * ```typescript
 * const processed = await processCardImageForRendering(
 *   cardDataUrl,
 *   {
 *     cardWidthInches: 2.5,
 *     cardHeightInches: 3.5,
 *     imageWidthInches: 2.8,  // Larger than card (will be clipped)
 *     imageHeightInches: 3.2,
 *     // ... other dimensions
 *   },
 *   90  // 90-degree rotation
 * );
 * 
 * // Result:
 * // - Image rotated 90 degrees
 * // - Clipped to 2.5" × 3.5" card boundaries
 * // - Ready for placement at calculated position
 * ```
 * 
 * @throws {Error} When image loading fails, canvas creation fails, or invalid parameters provided
 */
export async function processCardImageForRendering(
  cardImageUrl: string,
  renderDimensions: CardRenderDimensions,
  rotation: number
): Promise<RotatedImageData> {
  // Validate inputs
  if (!cardImageUrl || typeof cardImageUrl !== 'string') {
    throw new Error('Invalid card image URL provided');
  }
  
  if (!renderDimensions) {
    throw new Error('No render dimensions provided');
  }
  
  if (typeof rotation !== 'number' || !isFinite(rotation)) {
    throw new Error(`Invalid rotation value: ${rotation}`);
  }
  
  // Normalize rotation to 0-359 range
  const normalizedRotation = ((rotation % 360) + 360) % 360;
  
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error('Image processing timed out'));
    }, 15000); // 15 second timeout

    const img = new Image();
    
    img.onload = () => {
      clearTimeout(timeoutId);
      
      try {
        // Validate image
        if (!img.naturalWidth || !img.naturalHeight) {
          throw new Error('Invalid image: no dimensions available');
        }
        
        // Create canvas for processing (sizing, clipping, and rotation)
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        if (!canvas) {
          throw new Error('Failed to create canvas element');
        }
        
        if (!ctx) {
          throw new Error('Failed to get 2D rendering context');
        }
        
        // Convert dimensions to pixels with validation
        const cardWidthPx = renderDimensions.cardWidthInches * DPI_CONSTANTS.EXTRACTION_DPI;
        const cardHeightPx = renderDimensions.cardHeightInches * DPI_CONSTANTS.EXTRACTION_DPI;
        const imageWidthPx = renderDimensions.imageWidthInches * DPI_CONSTANTS.EXTRACTION_DPI;
        const imageHeightPx = renderDimensions.imageHeightInches * DPI_CONSTANTS.EXTRACTION_DPI;
        
        // Validate pixel dimensions
        if (!isFinite(cardWidthPx) || !isFinite(cardHeightPx) || 
            !isFinite(imageWidthPx) || !isFinite(imageHeightPx) ||
            cardWidthPx <= 0 || cardHeightPx <= 0 || imageWidthPx <= 0 || imageHeightPx <= 0) {
          throw new Error(`Invalid pixel dimensions: card ${cardWidthPx}x${cardHeightPx}, image ${imageWidthPx}x${imageHeightPx}`);
        }
        
        // Check for reasonable canvas size (prevent memory issues)
        const maxCanvasSize = 10000; // 10k pixels max
        if (cardWidthPx > maxCanvasSize || cardHeightPx > maxCanvasSize) {
          throw new Error(`Canvas too large: ${cardWidthPx}x${cardHeightPx}. Maximum: ${maxCanvasSize}x${maxCanvasSize}`);
        }
        
        // Set canvas size to card dimensions (this defines the clipping area)
        let finalCanvasWidth = cardWidthPx;
        let finalCanvasHeight = cardHeightPx;
        
        // For 90° or 270° rotations, swap canvas dimensions
        if (normalizedRotation === 90 || normalizedRotation === 270) {
          finalCanvasWidth = cardHeightPx;
          finalCanvasHeight = cardWidthPx;
        }
        
        // Validate final canvas dimensions
        if (finalCanvasWidth <= 0 || finalCanvasHeight <= 0 || 
            finalCanvasWidth > maxCanvasSize || finalCanvasHeight > maxCanvasSize) {
          throw new Error(`Invalid final canvas dimensions: ${finalCanvasWidth}x${finalCanvasHeight}`);
        }
        
        try {
          canvas.width = finalCanvasWidth;
          canvas.height = finalCanvasHeight;
        } catch (error) {
          throw new Error(`Failed to set canvas size: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
        
        // Clear canvas
        try {
          ctx.clearRect(0, 0, finalCanvasWidth, finalCanvasHeight);
          ctx.save();
        } catch (error) {
          throw new Error(`Canvas clearing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
        
        // Move to center and apply rotation
        try {
          ctx.translate(finalCanvasWidth / 2, finalCanvasHeight / 2);
          
          if (normalizedRotation !== 0) {
            const radians = (normalizedRotation * Math.PI) / 180;
            if (!isFinite(radians)) {
              throw new Error(`Invalid rotation radians: ${radians}`);
            }
            ctx.rotate(radians);
          }
        } catch (error) {
          throw new Error(`Canvas transformation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
        
        // Calculate image position to center it in the card
        const drawX = -imageWidthPx / 2;
        const drawY = -imageHeightPx / 2;
        
        if (!isFinite(drawX) || !isFinite(drawY)) {
          throw new Error(`Invalid draw position: ${drawX}, ${drawY}`);
        }
        
        // Draw the image scaled and centered
        try {
          ctx.drawImage(img, drawX, drawY, imageWidthPx, imageHeightPx);
        } catch (error) {
          throw new Error(`Image drawing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
        
        try {
          ctx.restore();
        } catch (error) {
          console.warn('Canvas restore failed:', error);
          // Non-critical error, continue
        }
        
        // Get processed image as data URL
        let processedImageUrl: string;
        try {
          processedImageUrl = canvas.toDataURL('image/png');
          
          if (!processedImageUrl || processedImageUrl === 'data:,') {
            throw new Error('Failed to generate valid data URL');
          }
          
          // Validate data URL size
          if (processedImageUrl.length < 100) {
            throw new Error('Generated data URL too small, likely invalid');
          }
          
          const maxDataUrlSize = 100 * 1024 * 1024; // 100MB
          if (processedImageUrl.length > maxDataUrlSize) {
            throw new Error(`Generated data URL too large: ${Math.round(processedImageUrl.length / 1024 / 1024)}MB`);
          }
        } catch (error) {
          throw new Error(`Data URL generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
        
        // Return final canvas dimensions in inches
        const finalWidthInches = finalCanvasWidth / DPI_CONSTANTS.EXTRACTION_DPI;
        const finalHeightInches = finalCanvasHeight / DPI_CONSTANTS.EXTRACTION_DPI;
        
        if (!isFinite(finalWidthInches) || !isFinite(finalHeightInches) || 
            finalWidthInches <= 0 || finalHeightInches <= 0) {
          throw new Error(`Invalid final dimensions in inches: ${finalWidthInches}" x ${finalHeightInches}"`);
        }
        
        resolve({
          imageUrl: processedImageUrl,
          width: finalWidthInches,
          height: finalHeightInches
        });
        
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown processing error';
        console.error(`Image processing failed (rotation: ${normalizedRotation}°):`, errorMessage);
        
        // For critical errors, reject instead of fallback
        if (errorMessage.includes('Canvas too large') || 
            errorMessage.includes('Invalid image') ||
            errorMessage.includes('Failed to create canvas') ||
            errorMessage.includes('Invalid pixel dimensions')) {
          reject(new Error(`Image processing failed: ${errorMessage}`));
          return;
        }
        
        // For less critical errors, provide fallback
        console.warn('Using fallback image due to processing error');
        resolve({
          imageUrl: cardImageUrl,
          width: renderDimensions.cardWidthInches,
          height: renderDimensions.cardHeightInches
        });
      }
    };
    
    img.onerror = (error) => {
      clearTimeout(timeoutId);
      reject(new Error(`Failed to load image for processing: ${error instanceof Error ? error.message : 'Image load error'}`));
    };
    
    // Set source after setting up event handlers
    try {
      img.src = cardImageUrl;
    } catch (error) {
      clearTimeout(timeoutId);
      reject(new Error(`Failed to set image source: ${error instanceof Error ? error.message : 'Unknown error'}`));
    }
  });
}

/**
 * Helper function to get rotation for a specific card type
 * 
 * Extracted from cardUtils.ts for consistency
 */
function getRotationForCardType(outputSettings: OutputSettings, cardType: 'front' | 'back'): number {
  if (typeof outputSettings.rotation === 'object' && outputSettings.rotation !== null) {
    return outputSettings.rotation[cardType] || 0;
  }
  return outputSettings.rotation || 0;
}

/**
 * Calculate preview scaling for ConfigureStep display
 * 
 * Converts render dimensions and positioning from print inches to screen pixels
 * for preview display in the UI. Handles DPI conversion and viewport scaling.
 * 
 * **Scaling Process:**
 * 1. Convert page dimensions from inches to screen pixels (72 DPI)
 * 2. Calculate scale factor to fit within preview constraints
 * 3. Apply scale to page dimensions
 * 4. Convert card position and size to preview coordinates
 * 5. Return all scaled values for UI rendering
 * 
 * **DPI Handling:**
 * - Input dimensions are in print inches
 * - Converts to screen pixels using SCREEN_DPI (72)
 * - Applies additional scaling to fit preview area
 * - Final values ready for CSS pixel display
 * 
 * @param _renderDimensions - Card render dimensions (currently unused, reserved for future)
 * @param positioning - Card position and dimensions from calculateCardPositioning()
 * @param pageWidth - Page width in inches
 * @param pageHeight - Page height in inches
 * @param maxPreviewWidth - Maximum preview width in pixels (default: 400)
 * @param maxPreviewHeight - Maximum preview height in pixels (default: 500)
 * @returns Object with scaled dimensions and positions for preview display
 * 
 * @example
 * ```typescript
 * const preview = calculatePreviewScaling(
 *   renderDimensions,
 *   { x: 3, y: 3.75, width: 2.5, height: 3.5, rotation: 0 },
 *   8.5,  // Letter width
 *   11,   // Letter height
 *   400,  // Max preview width
 *   500   // Max preview height
 * );
 * 
 * // For 8.5" × 11" page:
 * // - Screen pixels: 612 × 792
 * // - Scale to fit 400×500: ~0.63
 * // - Final preview: 386 × 500 pixels
 * // - Card at: (135, 169) pixels, 112 × 158 pixels
 * ```
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