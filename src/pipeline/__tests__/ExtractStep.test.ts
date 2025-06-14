/**
 * Unit tests for ExtractStep migration
 */

import { ExtractStep } from '../steps/ExtractStepMigration';
import { CardData, WorkflowSettings } from '../types';

describe('ExtractStep', () => {
  let extractStep: ExtractStep;
  
  beforeEach(() => {
    extractStep = new ExtractStep();
  });

  describe('Constructor and Basic Properties', () => {
    it('should initialize with correct properties', () => {
      expect(extractStep.id).toBe('extract');
      expect(extractStep.name).toBe('Extract Cards');
      expect(extractStep.description).toBe('Extract individual cards from PDF pages');
      expect(extractStep.shouldCache).toBe(true);
    });

    it('should initialize with default state', () => {
      const state = extractStep.getState();
      
      expect(state.renderedPageData).toBeNull();
      expect(state.cardPreviewUrl).toBeNull();
      expect(state.isRendering).toBe(false);
      expect(state.extractedCards).toEqual([]);
      expect(state.cardDimensions).toBeNull();
      expect(state.settings.currentPage).toBe(0);
      expect(state.settings.currentCard).toBe(0);
      expect(state.settings.zoom).toBe(1.0);
      expect(state.settings.selectedCards).toEqual(new Set());
      expect(state.settings.showGrid).toBe(true);
      expect(state.settings.enableSelection).toBe(true);
    });
  });

  describe('Execute Method', () => {
    const sampleCards: CardData[] = [
      {
        id: 'card-1',
        x: 0,
        y: 0,
        width: 100,
        height: 140,
        rotation: 0,
        selected: false,
        extracted: false
      },
      {
        id: 'card-2',
        x: 100,
        y: 0,
        width: 100,
        height: 140,
        rotation: 0,
        selected: false,
        extracted: false
      }
    ];

    const sampleSettings: WorkflowSettings = {
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

    it('should execute successfully and return input cards', async () => {
      const result = await extractStep.execute(sampleCards, sampleSettings);
      
      expect(result).toEqual(sampleCards);
      expect(extractStep.getExtractedCards()).toEqual(sampleCards);
    });

    it('should handle execution errors gracefully', async () => {
      // Force an error by calling with invalid input
      const result = await extractStep.execute(null as any, sampleSettings);
      
      expect(result).toEqual([]);
    });
  });

  describe('Preview Generation', () => {
    const sampleSettings: WorkflowSettings = {
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

    it('should generate preview successfully', async () => {
      const preview = await extractStep.generatePreview([], sampleSettings);
      
      expect(preview.imageUrl).toBe('');
      expect(preview.metadata.width).toBe(800);
      expect(preview.metadata.height).toBe(600);
      expect(preview.metadata.dpi).toBe(300);
    });

    it('should use default DPI when not provided', async () => {
      const settingsWithoutDpi = { ...sampleSettings };
      delete (settingsWithoutDpi as any).dpi;
      
      const preview = await extractStep.generatePreview([], settingsWithoutDpi);
      
      expect(preview.metadata.dpi).toBe(300);
    });
  });

  describe('Validation', () => {
    it('should validate valid settings', () => {
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

      const result = extractStep.validate(validSettings);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.warnings).toEqual([]);
    });

    it('should reject invalid grid columns', () => {
      const invalidSettings: WorkflowSettings = {
        inputMode: 'pdf',
        outputFormat: 'individual',
        dpi: 300,
        quality: 85,
        gridColumns: 0,
        gridRows: 3,
        cardWidth: 2.5,
        cardHeight: 3.5,
        bleed: 0.125
      };

      const result = extractStep.validate(invalidSettings);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual({
        field: 'gridColumns',
        message: 'Grid columns must be greater than 0',
        code: 'INVALID_GRID_COLUMNS'
      });
    });

    it('should reject invalid grid rows', () => {
      const invalidSettings: WorkflowSettings = {
        inputMode: 'pdf',
        outputFormat: 'individual',
        dpi: 300,
        quality: 85,
        gridColumns: 3,
        gridRows: -1,
        cardWidth: 2.5,
        cardHeight: 3.5,
        bleed: 0.125
      };

      const result = extractStep.validate(invalidSettings);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual({
        field: 'gridRows',
        message: 'Grid rows must be greater than 0',
        code: 'INVALID_GRID_ROWS'
      });
    });

    it('should reject invalid DPI', () => {
      const invalidSettings: WorkflowSettings = {
        inputMode: 'pdf',
        outputFormat: 'individual',
        dpi: 0,
        quality: 85,
        gridColumns: 3,
        gridRows: 3,
        cardWidth: 2.5,
        cardHeight: 3.5,
        bleed: 0.125
      };

      const result = extractStep.validate(invalidSettings);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual({
        field: 'dpi',
        message: 'DPI must be greater than 0',
        code: 'INVALID_DPI'
      });
    });
  });

  describe('Navigation Methods', () => {
    it('should navigate to page correctly', () => {
      extractStep.goToPage(5);
      
      const settings = extractStep.getSettings();
      expect(settings.currentPage).toBe(5);
      expect(settings.currentCard).toBe(0); // Should reset card selection
    });

    it('should prevent negative page numbers', () => {
      extractStep.goToPage(-1);
      
      const settings = extractStep.getSettings();
      expect(settings.currentPage).toBe(0);
    });

    it('should navigate to card correctly', () => {
      extractStep.goToCard(3);
      
      const settings = extractStep.getSettings();
      expect(settings.currentCard).toBe(3);
    });

    it('should prevent negative card numbers', () => {
      extractStep.goToCard(-1);
      
      const settings = extractStep.getSettings();
      expect(settings.currentCard).toBe(0);
    });
  });

  describe('Zoom Control', () => {
    it('should set zoom level correctly', () => {
      extractStep.setZoom(2.5);
      
      const settings = extractStep.getSettings();
      expect(settings.zoom).toBe(2.5);
    });

    it('should constrain zoom to minimum value', () => {
      extractStep.setZoom(0.05);
      
      const settings = extractStep.getSettings();
      expect(settings.zoom).toBe(0.1);
    });

    it('should constrain zoom to maximum value', () => {
      extractStep.setZoom(10.0);
      
      const settings = extractStep.getSettings();
      expect(settings.zoom).toBe(5.0);
    });
  });

  describe('UI Toggle Methods', () => {
    it('should toggle grid visibility', () => {
      const initialShowGrid = extractStep.getSettings().showGrid;
      
      extractStep.toggleGrid();
      expect(extractStep.getSettings().showGrid).toBe(!initialShowGrid);
      
      extractStep.toggleGrid();
      expect(extractStep.getSettings().showGrid).toBe(initialShowGrid);
    });

    it('should toggle selection mode', () => {
      const initialEnableSelection = extractStep.getSettings().enableSelection;
      
      extractStep.toggleSelection();
      expect(extractStep.getSettings().enableSelection).toBe(!initialEnableSelection);
      
      extractStep.toggleSelection();
      expect(extractStep.getSettings().enableSelection).toBe(initialEnableSelection);
    });
  });

  describe('Card Selection', () => {
    beforeEach(() => {
      // Set up some extracted cards for selection tests
      const sampleCards: CardData[] = [
        { id: 'card-1', x: 0, y: 0, width: 100, height: 140, rotation: 0, selected: false, extracted: false },
        { id: 'card-2', x: 100, y: 0, width: 100, height: 140, rotation: 0, selected: false, extracted: false },
        { id: 'card-3', x: 200, y: 0, width: 100, height: 140, rotation: 0, selected: false, extracted: false }
      ];
      
      extractStep.execute(sampleCards, {
        inputMode: 'pdf',
        outputFormat: 'individual',
        dpi: 300,
        quality: 85,
        gridColumns: 3,
        gridRows: 3,
        cardWidth: 2.5,
        cardHeight: 3.5,
        bleed: 0.125
      });
    });

    it('should select a card', () => {
      extractStep.selectCard('card-1');
      
      const selectedCards = extractStep.getSettings().selectedCards;
      expect(selectedCards.has('card-1')).toBe(true);
    });

    it('should deselect a selected card', () => {
      extractStep.selectCard('card-1');
      expect(extractStep.getSettings().selectedCards.has('card-1')).toBe(true);
      
      extractStep.selectCard('card-1');
      expect(extractStep.getSettings().selectedCards.has('card-1')).toBe(false);
    });

    it('should select all cards', () => {
      extractStep.selectAllCards();
      
      const selectedCards = extractStep.getSettings().selectedCards;
      expect(selectedCards.has('card-1')).toBe(true);
      expect(selectedCards.has('card-2')).toBe(true);
      expect(selectedCards.has('card-3')).toBe(true);
      expect(selectedCards.size).toBe(3);
    });

    it('should clear all selections', () => {
      extractStep.selectAllCards();
      expect(extractStep.getSettings().selectedCards.size).toBe(3);
      
      extractStep.clearSelection();
      expect(extractStep.getSettings().selectedCards.size).toBe(0);
    });
  });

  describe('Cache Key Generation', () => {
    it('should generate consistent cache keys for identical input', () => {
      const input: CardData[] = [
        { id: 'card-1', x: 0, y: 0, width: 100, height: 140, rotation: 0, selected: false, extracted: false }
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

      const key1 = extractStep.getCacheKey(input, settings);
      const key2 = extractStep.getCacheKey(input, settings);
      
      expect(key1).toBe(key2);
    });

    it('should generate different cache keys for different settings', () => {
      const input: CardData[] = [
        { id: 'card-1', x: 0, y: 0, width: 100, height: 140, rotation: 0, selected: false, extracted: false }
      ];
      
      const settings1: WorkflowSettings = {
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

      const settings2: WorkflowSettings = {
        ...settings1,
        gridColumns: 4
      };

      const key1 = extractStep.getCacheKey(input, settings1);
      const key2 = extractStep.getCacheKey(input, settings2);
      
      expect(key1).not.toBe(key2);
    });
  });

  describe('executeWithInput Method', () => {
    it('should handle extended input interface', async () => {
      const input = {
        pdfData: {},
        pdfMode: { type: 'booklet' },
        pageSettings: [],
        extractionSettings: {}
      };

      const result = await extractStep.executeWithInput(input);
      
      expect(result.stepId).toBe('extract');
      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
      expect(result.errors).toEqual([]);
      expect(result.warnings).toEqual([]);
      expect(result.metadata.cardsProcessed).toBe(0);
      expect(result.metadata.cacheHit).toBe(false);
      expect(typeof result.metadata.duration).toBe('number');
    });
  });
});
