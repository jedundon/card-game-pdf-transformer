/**
 * @fileoverview Web Worker for image processing operations
 * 
 * This worker handles intensive image processing operations including
 * scaling, rotation, color adjustments, and canvas manipulations
 * to keep the main thread responsive during heavy processing.
 * 
 * **Key Features:**
 * - Image scaling and resizing
 * - Rotation and transformation
 * - Color calibration and adjustments
 * - Canvas-based processing
 * - Batch processing support
 * 
 * @author Card Game PDF Transformer
 */

interface ImageProcessingRequest {
  id: string;
  operation: 'scale' | 'rotate' | 'colorAdjust' | 'crop' | 'batch';
  imageData: {
    width: number;
    height: number;
    data: ImageData | ArrayBuffer;
  };
  params: {
    // Scaling parameters
    targetWidth?: number;
    targetHeight?: number;
    maintainAspectRatio?: boolean;

    // Rotation parameters
    rotation?: number; // in degrees

    // Color adjustment parameters
    brightness?: number; // -100 to 100
    contrast?: number;   // -100 to 100
    saturation?: number; // -100 to 100
    hue?: number;        // -180 to 180

    // Crop parameters
    cropX?: number;
    cropY?: number;
    cropWidth?: number;
    cropHeight?: number;

    // Output parameters
    quality?: number;
    format?: 'png' | 'jpeg' | 'webp';
  };
}

interface ImageProcessingResponse {
  id: string;
  success: boolean;
  processedImageUrl?: string;
  processedImageData?: {
    width: number;
    height: number;
    data: ArrayBuffer;
  };
  error?: string;
  progress?: number;
}

// Get worker context
const ctx = self as unknown as {
  postMessage: (message: ImageProcessingResponse) => void;
  addEventListener: (type: string, listener: (event: MessageEvent<ImageProcessingRequest>) => void) => void;
};

/**
 * Process image processing request
 */
async function processImageRequest(request: ImageProcessingRequest): Promise<ImageProcessingResponse> {
  try {
    const { operation, imageData, params } = request;

    // Report initial progress
    ctx.postMessage({
      id: request.id,
      success: true,
      progress: 10
    });

    let result: { dataUrl: string; imageData?: any };

    switch (operation) {
      case 'scale':
        result = await scaleImage(imageData, params, request.id);
        break;
      case 'rotate':
        result = await rotateImage(imageData, params, request.id);
        break;
      case 'colorAdjust':
        result = await adjustImageColors(imageData, params, request.id);
        break;
      case 'crop':
        result = await cropImage(imageData, params, request.id);
        break;
      case 'batch':
        result = await processBatch(imageData, params, request.id);
        break;
      default:
        throw new Error(`Unknown operation: ${operation}`);
    }

    return {
      id: request.id,
      success: true,
      processedImageUrl: result.dataUrl,
      processedImageData: result.imageData,
      progress: 100
    };

  } catch (error) {
    return {
      id: request.id,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      progress: 100
    };
  }
}

/**
 * Scale image to target dimensions
 */
async function scaleImage(
  imageData: { width: number; height: number; data: ImageData | ArrayBuffer },
  params: any,
  requestId: string
): Promise<{ dataUrl: string; imageData?: any }> {
  const { width, height, data } = imageData;
  const { targetWidth, targetHeight, maintainAspectRatio = true } = params;

  if (!targetWidth && !targetHeight) {
    throw new Error('Target width or height must be specified for scaling');
  }

  // Calculate final dimensions
  let finalWidth = targetWidth || width;
  let finalHeight = targetHeight || height;

  if (maintainAspectRatio) {
    const aspectRatio = width / height;
    if (targetWidth && !targetHeight) {
      finalHeight = Math.round(targetWidth / aspectRatio);
    } else if (targetHeight && !targetWidth) {
      finalWidth = Math.round(targetHeight * aspectRatio);
    } else if (targetWidth && targetHeight) {
      // Fit within bounds while maintaining aspect ratio
      const scaleX = targetWidth / width;
      const scaleY = targetHeight / height;
      const scale = Math.min(scaleX, scaleY);
      finalWidth = Math.round(width * scale);
      finalHeight = Math.round(height * scale);
    }
  }

  // Report progress
  ctx.postMessage({
    id: requestId,
    success: true,
    progress: 30
  });

  // Create source canvas
  const sourceCanvas = new OffscreenCanvas(width, height);
  const sourceContext = sourceCanvas.getContext('2d');
  
  if (!sourceContext) {
    throw new Error('Failed to get source canvas context');
  }

  // Put image data on source canvas
  let sourceImageData: ImageData;
  if (data instanceof ImageData) {
    sourceImageData = data;
  } else {
    const uint8Array = new Uint8ClampedArray(data);
    sourceImageData = new ImageData(uint8Array, width, height);
  }
  
  sourceContext.putImageData(sourceImageData, 0, 0);

  // Report progress
  ctx.postMessage({
    id: requestId,
    success: true,
    progress: 60
  });

  // Create target canvas
  const targetCanvas = new OffscreenCanvas(finalWidth, finalHeight);
  const targetContext = targetCanvas.getContext('2d');
  
  if (!targetContext) {
    throw new Error('Failed to get target canvas context');
  }

  // Configure high-quality scaling
  targetContext.imageSmoothingEnabled = true;
  targetContext.imageSmoothingQuality = 'high';

  // Draw scaled image
  targetContext.drawImage(sourceCanvas, 0, 0, finalWidth, finalHeight);

  // Report progress
  ctx.postMessage({
    id: requestId,
    success: true,
    progress: 90
  });

  // Convert to data URL
  const blob = await targetCanvas.convertToBlob({ 
    type: `image/${params.format || 'png'}`, 
    quality: params.quality || 0.9 
  });
  
  const dataUrl = await blobToDataUrl(blob);

  return { dataUrl };
}

/**
 * Rotate image by specified degrees
 */
async function rotateImage(
  imageData: { width: number; height: number; data: ImageData | ArrayBuffer },
  params: any,
  requestId: string
): Promise<{ dataUrl: string; imageData?: any }> {
  const { width, height, data } = imageData;
  const { rotation = 0 } = params;

  if (rotation === 0) {
    // No rotation needed, return original as data URL
    const canvas = new OffscreenCanvas(width, height);
    const context = canvas.getContext('2d');
    
    if (!context) {
      throw new Error('Failed to get canvas context');
    }

    let sourceImageData: ImageData;
    if (data instanceof ImageData) {
      sourceImageData = data;
    } else {
      const uint8Array = new Uint8ClampedArray(data);
      sourceImageData = new ImageData(uint8Array, width, height);
    }
    
    context.putImageData(sourceImageData, 0, 0);
    const blob = await canvas.convertToBlob({ type: 'image/png' });
    const dataUrl = await blobToDataUrl(blob);
    return { dataUrl };
  }

  // Report progress
  ctx.postMessage({
    id: requestId,
    success: true,
    progress: 20
  });

  // Calculate rotated dimensions
  const radians = (rotation * Math.PI) / 180;
  const cos = Math.abs(Math.cos(radians));
  const sin = Math.abs(Math.sin(radians));
  const newWidth = Math.round(width * cos + height * sin);
  const newHeight = Math.round(width * sin + height * cos);

  // Create source canvas
  const sourceCanvas = new OffscreenCanvas(width, height);
  const sourceContext = sourceCanvas.getContext('2d');
  
  if (!sourceContext) {
    throw new Error('Failed to get source canvas context');
  }

  let sourceImageData: ImageData;
  if (data instanceof ImageData) {
    sourceImageData = data;
  } else {
    const uint8Array = new Uint8ClampedArray(data);
    sourceImageData = new ImageData(uint8Array, width, height);
  }
  
  sourceContext.putImageData(sourceImageData, 0, 0);

  // Report progress
  ctx.postMessage({
    id: requestId,
    success: true,
    progress: 50
  });

  // Create rotated canvas
  const rotatedCanvas = new OffscreenCanvas(newWidth, newHeight);
  const rotatedContext = rotatedCanvas.getContext('2d');
  
  if (!rotatedContext) {
    throw new Error('Failed to get rotated canvas context');
  }

  // Apply rotation transformation
  rotatedContext.translate(newWidth / 2, newHeight / 2);
  rotatedContext.rotate(radians);
  rotatedContext.translate(-width / 2, -height / 2);

  // Draw rotated image
  rotatedContext.drawImage(sourceCanvas, 0, 0);

  // Report progress
  ctx.postMessage({
    id: requestId,
    success: true,
    progress: 90
  });

  // Convert to data URL
  const blob = await rotatedCanvas.convertToBlob({ 
    type: `image/${params.format || 'png'}`, 
    quality: params.quality || 0.9 
  });
  
  const dataUrl = await blobToDataUrl(blob);

  return { dataUrl };
}

/**
 * Adjust image colors (brightness, contrast, saturation, hue)
 */
async function adjustImageColors(
  imageData: { width: number; height: number; data: ImageData | ArrayBuffer },
  params: any,
  requestId: string
): Promise<{ dataUrl: string; imageData?: any }> {
  const { width, height, data } = imageData;
  const { 
    brightness = 0, 
    contrast = 0, 
    saturation = 0, 
    hue = 0 
  } = params;

  // Create canvas
  const canvas = new OffscreenCanvas(width, height);
  const context = canvas.getContext('2d');
  
  if (!context) {
    throw new Error('Failed to get canvas context');
  }

  // Put original image data
  let sourceImageData: ImageData;
  if (data instanceof ImageData) {
    sourceImageData = data;
  } else {
    const uint8Array = new Uint8ClampedArray(data);
    sourceImageData = new ImageData(uint8Array, width, height);
  }
  
  context.putImageData(sourceImageData, 0, 0);

  // Report progress
  ctx.postMessage({
    id: requestId,
    success: true,
    progress: 30
  });

  // Apply color adjustments using CSS filters
  const filters = [];
  
  if (brightness !== 0) {
    const brightnessValue = 100 + brightness; // Convert -100/+100 to 0-200%
    filters.push(`brightness(${brightnessValue}%)`);
  }
  
  if (contrast !== 0) {
    const contrastValue = 100 + contrast; // Convert -100/+100 to 0-200%
    filters.push(`contrast(${contrastValue}%)`);
  }
  
  if (saturation !== 0) {
    const saturationValue = 100 + saturation; // Convert -100/+100 to 0-200%
    filters.push(`saturate(${saturationValue}%)`);
  }
  
  if (hue !== 0) {
    filters.push(`hue-rotate(${hue}deg)`);
  }

  if (filters.length > 0) {
    context.filter = filters.join(' ');
    
    // Redraw with filters applied
    const tempCanvas = new OffscreenCanvas(width, height);
    const tempContext = tempCanvas.getContext('2d');
    
    if (!tempContext) {
      throw new Error('Failed to get temp canvas context');
    }
    
    tempContext.putImageData(sourceImageData, 0, 0);
    
    // Clear and redraw with filter
    context.clearRect(0, 0, width, height);
    context.drawImage(tempCanvas, 0, 0);
    
    // Reset filter
    context.filter = 'none';
  }

  // Report progress
  ctx.postMessage({
    id: requestId,
    success: true,
    progress: 90
  });

  // Convert to data URL
  const blob = await canvas.convertToBlob({ 
    type: `image/${params.format || 'png'}`, 
    quality: params.quality || 0.9 
  });
  
  const dataUrl = await blobToDataUrl(blob);

  return { dataUrl };
}

/**
 * Crop image to specified region
 */
async function cropImage(
  imageData: { width: number; height: number; data: ImageData | ArrayBuffer },
  params: any,
  requestId: string
): Promise<{ dataUrl: string; imageData?: any }> {
  const { width, height, data } = imageData;
  const { 
    cropX = 0, 
    cropY = 0, 
    cropWidth = width, 
    cropHeight = height 
  } = params;

  // Validate crop parameters
  if (cropX < 0 || cropY < 0 || cropX + cropWidth > width || cropY + cropHeight > height) {
    throw new Error('Invalid crop parameters');
  }

  // Create source canvas
  const sourceCanvas = new OffscreenCanvas(width, height);
  const sourceContext = sourceCanvas.getContext('2d');
  
  if (!sourceContext) {
    throw new Error('Failed to get source canvas context');
  }

  let sourceImageData: ImageData;
  if (data instanceof ImageData) {
    sourceImageData = data;
  } else {
    const uint8Array = new Uint8ClampedArray(data);
    sourceImageData = new ImageData(uint8Array, width, height);
  }
  
  sourceContext.putImageData(sourceImageData, 0, 0);

  // Report progress
  ctx.postMessage({
    id: requestId,
    success: true,
    progress: 50
  });

  // Create cropped canvas
  const croppedCanvas = new OffscreenCanvas(cropWidth, cropHeight);
  const croppedContext = croppedCanvas.getContext('2d');
  
  if (!croppedContext) {
    throw new Error('Failed to get cropped canvas context');
  }

  // Draw cropped portion
  croppedContext.drawImage(
    sourceCanvas,
    cropX, cropY, cropWidth, cropHeight,
    0, 0, cropWidth, cropHeight
  );

  // Report progress
  ctx.postMessage({
    id: requestId,
    success: true,
    progress: 90
  });

  // Convert to data URL
  const blob = await croppedCanvas.convertToBlob({ 
    type: `image/${params.format || 'png'}`, 
    quality: params.quality || 0.9 
  });
  
  const dataUrl = await blobToDataUrl(blob);

  return { dataUrl };
}

/**
 * Process multiple operations in batch
 */
async function processBatch(
  imageData: { width: number; height: number; data: ImageData | ArrayBuffer },
  params: any,
  requestId: string
): Promise<{ dataUrl: string; imageData?: any }> {
  // This would implement batch processing of multiple operations
  // For now, just return the original image
  const { width, height, data } = imageData;
  
  const canvas = new OffscreenCanvas(width, height);
  const context = canvas.getContext('2d');
  
  if (!context) {
    throw new Error('Failed to get canvas context');
  }

  let sourceImageData: ImageData;
  if (data instanceof ImageData) {
    sourceImageData = data;
  } else {
    const uint8Array = new Uint8ClampedArray(data);
    sourceImageData = new ImageData(uint8Array, width, height);
  }
  
  context.putImageData(sourceImageData, 0, 0);
  
  const blob = await canvas.convertToBlob({ type: 'image/png' });
  const dataUrl = await blobToDataUrl(blob);
  
  return { dataUrl };
}

/**
 * Convert blob to data URL
 */
async function blobToDataUrl(blob: Blob): Promise<string> {
  const arrayBuffer = await blob.arrayBuffer();
  const uint8Array = new Uint8Array(arrayBuffer);
  
  let binaryString = '';
  for (let i = 0; i < uint8Array.length; i++) {
    binaryString += String.fromCharCode(uint8Array[i]);
  }
  
  const base64 = btoa(binaryString);
  return `data:${blob.type};base64,${base64}`;
}

/**
 * Message handler for image processing requests
 */
ctx.addEventListener('message', async (event: MessageEvent<ImageProcessingRequest>) => {
  const request = event.data;
  
  // Validate request
  if (!request || !request.id || !request.operation) {
    ctx.postMessage({
      id: request?.id || 'unknown',
      success: false,
      error: 'Invalid request format'
    });
    return;
  }

  // Process the request
  const response = await processImageRequest(request);
  ctx.postMessage(response);
});

// Notify that worker is ready
ctx.postMessage({
  id: 'worker-ready',
  success: true,
  progress: 0
});

export {}; // Make this a module