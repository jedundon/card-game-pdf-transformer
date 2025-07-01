/**
 * @fileoverview Card rendering and thumbnail utilities
 * 
 * Contains functions for rendering page thumbnails and image previews.
 * Supports both PDF pages and image files with consistent styling.
 */

import { DPI_CONSTANTS } from '../../constants';
import { PdfData, PdfPage, ImageFileData } from '../../types';

/**
 * Render a page thumbnail for display in the Import Step
 * 
 * Creates a high-quality thumbnail preview of a PDF page for use in the page designation
 * interface. Generates larger images that can be scaled down in the table but displayed
 * at full resolution in the popup preview.
 * 
 * **Rendering Details:**
 * - Target size: 480x600px (roughly 4:5 aspect ratio) for high quality popup display
 * - Uses 200 DPI for good quality while maintaining reasonable performance
 * - Maintains aspect ratio with padding if needed
 * - Returns data URL for direct use in img elements
 * 
 * @param pdfData - PDF document object from PDF.js
 * @param pageNumber - 1-based page number to render
 * @param maxWidth - Maximum thumbnail width in pixels (default: 480)
 * @param maxHeight - Maximum thumbnail height in pixels (default: 600)
 * @returns Promise resolving to data URL of the thumbnail image
 * 
 * @throws {Error} When page loading or rendering fails
 * 
 * @example
 * ```typescript
 * const thumbnailUrl = await renderPageThumbnail(pdfData, 1, 480, 600);
 * setThumbnailState(prev => ({ ...prev, [pageIndex]: thumbnailUrl }));
 * ```
 */
export async function renderPageThumbnail(
  pdfData: PdfData,
  pageNumber: number,
  maxWidth = 480,
  maxHeight = 600
): Promise<string> {
  try {
    // Get PDF page with timeout
    const pagePromise = pdfData.getPage(pageNumber);
    const timeoutPromise = new Promise<never>((_, reject) => 
      setTimeout(() => reject(new Error(`Thumbnail loading timed out for page ${pageNumber}`)), 10000)
    );
    
    const page: PdfPage = await Promise.race([pagePromise, timeoutPromise]);
    
    if (!page) {
      throw new Error(`Failed to load PDF page ${pageNumber} for thumbnail`);
    }

    // Calculate scale for thumbnail rendering (use 200 DPI for better quality thumbnails)
    const thumbnailDPI = 200;
    const thumbnailScale = thumbnailDPI / DPI_CONSTANTS.SCREEN_DPI; // ~2.78 scale for higher quality
    
    // Get viewport at thumbnail scale
    const viewport = page.getViewport({ scale: thumbnailScale });
    
    if (!viewport || viewport.width <= 0 || viewport.height <= 0) {
      throw new Error(`Invalid viewport dimensions for page ${pageNumber}: ${viewport?.width} x ${viewport?.height}`);
    }
    
    // Calculate thumbnail dimensions maintaining aspect ratio
    const aspectRatio = viewport.width / viewport.height;
    let thumbnailWidth = maxWidth;
    let thumbnailHeight = maxHeight;
    
    if (aspectRatio > maxWidth / maxHeight) {
      // Page is wider - fit to width
      thumbnailHeight = Math.round(maxWidth / aspectRatio);
    } else {
      // Page is taller - fit to height  
      thumbnailWidth = Math.round(maxHeight * aspectRatio);
    }
    
    // Create canvas for rendering
    const canvas = document.createElement('canvas');
    canvas.width = thumbnailWidth;
    canvas.height = thumbnailHeight;
    
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Failed to get 2D rendering context for thumbnail');
    }
    
    // Scale viewport to fit thumbnail size
    const scaleToThumbnail = Math.min(thumbnailWidth / viewport.width, thumbnailHeight / viewport.height);
    const scaledViewport = page.getViewport({ scale: thumbnailScale * scaleToThumbnail });
    
    // Center the page in the canvas if there's padding
    const offsetX = (thumbnailWidth - scaledViewport.width) / 2;
    const offsetY = (thumbnailHeight - scaledViewport.height) / 2;
    
    // Clear canvas with white background
    context.fillStyle = 'white';
    context.fillRect(0, 0, thumbnailWidth, thumbnailHeight);
    
    // Render the page with proper positioning
    context.save();
    context.translate(offsetX, offsetY);
    
    const renderContext = {
      canvasContext: context,
      viewport: scaledViewport
    };
    
    // Render with timeout
    const renderPromise = page.render(renderContext).promise;
    const renderTimeout = new Promise<never>((_, reject) => 
      setTimeout(() => reject(new Error(`Thumbnail rendering timed out for page ${pageNumber}`)), 8000)
    );
    
    await Promise.race([renderPromise, renderTimeout]);
    
    context.restore();
    
    // Generate and return data URL
    const dataUrl = canvas.toDataURL('image/png', 0.8); // Slightly compressed for better performance
    
    if (!dataUrl || dataUrl === 'data:,') {
      throw new Error('Failed to generate thumbnail data URL');
    }
    
    return dataUrl;
    
  } catch (error) {
    console.error(`Thumbnail generation failed for page ${pageNumber}:`, error);
    throw new Error(`Failed to generate thumbnail for page ${pageNumber}: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Render thumbnail for image file
 * 
 * Creates a thumbnail for an image file that matches the styling and format
 * of PDF page thumbnails. This ensures consistent appearance in the UI
 * regardless of whether the source is a PDF or image file.
 * 
 * @param imageData - Processed image file data
 * @param maxWidth - Maximum thumbnail width in pixels (default: 480)
 * @param maxHeight - Maximum thumbnail height in pixels (default: 600)
 * @returns Promise that resolves to a data URL for the thumbnail
 * 
 * @throws {Error} When thumbnail generation fails
 * 
 * @example
 * ```typescript
 * const imageData = await processImageFile(file);
 * const thumbnailUrl = await renderImageThumbnail(imageData, 480, 600);
 * setThumbnailState(prev => ({ ...prev, [pageIndex]: thumbnailUrl }));
 * ```
 */
export async function renderImageThumbnail(
  imageData: ImageFileData,
  maxWidth = 480,
  maxHeight = 600
): Promise<string> {
  try {
    const { canvas: sourceCanvas, width, height } = imageData;
    
    // Calculate thumbnail dimensions maintaining aspect ratio
    const aspectRatio = width / height;
    let thumbnailWidth = maxWidth;
    let thumbnailHeight = maxHeight;
    
    if (aspectRatio > maxWidth / maxHeight) {
      // Image is wider - fit to width
      thumbnailHeight = Math.round(maxWidth / aspectRatio);
    } else {
      // Image is taller - fit to height  
      thumbnailWidth = Math.round(maxHeight * aspectRatio);
    }
    
    // Create thumbnail canvas
    const thumbnailCanvas = document.createElement('canvas');
    thumbnailCanvas.width = thumbnailWidth;
    thumbnailCanvas.height = thumbnailHeight;
    
    const context = thumbnailCanvas.getContext('2d');
    if (!context) {
      throw new Error('Failed to get 2D rendering context for image thumbnail');
    }
    
    // Clear canvas with white background (consistent with PDF thumbnails)
    context.fillStyle = 'white';
    context.fillRect(0, 0, thumbnailWidth, thumbnailHeight);
    
    // Calculate scaling and positioning to center the image
    const scale = Math.min(thumbnailWidth / width, thumbnailHeight / height);
    const scaledWidth = width * scale;
    const scaledHeight = height * scale;
    const offsetX = (thumbnailWidth - scaledWidth) / 2;
    const offsetY = (thumbnailHeight - scaledHeight) / 2;
    
    // Draw the scaled image centered on the canvas
    context.drawImage(sourceCanvas, offsetX, offsetY, scaledWidth, scaledHeight);
    
    // Generate and return data URL (same format as PDF thumbnails)
    const dataUrl = thumbnailCanvas.toDataURL('image/png', 0.8);
    
    if (!dataUrl || dataUrl === 'data:,') {
      throw new Error('Failed to generate image thumbnail data URL');
    }
    
    return dataUrl;
    
  } catch (error) {
    console.error(`Image thumbnail generation failed for ${imageData.fileName}:`, error);
    throw new Error(`Failed to generate thumbnail for image ${imageData.fileName}: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Universal thumbnail renderer for mixed content
 * 
 * Renders thumbnails for either PDF pages or image files, automatically
 * detecting the content type and using the appropriate rendering method.
 * This is the main function used by UI components for multi-file support.
 * 
 * @param pdfData - PDF document data (null for image files)
 * @param imageData - Image file data (null for PDF pages)
 * @param pageNumber - Page number for PDF files (1-based, ignored for images)
 * @param maxWidth - Maximum thumbnail width in pixels (default: 480)
 * @param maxHeight - Maximum thumbnail height in pixels (default: 600)
 * @returns Promise that resolves to a data URL for the thumbnail
 * 
 * @throws {Error} When neither PDF nor image data is provided, or when rendering fails
 * 
 * @example
 * ```typescript
 * // For PDF page
 * const pdfThumbnail = await renderUniversalThumbnail(pdfData, null, 1);
 * 
 * // For image file
 * const imageThumbnail = await renderUniversalThumbnail(null, imageData, 0);
 * ```
 */
export async function renderUniversalThumbnail(
  pdfData: PdfData | null,
  imageData: ImageFileData | null,
  pageNumber: number,
  maxWidth = 480,
  maxHeight = 600
): Promise<string> {
  if (pdfData && !imageData) {
    // Render PDF page thumbnail
    return renderPageThumbnail(pdfData, pageNumber, maxWidth, maxHeight);
  } else if (imageData && !pdfData) {
    // Render image thumbnail
    return renderImageThumbnail(imageData, maxWidth, maxHeight);
  } else {
    throw new Error('Invalid thumbnail request: must provide either PDF data or image data, but not both');
  }
}