import { BaseStep } from './BaseStep';
import { 
  ValidationResult, 
  PreviewData,
  WorkflowSettings,
  CardData,
  ValidationError,
  ValidationWarning
} from '../types';
import { DPI_CONSTANTS } from '../../constants';
import { DEFAULT_SETTINGS } from '../../defaults';

export interface ConfigureStepInput {
  pdfData: any;
  pdfMode: any;
  pageSettings: any;
}

export interface ConfigureStepSettings {
  // Configuration-specific settings
  currentCardId: number;
  viewMode: 'front' | 'back';
  showCalibrationWizard: boolean;
  calibrationMeasurements: {
    leftMargin: string;
    rightMargin: string;
    topMargin: string;
    bottomMargin: string;
    cardWidth: string;
    cardHeight: string;
  };
  
  // Legacy settings structure that will be passed through
  extractionSettings: any;
  outputSettings: any;
}

export interface ConfigureStepState {
  cardPreviewUrl: string | null;
  cardPreviewDimensions: { width: number; height: number } | null;
  cardDimensions: {
    widthPx: number;
    heightPx: number;
    widthInches: number;
    heightInches: number;
  } | null;
  availableCardIds: number[];
  totalCards: number;
  isGeneratingPreview: boolean;
  input: ConfigureStepInput | null;
  settings: ConfigureStepSettings;
}

/**
 * ConfigureStep - Handles layout configuration and card dimension calculations
 * 
 * This step manages:
 * - Page size and layout settings
 * - Card dimensions and scaling
 * - Grid configuration
 * - Output format settings
 * - Card rotation settings
 * - Layout previews
 */
export class ConfigureStep extends BaseStep {
  private state: ConfigureStepState;

  constructor() {
    super('configure', 'Configure Layout', 'Configure layout and card dimensions');
    
    this.state = {
      cardPreviewUrl: null,
      cardPreviewDimensions: null,
      cardDimensions: null,
      availableCardIds: [],
      totalCards: 0,
      isGeneratingPreview: false,
      input: null,
      settings: {
        currentCardId: 1,
        viewMode: 'front',
        showCalibrationWizard: false,
        calibrationMeasurements: {
          leftMargin: '',
          rightMargin: '',
          topMargin: '',
          bottomMargin: '',
          cardWidth: '',
          cardHeight: ''
        },
        extractionSettings: DEFAULT_SETTINGS.extractionSettings,
        outputSettings: DEFAULT_SETTINGS.outputSettings
      }
    };
  }
  /**
   * Execute the configure step
   */
  async execute(input: CardData[], _settings: WorkflowSettings): Promise<CardData[]> {
    try {
      // For now, return input cards unchanged
      // Configuration step primarily updates settings rather than transforms data
      return input;
    } catch (error) {
      console.error('Configure step execution failed:', error);
      return [];
    }
  }

  /**
   * Generate preview for the current configuration
   */
  async generatePreview(_input: CardData[], _settings: WorkflowSettings): Promise<PreviewData> {
    try {
      // For configuration step, we generate a layout preview
      // This could be a grid preview showing the card layout
      return {
        imageUrl: '', // TODO: Implement layout preview generation
        thumbnailUrl: '',
        metadata: {
          width: 800,
          height: 600,
          dpi: DPI_CONSTANTS.SCREEN_DPI,
          timestamp: Date.now(),
          stepId: this.id
        }
      };
    } catch (error) {
      console.error('Configure preview generation failed:', error);
      throw error;
    }
  }
  /**
   * Validate step settings
   */
  validate(settings: WorkflowSettings): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Validate grid settings
    if (settings.gridColumns <= 0) {
      errors.push({
        field: 'gridColumns',
        message: 'Grid columns must be greater than 0',
        code: 'INVALID_GRID_COLUMNS'
      });
    }

    if (settings.gridRows <= 0) {
      errors.push({
        field: 'gridRows',
        message: 'Grid rows must be greater than 0',
        code: 'INVALID_GRID_ROWS'
      });
    }

    // Validate card dimensions
    if (settings.cardWidth <= 0) {
      errors.push({
        field: 'cardWidth',
        message: 'Card width must be greater than 0',
        code: 'INVALID_CARD_WIDTH'
      });
    }

    if (settings.cardHeight <= 0) {
      errors.push({
        field: 'cardHeight',
        message: 'Card height must be greater than 0',
        code: 'INVALID_CARD_HEIGHT'
      });
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Update configuration with new input data
   */
  updateInput(input: ConfigureStepInput): void {
    this.state.input = input;
    
    // Recalculate metrics when input changes
    const { totalCards, availableCardIds } = this.calculateCardMetrics(input);
    this.state.totalCards = totalCards;
    this.state.availableCardIds = availableCardIds;
  }

  /**
   * Update settings and trigger recalculation
   */
  updateSettings(newSettings: Partial<ConfigureStepSettings>): void {
    this.state.settings = { ...this.state.settings, ...newSettings };
    
    // Recalculate dimensions if card size settings changed
    if (
      newSettings.outputSettings?.cardSize ||
      newSettings.outputSettings?.cardScalePercent ||
      newSettings.outputSettings?.pageSize
    ) {
      this.state.cardDimensions = this.calculateCardDimensions();
      this.state.isGeneratingPreview = true;
    }
  }

  /**
   * Get current state
   */
  getState(): ConfigureStepState {
    return { ...this.state };
  }

  /**
   * Get current settings in legacy format for other components
   */
  getLegacySettings() {
    return {
      extractionSettings: this.state.settings.extractionSettings,
      outputSettings: this.state.settings.outputSettings,
      cardDimensions: this.state.cardDimensions
    };
  }

  /**
   * Calculate card dimensions based on current settings
   */
  private calculateCardDimensions() {
    const outputSettings = this.state.settings.outputSettings || DEFAULT_SETTINGS.outputSettings;
    const cardSize = outputSettings.cardSize || DEFAULT_SETTINGS.outputSettings.cardSize;
    const scalePercent = outputSettings.cardScalePercent || DEFAULT_SETTINGS.outputSettings.cardScalePercent;
    
    // Calculate scaled card dimensions
    const scaledWidthInches = cardSize.widthInches * (scalePercent / 100);
    const scaledHeightInches = cardSize.heightInches * (scalePercent / 100);
    
    // Convert to pixels at extraction DPI
    const dpi = DPI_CONSTANTS.EXTRACTION_DPI;
    const widthPx = Math.round(scaledWidthInches * dpi);
    const heightPx = Math.round(scaledHeightInches * dpi);
    
    return {
      widthPx,
      heightPx,
      widthInches: scaledWidthInches,
      heightInches: scaledHeightInches
    };
  }

  /**
   * Calculate card metrics (total cards, available IDs)
   */
  private calculateCardMetrics(input: ConfigureStepInput) {
    try {
      if (!input || !input.pdfMode || !input.pageSettings) {
        return { totalCards: 0, availableCardIds: [] };
      }

      const extractionSettings = this.state.settings.extractionSettings || DEFAULT_SETTINGS.extractionSettings;
      const gridRows = extractionSettings.grid?.rows || DEFAULT_SETTINGS.extractionSettings.grid.rows;
      const gridColumns = extractionSettings.grid?.columns || DEFAULT_SETTINGS.extractionSettings.grid.columns;
      
      const cardsPerPage = gridRows * gridColumns;
      const pageCount = Array.isArray(input.pageSettings) ? input.pageSettings.length : 1;
      
      let totalCards = cardsPerPage * pageCount;
      
      // Adjust for duplex/gutter-fold modes
      if (input.pdfMode.type === 'duplex' || input.pdfMode.type === 'gutter-fold') {
        totalCards *= 2; // Front and back cards
      }
      
      // Generate available card IDs (1-based)
      const availableCardIds = Array.from({ length: totalCards }, (_, i) => i + 1);
      
      return { totalCards, availableCardIds };
    } catch (error) {
      console.error('Error calculating card metrics:', error);
      return { totalCards: 0, availableCardIds: [] };
    }
  }
  /**
   * Get step-specific capabilities
   */
  getCapabilities() {
    return {
      supportsLayoutPreview: true,
      supportsCardPreview: true,
      supportsCalibration: true,
      supportsRealTimeUpdates: true
    };
  }
}
