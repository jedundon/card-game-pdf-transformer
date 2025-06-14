/**
 * Image processing utilities for card manipulation and enhancement
 */

export interface ImageFilters {
  brightness?: number;  // -100 to 100
  contrast?: number;    // -100 to 100
  saturation?: number;  // -100 to 100
  blur?: number;        // 0 to 10
  sharpen?: boolean;
}

export interface RotationOptions {
  angle: number;        // In degrees
  backgroundColor?: string;
}

export interface ResizeOptions {
  width?: number;
  height?: number;
  maintainAspectRatio?: boolean;
  quality?: 'high' | 'medium' | 'low';
}

/**
 * Apply filters to a canvas
 */
export function applyFilters(canvas: HTMLCanvasElement, filters: ImageFilters): void {
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Failed to get canvas context for filtering');
  }
  
  // Build CSS filter string
  const filterParts: string[] = [];
  
  if (filters.brightness !== undefined) {
    const brightnessPercent = 100 + filters.brightness;
    filterParts.push(`brightness(${brightnessPercent}%)`);
  }
  
  if (filters.contrast !== undefined) {
    const contrastPercent = 100 + filters.contrast;
    filterParts.push(`contrast(${contrastPercent}%)`);
  }
  
  if (filters.saturation !== undefined) {
    const saturationPercent = 100 + filters.saturation;
    filterParts.push(`saturate(${saturationPercent}%)`);
  }
  
  if (filters.blur !== undefined && filters.blur > 0) {
    filterParts.push(`blur(${filters.blur}px)`);
  }
  
  if (filterParts.length > 0) {
    // Create a temporary canvas to apply filters
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    const tempContext = tempCanvas.getContext('2d');
    
    if (tempContext) {
      tempContext.filter = filterParts.join(' ');
      tempContext.drawImage(canvas, 0, 0);
      
      // Copy filtered image back to original canvas
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.drawImage(tempCanvas, 0, 0);
    }
  }
  
  // Apply sharpening if requested (custom implementation)
  if (filters.sharpen) {
    applySharpen(canvas);
  }
}

/**
 * Apply sharpening filter using convolution
 */
function applySharpen(canvas: HTMLCanvasElement): void {
  const context = canvas.getContext('2d');
  if (!context) return;
  
  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  const width = canvas.width;
  const height = canvas.height;
  
  // Sharpening kernel
  const kernel = [
    0, -1, 0,
    -1, 5, -1,
    0, -1, 0
  ];
  
  const output = new Uint8ClampedArray(data.length);
  
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      for (let c = 0; c < 3; c++) { // RGB channels only
        let sum = 0;
        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            const pixelIndex = ((y + ky) * width + (x + kx)) * 4 + c;
            const kernelIndex = (ky + 1) * 3 + (kx + 1);
            sum += data[pixelIndex] * kernel[kernelIndex];
          }
        }
        const outputIndex = (y * width + x) * 4 + c;
        output[outputIndex] = Math.max(0, Math.min(255, sum));
      }
      // Copy alpha channel
      const alphaIndex = (y * width + x) * 4 + 3;
      output[alphaIndex] = data[alphaIndex];
    }
  }
  
  // Copy output back to image data
  for (let i = 0; i < data.length; i++) {
    data[i] = output[i] || data[i];
  }
  
  context.putImageData(imageData, 0, 0);
}

/**
 * Rotate canvas content
 */
export function rotateCanvas(
  canvas: HTMLCanvasElement,
  options: RotationOptions
): HTMLCanvasElement {
  const { angle, backgroundColor = 'transparent' } = options;
  const context = canvas.getContext('2d');
  
  if (!context) {
    throw new Error('Failed to get canvas context for rotation');
  }
  
  // Convert angle to radians
  const radians = (angle * Math.PI) / 180;
  
  // Calculate new canvas dimensions
  const cos = Math.abs(Math.cos(radians));
  const sin = Math.abs(Math.sin(radians));
  const newWidth = canvas.width * cos + canvas.height * sin;
  const newHeight = canvas.width * sin + canvas.height * cos;
  
  // Create new canvas with rotated dimensions
  const rotatedCanvas = document.createElement('canvas');
  rotatedCanvas.width = newWidth;
  rotatedCanvas.height = newHeight;
  const rotatedContext = rotatedCanvas.getContext('2d');
  
  if (!rotatedContext) {
    throw new Error('Failed to create rotated canvas context');
  }
  
  // Fill background if specified
  if (backgroundColor !== 'transparent') {
    rotatedContext.fillStyle = backgroundColor;
    rotatedContext.fillRect(0, 0, newWidth, newHeight);
  }
  
  // Translate to center and rotate
  rotatedContext.translate(newWidth / 2, newHeight / 2);
  rotatedContext.rotate(radians);
  rotatedContext.drawImage(canvas, -canvas.width / 2, -canvas.height / 2);
  
  return rotatedCanvas;
}

/**
 * Resize canvas with quality options
 */
export function resizeCanvas(
  canvas: HTMLCanvasElement,
  options: ResizeOptions
): HTMLCanvasElement {
  const { width, height, maintainAspectRatio = true, quality = 'high' } = options;
  
  if (!width && !height) {
    return canvas; // No resize needed
  }
  
  let newWidth = width || canvas.width;
  let newHeight = height || canvas.height;
  
  // Calculate dimensions maintaining aspect ratio
  if (maintainAspectRatio && width && height) {
    const aspectRatio = canvas.width / canvas.height;
    if (width / height > aspectRatio) {
      newWidth = height * aspectRatio;
    } else {
      newHeight = width / aspectRatio;
    }
  } else if (maintainAspectRatio) {
    const aspectRatio = canvas.width / canvas.height;
    if (width) {
      newHeight = width / aspectRatio;
    } else if (height) {
      newWidth = height * aspectRatio;
    }
  }
  
  const resizedCanvas = document.createElement('canvas');
  resizedCanvas.width = newWidth;
  resizedCanvas.height = newHeight;
  const context = resizedCanvas.getContext('2d');
  
  if (!context) {
    throw new Error('Failed to create resized canvas context');
  }
  
  // Set quality based on option
  switch (quality) {
    case 'high':
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = 'high';
      break;
    case 'medium':
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = 'medium';
      break;
    case 'low':
      context.imageSmoothingEnabled = false;
      break;
  }
  
  context.drawImage(canvas, 0, 0, newWidth, newHeight);
  return resizedCanvas;
}

/**
 * Add bleed margin to canvas
 */
export function addBleed(
  canvas: HTMLCanvasElement,
  bleedMargin: number,
  fillColor: string = '#FFFFFF'
): HTMLCanvasElement {
  if (bleedMargin <= 0) {
    return canvas;
  }
  
  const newWidth = canvas.width + (bleedMargin * 2);
  const newHeight = canvas.height + (bleedMargin * 2);
  
  const bleedCanvas = document.createElement('canvas');
  bleedCanvas.width = newWidth;
  bleedCanvas.height = newHeight;
  const context = bleedCanvas.getContext('2d');
  
  if (!context) {
    throw new Error('Failed to create bleed canvas context');
  }
  
  // Fill with background color
  context.fillStyle = fillColor;
  context.fillRect(0, 0, newWidth, newHeight);
  
  // Draw original image centered
  context.drawImage(canvas, bleedMargin, bleedMargin);
  
  return bleedCanvas;
}

/**
 * Add crop marks to canvas
 */
export function addCropMarks(
  canvas: HTMLCanvasElement,
  cropMarkLength: number = 18,
  cropMarkMargin: number = 9
): HTMLCanvasElement {
  const totalMargin = cropMarkLength + cropMarkMargin;
  const newWidth = canvas.width + (totalMargin * 2);
  const newHeight = canvas.height + (totalMargin * 2);
  
  const markedCanvas = document.createElement('canvas');
  markedCanvas.width = newWidth;
  markedCanvas.height = newHeight;
  const context = markedCanvas.getContext('2d');
  
  if (!context) {
    throw new Error('Failed to create crop mark canvas context');
  }
  
  // Fill with white background
  context.fillStyle = '#FFFFFF';
  context.fillRect(0, 0, newWidth, newHeight);
  
  // Draw original image centered
  context.drawImage(canvas, totalMargin, totalMargin);
  
  // Draw crop marks
  context.strokeStyle = '#000000';
  context.lineWidth = 0.5;
  
  const contentLeft = totalMargin;
  const contentTop = totalMargin;
  const contentRight = totalMargin + canvas.width;
  const contentBottom = totalMargin + canvas.height;
  
  // Top-left crop marks
  context.beginPath();
  context.moveTo(contentLeft - cropMarkMargin, contentTop);
  context.lineTo(contentLeft - cropMarkMargin - cropMarkLength, contentTop);
  context.moveTo(contentLeft, contentTop - cropMarkMargin);
  context.lineTo(contentLeft, contentTop - cropMarkMargin - cropMarkLength);
  context.stroke();
  
  // Top-right crop marks
  context.beginPath();
  context.moveTo(contentRight + cropMarkMargin, contentTop);
  context.lineTo(contentRight + cropMarkMargin + cropMarkLength, contentTop);
  context.moveTo(contentRight, contentTop - cropMarkMargin);
  context.lineTo(contentRight, contentTop - cropMarkMargin - cropMarkLength);
  context.stroke();
  
  // Bottom-left crop marks
  context.beginPath();
  context.moveTo(contentLeft - cropMarkMargin, contentBottom);
  context.lineTo(contentLeft - cropMarkMargin - cropMarkLength, contentBottom);
  context.moveTo(contentLeft, contentBottom + cropMarkMargin);
  context.lineTo(contentLeft, contentBottom + cropMarkMargin + cropMarkLength);
  context.stroke();
  
  // Bottom-right crop marks
  context.beginPath();
  context.moveTo(contentRight + cropMarkMargin, contentBottom);
  context.lineTo(contentRight + cropMarkMargin + cropMarkLength, contentBottom);
  context.moveTo(contentRight, contentBottom + cropMarkMargin);
  context.lineTo(contentRight, contentBottom + cropMarkMargin + cropMarkLength);
  context.stroke();
  
  return markedCanvas;
}

/**
 * Create thumbnail from canvas
 */
export function createThumbnail(
  canvas: HTMLCanvasElement,
  maxWidth: number = 150,
  maxHeight: number = 200,
  quality: number = 0.8
): string {
  const thumbnailCanvas = resizeCanvas(canvas, {
    width: maxWidth,
    height: maxHeight,
    maintainAspectRatio: true,
    quality: 'medium',
  });
  
  return thumbnailCanvas.toDataURL('image/jpeg', quality);
}

/**
 * Detect if image is primarily light or dark
 */
export function detectImageTone(canvas: HTMLCanvasElement): 'light' | 'dark' {
  const context = canvas.getContext('2d');
  if (!context) return 'light';
  
  // Sample a small area from the center
  const sampleSize = Math.min(100, canvas.width / 4, canvas.height / 4);
  const x = (canvas.width - sampleSize) / 2;
  const y = (canvas.height - sampleSize) / 2;
  
  const imageData = context.getImageData(x, y, sampleSize, sampleSize);
  const data = imageData.data;
  
  let totalBrightness = 0;
  const pixelCount = data.length / 4;
  
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    
    // Calculate relative luminance
    const brightness = 0.299 * r + 0.587 * g + 0.114 * b;
    totalBrightness += brightness;
  }
  
  const averageBrightness = totalBrightness / pixelCount;
  return averageBrightness > 128 ? 'light' : 'dark';
}
