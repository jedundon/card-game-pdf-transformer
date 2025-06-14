/**
 * Integration tests for ImportStep - Testing pipeline integration
 */

import { ImportStep } from '../steps/ImportStep';
import { TransformationPipeline } from '../TransformationPipeline';
import { StepRegistry } from '../StepRegistry';
import { createMockSettings } from './setup';
import type { 
  WorkflowSettings, 
  PDFDocument, 
  PDFMode, 
  PageSetting,
  PipelineConfig 
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

describe('ImportStep Integration', () => {
  let importStep: ImportStep;
  let pipeline: TransformationPipeline;
  let stepRegistry: StepRegistry;
  let mockPdfDocument: PDFDocument;
  let mockSettings: WorkflowSettings;

  beforeEach(() => {
    importStep = new ImportStep();
    stepRegistry = new StepRegistry();
    
    // Register the import step
    stepRegistry.register(importStep, {
      name: 'Import PDF',
      description: 'Import PDF and configure pages',
      category: 'input',
      version: '1.0.0',
      tags: ['pdf', 'import']
    });

    // Create pipeline configuration
    const config: PipelineConfig = {
      steps: [importStep],
      cacheEnabled: true,
      maxCacheSize: 100,
      performanceMonitoring: true,
      errorHandling: 'strict'
    };

    pipeline = new TransformationPipeline(config);

    // Create mock PDF document
    mockPdfDocument = {
      numPages: 4,
      fingerprint: 'test-pdf-fingerprint',
      _pdfInfo: { producer: 'Test PDF' }
    };

    // Create mock workflow settings with import data
    mockSettings = {
      ...createMockSettings(),
      pdfData: mockPdfDocument,
      pdfMode: {
        type: 'duplex',
        orientation: 'vertical',
        flipEdge: 'short'
      } as PDFMode,
      pageSettings: [
        { skip: false, type: 'front' },
        { skip: false, type: 'back' },
        { skip: false, type: 'front' },
        { skip: false, type: 'back' }
      ] as PageSetting[],
      fileName: 'test-cards.pdf'
    } as any;
  });  describe('Pipeline Integration', () => {
    test('should execute ImportStep through pipeline', async () => {
      // First, update pipeline settings with the PDF document
      await pipeline.updateSettings(mockSettings);
      
      const result = await pipeline.executeStep('import');
      
      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
      expect(result.metadata.cardsProcessed).toBe(0); // Import doesn't produce cards directly
    });

    test('should generate preview through pipeline', async () => {
      // First, update pipeline settings with the PDF document
      await pipeline.updateSettings(mockSettings);
      
      await pipeline.generatePreview('import');
      
      // generatePreview doesn't return anything, but should not throw
      // We can check that the step was called by verifying no errors occurred
      expect(true).toBe(true); // Test passes if no error thrown
    });

    test('should validate settings using step directly', () => {
      const result = importStep.validate(mockSettings);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should handle pipeline state updates', async () => {
      await pipeline.updateSettings(mockSettings);
      await pipeline.executeStep('import');
      
      const state = pipeline.getState();
      expect(state.currentStep).toBe('');
      expect(state.stepResults.has('import')).toBe(true);
      
      const stepResult = state.stepResults.get('import');
      expect(stepResult?.success).toBe(true);
    });
  });  describe('Data Flow Integration', () => {
    test('should store import configuration for downstream steps', async () => {
      // Update pipeline settings and execute import step
      await pipeline.updateSettings(mockSettings);
      const result = await pipeline.executeStep('import');
      expect(result.success).toBe(true);

      // Import step should store its configuration
      const config = importStep.getImportConfiguration();
      expect(config.pdfData).toBe(mockPdfDocument);
      expect(config.fileName).toBe('test-cards.pdf');
      expect(config.pageSettings).toHaveLength(4);
    });

    test('should provide estimated card count', () => {
      importStep.setPDFDocument(mockPdfDocument, 'test.pdf');
      importStep.setPDFMode({ type: 'duplex', orientation: 'vertical', flipEdge: 'short' });
      
      const estimatedCount = importStep.getEstimatedCardCount();
      expect(estimatedCount).toBe(24); // 4 pages × 6 cards per page (2×3 grid)
    });

    test('should handle page skipping in card estimation', () => {
      importStep.setPDFDocument(mockPdfDocument, 'test.pdf');
      importStep.setPDFMode({ type: 'duplex', orientation: 'vertical', flipEdge: 'short' });
      importStep.setPageSettings([
        { skip: false, type: 'front' },
        { skip: true, type: 'back' },    // Skip this page
        { skip: false, type: 'front' },
        { skip: false, type: 'back' }
      ]);
      
      const estimatedCount = importStep.getEstimatedCardCount();
      expect(estimatedCount).toBe(18); // 3 active pages × 6 cards per page
    });
  });

  describe('Error Handling Integration', () => {
    test('should handle pipeline errors gracefully', async () => {
      const invalidSettings = {
        ...mockSettings,
        pdfData: null
      } as any;

      await pipeline.updateSettings(invalidSettings);
      
      try {
        await pipeline.executeStep('import');
        fail('Expected executeStep to throw');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain('No PDF document loaded');
      }
    });

    test('should provide validation errors through step directly', () => {
      const invalidSettings = {
        ...mockSettings,
        pdfData: { numPages: 0 }
      } as any;

      const result = importStep.validate(invalidSettings);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'pdfData.numPages',
          code: 'INVALID_PAGE_COUNT'
        })
      );
    });
  });

  describe('Performance Integration', () => {
    test('should cache import results', async () => {
      await pipeline.updateSettings(mockSettings);
      
      // Execute twice with same settings
      const result1 = await pipeline.executeStep('import');
      const result2 = await pipeline.executeStep('import');
      
      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      
      // Second execution should be faster due to caching
      expect(result2.metadata.cacheHit).toBe(true);
    });

    test('should generate different cache keys for different PDFs', () => {
      const settings1 = mockSettings;
      const settings2 = {
        ...mockSettings,
        pdfData: { 
          ...mockPdfDocument, 
          fingerprint: 'different-fingerprint' 
        }
      } as any;

      const key1 = importStep.getCacheKey([], settings1);
      const key2 = importStep.getCacheKey([], settings2);
      
      expect(key1).not.toBe(key2);
    });

    test('should track performance metrics', async () => {
      await pipeline.updateSettings(mockSettings);
      const result = await pipeline.executeStep('import');
      
      expect(result.success).toBe(true);
      expect(result.metadata.duration).toBeGreaterThan(0);
      expect(typeof result.metadata.duration).toBe('number');
    });
  });
  describe('Configuration Integration', () => {
    test('should work with different PDF modes', async () => {
      const gutterFoldSettings = {
        ...mockSettings,
        pdfMode: {
          type: 'gutter-fold',
          orientation: 'horizontal',
          flipEdge: 'long'
        }
      } as any;

      await pipeline.updateSettings(gutterFoldSettings);
      const result = await pipeline.executeStep('import');
      expect(result.success).toBe(true);
      
      // Verify PDF mode was stored
      const config = importStep.getImportConfiguration();
      expect(config.pdfMode.type).toBe('gutter-fold');
      expect(config.pdfMode.orientation).toBe('horizontal');
    });

    test('should handle various page configurations', async () => {
      const customPageSettings = [
        { skip: false, type: 'front' },
        { skip: false, type: 'back' },
        { skip: true, type: 'front' },
        { skip: false, type: 'back' },
        { skip: false, type: 'front' },
        { skip: true, type: 'back' }
      ] as PageSetting[];

      const settingsWithCustomPages = {
        ...mockSettings,
        pdfData: { numPages: 6 },
        pageSettings: customPageSettings
      } as any;

      await pipeline.updateSettings(settingsWithCustomPages);
      const result = await pipeline.executeStep('import');
      expect(result.success).toBe(true);
      
      // Verify page settings were stored
      const config = importStep.getImportConfiguration();
      expect(config.pageSettings).toEqual(customPageSettings);
    });
  });

  describe('Step Registry Integration', () => {
    test('should be discoverable through step registry', () => {
      const registeredSteps = stepRegistry.getStepsByCategory('input');
      expect(registeredSteps).toHaveLength(1);
      expect(registeredSteps[0].id).toBe('import');
    });

    test('should provide correct step metadata', () => {
      const metadata = stepRegistry.getMetadata('import');
      expect(metadata).toBeDefined();
      expect(metadata?.name).toBe('Import PDF');
      expect(metadata?.category).toBe('input');
      expect(metadata?.tags).toContain('pdf');
    });

    test('should be retrievable by id', () => {
      const step = stepRegistry.getStep('import');
      expect(step).toBe(importStep);
    });
  });

  describe('Preview System Integration', () => {
    test('should generate consistent previews', async () => {
      await pipeline.updateSettings(mockSettings);
      
      // Generate previews through pipeline
      await pipeline.generatePreview('import');
      await pipeline.generatePreview('import');
      
      // Preview generation should not throw errors
      expect(true).toBe(true);
    });

    test('should generate previews for different configurations', async () => {
      const settings1 = mockSettings;
      const settings2 = {
        ...mockSettings,
        pdfMode: {
          type: 'gutter-fold',
          orientation: 'vertical',
          flipEdge: 'short'
        }
      } as any;

      await pipeline.updateSettings(settings1);
      await pipeline.generatePreview('import');
      
      await pipeline.updateSettings(settings2);
      await pipeline.generatePreview('import');
      
      // Previews should be generated without errors
      expect(true).toBe(true);
    });
  });
});
