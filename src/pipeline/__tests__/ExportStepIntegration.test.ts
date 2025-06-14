/**
 * @fileoverview Integration tests for ExportStep with pipeline infrastructure
 * Tests the export step's integration with the step registry, pipeline execution,
 * and state management
 */

import { StepRegistry } from '../StepRegistry';
import { TransformationPipeline } from '../TransformationPipeline';
import { ExportStep } from '../steps/ExportStep';
import { createMockSettings } from './setup';
import type { WorkflowSettings, OutputSettings, PipelineConfig } from '../types';
import * as cardUtils from '../../utils/cardUtils';

// Mock external dependencies
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

// Mock jsPDF
jest.mock('jspdf', () => {
  return jest.fn().mockImplementation(() => ({
    addPage: jest.fn(),
    addImage: jest.fn(),
    output: jest.fn(() => 'mock-pdf-blob-data'),
    internal: {
      pageSize: { width: 612, height: 792 }
    }
  }));
});

// Mock canvas
Object.defineProperty(document, 'createElement', {
  writable: true,
  value: jest.fn().mockImplementation((tagName) => {
    if (tagName === 'canvas') {
      const mockCanvas = {
        width: 400,
        height: 300,
        getContext: jest.fn(() => ({
          fillStyle: '',
          lineWidth: 0,
          strokeStyle: '',
          font: '',
          textAlign: '',
          fillRect: jest.fn(),
          strokeRect: jest.fn(),
          beginPath: jest.fn(),
          moveTo: jest.fn(),
          lineTo: jest.fn(),
          stroke: jest.fn(),
          fillText: jest.fn(),
          setLineDash: jest.fn()
        })),
        toDataURL: jest.fn(() => 'data:image/png;base64,mock-base64-data')
      };
      return mockCanvas;
    }
    if (tagName === 'a') {
      return {
        href: '',
        download: '',
        click: jest.fn(),
        style: { display: '' }
      };
    }
    return {};
  })
});

// Mock URL.createObjectURL and revokeObjectURL
global.URL.createObjectURL = jest.fn(() => 'mock-blob-url');
global.URL.revokeObjectURL = jest.fn();

// Helper function to create mock PDF document
const createMockPDFDocument = (fingerprint: string) => ({
  numPages: 4,
  fingerprint,
  _pdfInfo: { producer: 'Test PDF for Export' }
});

describe('ExportStep Integration Tests', () => {
  let stepRegistry: StepRegistry;
  let pipeline: TransformationPipeline;
  let exportStep: ExportStep;
  let mockSettings: WorkflowSettings;
  let mockOutputSettings: OutputSettings;

  beforeEach(() => {
    exportStep = new ExportStep();
    stepRegistry = new StepRegistry();
      // Register the export step
    stepRegistry.register(exportStep, {
      name: 'Export PDF',
      description: 'Generate final PDF output files from processed cards with configured layout settings',
      category: 'output',
      version: '1.0.0',
      tags: ['pdf', 'export', 'output', 'generation']
    });

    // Create pipeline configuration
    const config: PipelineConfig = {
      steps: [exportStep],
      cacheEnabled: true,
      maxCacheSize: 100,
      performanceMonitoring: true,
      errorHandling: 'strict'
    };

    pipeline = new TransformationPipeline(config);
    
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
      pdfData: createMockPDFDocument('test-export-pdf'),
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

  describe('Step Registry Integration', () => {
    test('should register ExportStep in the step registry', () => {
      const registeredStep = stepRegistry.getStep('export');
      
      expect(registeredStep).toBeInstanceOf(ExportStep);
      expect(registeredStep?.id).toBe('export');
      expect(registeredStep?.name).toBe('Export PDF');
    });    test('should have correct step metadata in registry', () => {
      const metadata = stepRegistry.getMetadata('export');
      
      expect(metadata).toBeDefined();
      expect(metadata?.id).toBe('export');
      expect(metadata?.name).toBe('Export PDF');
      expect(metadata?.description).toContain('Generate final PDF output files');
      expect(metadata?.category).toBe('output');
      expect(metadata?.tags).toContain('pdf');
      expect(metadata?.tags).toContain('export');
    });

    test('should find ExportStep in output category', () => {
      const outputSteps = stepRegistry.getStepsByCategory('output');
      const exportStepFound = outputSteps.find(step => step.id === 'export');
      
      expect(exportStepFound).toBeDefined();
      expect(exportStepFound?.name).toBe('Export PDF');
    });

    test('should find ExportStep by tag', () => {
      const exportSteps = stepRegistry.getStepsByTag('export');
      const pdfSteps = stepRegistry.getStepsByTag('pdf');
      
      expect(exportSteps.some(step => step.id === 'export')).toBe(true);
      expect(pdfSteps.some(step => step.id === 'export')).toBe(true);
    });
  });

  describe('Pipeline Integration', () => {
    test('should execute ExportStep through pipeline', async () => {
      // Update pipeline settings first
      await pipeline.updateSettings(mockSettings);
      
      const result = await pipeline.executeStep('export');
      
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      
      // Verify export results are available through ExportStep instance
      const exportResults = exportStep.getExportResults();
      expect(exportResults).not.toBeNull();
      expect(exportResults?.frontsBlob).toBeDefined();
      expect(exportResults?.backsBlob).toBeDefined();
    });    test('should handle pipeline execution with missing settings', async () => {
      const incompleteSettings = { ...mockSettings };
      delete incompleteSettings.outputSettings;
      
      await pipeline.updateSettings(incompleteSettings);
      
      // Pipeline should throw validation error before execution
      await expect(pipeline.executeStep('export')).rejects.toThrow('Step validation failed');
    });

    test('should generate preview through pipeline', async () => {
      await pipeline.updateSettings(mockSettings);
      
      // generatePreview doesn't return anything, but should not throw
      await pipeline.generatePreview('export');
      
      // Test passes if no error thrown
      expect(true).toBe(true);
    });

    test('should validate settings using step directly', () => {
      const validation = exportStep.validate(mockSettings);
      
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    test('should invalidate settings with missing PDF data', () => {
      const invalidSettings = { ...mockSettings };
      delete invalidSettings.pdfData;
      
      const validation = exportStep.validate(invalidSettings);
      
      expect(validation.valid).toBe(false);
      expect(validation.errors.some(error => error.code === 'MISSING_PDF_DATA')).toBe(true);
    });

    test('should handle pipeline state updates', async () => {
      await pipeline.updateSettings(mockSettings);
      await pipeline.executeStep('export');
      
      const state = pipeline.getState();
      expect(state.currentStep).toBe('');
      expect(state.stepResults.has('export')).toBe(true);
      
      const stepResult = state.stepResults.get('export');
      expect(stepResult?.success).toBe(true);
    });
  });

  describe('State Management Integration', () => {
    test('should manage export results state correctly', async () => {
      // Initially no results
      expect(exportStep.getExportResults()).toBeNull();
      
      // Execute to generate results
      await pipeline.updateSettings(mockSettings);
      await pipeline.executeStep('export');
      
      // Results should be available
      const results = exportStep.getExportResults();
      expect(results).not.toBeNull();
      expect(results?.totalCards).toBe(12);
      
      // Clear results
      exportStep.clearExportResults();
      expect(exportStep.getExportResults()).toBeNull();
    });

    test('should handle cache key generation correctly', () => {
      const key1 = exportStep.getCacheKey([], mockSettings);
      const key2 = exportStep.getCacheKey([], { ...mockSettings });
      const key3 = exportStep.getCacheKey([], { 
        ...mockSettings, 
        outputSettings: { 
          ...mockOutputSettings, 
          cardScalePercent: 150 
        }
      });
      
      expect(key1).toBe(key2); // Same settings should produce same key
      expect(key1).not.toBe(key3); // Different settings should produce different key
      expect(key1).toMatch(/^export_/); // Key should have correct prefix
    });

    test('should handle download functionality correctly', async () => {
      // Execute to generate results
      await pipeline.updateSettings(mockSettings);
      await pipeline.executeStep('export');
      
      // Test fronts download
      expect(() => exportStep.downloadFile('fronts')).not.toThrow();
      
      // Test backs download
      expect(() => exportStep.downloadFile('backs')).not.toThrow();
      
      // Test download without results
      exportStep.clearExportResults();
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      exportStep.downloadFile('fronts');
      expect(consoleSpy).toHaveBeenCalledWith('No export results available for download');
      consoleSpy.mockRestore();
    });
  });

  describe('Error Handling Integration', () => {    test('should handle execution errors gracefully through pipeline', async () => {
      const invalidSettings = { ...mockSettings };
      delete invalidSettings.pdfData;
      
      await pipeline.updateSettings(invalidSettings);
      
      // Pipeline should throw validation error before execution
      await expect(pipeline.executeStep('export')).rejects.toThrow('Step validation failed');
    });

    test('should handle validation with malformed settings', () => {
      const malformedSettings = {
        ...mockSettings,
        outputSettings: {
          ...mockOutputSettings,
          pageSize: { width: -1, height: -1 }, // Invalid dimensions
          cardSize: { widthInches: 0, heightInches: 0 } // Invalid card size
        }
      };
      
      const validation = exportStep.validate(malformedSettings);
      
      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });
  });

  describe('End-to-End Workflow Integration', () => {
    test('should complete full export workflow', async () => {
      // 1. Validate settings
      const validation = exportStep.validate(mockSettings);
      expect(validation.valid).toBe(true);
      
      // 2. Update pipeline settings
      await pipeline.updateSettings(mockSettings);
      
      // 3. Execute export
      const result = await pipeline.executeStep('export');
      expect(result.success).toBe(true);
      
      // 4. Verify results
      const exportResults = exportStep.getExportResults();
      expect(exportResults).not.toBeNull();      expect(exportResults?.frontsBlob).toBeTruthy();
      expect(exportResults?.backsBlob).toBeTruthy();
      
      // 5. Test download functionality
      expect(() => exportStep.downloadFile('fronts')).not.toThrow();
      expect(() => exportStep.downloadFile('backs')).not.toThrow();    });    test('should handle front-only export workflow', async () => {
      // Mock getAvailableCardIds to return only front cards
      const mockGetAvailableCardIds = cardUtils.getAvailableCardIds as jest.MockedFunction<typeof cardUtils.getAvailableCardIds>;
      mockGetAvailableCardIds.mockImplementation((viewMode, _totalCards, _pdfMode, _activePages, _cardsPerPage, _extractionSettings) => {
        if (viewMode === 'front') return [1, 2, 3];
        if (viewMode === 'back') return []; // Return empty for back cards
        return [1, 2, 3]; // Default fallback
      });

      const frontOnlySettings: Partial<WorkflowSettings> = {
        ...mockSettings,
        pageSettings: [
          { skip: false, type: 'front' as const },
          { skip: false, type: 'front' as const },
          { skip: false, type: 'front' as const }
        ]
      };
      
      await pipeline.updateSettings(frontOnlySettings);
      const result = await pipeline.executeStep('export');
      
      expect(result.success).toBe(true);
      
      const exportResults = exportStep.getExportResults();
      expect(exportResults?.frontCards).toBe(3);
      expect(exportResults?.backCards).toBe(0);
      
      // Reset mock for other tests
      mockGetAvailableCardIds.mockReset();
      mockGetAvailableCardIds.mockImplementation(() => [1, 2, 3, 4, 5, 6]);
    });

    test('should handle step execution in proper pipeline order', async () => {
      // Test that ExportStep is properly registered and can be found
      expect(stepRegistry.hasStep('export')).toBe(true);
      
      // Test that export step can access required data from settings
      await pipeline.updateSettings(mockSettings);
      const result = await pipeline.executeStep('export');
      expect(result.success).toBe(true);
    });

    test('should handle search and discovery', () => {
      // Test step discovery by search
      const searchResults = stepRegistry.searchSteps('export');
      expect(searchResults.some(step => step.id === 'export')).toBe(true);
      
      const pdfResults = stepRegistry.searchSteps('PDF');
      expect(pdfResults.some(step => step.id === 'export')).toBe(true);
    });
  });
});
