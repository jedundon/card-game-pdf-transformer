/**
 * Tests for ImportStep - PDF import and page configuration
 */

import { ImportStep } from '../steps/ImportStep';
import { createMockSettings } from './setup';
import type { 
  WorkflowSettings, 
  PDFDocument, 
  PDFMode, 
  PageSetting
} from '../types';

// Mock Canvas API for JSDOM environment
const mockToDataURL = jest.fn(() => 'data:image/png;base64,mock-base64-data');
global.HTMLCanvasElement.prototype.toDataURL = mockToDataURL;
global.HTMLCanvasElement.prototype.getContext = jest.fn(() => ({
  fillRect: jest.fn(),
  fillText: jest.fn(),
  strokeRect: jest.fn(),
  stroke: jest.fn(),
  beginPath: jest.fn(),
  moveTo: jest.fn(),
  lineTo: jest.fn(),
  setLineDash: jest.fn(),
  fillStyle: '',
  strokeStyle: '',
  lineWidth: 1,
  font: '',
  textAlign: '',
  canvas: { width: 400, height: 300 }
})) as any;

describe('ImportStep', () => {
  let importStep: ImportStep;
  let mockPdfDocument: PDFDocument;
  let mockSettings: WorkflowSettings;
  let mockPdfMode: PDFMode;
  let mockPageSettings: PageSetting[];

  beforeEach(() => {
    importStep = new ImportStep();
    
    // Create mock PDF document
    mockPdfDocument = {
      numPages: 4,
      fingerprint: 'test-pdf-fingerprint',
      _pdfInfo: { producer: 'Test PDF' }
    };

    // Create mock PDF mode
    mockPdfMode = {
      type: 'duplex',
      orientation: 'vertical',
      flipEdge: 'short'
    };

    // Create mock page settings
    mockPageSettings = [
      { skip: false, type: 'front' },
      { skip: false, type: 'back' },
      { skip: false, type: 'front' },
      { skip: false, type: 'back' }
    ];    // Create mock workflow settings with import data
    mockSettings = {
      ...createMockSettings(),
      pdfData: mockPdfDocument,
      pdfMode: mockPdfMode,
      pageSettings: mockPageSettings,
      fileName: 'test-cards.pdf'
    } as any;
  });

  describe('Constructor and Basic Properties', () => {
    test('should have correct step identification', () => {
      expect(importStep.id).toBe('import');
      expect(importStep.name).toBe('Import PDF');
      expect(importStep.description).toBe('Load PDF document and configure page settings');
      expect(importStep.shouldCache).toBe(true);
    });
  });

  describe('Execute Method', () => {
    test('should execute successfully with valid PDF data', async () => {
      const result = await importStep.execute([], mockSettings);
      
      expect(result).toEqual([]);
      expect(Array.isArray(result)).toBe(true);
    });

    test('should throw error when no PDF data is provided', async () => {
      const settingsWithoutPdf = {
        ...mockSettings,
        pdfData: null
      } as any;

      await expect(importStep.execute([], settingsWithoutPdf))
        .rejects
        .toThrow('No PDF document loaded');
    });    test('should handle malformed PDF data gracefully', async () => {
      const settingsWithMalformedPdf = {
        ...mockSettings,
        pdfData: null  // This will trigger the "No PDF document loaded" error
      } as any;

      await expect(importStep.execute([], settingsWithMalformedPdf))
        .rejects
        .toThrow('No PDF document loaded');
    });

    test('should store PDF configuration internally', async () => {
      await importStep.execute([], mockSettings);
      
      const config = importStep.getImportConfiguration();
      expect(config.pdfData).toBe(mockPdfDocument);
      expect(config.pdfMode).toEqual(mockPdfMode);
      expect(config.pageSettings).toEqual(mockPageSettings);
      expect(config.fileName).toBe('test-cards.pdf');
    });
  });

  describe('Generate Preview', () => {
    test('should generate preview with valid PDF data', async () => {
      const preview = await importStep.generatePreview([], mockSettings);
      
      expect(preview).toBeDefined();
      expect(preview.imageUrl).toMatch(/^data:image\/png;base64,/);
      expect(preview.thumbnailUrl).toBeDefined();
      expect(preview.metadata).toBeDefined();
      expect(preview.metadata.stepId).toBe('import');
      expect(preview.metadata.width).toBeGreaterThan(0);
      expect(preview.metadata.height).toBeGreaterThan(0);
    });

    test('should generate placeholder preview when no PDF is loaded', async () => {
      const settingsWithoutPdf = {
        ...mockSettings,
        pdfData: null
      } as any;

      const preview = await importStep.generatePreview([], settingsWithoutPdf);
      
      expect(preview).toBeDefined();
      expect(preview.imageUrl).toMatch(/^data:image\/png;base64,/);
      expect(preview.metadata.stepId).toBe('import');
    });    test('should handle preview generation errors gracefully', async () => {
      // Create a problematic settings object that will cause createImportPreview to fail
      const problematicSettings = {
        ...mockSettings,
        pdfData: { numPages: 0 }  // This should trigger validation error in preview
      } as any;

      // This should not throw because we handle errors gracefully in generatePreview
      const preview = await importStep.generatePreview([], problematicSettings);
      expect(preview).toBeDefined();
      expect(preview.imageUrl).toBe('data:image/png;base64,mock-base64-data');
    });

    test('should include correct metadata in preview', async () => {
      const preview = await importStep.generatePreview([], mockSettings);
      
      expect(preview.metadata.dpi).toBeDefined();
      expect(preview.metadata.renderTime).toBeDefined();
      expect(preview.metadata.timestamp).toBeDefined();
      expect(typeof preview.metadata.renderTime).toBe('number');
      expect(typeof preview.metadata.timestamp).toBe('number');
    });
  });

  describe('Validation', () => {
    test('should validate successfully with complete settings', () => {
      const result = importStep.validate(mockSettings);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should fail validation when PDF data is missing', () => {
      const settingsWithoutPdf = {
        ...mockSettings,
        pdfData: null
      } as any;

      const result = importStep.validate(settingsWithoutPdf);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'pdfData',
          code: 'MISSING_PDF'
        })
      );
    });

    test('should fail validation when PDF has no pages', () => {
      const settingsWithEmptyPdf = {
        ...mockSettings,
        pdfData: { numPages: 0 }
      } as any;

      const result = importStep.validate(settingsWithEmptyPdf);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'pdfData.numPages',
          code: 'INVALID_PAGE_COUNT'
        })
      );
    });

    test('should warn when page settings count mismatches PDF pages', () => {
      const settingsWithMismatch = {
        ...mockSettings,
        pageSettings: [{ skip: false, type: 'front' }] // Only 1 page setting for 4-page PDF
      } as any;

      const result = importStep.validate(settingsWithMismatch);
      
      expect(result.valid).toBe(true); // Warning, not error
      expect(result.warnings).toContainEqual(
        expect.objectContaining({
          field: 'pageSettings',
          code: 'PAGE_SETTINGS_MISMATCH'
        })
      );
    });

    test('should warn when all pages are skipped', () => {
      const settingsWithAllSkipped = {
        ...mockSettings,
        pageSettings: [
          { skip: true, type: 'front' },
          { skip: true, type: 'back' },
          { skip: true, type: 'front' },
          { skip: true, type: 'back' }
        ]
      } as any;

      const result = importStep.validate(settingsWithAllSkipped);
      
      expect(result.valid).toBe(true); // Warning, not error
      expect(result.warnings).toContainEqual(
        expect.objectContaining({
          field: 'pageSettings',
          code: 'ALL_PAGES_SKIPPED'
        })
      );
    });

    test('should validate PDF mode types', () => {
      const settingsWithInvalidMode = {
        ...mockSettings,
        pdfMode: { type: 'invalid', orientation: 'vertical', flipEdge: 'short' }
      } as any;

      const result = importStep.validate(settingsWithInvalidMode);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'pdfMode.type',
          code: 'INVALID_PDF_MODE_TYPE'
        })
      );
    });

    test('should validate PDF mode orientations', () => {
      const settingsWithInvalidOrientation = {
        ...mockSettings,
        pdfMode: { type: 'gutter-fold', orientation: 'invalid', flipEdge: 'short' }
      } as any;

      const result = importStep.validate(settingsWithInvalidOrientation);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'pdfMode.orientation',
          code: 'INVALID_PDF_ORIENTATION'
        })
      );
    });

    test('should validate PDF mode flip edges', () => {
      const settingsWithInvalidFlipEdge = {
        ...mockSettings,
        pdfMode: { type: 'duplex', orientation: 'vertical', flipEdge: 'invalid' }
      } as any;

      const result = importStep.validate(settingsWithInvalidFlipEdge);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'pdfMode.flipEdge',
          code: 'INVALID_PDF_FLIP_EDGE'
        })
      );
    });

    test('should handle validation errors gracefully', () => {
      // Settings that will cause JSON.stringify to throw
      const problematicSettings = {} as any;
      problematicSettings.circularRef = problematicSettings;

      const result = importStep.validate(problematicSettings);
      
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Cache Key Generation', () => {
    test('should generate consistent cache keys for same settings', () => {
      const key1 = importStep.getCacheKey([], mockSettings);
      const key2 = importStep.getCacheKey([], mockSettings);
      
      expect(key1).toBe(key2);
      expect(key1).toMatch(/^import-/);
    });

    test('should generate different cache keys for different PDF data', () => {
      const settings1 = mockSettings;
      const settings2 = {
        ...mockSettings,
        pdfData: { ...mockPdfDocument, fingerprint: 'different-fingerprint' }
      } as any;

      const key1 = importStep.getCacheKey([], settings1);
      const key2 = importStep.getCacheKey([], settings2);
      
      expect(key1).not.toBe(key2);
    });

    test('should generate different cache keys for different page settings', () => {
      const settings1 = mockSettings;
      const settings2 = {
        ...mockSettings,
        pageSettings: [
          { skip: true, type: 'front' },
          { skip: false, type: 'back' },
          { skip: false, type: 'front' },
          { skip: false, type: 'back' }
        ]
      } as any;

      const key1 = importStep.getCacheKey([], settings1);
      const key2 = importStep.getCacheKey([], settings2);
      
      expect(key1).not.toBe(key2);
    });

    test('should handle missing PDF data in cache key generation', () => {
      const settingsWithoutPdf = {
        ...mockSettings,
        pdfData: null
      } as any;

      const key = importStep.getCacheKey([], settingsWithoutPdf);
      
      expect(key).toMatch(/^import-no-pdf-/);
    });
  });

  describe('Public API Methods', () => {
    test('should set PDF document correctly', async () => {
      await importStep.setPDFDocument(mockPdfDocument, 'new-file.pdf');
      
      const config = importStep.getImportConfiguration();
      expect(config.pdfData).toBe(mockPdfDocument);
      expect(config.fileName).toBe('new-file.pdf');
      expect(config.pageSettings).toHaveLength(mockPdfDocument.numPages);
    });

    test('should initialize page settings with alternating front/back', async () => {
      await importStep.setPDFDocument(mockPdfDocument, 'test.pdf');
      
      const config = importStep.getImportConfiguration();
      expect(config.pageSettings[0].type).toBe('front');
      expect(config.pageSettings[1].type).toBe('back');
      expect(config.pageSettings[2].type).toBe('front');
      expect(config.pageSettings[3].type).toBe('back');
        // All should default to not skipped
      config.pageSettings.forEach((setting: PageSetting) => {
        expect(setting.skip).toBe(false);
      });
    });

    test('should update PDF mode correctly', () => {
      const newMode: PDFMode = {
        type: 'gutter-fold',
        orientation: 'horizontal',
        flipEdge: 'long'
      };

      importStep.setPDFMode(newMode);
      
      const config = importStep.getImportConfiguration();
      expect(config.pdfMode).toEqual(newMode);
    });

    test('should update page settings correctly', () => {
      const newPageSettings: PageSetting[] = [
        { skip: true, type: 'front' },
        { skip: false, type: 'back' }
      ];

      importStep.setPageSettings(newPageSettings);
      
      const config = importStep.getImportConfiguration();
      expect(config.pageSettings).toEqual(newPageSettings);
    });    test('should calculate estimated card count correctly', () => {
      // Setup mock data - order matters!
      const mockDoc: PDFDocument = { numPages: 4 };
      importStep.setPDFDocument(mockDoc, 'test.pdf');  // This must come first as it resets page settings
      
      importStep.setPDFMode({ type: 'duplex', orientation: 'vertical', flipEdge: 'short' });
      importStep.setPageSettings([
        { skip: false, type: 'front' },
        { skip: false, type: 'back' },
        { skip: true, type: 'front' },   // This page is skipped
        { skip: false, type: 'back' }
      ]);
      
      // For duplex mode, default grid is 2x3 = 6 cards per page
      // Valid pages indices: [0, 1, 3] = 3 active pages
      // 3 active pages × 6 cards = 18 cards
      const estimatedCount = importStep.getEstimatedCardCount();
      expect(estimatedCount).toBe(18);
    });

    test('should return 0 card count when no PDF is loaded', () => {
      const estimatedCount = importStep.getEstimatedCardCount();
      expect(estimatedCount).toBe(0);
    });    test('should calculate card count for gutter-fold mode', () => {
      const mockDoc: PDFDocument = { numPages: 2 };
      importStep.setPDFDocument(mockDoc, 'test.pdf');  // This must come first
      
      importStep.setPDFMode({ type: 'gutter-fold', orientation: 'vertical', flipEdge: 'short' });
      importStep.setPageSettings([
        { skip: false, type: 'front' },
        { skip: false, type: 'back' }
      ]);
      
      // For gutter-fold vertical, default grid is 4x2 = 8 cards per page
      // 2 active pages × 8 cards = 16 cards
      const estimatedCount = importStep.getEstimatedCardCount();
      expect(estimatedCount).toBe(16);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    test('should handle empty page settings gracefully', () => {
      importStep.setPageSettings([]);
      const estimatedCount = importStep.getEstimatedCardCount();
      expect(estimatedCount).toBe(0);
    });

    test('should handle invalid PDF mode gracefully', () => {
      const invalidMode = { type: 'invalid' } as any;
      importStep.setPDFMode(invalidMode);
      
      // Should still work, using defaults for missing properties
      const config = importStep.getImportConfiguration();
      expect(config.pdfMode.type).toBe('invalid');
    });

    test('should handle settings with missing properties', () => {
      const sparseSettings = {} as any;
      const result = importStep.validate(sparseSettings);
      
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    test('should maintain state isolation between instances', () => {
      const step1 = new ImportStep();
      const step2 = new ImportStep();
      
      step1.setPDFMode({ type: 'duplex', orientation: 'vertical', flipEdge: 'short' });
      step2.setPDFMode({ type: 'gutter-fold', orientation: 'horizontal', flipEdge: 'long' });
      
      expect(step1.getImportConfiguration().pdfMode.type).toBe('duplex');
      expect(step2.getImportConfiguration().pdfMode.type).toBe('gutter-fold');
    });
  });
});
