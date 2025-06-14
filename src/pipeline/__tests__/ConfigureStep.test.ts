import { ConfigureStep, ConfigureStepInput, ConfigureStepSettings } from '../steps/ConfigureStep';
import { WorkflowSettings, CardData } from '../types';
import { DEFAULT_SETTINGS } from '../../defaults';

describe('ConfigureStep', () => {
  let configureStep: ConfigureStep;
  let mockInput: ConfigureStepInput;
  let mockSettings: WorkflowSettings;

  beforeEach(() => {
    configureStep = new ConfigureStep();
    
    mockInput = {
      pdfData: { pages: [{ width: 612, height: 792 }] },
      pdfMode: { type: 'duplex', orientation: 'vertical', flipEdge: 'short' },
      pageSettings: [{ pageNumber: 1, selected: true }]
    };

    mockSettings = {
      inputMode: 'pdf',
      outputFormat: 'individual',
      dpi: 300,
      quality: 90,
      gridColumns: 3,
      gridRows: 2,
      cardWidth: 2.5,
      cardHeight: 3.5,
      bleed: 0.125
    };
  });

  describe('Constructor', () => {
    it('should initialize with correct id and name', () => {
      expect(configureStep.id).toBe('configure');
      expect(configureStep.name).toBe('Configure Layout');
    });    it('should initialize with default state', () => {
      const state = configureStep.getState();
      expect(state.settings.currentCardId).toBe(1);
      expect(state.settings.viewMode).toBe('front');
      expect(state.settings.showCalibrationWizard).toBe(false);
      expect(state.cardPreviewUrl).toBeNull();
      expect(state.cardDimensions).toBeNull();
      expect(state.availableCardIds).toEqual([]);
      expect(state.totalCards).toBe(0);
      expect(state.isGeneratingPreview).toBe(false);
    });
  });

  describe('Execute', () => {
    it('should execute successfully and return input cards unchanged', async () => {
      const inputCards = [
        { id: '1', x: 0, y: 0, width: 100, height: 140, rotation: 0, selected: false, extracted: false }
      ];

      const result = await configureStep.execute(inputCards, mockSettings);
      
      expect(result).toEqual(inputCards);
    });    it('should handle execution errors gracefully', async () => {
      const inputCards = [
        { id: '1', x: 0, y: 0, width: 100, height: 140, rotation: 0, selected: false, extracted: false }
      ];

      // Mock console.error to avoid noise in tests
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      // The ConfigureStep doesn't actually throw errors in execute, it returns input unchanged
      // So this test should verify it handles the input properly even with null settings
      const invalidSettings = null as any;
      
      const result = await configureStep.execute(inputCards, invalidSettings);
      
      // ConfigureStep should return input cards unchanged even with invalid settings
      expect(result).toEqual(inputCards);
      
      consoleSpy.mockRestore();
    });
  });

  describe('Generate Preview', () => {    it('should generate preview data successfully', async () => {
      const inputCards: CardData[] = [];
      
      const preview = await configureStep.generatePreview(inputCards, mockSettings);
      
      expect(preview).toBeDefined();
      expect(preview.imageUrl).toBe(''); // TODO: Will be implemented later
      expect(preview.thumbnailUrl).toBe('');
      expect(preview.metadata.width).toBe(800);
      expect(preview.metadata.height).toBe(600);
      expect(preview.metadata.stepId).toBe('configure');
      expect(preview.metadata.timestamp).toBeGreaterThan(0);
    });

    it('should handle preview generation errors', async () => {
      const inputCards: CardData[] = [];
      
      // Mock console.error to avoid noise in tests
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      // Force an error by mocking Date.now to throw
      const originalDateNow = Date.now;
      Date.now = jest.fn(() => { throw new Error('Date error'); });
      
      await expect(configureStep.generatePreview(inputCards, mockSettings)).rejects.toThrow('Date error');
      expect(consoleSpy).toHaveBeenCalledWith('Configure preview generation failed:', expect.any(Error));
      
      // Restore mocks
      Date.now = originalDateNow;
      consoleSpy.mockRestore();
    });
  });

  describe('Validation', () => {
    it('should validate settings successfully', () => {
      const result = configureStep.validate(mockSettings);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });

    it('should detect invalid grid columns', () => {
      const invalidSettings = { ...mockSettings, gridColumns: 0 };
      
      const result = configureStep.validate(invalidSettings);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].field).toBe('gridColumns');
      expect(result.errors[0].message).toBe('Grid columns must be greater than 0');
      expect(result.errors[0].code).toBe('INVALID_GRID_COLUMNS');
    });

    it('should detect invalid grid rows', () => {
      const invalidSettings = { ...mockSettings, gridRows: -1 };
      
      const result = configureStep.validate(invalidSettings);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].field).toBe('gridRows');
      expect(result.errors[0].message).toBe('Grid rows must be greater than 0');
      expect(result.errors[0].code).toBe('INVALID_GRID_ROWS');
    });

    it('should detect invalid card width', () => {
      const invalidSettings = { ...mockSettings, cardWidth: 0 };
      
      const result = configureStep.validate(invalidSettings);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].field).toBe('cardWidth');
      expect(result.errors[0].message).toBe('Card width must be greater than 0');
      expect(result.errors[0].code).toBe('INVALID_CARD_WIDTH');
    });

    it('should detect invalid card height', () => {
      const invalidSettings = { ...mockSettings, cardHeight: -5 };
      
      const result = configureStep.validate(invalidSettings);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].field).toBe('cardHeight');
      expect(result.errors[0].message).toBe('Card height must be greater than 0');
      expect(result.errors[0].code).toBe('INVALID_CARD_HEIGHT');
    });

    it('should detect multiple validation errors', () => {
      const invalidSettings = { 
        ...mockSettings, 
        gridColumns: 0, 
        gridRows: -1, 
        cardWidth: 0, 
        cardHeight: -1 
      };
      
      const result = configureStep.validate(invalidSettings);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(4);
      expect(result.errors.map(e => e.field)).toEqual(['gridColumns', 'gridRows', 'cardWidth', 'cardHeight']);
    });
  });

  describe('Input and Settings Management', () => {
    it('should update input and recalculate metrics', () => {
      configureStep.updateInput(mockInput);
      
      const state = configureStep.getState();
      expect(state.input).toEqual(mockInput);
      expect(state.totalCards).toBeGreaterThan(0);
      expect(state.availableCardIds).toHaveLength(state.totalCards);
    });

    it('should handle input with duplex mode correctly', () => {
      const duplexInput = {
        ...mockInput,
        pdfMode: { type: 'duplex', orientation: 'vertical', flipEdge: 'short' },
        pageSettings: [{ pageNumber: 1, selected: true }, { pageNumber: 2, selected: true }]
      };

      configureStep.updateInput(duplexInput);
      
      const state = configureStep.getState();
      // Duplex mode should double the cards (front and back)
      const expectedCards = 2 * 3 * 2 * 2; // 2 pages * 3 columns * 2 rows * 2 sides
      expect(state.totalCards).toBe(expectedCards);
    });

    it('should handle input with gutter-fold mode correctly', () => {
      const gutterFoldInput = {
        ...mockInput,
        pdfMode: { type: 'gutter-fold', orientation: 'horizontal', flipEdge: 'short' },
        pageSettings: [{ pageNumber: 1, selected: true }]
      };

      configureStep.updateInput(gutterFoldInput);
      
      const state = configureStep.getState();
      // Gutter-fold mode should double the cards (front and back)
      const expectedCards = 1 * 3 * 2 * 2; // 1 page * 3 columns * 2 rows * 2 sides  
      expect(state.totalCards).toBe(expectedCards);
    });

    it('should update settings and trigger recalculation', () => {
      configureStep.updateInput(mockInput);
      
      const newSettings: Partial<ConfigureStepSettings> = {
        outputSettings: {
          ...DEFAULT_SETTINGS.outputSettings,
          cardSize: { widthInches: 3.0, heightInches: 4.0 }
        }
      };

      configureStep.updateSettings(newSettings);
      
      const state = configureStep.getState();
      expect(state.cardDimensions).toBeDefined();
      expect(state.cardDimensions!.widthInches).toBe(3.0);
      expect(state.cardDimensions!.heightInches).toBe(4.0);
    });

    it('should handle invalid input gracefully', () => {
      const invalidInput = {
        pdfData: null,
        pdfMode: null,
        pageSettings: null
      };

      configureStep.updateInput(invalidInput);
      
      const state = configureStep.getState();
      expect(state.totalCards).toBe(0);
      expect(state.availableCardIds).toEqual([]);
    });
  });

  describe('Card Dimension Calculations', () => {
    it('should calculate card dimensions correctly', () => {
      configureStep.updateInput(mockInput);
      
      const settings: Partial<ConfigureStepSettings> = {
        outputSettings: {
          ...DEFAULT_SETTINGS.outputSettings,
          cardSize: { widthInches: 2.5, heightInches: 3.5 },
          cardScalePercent: 100
        }
      };

      configureStep.updateSettings(settings);
      
      const state = configureStep.getState();
      expect(state.cardDimensions).toBeDefined();
      expect(state.cardDimensions!.widthInches).toBe(2.5);
      expect(state.cardDimensions!.heightInches).toBe(3.5);
      expect(state.cardDimensions!.widthPx).toBe(750); // 2.5 * 300 DPI
      expect(state.cardDimensions!.heightPx).toBe(1050); // 3.5 * 300 DPI
    });

    it('should handle card scaling correctly', () => {
      configureStep.updateInput(mockInput);
      
      const settings: Partial<ConfigureStepSettings> = {
        outputSettings: {
          ...DEFAULT_SETTINGS.outputSettings,
          cardSize: { widthInches: 2.5, heightInches: 3.5 },
          cardScalePercent: 50 // 50% scale
        }
      };

      configureStep.updateSettings(settings);
      
      const state = configureStep.getState();
      expect(state.cardDimensions).toBeDefined();
      expect(state.cardDimensions!.widthInches).toBe(1.25); // 2.5 * 0.5
      expect(state.cardDimensions!.heightInches).toBe(1.75); // 3.5 * 0.5
      expect(state.cardDimensions!.widthPx).toBe(375); // 1.25 * 300 DPI
      expect(state.cardDimensions!.heightPx).toBe(525); // 1.75 * 300 DPI
    });
  });

  describe('Legacy Settings Integration', () => {
    it('should provide legacy settings format', () => {
      configureStep.updateInput(mockInput);
      
      const legacySettings = configureStep.getLegacySettings();
      
      expect(legacySettings.extractionSettings).toBeDefined();
      expect(legacySettings.outputSettings).toBeDefined();
      expect(legacySettings.cardDimensions).toBeDefined();
    });

    it('should maintain consistency between settings and state', () => {
      configureStep.updateInput(mockInput);
      
      const state = configureStep.getState();
      const legacySettings = configureStep.getLegacySettings();
      
      expect(legacySettings.extractionSettings).toEqual(state.settings.extractionSettings);
      expect(legacySettings.outputSettings).toEqual(state.settings.outputSettings);
      expect(legacySettings.cardDimensions).toEqual(state.cardDimensions);
    });
  });

  describe('Capabilities', () => {
    it('should return correct capabilities', () => {
      const capabilities = configureStep.getCapabilities();
      
      expect(capabilities.supportsLayoutPreview).toBe(true);
      expect(capabilities.supportsCardPreview).toBe(true);
      expect(capabilities.supportsCalibration).toBe(true);
      expect(capabilities.supportsRealTimeUpdates).toBe(true);
    });
  });

  describe('Error Handling', () => {    it('should handle card metrics calculation errors gracefully', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      // Test with malformed input that might cause errors
      const malformedInput = {
        pdfData: null,
        pdfMode: null,
        pageSettings: null
      };

      configureStep.updateInput(malformedInput);
      
      const state = configureStep.getState();
      expect(state.totalCards).toBe(0);
      expect(state.availableCardIds).toEqual([]);
      // The error won't be logged in this case because we handle null input gracefully
      
      consoleSpy.mockRestore();
    });
  });

  describe('Integration with Pipeline', () => {
    it('should work with real-world settings structure', () => {
      // Test with actual default settings structure
      const realWorldInput = {
        pdfData: { pages: Array(5).fill({ width: 612, height: 792 }) },
        pdfMode: DEFAULT_SETTINGS.pdfMode,
        pageSettings: Array(5).fill(null).map((_, i) => ({ pageNumber: i + 1, selected: true }))
      };

      configureStep.updateInput(realWorldInput);
      
      const settings = {
        extractionSettings: DEFAULT_SETTINGS.extractionSettings,
        outputSettings: DEFAULT_SETTINGS.outputSettings,
        currentCardId: 1,
        viewMode: 'front' as const,
        showCalibrationWizard: false,
        calibrationMeasurements: {
          leftMargin: '',
          rightMargin: '',
          topMargin: '',
          bottomMargin: '',
          cardWidth: '',
          cardHeight: ''
        }
      };

      configureStep.updateSettings(settings);
      
      const state = configureStep.getState();
      const legacySettings = configureStep.getLegacySettings();
      
      expect(state.totalCards).toBeGreaterThan(0);
      expect(state.availableCardIds).toHaveLength(state.totalCards);
      expect(legacySettings.cardDimensions).toBeDefined();
      expect(legacySettings.cardDimensions!.widthInches).toBeGreaterThan(0);
      expect(legacySettings.cardDimensions!.heightInches).toBeGreaterThan(0);
    });
  });
});
