/**
 * Integration test for migrating ExtractStep component to use pipeline
 * This demonstrates how the existing component can incrementally adopt the new pipeline
 */

import { ExtractStep } from '../steps/ExtractStepMigration';
import { CardData, WorkflowSettings } from '../types';

describe('ExtractStep Pipeline Integration', () => {
  let pipelineStep: ExtractStep;
  
  beforeEach(() => {
    pipelineStep = new ExtractStep();
  });

  describe('Component Integration Pattern', () => {
    it('should work as a drop-in replacement for existing extraction logic', async () => {
      // Simulate existing component data
      const existingCardData: CardData[] = [
        {
          id: 'page-0-card-0',
          x: 0,
          y: 0,
          width: 250,
          height: 350,
          rotation: 0,
          selected: false,
          extracted: false,
          sourcePageIndex: 0,
          extractedImageUrl: '',
          thumbnailUrl: ''
        },
        {
          id: 'page-0-card-1',
          x: 250,
          y: 0,
          width: 250,
          height: 350,
          rotation: 0,
          selected: false,
          extracted: false,
          sourcePageIndex: 0,
          extractedImageUrl: '',
          thumbnailUrl: ''
        }
      ];

      const workflowSettings: WorkflowSettings = {
        inputMode: 'pdf',
        outputFormat: 'individual',
        dpi: 300,
        quality: 85,
        gridColumns: 3,
        gridRows: 3,
        cardWidth: 2.5,
        cardHeight: 3.5,
        bleed: 0.125
      };

      // Execute through pipeline
      const result = await pipelineStep.execute(existingCardData, workflowSettings);
      
      // Should return the processed cards
      expect(result).toEqual(existingCardData);
      expect(pipelineStep.getExtractedCards()).toEqual(existingCardData);
    });

    it('should provide navigation controls compatible with existing UI', () => {
      // Test navigation methods that existing component can use
      pipelineStep.goToPage(2);
      expect(pipelineStep.getSettings().currentPage).toBe(2);
      expect(pipelineStep.getSettings().currentCard).toBe(0); // Should reset

      pipelineStep.goToCard(5);
      expect(pipelineStep.getSettings().currentCard).toBe(5);

      pipelineStep.setZoom(1.5);
      expect(pipelineStep.getSettings().zoom).toBe(1.5);
    });

    it('should support selection state that existing component can sync with', () => {
      // Set up some extracted cards first
      const cards: CardData[] = [
        { id: 'card-1', x: 0, y: 0, width: 100, height: 140, rotation: 0, selected: false, extracted: false },
        { id: 'card-2', x: 100, y: 0, width: 100, height: 140, rotation: 0, selected: false, extracted: false }
      ];

      pipelineStep.execute(cards, {
        inputMode: 'pdf',
        outputFormat: 'individual',
        dpi: 300,
        quality: 85,
        gridColumns: 2,
        gridRows: 1,
        cardWidth: 2.5,
        cardHeight: 3.5,
        bleed: 0.125
      });

      // Test selection methods
      pipelineStep.selectCard('card-1');
      expect(pipelineStep.getSettings().selectedCards.has('card-1')).toBe(true);

      pipelineStep.selectAllCards();
      expect(pipelineStep.getSettings().selectedCards.size).toBe(2);

      pipelineStep.clearSelection();
      expect(pipelineStep.getSettings().selectedCards.size).toBe(0);
    });

    it('should generate previews compatible with existing preview system', async () => {
      const settings: WorkflowSettings = {
        inputMode: 'pdf',
        outputFormat: 'individual',
        dpi: 300,
        quality: 85,
        gridColumns: 3,
        gridRows: 3,
        cardWidth: 2.5,
        cardHeight: 3.5,
        bleed: 0.125
      };

      const preview = await pipelineStep.generatePreview([], settings);
      
      expect(preview).toHaveProperty('imageUrl');
      expect(preview).toHaveProperty('metadata');
      expect(preview.metadata).toHaveProperty('width');
      expect(preview.metadata).toHaveProperty('height');
      expect(preview.metadata).toHaveProperty('dpi');
    });
  });

  describe('Migration Path Verification', () => {
    it('should validate settings in a way compatible with existing validation', () => {
      const validSettings: WorkflowSettings = {
        inputMode: 'pdf',
        outputFormat: 'individual',
        dpi: 300,
        quality: 85,
        gridColumns: 3,
        gridRows: 3,
        cardWidth: 2.5,
        cardHeight: 3.5,
        bleed: 0.125
      };

      const validation = pipelineStep.validate(validSettings);
      expect(validation.valid).toBe(true);
      expect(validation.errors).toEqual([]);
    });

    it('should handle the extended input format for gradual migration', async () => {
      const extendedInput = {
        pdfData: { /* mock PDF data */ },
        pdfMode: { type: 'booklet', orientation: 'portrait' },
        pageSettings: [
          { skip: false, type: 'front' },
          { skip: false, type: 'back' }
        ],
        extractionSettings: {
          grid: { rows: 3, columns: 3 },
          crop: { left: 0, right: 0, top: 0, bottom: 0 }
        }
      };

      const result = await pipelineStep.executeWithInput(extendedInput);
      
      expect(result.stepId).toBe('extract');
      expect(result.success).toBe(true);
      expect(typeof result.metadata.duration).toBe('number');
    });

    it('should maintain performance characteristics suitable for real-time preview', async () => {
      const startTime = Date.now();
      
      // Test multiple rapid operations like a real-time preview would do
      pipelineStep.setZoom(1.2);
      pipelineStep.goToPage(1);
      pipelineStep.toggleGrid();
      
      const settings: WorkflowSettings = {
        inputMode: 'pdf',
        outputFormat: 'individual',
        dpi: 300,
        quality: 85,
        gridColumns: 3,
        gridRows: 3,
        cardWidth: 2.5,
        cardHeight: 3.5,
        bleed: 0.125
      };
      
      await pipelineStep.generatePreview([], settings);
      
      const duration = Date.now() - startTime;
      
      // Should complete quickly for real-time use
      expect(duration).toBeLessThan(100); // Less than 100ms
    });
  });

  describe('State Management Compatibility', () => {
    it('should provide state that existing component can read and sync with', () => {
      const state = pipelineStep.getState();
      
      // Verify state has expected structure for existing component
      expect(state).toHaveProperty('renderedPageData');
      expect(state).toHaveProperty('cardPreviewUrl');
      expect(state).toHaveProperty('isRendering');
      expect(state).toHaveProperty('extractedCards');
      expect(state).toHaveProperty('cardDimensions');
      expect(state).toHaveProperty('settings');
      
      // Settings should have expected UI state
      expect(state.settings).toHaveProperty('currentPage');
      expect(state.settings).toHaveProperty('currentCard');
      expect(state.settings).toHaveProperty('zoom');
      expect(state.settings).toHaveProperty('selectedCards');
      expect(state.settings).toHaveProperty('showGrid');
      expect(state.settings).toHaveProperty('enableSelection');
    });

    it('should support cache keys for optimization', () => {
      const input: CardData[] = [
        { id: 'test-card', x: 0, y: 0, width: 100, height: 140, rotation: 0, selected: false, extracted: false }
      ];
      
      const settings: WorkflowSettings = {
        inputMode: 'pdf',
        outputFormat: 'individual',
        dpi: 300,
        quality: 85,
        gridColumns: 3,
        gridRows: 3,
        cardWidth: 2.5,
        cardHeight: 3.5,
        bleed: 0.125
      };

      const cacheKey = pipelineStep.getCacheKey(input, settings);
      
      expect(typeof cacheKey).toBe('string');
      expect(cacheKey).toMatch(/^extract-/);
      expect(cacheKey.length).toBeGreaterThan(10);
    });
  });
});
