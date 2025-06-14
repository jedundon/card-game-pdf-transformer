/**
 * Unit tests for ExportStep - Testing PDF export functionality
 */

import { ExportStep } from '../steps/ExportStep';
import { createMockSettings } from './setup';
import type { 
  WorkflowSettings, 
  OutputSettings,
  PDFDocument
} from '../types';

// Mock jsPDF to avoid actual PDF generation in tests
jest.mock('jspdf', () => {
  return jest.fn().mockImplementation(() => ({
    addPage: jest.fn(),
    addImage: jest.fn(),
    output: jest.fn(() => new ArrayBuffer(1024))
  }));
});

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
  clearRect: jest.fn(),
  save: jest.fn(),
  restore: jest.fn(),
  translate: jest.fn(),
  rotate: jest.fn(),
  drawImage: jest.fn(),
  fillStyle: '',
  strokeStyle: '',
  lineWidth: 1,
  font: '',
  textAlign: '',
  canvas: { width: 400, height: 300 }
})) as any;

// Mock cardUtils functions
jest.mock('../../utils/cardUtils', () => ({
  getRotationForCardType: jest.fn(() => 0),
  getActivePages: jest.fn(() => [{ pageNumber: 1 }, { pageNumber: 2 }]),
  calculateTotalCards: jest.fn(() => 12),
  getAvailableCardIds: jest.fn(() => [1, 2, 3, 4, 5, 6]),
  getCardInfo: jest.fn((index) => ({ id: index + 1, type: index % 2 === 0 ? 'front' : 'back' })),
  extractCardImage: jest.fn(() => Promise.resolve('data:image/png;base64,mock-card-image')),
  calculateCardDimensions: jest.fn(() => ({
    scaledCardWidthInches: 2.5,
    scaledCardHeightInches: 3.5
  })),
  calculateCardImageDimensions: jest.fn(() => Promise.resolve({
    width: 2.5,
    height: 3.5,
    imageWidth: 2.5,
    imageHeight: 3.5
  }))
}));

// Mock URL.createObjectURL and revokeObjectURL
global.URL.createObjectURL = jest.fn(() => 'mock-blob-url');
global.URL.revokeObjectURL = jest.fn();

describe('ExportStep', () => {
  let exportStep: ExportStep;
  let mockSettings: WorkflowSettings;
  let mockPdfDocument: PDFDocument;
  let mockOutputSettings: OutputSettings;

  beforeEach(() => {
    exportStep = new ExportStep();
    
    // Create mock PDF document
    mockPdfDocument = {
      numPages: 4,
      fingerprint: 'test-export-pdf-fingerprint',
      _pdfInfo: { producer: 'Test PDF for Export' }
    };

    // Create mock output settings
    mockOutputSettings = {
      pageSize: { width: 8.5, height: 11 },
      offset: { horizontal: 0, vertical: 0 },
      cardSize: { widthInches: 2.5, heightInches: 3.5 },
      cardScalePercent: 100,
      bleedMarginInches: 0,
      rotation: { front: 0, back: 0 },
      cardImageSizingMode: 'actual-size'
    };

    // Create mock workflow settings with export data
    mockSettings = {
      ...createMockSettings(),
      pdfData: mockPdfDocument,
      outputSettings: mockOutputSettings,
      outputFormat: 'individual' as const,
      exportFilename: 'test-export.pdf',
      pdfMode: {
        type: 'duplex',
        orientation: 'vertical',
        flipEdge: 'short'
      },
      pageSettings: [
        { skip: false, type: 'front' },
        { skip: false, type: 'back' },
        { skip: false, type: 'front' },
        { skip: false, type: 'back' }
      ],
      extractionSettings: {
        grid: { rows: 2, columns: 3 },
        crop: { top: 0, right: 0, bottom: 0, left: 0 }
      }
    } as any;

    // Clear all mocks
    jest.clearAllMocks();
  });

  describe('Constructor and Basic Properties', () => {
    test('should have correct step identification', () => {
      expect(exportStep.id).toBe('export');
      expect(exportStep.name).toBe('Export PDF');
      expect(exportStep.description).toBe('Generate final PDF output files from processed cards');
    });
  });

  describe('Execute Method', () => {
    test('should execute successfully with valid export settings', async () => {
      const result = await exportStep.execute([], mockSettings);
      
      expect(result).toEqual([]);
      expect(exportStep.getExportResults()).toBeTruthy();
      expect(exportStep.getExportResults()?.totalCards).toBe(12);
    });

    test('should throw error when no export settings are provided', async () => {
      const settingsWithoutOutput = { ...mockSettings };
      delete settingsWithoutOutput.outputSettings;

      await expect(exportStep.execute([], settingsWithoutOutput))
        .rejects.toThrow('No export settings provided');
    });

    test('should throw error when no PDF data is available', async () => {
      const settingsWithoutPdf = { ...mockSettings };
      delete settingsWithoutPdf.pdfData;

      await expect(exportStep.execute([], settingsWithoutPdf))
        .rejects.toThrow('No PDF data available for export');
    });

    test('should handle export generation errors gracefully', async () => {
      // Mock cardUtils to throw an error
      const { calculateTotalCards } = require('../../utils/cardUtils');
      calculateTotalCards.mockImplementationOnce(() => {
        throw new Error('Card calculation failed');
      });

      await expect(exportStep.execute([], mockSettings))
        .rejects.toThrow('Failed to export PDF files');
    });

    test('should store export results internally', async () => {
      await exportStep.execute([], mockSettings);
      
      const results = exportStep.getExportResults();
      expect(results).toBeTruthy();
      expect(results?.totalCards).toBe(12);
      expect(results?.frontCards).toBe(6);
      expect(results?.backCards).toBe(6);
    });
  });
  describe('Generate Preview', () => {
    test('should generate preview with valid export settings', async () => {
      const preview = await exportStep.generatePreview([], mockSettings);
      
      expect(preview.imageUrl).toBe('data:image/png;base64,mock-base64-data');
      expect(preview.metadata.stepId).toBe('export');
      // Canvas size is calculated as: pageSize * PDF_DPI * previewScale
      // 8.5" * 300 DPI * 2 = 5100px width, 11" * 300 DPI * 2 = 6600px height
      expect(preview.metadata.width).toBe(5100);
      expect(preview.metadata.height).toBe(6600);
    });

    test('should generate placeholder preview when no export settings', async () => {
      const settingsWithoutOutput = { ...mockSettings };
      delete settingsWithoutOutput.outputSettings;

      const preview = await exportStep.generatePreview([], settingsWithoutOutput);
      
      expect(preview.imageUrl).toBe('data:image/png;base64,mock-base64-data');
      expect(preview.metadata.stepId).toBe('export');
    });

    test('should generate placeholder preview when no PDF data', async () => {
      const settingsWithoutPdf = { ...mockSettings };
      delete settingsWithoutPdf.pdfData;

      const preview = await exportStep.generatePreview([], settingsWithoutPdf);
      
      expect(preview.imageUrl).toBe('data:image/png;base64,mock-base64-data');
      expect(preview.metadata.stepId).toBe('export');
    });

    test('should handle preview generation errors gracefully', async () => {
      // Mock canvas getContext to return null
      global.HTMLCanvasElement.prototype.getContext = jest.fn(() => null);

      const preview = await exportStep.generatePreview([], mockSettings);
      
      expect(preview.imageUrl).toBe('data:image/png;base64,mock-base64-data');
      expect(preview.metadata.stepId).toBe('export');
    });

    test('should include correct metadata in preview', async () => {
      const preview = await exportStep.generatePreview([], mockSettings);
      
      expect(preview.metadata.stepId).toBe('export');
      expect(preview.metadata.timestamp).toBeGreaterThan(0);
      expect(typeof preview.metadata.timestamp).toBe('number');
    });
  });

  describe('Validation', () => {
    test('should validate successfully with complete export settings', () => {
      const result = exportStep.validate(mockSettings);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should fail validation when PDF data is missing', () => {
      const settingsWithoutPdf = { ...mockSettings };
      delete settingsWithoutPdf.pdfData;

      const result = exportStep.validate(settingsWithoutPdf);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'pdfData',
          code: 'MISSING_PDF_DATA'
        })
      );
    });

    test('should fail validation when output settings are missing', () => {
      const settingsWithoutOutput = { ...mockSettings };
      delete settingsWithoutOutput.outputSettings;

      const result = exportStep.validate(settingsWithoutOutput);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'outputSettings',
          code: 'MISSING_OUTPUT_SETTINGS'
        })
      );
    });

    test('should fail validation with invalid page size', () => {
      const settingsWithInvalidPageSize = {
        ...mockSettings,
        outputSettings: {
          ...mockOutputSettings,
          pageSize: { width: 0, height: 0 }
        }
      };

      const result = exportStep.validate(settingsWithInvalidPageSize);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'outputSettings.pageSize',
          code: 'INVALID_PAGE_SIZE'
        })
      );
    });

    test('should fail validation with invalid card size', () => {
      const settingsWithInvalidCardSize = {
        ...mockSettings,
        outputSettings: {
          ...mockOutputSettings,
          cardSize: { widthInches: 0, heightInches: 0 }
        }
      };

      const result = exportStep.validate(settingsWithInvalidCardSize);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'outputSettings.cardSize',
          code: 'INVALID_CARD_SIZE'
        })
      );
    });

    test('should fail validation with invalid card scale', () => {
      const settingsWithInvalidScale = {
        ...mockSettings,
        outputSettings: {
          ...mockOutputSettings,
          cardScalePercent: 0
        }
      };

      const result = exportStep.validate(settingsWithInvalidScale);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'outputSettings.cardScalePercent',
          code: 'INVALID_CARD_SCALE'
        })
      );
    });

    test('should fail validation with invalid bleed margin', () => {
      const settingsWithInvalidBleed = {
        ...mockSettings,
        outputSettings: {
          ...mockOutputSettings,
          bleedMarginInches: -1
        }
      };

      const result = exportStep.validate(settingsWithInvalidBleed);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'outputSettings.bleedMarginInches',
          code: 'INVALID_BLEED_MARGIN'
        })
      );
    });

    test('should warn about large horizontal offset', () => {
      const settingsWithLargeOffset = {
        ...mockSettings,
        outputSettings: {
          ...mockOutputSettings,
          offset: { horizontal: 10, vertical: 0 } // Larger than half page width
        }
      };

      const result = exportStep.validate(settingsWithLargeOffset);
      
      expect(result.valid).toBe(true);
      expect(result.warnings).toContainEqual(
        expect.objectContaining({
          field: 'outputSettings.offset.horizontal',
          code: 'LARGE_HORIZONTAL_OFFSET'
        })
      );
    });

    test('should warn about large vertical offset', () => {
      const settingsWithLargeOffset = {
        ...mockSettings,
        outputSettings: {
          ...mockOutputSettings,
          offset: { horizontal: 0, vertical: 10 } // Larger than half page height
        }
      };

      const result = exportStep.validate(settingsWithLargeOffset);
      
      expect(result.valid).toBe(true);
      expect(result.warnings).toContainEqual(
        expect.objectContaining({
          field: 'outputSettings.offset.vertical',
          code: 'LARGE_VERTICAL_OFFSET'
        })
      );
    });

    test('should fail validation with invalid rotation values', () => {
      const settingsWithInvalidRotation = {
        ...mockSettings,
        outputSettings: {
          ...mockOutputSettings,
          rotation: { front: 45, back: 135 } // Invalid rotation values
        }
      };

      const result = exportStep.validate(settingsWithInvalidRotation);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'outputSettings.rotation.front',
          code: 'INVALID_FRONT_ROTATION'
        })
      );
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'outputSettings.rotation.back',
          code: 'INVALID_BACK_ROTATION'
        })
      );
    });

    test('should fail validation when no active pages', () => {
      const { getActivePages } = require('../../utils/cardUtils');
      getActivePages.mockReturnValueOnce([]);

      const result = exportStep.validate(mockSettings);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'pageSettings',
          code: 'NO_ACTIVE_PAGES'
        })
      );
    });

    test('should handle validation errors gracefully', () => {
      const settingsWithNullOutput = {
        ...mockSettings,
        outputSettings: null
      } as any;

      const result = exportStep.validate(settingsWithNullOutput);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'outputSettings',
          code: 'MISSING_OUTPUT_SETTINGS'
        })
      );
    });
  });

  describe('Cache Key Generation', () => {
    test('should generate consistent cache keys for same settings', () => {
      const key1 = exportStep.getCacheKey([], mockSettings);
      const key2 = exportStep.getCacheKey([], mockSettings);
      
      expect(key1).toBe(key2);
      expect(typeof key1).toBe('string');
      expect(key1.length).toBeGreaterThan(0);
    });

    test('should generate different cache keys for different output settings', () => {
      const settings1 = mockSettings;
      const settings2 = {
        ...mockSettings,
        outputSettings: {
          ...mockOutputSettings,
          cardScalePercent: 150
        }
      };

      const key1 = exportStep.getCacheKey([], settings1);
      const key2 = exportStep.getCacheKey([], settings2);
      
      expect(key1).not.toBe(key2);
    });

    test('should generate different cache keys for different PDF data', () => {
      const settings1 = mockSettings;
      const settings2 = {
        ...mockSettings,
        pdfData: { 
          ...mockPdfDocument, 
          fingerprint: 'different-export-fingerprint' 
        }
      };

      const key1 = exportStep.getCacheKey([], settings1);
      const key2 = exportStep.getCacheKey([], settings2);
      
      expect(key1).not.toBe(key2);
    });

    test('should handle missing output settings in cache key generation', () => {
      const settingsWithoutOutput = { ...mockSettings };
      delete settingsWithoutOutput.outputSettings;

      const key = exportStep.getCacheKey([], settingsWithoutOutput);
      
      expect(typeof key).toBe('string');
      expect(key.length).toBeGreaterThan(0);
    });
  });

  describe('Public API Methods', () => {
    test('should return null export results initially', () => {
      const results = exportStep.getExportResults();
      expect(results).toBeNull();
    });

    test('should return export results after execution', async () => {
      await exportStep.execute([], mockSettings);
      
      const results = exportStep.getExportResults();
      expect(results).toBeTruthy();
      expect(results?.totalCards).toBe(12);
      expect(results?.frontCards).toBe(6);
      expect(results?.backCards).toBe(6);
    });

    test('should clear export results and clean up blob URLs', async () => {
      await exportStep.execute([], mockSettings);
      
      exportStep.clearExportResults();
      
      expect(exportStep.getExportResults()).toBeNull();
      expect(URL.revokeObjectURL).toHaveBeenCalled();
    });

    test('should download fronts file successfully', async () => {
      // Mock DOM methods
      const mockLink = {
        href: '',
        download: '',
        style: { display: '' },
        click: jest.fn()
      };
      const createElement = jest.spyOn(document, 'createElement').mockReturnValue(mockLink as any);
      const appendChild = jest.spyOn(document.body, 'appendChild').mockImplementation();
      const removeChild = jest.spyOn(document.body, 'removeChild').mockImplementation();

      await exportStep.execute([], mockSettings);
      
      const success = exportStep.downloadFile('fronts', 'test-fronts.pdf');
      
      expect(success).toBe(true);
      expect(createElement).toHaveBeenCalledWith('a');
      expect(mockLink.click).toHaveBeenCalled();
      expect(appendChild).toHaveBeenCalledWith(mockLink);
      expect(removeChild).toHaveBeenCalledWith(mockLink);

      createElement.mockRestore();
      appendChild.mockRestore();
      removeChild.mockRestore();
    });

    test('should download backs file successfully', async () => {
      // Mock DOM methods
      const mockLink = {
        href: '',
        download: '',
        style: { display: '' },
        click: jest.fn()
      };
      const createElement = jest.spyOn(document, 'createElement').mockReturnValue(mockLink as any);
      const appendChild = jest.spyOn(document.body, 'appendChild').mockImplementation();
      const removeChild = jest.spyOn(document.body, 'removeChild').mockImplementation();

      await exportStep.execute([], mockSettings);
      
      const success = exportStep.downloadFile('backs', 'test-backs.pdf');
      
      expect(success).toBe(true);
      expect(createElement).toHaveBeenCalledWith('a');
      expect(mockLink.click).toHaveBeenCalled();

      createElement.mockRestore();
      appendChild.mockRestore();
      removeChild.mockRestore();
    });

    test('should fail to download when no export results available', () => {
      const success = exportStep.downloadFile('fronts');
      expect(success).toBe(false);
    });

    test('should fail to download when specific file type not available', async () => {
      // Mock the export to only generate fronts
      const { getAvailableCardIds } = require('../../utils/cardUtils');
      getAvailableCardIds.mockImplementation((cardType: string) => {
        return cardType === 'front' ? [1, 2, 3] : [];
      });

      await exportStep.execute([], mockSettings);
      
      const successFronts = exportStep.downloadFile('fronts');
      const successBacks = exportStep.downloadFile('backs');
      
      expect(successFronts).toBe(true);
      expect(successBacks).toBe(false);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    test('should handle missing page settings gracefully', async () => {
      const settingsWithoutPages = { ...mockSettings };
      delete settingsWithoutPages.pageSettings;

      const result = exportStep.validate(settingsWithoutPages);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'pageSettings',
          code: 'MISSING_PAGE_SETTINGS'
        })
      );
    });

    test('should handle different output formats', async () => {
      const settingsWithCombined = {
        ...mockSettings,
        outputFormat: 'combined' as const
      };

      await exportStep.execute([], settingsWithCombined);
      
      const results = exportStep.getExportResults();
      expect(results).toBeTruthy();
    });

    test('should handle settings with missing extraction settings', async () => {
      const settingsWithoutExtraction = { ...mockSettings };
      delete settingsWithoutExtraction.extractionSettings;

      await expect(exportStep.execute([], settingsWithoutExtraction))
        .resolves.not.toThrow();
    });

    test('should maintain state isolation between instances', async () => {
      const exportStep1 = new ExportStep();
      const exportStep2 = new ExportStep();

      await exportStep1.execute([], mockSettings);
      
      expect(exportStep1.getExportResults()).toBeTruthy();
      expect(exportStep2.getExportResults()).toBeNull();
    });

    test('should handle canvas creation failure in preview', async () => {
      const originalGetContext = global.HTMLCanvasElement.prototype.getContext;
      global.HTMLCanvasElement.prototype.getContext = jest.fn(() => null);

      const preview = await exportStep.generatePreview([], mockSettings);
      
      expect(preview.imageUrl).toBe('data:image/png;base64,mock-base64-data');
      expect(preview.metadata.stepId).toBe('export');

      global.HTMLCanvasElement.prototype.getContext = originalGetContext;
    });

    test('should handle download errors gracefully', async () => {
      const createElement = jest.spyOn(document, 'createElement').mockImplementation(() => {
        throw new Error('DOM error');
      });

      await exportStep.execute([], mockSettings);
      
      const success = exportStep.downloadFile('fronts');
      expect(success).toBe(false);

      createElement.mockRestore();
    });
  });
});
