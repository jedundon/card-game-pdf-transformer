/**
 * @fileoverview renderUtils Integration Tests
 * 
 * Critical tests for the unified rendering system that ensure perfect consistency
 * between preview and export. These tests verify that renderUtils functions work
 * correctly end-to-end with actual canvas processing and image manipulation.
 * 
 * Key areas tested:
 * - calculateFinalCardRenderDimensions with real image data
 * - processCardImageForRendering with canvas validation
 * - calculateCardPositioning end-to-end accuracy
 * - Preview vs export consistency using same functions
 * - Canvas-based rotation and clipping accuracy
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  calculateFinalCardRenderDimensions,
  processCardImageForRendering,
  calculateCardPositioning,
  calculatePreviewScaling
} from '../utils/renderUtils'
import { OutputSettings } from '../types'

// Mock HTML5 Canvas for testing
class MockCanvas {
  width = 0;
  height = 0;
  private context: MockCanvasContext;

  constructor() {
    this.context = new MockCanvasContext(this);
  }

  getContext(type: string) {
    if (type === '2d') return this.context;
    return null;
  }

  toDataURL(format?: string) {
    // Return a mock data URL
    const mockData = `data:image/${format || 'png'};base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==`;
    return mockData;
  }
}

class MockCanvasContext {
  canvas: MockCanvas;
  private transforms: any[] = [];
  private saveCount = 0;

  constructor(canvas: MockCanvas) {
    this.canvas = canvas;
  }

  clearRect() {}
  save() { this.saveCount++; }
  restore() { this.saveCount = Math.max(0, this.saveCount - 1); }
  translate(x: number, y: number) { this.transforms.push({ type: 'translate', x, y }); }
  rotate(angle: number) { this.transforms.push({ type: 'rotate', angle }); }
  drawImage() {}

  getTransforms() { return [...this.transforms]; }
  getSaveCount() { return this.saveCount; }
}

class MockImage {
  naturalWidth = 0;
  naturalHeight = 0;
  onload: (() => void) | null = null;
  onerror: ((error: any) => void) | null = null;
  src = '';

  constructor() {
    // Auto-trigger onload after a microtask to simulate async loading
    Promise.resolve().then(() => {
      if (this.onload) {
        this.onload();
      }
    });
  }
}

describe('renderUtils Integration Tests', () => {
  let originalDocument: any;
  let originalImage: any;

  beforeEach(() => {
    // Mock DOM elements for testing
    originalDocument = global.document;
    originalImage = global.Image;

    global.document = {
      createElement: vi.fn((tagName: string) => {
        if (tagName === 'canvas') {
          return new MockCanvas();
        }
        return {};
      })
    } as any;

    global.Image = MockImage as any;
  });

  afterEach(() => {
    global.document = originalDocument;
    global.Image = originalImage;
    vi.clearAllMocks();
  });

  describe('calculateFinalCardRenderDimensions Integration', () => {
    it('should calculate dimensions correctly with actual image processing', async () => {
      // Create a mock image data URL
      const mockImageUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAASwAAAEsCAYAAAB5fY51AAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAAOxAAADsQBlSsOGwAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAAAASUVORK5CYII=';
      
      // Mock Image to return specific dimensions
      class TestImage extends MockImage {
        naturalWidth = 750; // 2.5" at 300 DPI
        naturalHeight = 1050; // 3.5" at 300 DPI
      }
      global.Image = TestImage as any;

      const outputSettings: OutputSettings = {
        cardSize: { widthInches: 2.5, heightInches: 3.5 },
        bleedMarginInches: 0.125,
        cardScalePercent: 100,
        cardImageSizingMode: 'fit-to-card'
      };

      const result = await calculateFinalCardRenderDimensions(mockImageUrl, outputSettings);

      // Validate calculated dimensions
      expect(result.cardWidthInches).toBeCloseTo(2.75, 3); // 2.5 + 0.125*2
      expect(result.cardHeightInches).toBeCloseTo(3.75, 3); // 3.5 + 0.125*2
      expect(result.originalImageWidthInches).toBeCloseTo(2.5, 3); // 750/300
      expect(result.originalImageHeightInches).toBeCloseTo(3.5, 3); // 1050/300
      expect(result.sizingMode).toBe('fit-to-card');

      // For fit-to-card mode, image should scale to fit within card bounds
      // The actual scaling depends on the aspect ratio matching - test that dimensions are reasonable
      expect(result.imageWidthInches).toBeGreaterThan(0);
      expect(result.imageHeightInches).toBeGreaterThan(0);
      expect(result.imageWidthInches).toBeLessThanOrEqual(result.cardWidthInches);
      expect(result.imageHeightInches).toBeLessThanOrEqual(result.cardHeightInches);
    });

    it('should handle different sizing modes correctly', async () => {
      const mockImageUrl = 'data:image/png;base64,test';
      
      // Mock wider image (landscape)
      class WideImage extends MockImage {
        naturalWidth = 1200; // 4" at 300 DPI  
        naturalHeight = 900;  // 3" at 300 DPI
      }
      global.Image = WideImage as any;

      const baseSettings: OutputSettings = {
        cardSize: { widthInches: 2.5, heightInches: 3.5 },
        bleedMarginInches: 0.125,
        cardScalePercent: 100
      };

      // Test actual-size mode
      const actualSizeResult = await calculateFinalCardRenderDimensions(mockImageUrl, {
        ...baseSettings,
        cardImageSizingMode: 'actual-size'
      });

      expect(actualSizeResult.imageWidthInches).toBeCloseTo(4.0, 3); // Original size
      expect(actualSizeResult.imageHeightInches).toBeCloseTo(3.0, 3); // Original size

      // Test fit-to-card mode (should scale down to fit)
      const fitToCardResult = await calculateFinalCardRenderDimensions(mockImageUrl, {
        ...baseSettings,
        cardImageSizingMode: 'fit-to-card'
      });

      // Image is wider than card, so should scale to fit height
      const expectedScale = 2.75 / 4.0; // Card width / image width
      expect(fitToCardResult.imageWidthInches).toBeCloseTo(2.75, 3); // Scaled to fit width
      expect(fitToCardResult.imageHeightInches).toBeCloseTo(3.0 * expectedScale, 3); // Proportionally scaled

      // Test fill-card mode (should scale up to fill)
      const fillCardResult = await calculateFinalCardRenderDimensions(mockImageUrl, {
        ...baseSettings,
        cardImageSizingMode: 'fill-card'
      });

      // Should scale to fill the card (may crop)
      const fillScale = Math.max(2.75 / 4.0, 3.75 / 3.0); // Fill the card
      expect(fillCardResult.imageWidthInches).toBeCloseTo(4.0 * fillScale, 3);
      expect(fillCardResult.imageHeightInches).toBeCloseTo(3.0 * fillScale, 3);
    });

    it('should handle scale percentages correctly', async () => {
      const mockImageUrl = 'data:image/png;base64,test';
      
      class StandardImage extends MockImage {
        naturalWidth = 750; // 2.5" at 300 DPI
        naturalHeight = 1050; // 3.5" at 300 DPI
      }
      global.Image = StandardImage as any;

      const testScales = [50, 75, 100, 125, 150];

      for (const scale of testScales) {
        const outputSettings: OutputSettings = {
          cardSize: { widthInches: 2.5, heightInches: 3.5 },
          bleedMarginInches: 0.125,
          cardScalePercent: scale,
          cardImageSizingMode: 'fit-to-card'
        };

        const result = await calculateFinalCardRenderDimensions(mockImageUrl, outputSettings);
        
        const expectedCardWidth = 2.75 * (scale / 100);
        const expectedCardHeight = 3.75 * (scale / 100);
        
        expect(result.cardWidthInches).toBeCloseTo(expectedCardWidth, 3);
        expect(result.cardHeightInches).toBeCloseTo(expectedCardHeight, 3);
        // For fit-to-card mode, image should fit within card bounds
        expect(result.imageWidthInches).toBeGreaterThan(0);
        expect(result.imageHeightInches).toBeGreaterThan(0);
        expect(result.imageWidthInches).toBeLessThanOrEqual(result.cardWidthInches);
        expect(result.imageHeightInches).toBeLessThanOrEqual(result.cardHeightInches);
      }
    });
  });

  describe('processCardImageForRendering Integration', () => {
    it('should process image with rotation correctly', async () => {
      const mockImageUrl = 'data:image/png;base64,test';
      
      class TestImage extends MockImage {
        naturalWidth = 825; // 2.75" at 300 DPI
        naturalHeight = 1125; // 3.75" at 300 DPI
      }
      global.Image = TestImage as any;

      const renderDimensions = {
        cardWidthInches: 2.75,
        cardHeightInches: 3.75,
        imageWidthInches: 2.75,
        imageHeightInches: 3.75,
        originalImageWidthInches: 2.75,
        originalImageHeightInches: 3.75,
        sizingMode: 'fit-to-card' as const
      };

      // Test 0° rotation
      const result0 = await processCardImageForRendering(mockImageUrl, renderDimensions, 0);
      expect(result0.width).toBeCloseTo(2.75, 3);
      expect(result0.height).toBeCloseTo(3.75, 3);
      expect(result0.imageUrl).toContain('data:image/');

      // Test 90° rotation (should swap dimensions)
      const result90 = await processCardImageForRendering(mockImageUrl, renderDimensions, 90);
      expect(result90.width).toBeCloseTo(3.75, 3); // Height becomes width
      expect(result90.height).toBeCloseTo(2.75, 3); // Width becomes height
      expect(result90.imageUrl).toContain('data:image/');

      // Test 180° rotation (should maintain dimensions)
      const result180 = await processCardImageForRendering(mockImageUrl, renderDimensions, 180);
      expect(result180.width).toBeCloseTo(2.75, 3);
      expect(result180.height).toBeCloseTo(3.75, 3);

      // Test 270° rotation (should swap dimensions)
      const result270 = await processCardImageForRendering(mockImageUrl, renderDimensions, 270);
      expect(result270.width).toBeCloseTo(3.75, 3);
      expect(result270.height).toBeCloseTo(2.75, 3);
    });

    it('should validate canvas operations during processing', async () => {
      const mockImageUrl = 'data:image/png;base64,test';
      
      class TestImage extends MockImage {
        naturalWidth = 600;
        naturalHeight = 800;
      }
      global.Image = TestImage as any;

      const renderDimensions = {
        cardWidthInches: 2.0,
        cardHeightInches: 3.0,
        imageWidthInches: 1.8,
        imageHeightInches: 2.4,
        originalImageWidthInches: 2.0,
        originalImageHeightInches: 2.67,
        sizingMode: 'fit-to-card' as const
      };

      // Track canvas operations
      let canvasOperations: any[] = [];
      const originalCreateElement = global.document.createElement;
      
      global.document.createElement = vi.fn((tagName: string) => {
        if (tagName === 'canvas') {
          const canvas = new MockCanvas();
          const originalGetContext = canvas.getContext.bind(canvas);
          
          canvas.getContext = (type: string) => {
            const context = originalGetContext(type);
            if (context && type === '2d') {
              // Track canvas operations
              const originalDrawImage = context.drawImage;
              const originalTranslate = context.translate;
              const originalRotate = context.rotate;
              const originalSave = context.save;
              const originalRestore = context.restore;
              
              context.drawImage = (...args: any[]) => {
                canvasOperations.push({ operation: 'drawImage', args });
                return originalDrawImage.apply(context, args);
              };
              
              context.translate = (x: number, y: number) => {
                canvasOperations.push({ operation: 'translate', args: [x, y] });
                return originalTranslate.call(context, x, y);
              };
              
              context.rotate = (angle: number) => {
                canvasOperations.push({ operation: 'rotate', args: [angle] });
                return originalRotate.call(context, angle);
              };
              
              context.save = () => {
                canvasOperations.push({ operation: 'save', args: [] });
                return originalSave.call(context);
              };
              
              context.restore = () => {
                canvasOperations.push({ operation: 'restore', args: [] });
                return originalRestore.call(context);
              };
            }
            return context;
          };
          
          return canvas;
        }
        return originalCreateElement(tagName);
      });

      await processCardImageForRendering(mockImageUrl, renderDimensions, 90);

      // Validate canvas operation sequence
      expect(canvasOperations.length).toBeGreaterThan(0);
      
      // Should save context
      expect(canvasOperations.some(op => op.operation === 'save')).toBe(true);
      
      // Should translate to center
      const translateOps = canvasOperations.filter(op => op.operation === 'translate');
      expect(translateOps.length).toBeGreaterThan(0);
      
      // Should rotate for 90° rotation
      const rotateOps = canvasOperations.filter(op => op.operation === 'rotate');
      expect(rotateOps.length).toBe(1);
      expect(rotateOps[0].args[0]).toBeCloseTo(Math.PI / 2, 5); // 90° in radians
      
      // Should draw image
      expect(canvasOperations.some(op => op.operation === 'drawImage')).toBe(true);
      
      // Should restore context
      expect(canvasOperations.some(op => op.operation === 'restore')).toBe(true);

      global.document.createElement = originalCreateElement;
    });

    it('should handle clipping correctly', async () => {
      const mockImageUrl = 'data:image/png;base64,test';
      
      // Image larger than card (should be clipped)
      class LargeImage extends MockImage {
        naturalWidth = 1500; // 5" at 300 DPI
        naturalHeight = 1800; // 6" at 300 DPI
      }
      global.Image = LargeImage as any;

      const renderDimensions = {
        cardWidthInches: 2.75,
        cardHeightInches: 3.75,
        imageWidthInches: 4.0, // Larger than card
        imageHeightInches: 5.0, // Larger than card
        originalImageWidthInches: 5.0,
        originalImageHeightInches: 6.0,
        sizingMode: 'actual-size' as const
      };

      let canvasSize: { width: number; height: number } = { width: 0, height: 0 };
      
      const originalCreateElement = global.document.createElement;
      global.document.createElement = vi.fn((tagName: string) => {
        if (tagName === 'canvas') {
          const canvas = new MockCanvas();
          
          // Override width/height setters to track canvas size
          Object.defineProperty(canvas, 'width', {
            get: () => canvasSize.width,
            set: (value: number) => { canvasSize.width = value; }
          });
          
          Object.defineProperty(canvas, 'height', {
            get: () => canvasSize.height,
            set: (value: number) => { canvasSize.height = value; }
          });
          
          return canvas;
        }
        return originalCreateElement(tagName);
      });

      const result = await processCardImageForRendering(mockImageUrl, renderDimensions, 0);

      // Canvas should be sized to card dimensions (clipping area)
      expect(canvasSize.width).toBeCloseTo(825, 1); // 2.75" * 300 DPI
      expect(canvasSize.height).toBeCloseTo(1125, 1); // 3.75" * 300 DPI
      
      // Result should report card dimensions (not image dimensions)
      expect(result.width).toBeCloseTo(2.75, 3);
      expect(result.height).toBeCloseTo(3.75, 3);

      global.document.createElement = originalCreateElement;
    });
  });

  describe('calculateCardPositioning Integration', () => {
    it('should calculate positioning accurately for different page sizes', () => {
      const renderDimensions = {
        cardWidthInches: 2.75,
        cardHeightInches: 3.75,
        imageWidthInches: 2.75,
        imageHeightInches: 3.75,
        originalImageWidthInches: 2.75,
        originalImageHeightInches: 3.75,
        sizingMode: 'fit-to-card' as const
      };

      // Test letter size page
      const letterSettings: OutputSettings = {
        pageSize: { width: 8.5, height: 11.0 },
        offset: { horizontal: 0, vertical: 0 },
        rotation: 0
      };

      const letterPosition = calculateCardPositioning(renderDimensions, letterSettings, 'front');
      
      // Should be centered on letter page
      expect(letterPosition.x).toBeCloseTo(2.875, 3); // (8.5 - 2.75) / 2
      expect(letterPosition.y).toBeCloseTo(3.625, 3); // (11 - 3.75) / 2
      expect(letterPosition.width).toBeCloseTo(2.75, 3);
      expect(letterPosition.height).toBeCloseTo(3.75, 3);
      expect(letterPosition.rotation).toBe(0);

      // Test A4 page
      const a4Settings: OutputSettings = {
        pageSize: { width: 8.27, height: 11.69 },
        offset: { horizontal: 0, vertical: 0 },
        rotation: 0
      };

      const a4Position = calculateCardPositioning(renderDimensions, a4Settings, 'front');
      
      expect(a4Position.x).toBeCloseTo(2.76, 2); // (8.27 - 2.75) / 2
      expect(a4Position.y).toBeCloseTo(3.97, 2); // (11.69 - 3.75) / 2
    });

    it('should handle offsets correctly', () => {
      const renderDimensions = {
        cardWidthInches: 2.75,
        cardHeightInches: 3.75,
        imageWidthInches: 2.75,
        imageHeightInches: 3.75,
        originalImageWidthInches: 2.75,
        originalImageHeightInches: 3.75,
        sizingMode: 'fit-to-card' as const
      };

      const offsetSettings: OutputSettings = {
        pageSize: { width: 8.5, height: 11.0 },
        offset: { horizontal: 0.25, vertical: -0.125 }, // Move right and up
        rotation: 0
      };

      const position = calculateCardPositioning(renderDimensions, offsetSettings, 'front');
      
      // Should include offset in position calculation
      expect(position.x).toBeCloseTo(3.125, 3); // 2.875 + 0.25
      expect(position.y).toBeCloseTo(3.5, 3); // 3.625 - 0.125
    });

    it('should handle rotation correctly', () => {
      const renderDimensions = {
        cardWidthInches: 2.75,
        cardHeightInches: 3.75,
        imageWidthInches: 2.75,
        imageHeightInches: 3.75,
        originalImageWidthInches: 2.75,
        originalImageHeightInches: 3.75,
        sizingMode: 'fit-to-card' as const
      };

      // Test 90° rotation
      const rotatedSettings: OutputSettings = {
        pageSize: { width: 8.5, height: 11.0 },
        offset: { horizontal: 0, vertical: 0 },
        rotation: 90
      };

      const rotatedPosition = calculateCardPositioning(renderDimensions, rotatedSettings, 'front');
      
      // Dimensions should be swapped for 90° rotation
      expect(rotatedPosition.width).toBeCloseTo(3.75, 3); // Height becomes width
      expect(rotatedPosition.height).toBeCloseTo(2.75, 3); // Width becomes height
      expect(rotatedPosition.rotation).toBe(90);
      
      // Position should account for swapped dimensions
      expect(rotatedPosition.x).toBeCloseTo(2.375, 3); // (8.5 - 3.75) / 2
      expect(rotatedPosition.y).toBeCloseTo(4.125, 3); // (11 - 2.75) / 2
    });

    it('should handle different card types correctly', () => {
      const renderDimensions = {
        cardWidthInches: 2.75,
        cardHeightInches: 3.75,
        imageWidthInches: 2.75,
        imageHeightInches: 3.75,
        originalImageWidthInches: 2.75,
        originalImageHeightInches: 3.75,
        sizingMode: 'fit-to-card' as const
      };

      const dualRotationSettings: OutputSettings = {
        pageSize: { width: 8.5, height: 11.0 },
        offset: { horizontal: 0, vertical: 0 },
        rotation: { front: 0, back: 180 }
      };

      const frontPosition = calculateCardPositioning(renderDimensions, dualRotationSettings, 'front');
      const backPosition = calculateCardPositioning(renderDimensions, dualRotationSettings, 'back');
      
      expect(frontPosition.rotation).toBe(0);
      expect(backPosition.rotation).toBe(180);
      
      // Positions should be the same (180° doesn't change dimensions)
      expect(frontPosition.x).toBeCloseTo(backPosition.x, 3);
      expect(frontPosition.y).toBeCloseTo(backPosition.y, 3);
      expect(frontPosition.width).toBeCloseTo(backPosition.width, 3);
      expect(frontPosition.height).toBeCloseTo(backPosition.height, 3);
    });
  });

  describe('calculatePreviewScaling Integration', () => {
    it('should scale preview consistently with export calculations', () => {
      const renderDimensions = {
        cardWidthInches: 2.75,
        cardHeightInches: 3.75,
        imageWidthInches: 2.75,
        imageHeightInches: 3.75,
        originalImageWidthInches: 2.75,
        originalImageHeightInches: 3.75,
        sizingMode: 'fit-to-card' as const
      };

      const positioning = {
        x: 2.875,
        y: 3.625,
        width: 2.75,
        height: 3.75,
        rotation: 0
      };

      const pageWidth = 8.5;
      const pageHeight = 11.0;
      const maxPreviewWidth = 400;
      const maxPreviewHeight = 500;

      const previewScaling = calculatePreviewScaling(
        renderDimensions,
        positioning,
        pageWidth,
        pageHeight,
        maxPreviewWidth,
        maxPreviewHeight
      );

      // Validate preview page scaling
      const expectedPageWidthPx = pageWidth * 72; // 612px
      const expectedPageHeightPx = pageHeight * 72; // 792px
      const expectedScale = Math.min(400 / 612, 500 / 792); // ~0.632

      expect(previewScaling.scale).toBeCloseTo(expectedScale, 3);
      expect(previewScaling.previewPageWidth).toBeCloseTo(expectedPageWidthPx * expectedScale, 1);
      expect(previewScaling.previewPageHeight).toBeCloseTo(expectedPageHeightPx * expectedScale, 1);

      // Validate card scaling
      expect(previewScaling.previewCardWidth).toBeCloseTo(positioning.width * 72 * expectedScale, 1);
      expect(previewScaling.previewCardHeight).toBeCloseTo(positioning.height * 72 * expectedScale, 1);
      expect(previewScaling.previewX).toBeCloseTo(positioning.x * 72 * expectedScale, 1);
      expect(previewScaling.previewY).toBeCloseTo(positioning.y * 72 * expectedScale, 1);
    });

    it('should maintain aspect ratios in preview scaling', () => {
      const renderDimensions = {
        cardWidthInches: 2.75,
        cardHeightInches: 3.75,
        imageWidthInches: 2.75,
        imageHeightInches: 3.75,
        originalImageWidthInches: 2.75,
        originalImageHeightInches: 3.75,
        sizingMode: 'fit-to-card' as const
      };

      // Test different positioning scenarios
      const testPositions = [
        { x: 1.0, y: 1.0, width: 3.0, height: 4.0, rotation: 0 },
        { x: 2.0, y: 3.0, width: 4.0, height: 3.0, rotation: 90 },
        { x: 0.5, y: 0.5, width: 2.0, height: 2.0, rotation: 180 }
      ];

      for (const position of testPositions) {
        const previewScaling = calculatePreviewScaling(
          renderDimensions,
          position,
          8.5,
          11.0,
          400,
          500
        );

        // Verify aspect ratios are preserved
        const originalAspect = position.width / position.height;
        const previewAspect = previewScaling.previewCardWidth / previewScaling.previewCardHeight;
        
        expect(previewAspect).toBeCloseTo(originalAspect, 5);

        // Verify preview fits within constraints
        expect(previewScaling.previewPageWidth).toBeLessThanOrEqual(400);
        expect(previewScaling.previewPageHeight).toBeLessThanOrEqual(500);
      }
    });
  });

  describe('End-to-End Rendering Pipeline Integration', () => {
    it('should maintain consistency through complete rendering pipeline', async () => {
      const mockImageUrl = 'data:image/png;base64,test';
      
      class TestImage extends MockImage {
        naturalWidth = 750; // 2.5" at 300 DPI
        naturalHeight = 1050; // 3.5" at 300 DPI
      }
      global.Image = TestImage as any;

      const outputSettings: OutputSettings = {
        cardSize: { widthInches: 2.5, heightInches: 3.5 },
        bleedMarginInches: 0.125,
        cardScalePercent: 110,
        cardImageSizingMode: 'fit-to-card',
        pageSize: { width: 8.5, height: 11.0 },
        offset: { horizontal: 0.125, vertical: -0.0625 },
        rotation: 90
      };

      // Step 1: Calculate final card render dimensions
      const renderDimensions = await calculateFinalCardRenderDimensions(mockImageUrl, outputSettings);

      // Step 2: Calculate card positioning
      const positioning = calculateCardPositioning(renderDimensions, outputSettings, 'front');

      // Step 3: Process image for rendering
      const processedImage = await processCardImageForRendering(
        mockImageUrl,
        renderDimensions,
        positioning.rotation
      );

      // Step 4: Calculate preview scaling
      const previewScaling = calculatePreviewScaling(
        renderDimensions,
        positioning,
        outputSettings.pageSize.width,
        outputSettings.pageSize.height,
        400,
        500
      );

      // Validate complete pipeline consistency
      
      // Render dimensions should account for scale and bleed
      const expectedCardWidth = 2.75 * 1.1; // (2.5 + 0.25) * 1.1
      const expectedCardHeight = 3.75 * 1.1; // (3.5 + 0.25) * 1.1
      
      expect(renderDimensions.cardWidthInches).toBeCloseTo(expectedCardWidth, 3);
      expect(renderDimensions.cardHeightInches).toBeCloseTo(expectedCardHeight, 3);

      // Positioning should handle rotation (dimension swap)
      expect(positioning.width).toBeCloseTo(expectedCardHeight, 3); // Height becomes width at 90°
      expect(positioning.height).toBeCloseTo(expectedCardWidth, 3); // Width becomes height at 90°
      expect(positioning.rotation).toBe(90);

      // Processed image should have swapped dimensions for 90° rotation
      expect(processedImage.width).toBeCloseTo(expectedCardHeight, 3);
      expect(processedImage.height).toBeCloseTo(expectedCardWidth, 3);

      // Preview should maintain aspect ratios
      const positioningAspect = positioning.width / positioning.height;
      const previewAspect = previewScaling.previewCardWidth / previewScaling.previewCardHeight;
      expect(previewAspect).toBeCloseTo(positioningAspect, 5);

      // All steps should be mathematically consistent
      expect(processedImage.width).toBeCloseTo(positioning.width, 3);
      expect(processedImage.height).toBeCloseTo(positioning.height, 3);
    });

    it('should handle error cases gracefully throughout pipeline', async () => {
      // Test with invalid image URL
      const invalidImageUrl = 'invalid-url';
      
      class FailingImage extends MockImage {
        constructor() {
          super();
          // Simulate image load failure
          Promise.resolve().then(() => {
            if (this.onerror) {
              this.onerror(new Error('Failed to load image'));
            }
          });
        }
      }
      global.Image = FailingImage as any;

      const outputSettings: OutputSettings = {
        cardSize: { widthInches: 2.5, heightInches: 3.5 },
        bleedMarginInches: 0.125,
        cardScalePercent: 100,
        cardImageSizingMode: 'fit-to-card'
      };

      // Should reject with meaningful error
      await expect(calculateFinalCardRenderDimensions(invalidImageUrl, outputSettings))
        .rejects.toThrow();

      // Test with invalid dimensions
      class ZeroSizeImage extends MockImage {
        naturalWidth = 0;
        naturalHeight = 0;
      }
      global.Image = ZeroSizeImage as any;

      await expect(calculateFinalCardRenderDimensions('data:image/png;base64,test', outputSettings))
        .rejects.toThrow();
    });
  });
});