/**
 * Professional color transformation utilities for color calibration
 * 
 * This module provides comprehensive color processing functions for printer/media calibration,
 * including basic adjustments, per-channel controls, shadows/highlights, and levels.
 */

export interface ColorTransformation {
  // Basic adjustments
  brightness: number;      // -100 to +100
  contrast: number;        // 0.5 to 2.0
  saturation: number;      // -100 to +100
  hue: number;            // -180 to +180
  gamma: number;          // 0.5 to 2.0
  vibrance: number;       // -100 to +100
  
  // Per-channel control
  redMultiplier: number;   // 0.5 to 1.5
  greenMultiplier: number; // 0.5 to 1.5
  blueMultiplier: number;  // 0.5 to 1.5
  
  // Shadows/Highlights
  shadows: number;         // -50 to +50
  highlights: number;      // -50 to +50
  midtoneBalance: number;  // -100 to +100
  
  // Levels
  blackPoint: number;      // 0 to 50
  whitePoint: number;      // 205 to 255
  outputBlack: number;     // 0 to 30
  outputWhite: number;     // 225 to 255
}

/**
 * Apply color transformation to an image using canvas processing
 * 
 * @param imageUrl - Data URL of the source image
 * @param transformation - Color transformation parameters
 * @returns Promise resolving to transformed image data URL
 */
export async function applyColorTransformation(
  imageUrl: string,
  transformation: ColorTransformation
): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          throw new Error('Could not get canvas context');
        }
        
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        
        // Draw original image
        ctx.drawImage(img, 0, 0);
        
        // Get image data for processing
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        
        // Apply transformations to each pixel
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          // Alpha channel (data[i + 3]) is preserved
          
          // Convert RGB to normalized values (0-1)
          let red = r / 255;
          let green = g / 255;
          let blue = b / 255;
          
          // Apply basic transformations
          const transformed = applyBasicTransformations(red, green, blue, transformation);
          red = transformed.r;
          green = transformed.g;
          blue = transformed.b;
          
          // Apply per-channel multipliers
          red = Math.min(1, Math.max(0, red * transformation.redMultiplier));
          green = Math.min(1, Math.max(0, green * transformation.greenMultiplier));
          blue = Math.min(1, Math.max(0, blue * transformation.blueMultiplier));
          
          // Apply shadows/highlights
          const shadowHighlight = applyShadowsHighlights(red, green, blue, transformation);
          red = shadowHighlight.r;
          green = shadowHighlight.g;
          blue = shadowHighlight.b;
          
          // Apply levels
          const levels = applyLevels(red, green, blue, transformation);
          red = levels.r;
          green = levels.g;
          blue = levels.b;
          
          // Convert back to 0-255 range and apply to image data
          data[i] = Math.round(Math.min(255, Math.max(0, red * 255)));
          data[i + 1] = Math.round(Math.min(255, Math.max(0, green * 255)));
          data[i + 2] = Math.round(Math.min(255, Math.max(0, blue * 255)));
        }
        
        // Put processed image data back to canvas
        ctx.putImageData(imageData, 0, 0);
        
        // Return processed image as data URL
        resolve(canvas.toDataURL('image/png'));
      } catch (error) {
        console.warn('Color transformation failed:', error);
        // Return original image on failure
        resolve(imageUrl);
      }
    };
    
    img.onerror = () => {
      console.warn('Failed to load image for color transformation');
      resolve(imageUrl);
    };
    
    img.src = imageUrl;
  });
}

/**
 * Apply basic color transformations (brightness, contrast, saturation, hue, gamma, vibrance)
 */
function applyBasicTransformations(
  r: number, 
  g: number, 
  b: number, 
  transform: ColorTransformation
): { r: number; g: number; b: number } {
  // Apply gamma correction
  r = Math.pow(r, 1 / transform.gamma);
  g = Math.pow(g, 1 / transform.gamma);
  b = Math.pow(b, 1 / transform.gamma);
  
  // Apply brightness (linear adjustment)
  const brightnessFactor = transform.brightness / 100;
  r = Math.min(1, Math.max(0, r + brightnessFactor));
  g = Math.min(1, Math.max(0, g + brightnessFactor));
  b = Math.min(1, Math.max(0, b + brightnessFactor));
  
  // Apply contrast (around midpoint)
  const contrastFactor = transform.contrast;
  r = Math.min(1, Math.max(0, (r - 0.5) * contrastFactor + 0.5));
  g = Math.min(1, Math.max(0, (g - 0.5) * contrastFactor + 0.5));
  b = Math.min(1, Math.max(0, (b - 0.5) * contrastFactor + 0.5));
  
  // Convert to HSL for saturation, hue, and vibrance adjustments
  const hsl = rgbToHsl(r, g, b);
  
  // Apply saturation
  const saturationFactor = 1 + (transform.saturation / 100);
  hsl.s = Math.min(1, Math.max(0, hsl.s * saturationFactor));
  
  // Apply hue shift
  hsl.h = (hsl.h + transform.hue / 360) % 1;
  if (hsl.h < 0) hsl.h += 1;
  
  // Apply vibrance (selective saturation that protects skin tones)
  const vibranceFactor = transform.vibrance / 100;
  if (vibranceFactor !== 0) {
    // Simple vibrance implementation - boost saturation more for less saturated colors
    const saturationBoost = vibranceFactor * (1 - hsl.s);
    hsl.s = Math.min(1, Math.max(0, hsl.s + saturationBoost));
  }
  
  // Convert back to RGB
  const rgb = hslToRgb(hsl.h, hsl.s, hsl.l);
  return { r: rgb.r, g: rgb.g, b: rgb.b };
}

/**
 * Apply shadows/highlights adjustments
 */
function applyShadowsHighlights(
  r: number, 
  g: number, 
  b: number, 
  transform: ColorTransformation
): { r: number; g: number; b: number } {
  // Calculate luminance
  const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
  
  // Apply shadow adjustment (affects darker areas more)
  const shadowFactor = transform.shadows / 50; // Normalize to -1 to +1
  const shadowMask = 1 - luminance; // Stronger effect in shadows
  const shadowAdjustment = shadowFactor * shadowMask * 0.3; // Scale the effect
  
  // Apply highlight adjustment (affects brighter areas more)
  const highlightFactor = transform.highlights / 50; // Normalize to -1 to +1
  const highlightMask = luminance; // Stronger effect in highlights
  const highlightAdjustment = highlightFactor * highlightMask * 0.3; // Scale the effect
  
  // Apply midtone balance
  const midtoneFactor = transform.midtoneBalance / 100; // Normalize to -1 to +1
  const midtoneAdjustment = midtoneFactor * 0.2; // Global adjustment
  
  // Combine adjustments
  const totalAdjustment = shadowAdjustment + highlightAdjustment + midtoneAdjustment;
  
  r = Math.min(1, Math.max(0, r + totalAdjustment));
  g = Math.min(1, Math.max(0, g + totalAdjustment));
  b = Math.min(1, Math.max(0, b + totalAdjustment));
  
  return { r, g, b };
}

/**
 * Apply levels adjustments (black point, white point, output levels)
 */
function applyLevels(
  r: number, 
  g: number, 
  b: number, 
  transform: ColorTransformation
): { r: number; g: number; b: number } {
  // Convert to 0-255 range for levels processing
  let red = r * 255;
  let green = g * 255;
  let blue = b * 255;
  
  // Apply input levels (black point and white point)
  const inputBlack = transform.blackPoint;
  const inputWhite = transform.whitePoint;
  const inputRange = inputWhite - inputBlack;
  
  if (inputRange > 0) {
    red = Math.min(255, Math.max(0, (red - inputBlack) * (255 / inputRange)));
    green = Math.min(255, Math.max(0, (green - inputBlack) * (255 / inputRange)));
    blue = Math.min(255, Math.max(0, (blue - inputBlack) * (255 / inputRange)));
  }
  
  // Apply output levels
  const outputBlack = transform.outputBlack;
  const outputWhite = transform.outputWhite;
  const outputRange = outputWhite - outputBlack;
  
  red = outputBlack + (red / 255) * outputRange;
  green = outputBlack + (green / 255) * outputRange;
  blue = outputBlack + (blue / 255) * outputRange;
  
  // Convert back to 0-1 range
  return {
    r: Math.min(1, Math.max(0, red / 255)),
    g: Math.min(1, Math.max(0, green / 255)),
    b: Math.min(1, Math.max(0, blue / 255))
  };
}

/**
 * Convert RGB to HSL color space
 */
function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const diff = max - min;
  const sum = max + min;
  const l = sum / 2;
  
  let h = 0;
  let s = 0;
  
  if (diff !== 0) {
    s = l > 0.5 ? diff / (2 - sum) : diff / sum;
    
    switch (max) {
      case r:
        h = ((g - b) / diff + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / diff + 2) / 6;
        break;
      case b:
        h = ((r - g) / diff + 4) / 6;
        break;
    }
  }
  
  return { h, s, l };
}

/**
 * Convert HSL to RGB color space
 */
function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  let r: number, g: number, b: number;
  
  if (s === 0) {
    r = g = b = l; // Achromatic
  } else {
    const hue2rgb = (p: number, q: number, t: number): number => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };
    
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    
    r = hue2rgb(p, q, h + 1/3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1/3);
  }
  
  return { r, g, b };
}

/**
 * Get default color transformation (no changes applied)
 */
export function getDefaultColorTransformation(): ColorTransformation {
  return {
    brightness: 0,
    contrast: 1.0,
    saturation: 0,
    hue: 0,
    gamma: 1.0,
    vibrance: 0,
    redMultiplier: 1.0,
    greenMultiplier: 1.0,
    blueMultiplier: 1.0,
    shadows: 0,
    highlights: 0,
    midtoneBalance: 0,
    blackPoint: 0,
    whitePoint: 255,
    outputBlack: 0,
    outputWhite: 255
  };
}

/**
 * Check if a color transformation has any non-default values
 */
export function hasNonDefaultColorSettings(transformation: ColorTransformation): boolean {
  const defaults = getDefaultColorTransformation();
  
  return (
    transformation.brightness !== defaults.brightness ||
    transformation.contrast !== defaults.contrast ||
    transformation.saturation !== defaults.saturation ||
    transformation.hue !== defaults.hue ||
    transformation.gamma !== defaults.gamma ||
    transformation.vibrance !== defaults.vibrance ||
    transformation.redMultiplier !== defaults.redMultiplier ||
    transformation.greenMultiplier !== defaults.greenMultiplier ||
    transformation.blueMultiplier !== defaults.blueMultiplier ||
    transformation.shadows !== defaults.shadows ||
    transformation.highlights !== defaults.highlights ||
    transformation.midtoneBalance !== defaults.midtoneBalance ||
    transformation.blackPoint !== defaults.blackPoint ||
    transformation.whitePoint !== defaults.whitePoint ||
    transformation.outputBlack !== defaults.outputBlack ||
    transformation.outputWhite !== defaults.outputWhite
  );
}

/**
 * Color transformation presets for common printer/media combinations
 */
export const COLOR_PRESETS = {
  'none': {
    name: 'Custom',
    description: 'Use your own custom color adjustments',
    transformation: getDefaultColorTransformation()
  },
  'inkjet-glossy': {
    name: 'Inkjet Glossy Photo Paper',
    description: 'Enhanced contrast, slight blue reduction for glossy prints',
    transformation: {
      ...getDefaultColorTransformation(),
      contrast: 1.1,
      blueMultiplier: 0.95,
      highlights: -5
    }
  },
  'laser-standard': {
    name: 'Laser Printer Standard Paper',
    description: 'Increased brightness, shadow lift for laser printing',
    transformation: {
      ...getDefaultColorTransformation(),
      brightness: 10,
      shadows: 15,
      contrast: 1.05
    }
  },
  'inkjet-matte': {
    name: 'Inkjet Matte Card Stock',
    description: 'Saturation boost, highlight compression for matte surfaces',
    transformation: {
      ...getDefaultColorTransformation(),
      saturation: 15,
      highlights: -10,
      contrast: 1.15
    }
  },
  'photo-lab': {
    name: 'Professional Photo Lab',
    description: 'Minimal adjustments for professional lab printing',
    transformation: {
      ...getDefaultColorTransformation(),
      gamma: 1.05,
      shadows: 2
    }
  },
  'home-inkjet-fix': {
    name: 'Home Inkjet Color Bias Fix',
    description: 'Common adjustments for home inkjet color balance',
    transformation: {
      ...getDefaultColorTransformation(),
      redMultiplier: 1.05,
      greenMultiplier: 0.98,
      blueMultiplier: 0.92,
      brightness: 5
    }
  }
} as const;

export type ColorPresetKey = keyof typeof COLOR_PRESETS;

/**
 * Get appropriate transformation ranges for each color parameter type
 * Returns sensible min/max values and defaults for grid calibration
 */
export function getTransformationRange(type: string): {
  min: number;
  max: number;
  defaultMin: number;
  defaultMax: number;
  step: number;
  unit: string;
} {
  switch (type) {
    case 'brightness':
      return {
        min: -100,
        max: 100,
        defaultMin: -20,
        defaultMax: 20,
        step: 1,
        unit: '%'
      };
    
    case 'contrast':
      return {
        min: 0.5,
        max: 2.0,
        defaultMin: 0.8,
        defaultMax: 1.3,
        step: 0.05,
        unit: 'x'
      };
    
    case 'saturation':
      return {
        min: -100,
        max: 100,
        defaultMin: -30,
        defaultMax: 30,
        step: 1,
        unit: '%'
      };
    
    case 'hue':
      return {
        min: -180,
        max: 180,
        defaultMin: -20,
        defaultMax: 20,
        step: 1,
        unit: '°'
      };
    
    case 'gamma':
      return {
        min: 0.5,
        max: 2.0,
        defaultMin: 0.8,
        defaultMax: 1.2,
        step: 0.05,
        unit: ''
      };
    
    case 'vibrance':
      return {
        min: -100,
        max: 100,
        defaultMin: -25,
        defaultMax: 25,
        step: 1,
        unit: '%'
      };
    
    case 'redMultiplier':
    case 'greenMultiplier':
    case 'blueMultiplier':
      return {
        min: 0.5,
        max: 1.5,
        defaultMin: 0.9,
        defaultMax: 1.1,
        step: 0.05,
        unit: 'x'
      };
    
    case 'shadows':
    case 'highlights':
      return {
        min: -50,
        max: 50,
        defaultMin: -15,
        defaultMax: 15,
        step: 1,
        unit: ''
      };
    
    case 'midtoneBalance':
      return {
        min: -100,
        max: 100,
        defaultMin: -20,
        defaultMax: 20,
        step: 1,
        unit: ''
      };
    
    case 'blackPoint':
      return {
        min: 0,
        max: 50,
        defaultMin: 0,
        defaultMax: 15,
        step: 1,
        unit: ''
      };
    
    case 'whitePoint':
      return {
        min: 205,
        max: 255,
        defaultMin: 235,
        defaultMax: 255,
        step: 1,
        unit: ''
      };
    
    case 'outputBlack':
      return {
        min: 0,
        max: 30,
        defaultMin: 0,
        defaultMax: 10,
        step: 1,
        unit: ''
      };
    
    case 'outputWhite':
      return {
        min: 225,
        max: 255,
        defaultMin: 245,
        defaultMax: 255,
        step: 1,
        unit: ''
      };
    
    default:
      // Fallback for unknown types
      return {
        min: -50,
        max: 50,
        defaultMin: -10,
        defaultMax: 10,
        step: 1,
        unit: ''
      };
  }
}