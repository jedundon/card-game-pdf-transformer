import { BaseStep } from './BaseStep';
import { 
  CardData, 
  StepResult, 
  ValidationResult, 
  PreviewData,
  WorkflowSettings 
} from '../types';
import { extractCardImage } from '../../utils/cardUtils';

export interface ExtractStepInput {
  pdfData: any;
  pdfMode: any;
  pageSettings: any;
  extractionSettings: any;
  cardIndex?: number; // For single card extraction
  batchExtraction?: boolean; // For extracting all cards
}

export interface ExtractStepSettings {
  currentPage: number;
  currentCard: number;
  zoom: number;
  selectedCards: Set<string>;
  showGrid: boolean;
  enableSelection: boolean;
}

export interface ExtractStepResult extends StepResult {
  cardData?: CardData;
  cardImageUrl?: string;
  cardDimensions?: {
    widthPx: number;
    heightPx: number;
    widthInches: number;
    heightInches: number;
  };
}

export interface ExtractStepState {
  renderedPageData: any;
  cardPreviewUrl: string | null;
  isRendering: boolean;
  extractedCards: CardData[];
  cardDimensions: {
    widthPx: number;
    heightPx: number;
    widthInches: number;
    heightInches: number;
  } | null;
  settings: ExtractStepSettings;
}

export class ExtractStep extends BaseStep {
  private state: ExtractStepState;
  private lastExecutionTime: number = 0;

  constructor() {
    super('extract', 'Extract Cards', 'Extract individual cards from PDF pages');
    
    this.state = {
      renderedPageData: null,
      cardPreviewUrl: null,
      isRendering: false,
      extractedCards: [],
      cardDimensions: null,
      settings: {
        currentPage: 0,
        currentCard: 0,
        zoom: 1.0,
        selectedCards: new Set<string>(),
        showGrid: true,
        enableSelection: true
      }
    };
  }
  async execute(input: CardData[], _settings: WorkflowSettings): Promise<CardData[]> {
    this.lastExecutionTime = Date.now();
    
    try {
      // For now, return input cards unchanged
      // This method is for batch processing all cards
      this.state.extractedCards = input;
      
      return input;
    } catch (error) {
      console.error('Extract step execution failed:', error);
      return [];
    }
  }
  /**
   * Extract a single card image - the main extraction operation
   */
  async extractCard(input: ExtractStepInput): Promise<ExtractStepResult> {
    this.lastExecutionTime = Date.now();
    
    try {
      const { pdfData, pdfMode, pageSettings, extractionSettings, cardIndex } = input;
      
      if (cardIndex === undefined) {
        throw new Error('Card index required for single card extraction');
      }

      // Get active pages for extraction utility
      const { getActivePages } = await import('../../utils/cardUtils');
      const activePages = getActivePages(pageSettings);

      // Use the centralized extraction utility
      const cardImageUrl = await extractCardImage(
        cardIndex,
        pdfData,
        pdfMode,
        activePages,
        pageSettings,
        extractionSettings
      );

      if (!cardImageUrl) {
        throw new Error('Failed to extract card image');
      }

      // Calculate card position in grid
      const cardsPerPage = extractionSettings.grid.rows * extractionSettings.grid.columns;
      const pageIndex = Math.floor(cardIndex / cardsPerPage);
      const positionInPage = cardIndex % cardsPerPage;
      const row = Math.floor(positionInPage / extractionSettings.grid.columns);
      const col = positionInPage % extractionSettings.grid.columns;

      // Create card data matching pipeline CardData interface
      const cardData: CardData = {
        id: `card-${cardIndex}`,
        x: col * (extractionSettings.cardWidth || 100),
        y: row * (extractionSettings.cardHeight || 140),
        width: extractionSettings.cardWidth || 100,
        height: extractionSettings.cardHeight || 140,
        rotation: 0,
        selected: false,
        extracted: true,
        sourcePageIndex: pageIndex,
        extractedImageUrl: cardImageUrl,
        thumbnailUrl: cardImageUrl // For now, use same image
      };

      const result: ExtractStepResult = {
        stepId: this.id,
        success: true,
        data: [cardData],
        cardData,
        cardImageUrl,
        errors: [],
        warnings: [],
        metadata: {
          duration: Date.now() - this.lastExecutionTime,
          cardsProcessed: 1,
          cacheHit: false
        }
      };
      
      return result;
    } catch (error) {
      return {
        stepId: this.id,
        success: false,
        data: [],
        errors: [error instanceof Error ? error.message : 'Unknown extraction error'],
        warnings: [],
        metadata: {
          duration: Date.now() - this.lastExecutionTime,
          cardsProcessed: 0,
          cacheHit: false
        }
      };
    }
  }

  async generatePreview(_input: CardData[], settings: WorkflowSettings): Promise<PreviewData> {
    try {
      // Generate a basic preview structure
      // This will be enhanced as we migrate the preview logic
      return {
        imageUrl: '',
        metadata: {
          width: 800,
          height: 600,
          dpi: settings.dpi || 300
        }
      };
    } catch (error) {
      throw new Error(`Preview generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  validate(settings: WorkflowSettings): ValidationResult {
    const errors: Array<{ field: string; message: string; code: string }> = [];
    const warnings: Array<{ field: string; message: string; code: string }> = [];

    // Basic validation for workflow settings
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

    if (settings.dpi <= 0) {
      errors.push({
        field: 'dpi',
        message: 'DPI must be greater than 0',
        code: 'INVALID_DPI'
      });
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  // Extended API specific to extract step
  public async executeWithInput(_input: ExtractStepInput): Promise<StepResult> {
    this.lastExecutionTime = Date.now();
    
    try {
      // This is where we'll move the existing extraction logic
      // For now, create a basic result structure
      const result: StepResult = {
        stepId: this.id,
        success: true,
        data: [],
        errors: [],
        warnings: [],
        metadata: {
          duration: Date.now() - this.lastExecutionTime,
          cardsProcessed: 0,
          cacheHit: false
        }
      };
      
      return result;
    } catch (error) {
      return {
        stepId: this.id,
        success: false,
        data: [],
        errors: [error instanceof Error ? error.message : 'Unknown extraction error'],
        warnings: [],
        metadata: {
          duration: Date.now() - this.lastExecutionTime,
          cardsProcessed: 0,
          cacheHit: false
        }
      };
    }
  }

  // Navigation helpers for the UI
  public goToPage(pageIndex: number): void {
    this.state.settings.currentPage = Math.max(0, pageIndex);
    this.state.settings.currentCard = 0; // Reset card selection when changing pages
  }

  public goToCard(cardIndex: number): void {
    this.state.settings.currentCard = Math.max(0, cardIndex);
  }

  public setZoom(zoom: number): void {
    this.state.settings.zoom = Math.max(0.1, Math.min(5.0, zoom));
  }

  public toggleGrid(): void {
    this.state.settings.showGrid = !this.state.settings.showGrid;
  }

  public toggleSelection(): void {
    this.state.settings.enableSelection = !this.state.settings.enableSelection;
  }

  public selectCard(cardId: string): void {
    const selection = this.state.settings.selectedCards;
    
    if (selection.has(cardId)) {
      selection.delete(cardId);
    } else {
      selection.add(cardId);
    }
  }

  public selectAllCards(): void {
    const allCardIds = this.state.extractedCards.map(card => card.id);
    this.state.settings.selectedCards = new Set(allCardIds);
  }

  public clearSelection(): void {
    this.state.settings.selectedCards = new Set();
  }

  // State accessors
  public getState(): ExtractStepState {
    return { ...this.state };
  }

  public getSettings(): ExtractStepSettings {
    return { ...this.state.settings };
  }

  public getExtractedCards(): CardData[] {
    return [...this.state.extractedCards];
  }

  public getCardDimensions() {
    return this.state.cardDimensions;
  }

  // Cache key generation
  public getCacheKey(input: CardData[], settings: WorkflowSettings): string {
    const settingsHash = JSON.stringify({
      gridColumns: settings.gridColumns,
      gridRows: settings.gridRows,
      cardWidth: settings.cardWidth,
      cardHeight: settings.cardHeight,
      dpi: settings.dpi,
      bleed: settings.bleed
    });
    
    return `extract-${input.length}-${btoa(settingsHash).slice(0, 8)}`;
  }
}
