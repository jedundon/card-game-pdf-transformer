/**
 * @fileoverview Web Worker for thumbnail generation
 * 
 * This worker handles thumbnail generation for PDF pages and images
 * in the background to keep the main thread responsive during heavy
 * processing operations.
 * 
 * **Key Features:**
 * - PDF page thumbnail rendering
 * - Image thumbnail generation
 * - Canvas-based processing
 * - Error handling and timeouts
 * - Progress reporting
 * 
 * @author Card Game PDF Transformer
 */

// Import necessary types for the worker context
interface ThumbnailRequest {
  id: string;
  type: 'pdf' | 'image';
  pageNumber?: number;
  maxWidth?: number;
  maxHeight?: number;
  pdfData?: any; // PDF.js document data
  imageData?: {
    width: number;
    height: number;
    data: ImageData | ArrayBuffer;
  };
}

interface ThumbnailResponse {
  id: string;
  success: boolean;
  thumbnailUrl?: string;
  error?: string;
  progress?: number;
}

interface WorkerContext {
  postMessage: (message: ThumbnailResponse) => void;
  addEventListener: (type: string, listener: (event: MessageEvent<ThumbnailRequest>) => void) => void;
  importScripts: (...urls: string[]) => void;
}

// Get worker context
const ctx = self as unknown as WorkerContext;

// Import PDF.js for PDF processing
try {
  ctx.importScripts('/card-game-pdf-transformer/pdf.worker.min.js');
} catch (error) {
  console.error('Failed to import PDF.js worker:', error);
}

/**
 * Process thumbnail generation request
 */
async function processThumbnailRequest(request: ThumbnailRequest): Promise<ThumbnailResponse> {
  try {
    let thumbnailUrl: string;

    if (request.type === 'pdf' && request.pdfData && request.pageNumber) {
      thumbnailUrl = await generatePdfThumbnail(
        request.pdfData,
        request.pageNumber,
        request.maxWidth || 480,
        request.maxHeight || 600,
        request.id
      );
    } else if (request.type === 'image' && request.imageData) {
      thumbnailUrl = await generateImageThumbnail(
        request.imageData,
        request.maxWidth || 480,
        request.maxHeight || 600,
        request.id
      );
    } else {
      throw new Error('Invalid thumbnail request parameters');
    }

    return {
      id: request.id,
      success: true,
      thumbnailUrl,
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
 * Generate PDF page thumbnail
 */
async function generatePdfThumbnail(
  // pdfData: any,
  // pageNumber: number,
  // maxWidth: number,
  // maxHeight: number,
  requestId: string
): Promise<string> {
  // Report progress
  ctx.postMessage({
    id: requestId,
    success: true,
    progress: 10
  });

  // This is a simplified version - in a real implementation,
  // you would need to properly handle PDF.js in a worker context
  // For now, we'll throw an error to indicate this needs main thread processing
  throw new Error('PDF processing in worker not yet implemented - use main thread');
}

/**
 * Generate image thumbnail
 */
async function generateImageThumbnail(
  imageData: { width: number; height: number; data: ImageData | ArrayBuffer },
  maxWidth: number,
  maxHeight: number,
  requestId: string
): Promise<string> {
  // Report progress
  ctx.postMessage({
    id: requestId,
    success: true,
    progress: 20
  });

  const { width, height, data } = imageData;

  // Calculate thumbnail dimensions maintaining aspect ratio
  const aspectRatio = width / height;
  let thumbnailWidth = maxWidth;
  let thumbnailHeight = maxHeight;

  if (aspectRatio > maxWidth / maxHeight) {
    thumbnailHeight = Math.round(maxWidth / aspectRatio);
  } else {
    thumbnailWidth = Math.round(maxHeight * aspectRatio);
  }

  // Report progress
  ctx.postMessage({
    id: requestId,
    success: true,
    progress: 50
  });

  // Create OffscreenCanvas for thumbnail generation
  const canvas = new OffscreenCanvas(thumbnailWidth, thumbnailHeight);
  const context = canvas.getContext('2d');

  if (!context) {
    throw new Error('Failed to get 2D context for thumbnail canvas');
  }

  // Clear canvas with white background
  context.fillStyle = 'white';
  context.fillRect(0, 0, thumbnailWidth, thumbnailHeight);

  // Report progress
  ctx.postMessage({
    id: requestId,
    success: true,
    progress: 70
  });

  // Create ImageData from the input data
  let sourceImageData: ImageData;
  if (data instanceof ImageData) {
    sourceImageData = data;
  } else {
    // Convert ArrayBuffer to ImageData
    const uint8Array = new Uint8ClampedArray(data);
    sourceImageData = new ImageData(uint8Array, width, height);
  }

  // Create temporary canvas for source image
  const sourceCanvas = new OffscreenCanvas(width, height);
  const sourceContext = sourceCanvas.getContext('2d');
  
  if (!sourceContext) {
    throw new Error('Failed to get source canvas context');
  }

  sourceContext.putImageData(sourceImageData, 0, 0);

  // Calculate scaling and positioning
  const scale = Math.min(thumbnailWidth / width, thumbnailHeight / height);
  const scaledWidth = width * scale;
  const scaledHeight = height * scale;
  const offsetX = (thumbnailWidth - scaledWidth) / 2;
  const offsetY = (thumbnailHeight - scaledHeight) / 2;

  // Draw scaled image
  context.drawImage(
    sourceCanvas,
    0, 0, width, height,
    offsetX, offsetY, scaledWidth, scaledHeight
  );

  // Report progress
  ctx.postMessage({
    id: requestId,
    success: true,
    progress: 90
  });

  // Convert to blob and then to data URL
  const blob = await canvas.convertToBlob({ type: 'image/png', quality: 0.8 });
  
  // Convert blob to data URL
  const arrayBuffer = await blob.arrayBuffer();
  const uint8Array = new Uint8Array(arrayBuffer);
  
  // Create data URL from Uint8Array
  let binaryString = '';
  for (let i = 0; i < uint8Array.length; i++) {
    binaryString += String.fromCharCode(uint8Array[i]);
  }
  
  const base64 = btoa(binaryString);
  const dataUrl = `data:image/png;base64,${base64}`;

  return dataUrl;
}

/**
 * Message handler for thumbnail requests
 */
ctx.addEventListener('message', async (event: MessageEvent<ThumbnailRequest>) => {
  const request = event.data;
  
  // Validate request
  if (!request || !request.id || !request.type) {
    ctx.postMessage({
      id: request?.id || 'unknown',
      success: false,
      error: 'Invalid request format'
    });
    return;
  }

  // Process the request
  const response = await processThumbnailRequest(request);
  ctx.postMessage(response);
});

// Notify that worker is ready
ctx.postMessage({
  id: 'worker-ready',
  success: true,
  progress: 0
});

export {}; // Make this a module