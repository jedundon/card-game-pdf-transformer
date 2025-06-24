/**
 * @fileoverview Image file processing utilities for multi-file support
 * 
 * This module provides functionality to process image files (PNG, JPG, JPEG)
 * and integrate them into the existing PDF workflow. Images are converted to
 * canvas-based data structures that are compatible with the existing card
 * extraction and processing pipeline.
 * 
 * **Key Responsibilities:**
 * - Image file validation and type checking
 * - Canvas-based image processing for workflow integration
 * - Thumbnail generation for image files
 * - Dimension extraction and scaling calculations
 * - Error handling for corrupted or unsupported image files
 * 
 * **Design Philosophy:**
 * Images are treated as single-page documents in the workflow, with each
 * image file representing one "page" that can contain one or more cards
 * depending on the grid extraction settings.
 * 
 * @author Card Game PDF Transformer
 */

import { SUPPORTED_FILE_TYPES, FILE_SIZE_LIMITS, DPI_CONSTANTS } from '../constants';
import { ImageFileData, FileSource } from '../types';

/**
 * Validate if a file is a supported image type
 * 
 * Checks both MIME type and file extension to ensure the file can be processed
 * as an image. This provides defense against incorrectly labeled files.
 * 
 * @param file - File object to validate
 * @returns true if the file is a supported image format
 * 
 * @example
 * ```typescript
 * const file = new File(['data'], 'card.png', { type: 'image/png' });
 * const isValid = isValidImageFile(file); // Returns true
 * ```
 */
export function isValidImageFile(file: File): boolean {
  // Check MIME type
  const validMimeType = SUPPORTED_FILE_TYPES.IMAGE_MIME_TYPES.includes(
    file.type as any
  );
  
  // Check file extension
  const fileName = file.name.toLowerCase();
  const hasValidExtension = SUPPORTED_FILE_TYPES.IMAGE_EXTENSIONS.some(
    ext => fileName.endsWith(ext)
  );
  
  return validMimeType && hasValidExtension;
}

/**
 * Validate image file size
 * 
 * Ensures the image file is within acceptable size limits to prevent
 * memory issues and maintain reasonable processing performance.
 * 
 * @param file - File object to validate
 * @returns true if the file size is within limits
 * 
 * @example
 * ```typescript
 * const file = new File(['data'], 'large-image.png');
 * const isValidSize = validateImageFileSize(file);
 * ```
 */
export function validateImageFileSize(file: File): boolean {
  return file.size <= FILE_SIZE_LIMITS.IMAGE_MAX_SIZE;
}

/**
 * Create a FileSource object for an image file
 * 
 * Generates the metadata structure needed to track image files
 * in the multi-file workflow system.
 * 
 * @param file - Image file to create metadata for
 * @returns FileSource object with image file metadata
 * 
 * @example
 * ```typescript
 * const file = new File(['data'], 'card-front.png', { type: 'image/png' });
 * const source = createImageFileSource(file);
 * // Returns: { name: 'card-front.png', type: 'image', originalPageCount: 1, ... }
 * ```
 */
export function createImageFileSource(file: File): FileSource {
  return {
    name: file.name,
    type: 'image',
    originalPageCount: 1, // Images always represent a single "page"
    size: file.size,
    importTimestamp: Date.now()
  };
}

/**
 * Load and process an image file into canvas data
 * 
 * Converts an image file into a canvas-based data structure that can be
 * processed by the existing card extraction pipeline. The canvas approach
 * provides consistent handling between PDF pages and image files.
 * 
 * @param file - Image file to process
 * @returns Promise that resolves to ImageFileData with canvas and metadata
 * @throws Error if the image cannot be loaded or processed
 * 
 * @example
 * ```typescript
 * const file = new File(['data'], 'card.png', { type: 'image/png' });
 * try {
 *   const imageData = await processImageFile(file);
 *   console.log(`Processed ${imageData.fileName}: ${imageData.width}x${imageData.height}`);
 * } catch (error) {
 *   console.error('Failed to process image:', error);
 * }
 * ```
 */
export async function processImageFile(file: File): Promise<ImageFileData> {
  return new Promise((resolve, reject) => {
    // Validate file before processing
    if (!isValidImageFile(file)) {
      reject(new Error(`Unsupported image file type: ${file.type}`));
      return;
    }
    
    if (!validateImageFileSize(file)) {
      reject(new Error(`Image file too large: ${file.size} bytes (max: ${FILE_SIZE_LIMITS.IMAGE_MAX_SIZE})`));
      return;
    }
    
    const reader = new FileReader();
    const img = new Image();
    
    reader.onload = () => {
      img.onload = () => {
        try {
          // Create canvas with image dimensions
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          
          if (!ctx) {
            reject(new Error('Failed to create canvas context'));
            return;
          }
          
          // Set canvas size to image dimensions
          canvas.width = img.width;
          canvas.height = img.height;
          
          // Draw image to canvas
          ctx.drawImage(img, 0, 0);
          
          // Create ImageFileData object
          const imageData: ImageFileData = {
            canvas,
            width: img.width,
            height: img.height,
            fileName: file.name
          };
          
          resolve(imageData);
        } catch (error) {
          reject(new Error(`Failed to process image: ${error}`));
        }
      };
      
      img.onerror = () => {
        reject(new Error('Failed to load image data'));
      };
      
      // Load image from file data
      img.src = reader.result as string;
    };
    
    reader.onerror = () => {
      reject(new Error('Failed to read image file'));
    };
    
    // Read file as data URL
    reader.readAsDataURL(file);
  });
}

/**
 * Create a thumbnail for an image file
 * 
 * Generates a scaled-down version of the image for display in the UI.
 * The thumbnail maintains aspect ratio while fitting within specified dimensions.
 * 
 * @param imageData - Processed image data with canvas
 * @param maxWidth - Maximum thumbnail width in pixels (default: 200)
 * @param maxHeight - Maximum thumbnail height in pixels (default: 150)
 * @returns Data URL string for the thumbnail image
 * 
 * @example
 * ```typescript
 * const imageData = await processImageFile(file);
 * const thumbnailUrl = createImageThumbnail(imageData, 100, 100);
 * // Use thumbnailUrl as src for img element
 * ```
 */
export function createImageThumbnail(
  imageData: ImageFileData,
  maxWidth: number = 200,
  maxHeight: number = 150
): string {
  const { canvas, width, height } = imageData;
  
  // Calculate thumbnail dimensions maintaining aspect ratio
  const aspectRatio = width / height;
  let thumbnailWidth = Math.min(maxWidth, width);
  let thumbnailHeight = Math.min(maxHeight, height);
  
  if (thumbnailWidth / thumbnailHeight > aspectRatio) {
    thumbnailWidth = thumbnailHeight * aspectRatio;
  } else {
    thumbnailHeight = thumbnailWidth / aspectRatio;
  }
  
  // Create thumbnail canvas
  const thumbnailCanvas = document.createElement('canvas');
  const ctx = thumbnailCanvas.getContext('2d');
  
  if (!ctx) {
    throw new Error('Failed to create thumbnail canvas context');
  }
  
  thumbnailCanvas.width = thumbnailWidth;
  thumbnailCanvas.height = thumbnailHeight;
  
  // Draw scaled image to thumbnail canvas
  ctx.drawImage(canvas, 0, 0, thumbnailWidth, thumbnailHeight);
  
  // Return data URL for thumbnail
  return thumbnailCanvas.toDataURL('image/png');
}

/**
 * Get image dimensions without full processing
 * 
 * Quickly extracts width and height from an image file without creating
 * the full canvas data structure. Useful for validation and UI display.
 * 
 * @param file - Image file to analyze
 * @returns Promise that resolves to width and height in pixels
 * @throws Error if dimensions cannot be determined
 * 
 * @example
 * ```typescript
 * const file = new File(['data'], 'card.png', { type: 'image/png' });
 * const { width, height } = await getImageDimensions(file);
 * console.log(`Image size: ${width}x${height}`);
 * ```
 */
export async function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    if (!isValidImageFile(file)) {
      reject(new Error(`Unsupported image file type: ${file.type}`));
      return;
    }
    
    const reader = new FileReader();
    const img = new Image();
    
    reader.onload = () => {
      img.onload = () => {
        resolve({
          width: img.width,
          height: img.height
        });
      };
      
      img.onerror = () => {
        reject(new Error('Failed to load image for dimension analysis'));
      };
      
      img.src = reader.result as string;
    };
    
    reader.onerror = () => {
      reject(new Error('Failed to read image file for dimension analysis'));
    };
    
    reader.readAsDataURL(file);
  });
}

/**
 * Validate multiple image files for batch processing
 * 
 * Checks a collection of files to ensure they are all valid images
 * and within size limits. Returns detailed validation results.
 * 
 * @param files - Array of files to validate
 * @returns Validation results with valid files and error details
 * 
 * @example
 * ```typescript
 * const files = [file1, file2, file3];
 * const validation = validateImageFiles(files);
 * console.log(`${validation.validFiles.length} valid, ${validation.errors.length} errors`);
 * ```
 */
export function validateImageFiles(files: File[]): {
  validFiles: File[];
  errors: Array<{ file: File; error: string }>;
} {
  const validFiles: File[] = [];
  const errors: Array<{ file: File; error: string }> = [];
  
  for (const file of files) {
    if (!isValidImageFile(file)) {
      errors.push({
        file,
        error: `Unsupported file type: ${file.type}`
      });
      continue;
    }
    
    if (!validateImageFileSize(file)) {
      errors.push({
        file,
        error: `File too large: ${Math.round(file.size / 1024 / 1024)}MB (max: ${Math.round(FILE_SIZE_LIMITS.IMAGE_MAX_SIZE / 1024 / 1024)}MB)`
      });
      continue;
    }
    
    validFiles.push(file);
  }
  
  return { validFiles, errors };
}