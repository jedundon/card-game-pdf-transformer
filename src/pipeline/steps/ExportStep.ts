import { BaseStep } from './BaseStep';
import { 
  CardData, 
  WorkflowSettings, 
  ValidationResult, 
  PreviewData,
  ExportSettings,
  ExportResult,
  OutputSettings
} from '../types';
import { DPI_CONSTANTS } from '../../constants';
import { DEFAULT_SETTINGS } from '../../defaults';
import jsPDF from 'jspdf';
import { 
  getRotationForCardType, 
  getActivePages, 
  calculateTotalCards,
  getAvailableCardIds,
  getCardInfo,
  extractCardImage as extractCardImageUtil,
  calculateCardDimensions
} from '../../utils/cardUtils';

/**
 * ExportStep - Handles PDF export and file generation in the transformation pipeline
 * 
 * This step is responsible for:
 * - Generating PDF files from processed card data
 * - Applying output settings (scale, rotation, positioning)
 * - Supporting multiple output formats (individual, combined)
 * - Creating download-ready PDF blobs
 * - Ensuring exported cards match Configure step previews exactly
 */
export class ExportStep extends BaseStep {
  private exportResults: ExportResult | null = null;

  constructor() {
    super('export', 'Export PDF', 'Generate final PDF output files from processed cards');
  }

  /**
   * Execute the export step - generates PDF files from card data
   */
  async execute(input: CardData[], settings: WorkflowSettings): Promise<CardData[]> {
    try {
      console.log('Starting ExportStep execution...');
      
      // Get export settings
      const exportSettings = this.getExportSettings(settings);
      if (!exportSettings) {
        throw new Error('No export settings provided');
      }

      // Validate that we have the necessary data for export
      if (!settings.pdfData) {
        throw new Error('No PDF data available for export');
      }

      // Generate PDF files
      const exportResult = await this.generateExportFiles(settings, exportSettings);
      
      // Store results for access by UI
      this.exportResults = exportResult;

      console.log('ExportStep execution completed:', {
        totalCards: exportResult.totalCards,
        frontCards: exportResult.frontCards,
        backCards: exportResult.backCards,
        frontsGenerated: !!exportResult.frontsBlob,
        backsGenerated: !!exportResult.backsBlob
      });

      // Export step returns the same input since it generates files as side effects
      return input;
    } catch (error) {
      console.error('ExportStep execution failed:', error);
      throw new Error(`Failed to export PDF files: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate preview showing export layout and settings
   */
  async generatePreview(_input: CardData[], settings: WorkflowSettings): Promise<PreviewData> {
    try {
      const exportSettings = this.getExportSettings(settings);
      
      if (!exportSettings || !settings.pdfData) {
        return this.generatePlaceholderPreview();
      }

      // Create preview canvas showing export layout
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        throw new Error('Unable to create canvas context for preview');
      }

      // Set canvas size based on output page size
      const { outputSettings } = exportSettings;
      const previewScale = 2; // Higher resolution for better preview
      canvas.width = outputSettings.pageSize.width * DPI_CONSTANTS.PDF_DPI * previewScale;
      canvas.height = outputSettings.pageSize.height * DPI_CONSTANTS.PDF_DPI * previewScale;

      // Clear canvas with white background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw page outline
      ctx.strokeStyle = '#e5e7eb';
      ctx.lineWidth = 2;
      ctx.strokeRect(0, 0, canvas.width, canvas.height);

      // Calculate card dimensions and position
      const cardDimensions = calculateCardDimensions(outputSettings);
      const cardX = (outputSettings.pageSize.width - cardDimensions.scaledCardWidthInches) / 2 + outputSettings.offset.horizontal;
      const cardY = (outputSettings.pageSize.height - cardDimensions.scaledCardHeightInches) / 2 + outputSettings.offset.vertical;

      // Convert to canvas coordinates
      const canvasCardX = cardX * DPI_CONSTANTS.PDF_DPI * previewScale;
      const canvasCardY = cardY * DPI_CONSTANTS.PDF_DPI * previewScale;
      const canvasCardWidth = cardDimensions.scaledCardWidthInches * DPI_CONSTANTS.PDF_DPI * previewScale;
      const canvasCardHeight = cardDimensions.scaledCardHeightInches * DPI_CONSTANTS.PDF_DPI * previewScale;

      // Draw card outline
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.strokeRect(canvasCardX, canvasCardY, canvasCardWidth, canvasCardHeight);

      // Draw center lines
      ctx.strokeStyle = '#6b7280';
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 2]);
      
      // Horizontal center line
      ctx.beginPath();
      ctx.moveTo(0, canvas.height / 2);
      ctx.lineTo(canvas.width, canvas.height / 2);
      ctx.stroke();
      
      // Vertical center line
      ctx.beginPath();
      ctx.moveTo(canvas.width / 2, 0);
      ctx.lineTo(canvas.width / 2, canvas.height);
      ctx.stroke();

      // Add labels
      ctx.fillStyle = '#374151';
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'center';
      
      // Page size label
      ctx.fillText(
        `Page: ${outputSettings.pageSize.width}" × ${outputSettings.pageSize.height}"`,
        canvas.width / 2,
        30
      );
      
      // Card size label
      ctx.fillText(
        `Card: ${cardDimensions.scaledCardWidthInches.toFixed(2)}" × ${cardDimensions.scaledCardHeightInches.toFixed(2)}"`,
        canvas.width / 2,
        canvas.height - 20
      );      return {
        imageUrl: canvas.toDataURL('image/png'),
        metadata: {
          width: canvas.width,
          height: canvas.height,
          dpi: DPI_CONSTANTS.PDF_DPI,
          stepId: this.id,
          timestamp: Date.now()
        }
      };
    } catch (error) {
      console.error('Failed to generate export preview:', error);
      return this.generatePlaceholderPreview();
    }
  }

  /**
   * Validate export settings and requirements
   */
  validate(settings: WorkflowSettings): ValidationResult {
    const errors: Array<{ field: string; message: string; code: string }> = [];
    const warnings: Array<{ field: string; message: string; code: string }> = [];

    try {
      // Check if PDF data is available
      if (!settings.pdfData) {
        errors.push({
          field: 'pdfData',
          message: 'No PDF document loaded for export',
          code: 'MISSING_PDF_DATA'
        });
      }

      // Check if page settings exist
      if (!settings.pageSettings || settings.pageSettings.length === 0) {
        errors.push({
          field: 'pageSettings',
          message: 'No page settings configured',
          code: 'MISSING_PAGE_SETTINGS'
        });
      }

      // Get export settings
      const exportSettings = this.getExportSettings(settings);
      if (!exportSettings) {
        errors.push({
          field: 'outputSettings',
          message: 'No output settings configured',
          code: 'MISSING_OUTPUT_SETTINGS'
        });
        return { valid: false, errors, warnings };
      }

      const { outputSettings } = exportSettings;

      // Validate page size
      if (!outputSettings.pageSize || outputSettings.pageSize.width <= 0 || outputSettings.pageSize.height <= 0) {
        errors.push({
          field: 'outputSettings.pageSize',
          message: 'Invalid page size settings',
          code: 'INVALID_PAGE_SIZE'
        });
      }

      // Validate card size
      if (!outputSettings.cardSize || outputSettings.cardSize.widthInches <= 0 || outputSettings.cardSize.heightInches <= 0) {
        errors.push({
          field: 'outputSettings.cardSize',
          message: 'Invalid card size settings',
          code: 'INVALID_CARD_SIZE'
        });
      }

      // Validate card scale
      if (outputSettings.cardScalePercent <= 0 || outputSettings.cardScalePercent > 200) {
        errors.push({
          field: 'outputSettings.cardScalePercent',
          message: 'Card scale must be between 1% and 200%',
          code: 'INVALID_CARD_SCALE'
        });
      }

      // Validate bleed margin
      if (outputSettings.bleedMarginInches < 0 || outputSettings.bleedMarginInches > 1) {
        errors.push({
          field: 'outputSettings.bleedMarginInches',
          message: 'Bleed margin must be between 0 and 1 inch',
          code: 'INVALID_BLEED_MARGIN'
        });
      }

      // Validate offsets
      if (Math.abs(outputSettings.offset.horizontal) > outputSettings.pageSize.width / 2) {
        warnings.push({
          field: 'outputSettings.offset.horizontal',
          message: 'Horizontal offset may cause cards to go off page',
          code: 'LARGE_HORIZONTAL_OFFSET'
        });
      }

      if (Math.abs(outputSettings.offset.vertical) > outputSettings.pageSize.height / 2) {
        warnings.push({
          field: 'outputSettings.offset.vertical',
          message: 'Vertical offset may cause cards to go off page',
          code: 'LARGE_VERTICAL_OFFSET'
        });
      }

      // Check if there are any active pages
      if (settings.pageSettings) {
        const activePages = getActivePages(settings.pageSettings);
        if (activePages.length === 0) {
          errors.push({
            field: 'pageSettings',
            message: 'No active pages selected for export',
            code: 'NO_ACTIVE_PAGES'
          });
        }
      }

      // Validate rotation values
      if (outputSettings.rotation) {
        const validRotations = [0, 90, 180, 270];
        if (!validRotations.includes(outputSettings.rotation.front)) {
          errors.push({
            field: 'outputSettings.rotation.front',
            message: 'Front card rotation must be 0, 90, 180, or 270 degrees',
            code: 'INVALID_FRONT_ROTATION'
          });
        }
        if (!validRotations.includes(outputSettings.rotation.back)) {
          errors.push({
            field: 'outputSettings.rotation.back',
            message: 'Back card rotation must be 0, 90, 180, or 270 degrees',
            code: 'INVALID_BACK_ROTATION'
          });
        }
      }

    } catch (error) {
      errors.push({
        field: 'general',
        message: `Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        code: 'VALIDATION_ERROR'
      });
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  /**
   * Export to PDF files - main export operation
   */
  async exportToPdf(input: {
    pdfData: any;
    pdfMode: any;
    pageSettings: any;
    extractionSettings: any;
    outputSettings: any;
  }): Promise<{
    success: boolean;
    frontsBlob: Blob | null;
    backsBlob: Blob | null;
    metadata: any;
    errors: string[];
  }> {
    try {      // Create workflow settings format expected by the pipeline
      const workflowSettings: WorkflowSettings = {
        pdfData: input.pdfData,
        pdfMode: input.pdfMode,
        pageSettings: input.pageSettings,
        extractionSettings: input.extractionSettings,
        outputSettings: input.outputSettings,
        // Required fields from WorkflowSettings interface
        gridColumns: input.extractionSettings.grid?.columns || 1,
        gridRows: input.extractionSettings.grid?.rows || 1,
        cardWidth: input.outputSettings.cardSize?.widthInches || 2.5,
        cardHeight: input.outputSettings.cardSize?.heightInches || 3.5,
        dpi: input.outputSettings.dpi || 300,
        bleed: input.outputSettings.bleedMarginInches || 0,        inputMode: 'pdf',
        outputFormat: 'individual',
        quality: 0.9
      };

      // Execute the export through the base execute method
      await this.execute([], workflowSettings);
      
      if (!this.exportResults) {
        throw new Error('Export execution failed to produce results');
      }

      return {
        success: true,
        frontsBlob: this.exportResults.frontsBlob,
        backsBlob: this.exportResults.backsBlob,
        metadata: {
          totalCards: this.exportResults.totalCards,
          frontCards: this.exportResults.frontCards,
          backCards: this.exportResults.backCards
        },
        errors: []
      };
    } catch (error) {
      return {
        success: false,
        frontsBlob: null,
        backsBlob: null,
        metadata: {},
        errors: [error instanceof Error ? error.message : 'Unknown export error']
      };
    }
  }

  /**
   * Validate export settings
   */
  validateExportSettings(outputSettings: any): ValidationResult {
    const errors: any[] = [];
    const warnings: any[] = [];

    try {
      // Validate page size
      if (outputSettings.pageSize) {
        if (outputSettings.pageSize.width <= 0) {
          errors.push({
            field: 'pageSize.width',
            message: 'Page width must be greater than 0',
            code: 'INVALID_PAGE_WIDTH'
          });
        }

        if (outputSettings.pageSize.height <= 0) {
          errors.push({
            field: 'pageSize.height',
            message: 'Page height must be greater than 0',
            code: 'INVALID_PAGE_HEIGHT'
          });
        }
      }

      // Validate card size
      if (outputSettings.cardSize) {
        if (outputSettings.cardSize.widthInches <= 0) {
          errors.push({
            field: 'cardSize.widthInches',
            message: 'Card width must be greater than 0',
            code: 'INVALID_CARD_WIDTH'
          });
        }

        if (outputSettings.cardSize.heightInches <= 0) {
          errors.push({
            field: 'cardSize.heightInches',
            message: 'Card height must be greater than 0',
            code: 'INVALID_CARD_HEIGHT'
          });
        }
      }

      // Validate DPI
      if (outputSettings.dpi <= 0) {
        errors.push({
          field: 'dpi',
          message: 'DPI must be greater than 0',
          code: 'INVALID_DPI'
        });
      }

      // Validate scale
      if (outputSettings.scalePercent !== undefined && outputSettings.scalePercent <= 0) {
        errors.push({
          field: 'scalePercent',
          message: 'Scale percent must be greater than 0',
          code: 'INVALID_SCALE'
        });
      }

    } catch (error) {
      errors.push({
        field: 'general',
        message: `Export validation error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        code: 'VALIDATION_ERROR'
      });
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Generate cache key for export results
   */  getCacheKey(_input: CardData[], settings: WorkflowSettings): string {
    const exportSettings = this.getExportSettings(settings);
    const relevantSettings = {
      pdfFingerprint: settings.pdfData?.fingerprint,
      pageSettings: settings.pageSettings,
      pdfMode: settings.pdfMode,
      extractionSettings: settings.extractionSettings,
      outputSettings: exportSettings?.outputSettings,
      exportFormat: exportSettings?.outputFormat
    };
    
    // Use full hash to avoid collisions
    const hash = btoa(JSON.stringify(relevantSettings));
    return `export_${hash}`;
  }

  // Public API methods

  /**
   * Get the export results (PDF blobs and metadata)
   */
  getExportResults(): ExportResult | null {
    return this.exportResults;
  }

  /**
   * Clear cached export results and clean up blob URLs
   */
  clearExportResults(): void {
    if (this.exportResults) {
      // Clean up blob URLs to prevent memory leaks
      if (this.exportResults.frontsBlob) {
        URL.revokeObjectURL(this.exportResults.frontsBlob as any);
      }
      if (this.exportResults.backsBlob) {
        URL.revokeObjectURL(this.exportResults.backsBlob as any);
      }
    }
    this.exportResults = null;
  }

  /**
   * Generate download for a specific file type
   */
  downloadFile(fileType: 'fronts' | 'backs', filename?: string): boolean {
    if (!this.exportResults) {
      console.error('No export results available for download');
      return false;
    }

    const blob = fileType === 'fronts' ? this.exportResults.frontsBlob : this.exportResults.backsBlob;
    if (!blob) {
      console.error(`No ${fileType} PDF available for download`);
      return false;
    }

    try {
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename || `card_${fileType}.pdf`;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      console.log(`Download initiated for ${fileType} PDF`);
      return true;
    } catch (error) {
      console.error(`Error downloading ${fileType} PDF:`, error);
      return false;
    }
  }

  // Private helper methods

  private getExportSettings(settings: WorkflowSettings): ExportSettings | null {
    if (!settings.outputSettings) {
      return null;
    }    return {
      outputSettings: settings.outputSettings,
      outputFormat: (settings.outputFormat === 'individual' || settings.outputFormat === 'combined') 
        ? settings.outputFormat 
        : 'individual',
      exportFilename: settings.exportFilename
    };
  }

  private generatePlaceholderPreview(): PreviewData {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    canvas.width = 400;
    canvas.height = 300;
    
    if (ctx) {
      // Gray background
      ctx.fillStyle = '#f3f4f6';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Placeholder text
      ctx.fillStyle = '#6b7280';
      ctx.font = '16px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Export Preview', canvas.width / 2, canvas.height / 2 - 10);
      ctx.fillText('Configure export settings to see preview', canvas.width / 2, canvas.height / 2 + 15);
    }    return {
      imageUrl: canvas.toDataURL('image/png'),
      metadata: {
        width: canvas.width,
        height: canvas.height,
        dpi: DPI_CONSTANTS.SCREEN_DPI,
        stepId: this.id,
        timestamp: Date.now()
      }
    };
  }

  private async generateExportFiles(settings: WorkflowSettings, exportSettings: ExportSettings): Promise<ExportResult> {
    const { outputSettings } = exportSettings;
    
    // Calculate total cards
    const activePages = getActivePages(settings.pageSettings || []);
    const cardsPerPage = settings.extractionSettings?.grid?.rows * settings.extractionSettings?.grid?.columns || 6;
    const totalCards = calculateTotalCards(settings.pdfMode || DEFAULT_SETTINGS.pdfMode, activePages, cardsPerPage);

    // Generate PDFs
    const [frontsBlob, backsBlob] = await Promise.all([
      this.generatePDF('front', settings, outputSettings, activePages, cardsPerPage),
      this.generatePDF('back', settings, outputSettings, activePages, cardsPerPage)
    ]);

    // Count cards by type
    const frontCardIds = getAvailableCardIds('front', totalCards, settings.pdfMode || DEFAULT_SETTINGS.pdfMode, activePages, cardsPerPage, settings.extractionSettings || DEFAULT_SETTINGS.extractionSettings);
    const backCardIds = getAvailableCardIds('back', totalCards, settings.pdfMode || DEFAULT_SETTINGS.pdfMode, activePages, cardsPerPage, settings.extractionSettings || DEFAULT_SETTINGS.extractionSettings);

    return {
      frontsBlob,
      backsBlob,
      totalCards,
      frontCards: frontCardIds.length,
      backCards: backCardIds.length
    };
  }

  private async generatePDF(
    cardType: 'front' | 'back',
    settings: WorkflowSettings,
    outputSettings: OutputSettings,
    activePages: any[],
    cardsPerPage: number
  ): Promise<Blob | null> {
    if (!settings.pdfData) return null;

    try {
      console.log(`Starting ${cardType} PDF generation...`);
      
      const totalCards = calculateTotalCards(settings.pdfMode || DEFAULT_SETTINGS.pdfMode, activePages, cardsPerPage);
      const cardIds = getAvailableCardIds(
        cardType,
        totalCards,
        settings.pdfMode || DEFAULT_SETTINGS.pdfMode,
        activePages,
        cardsPerPage,
        settings.extractionSettings || DEFAULT_SETTINGS.extractionSettings
      );
      
      console.log(`Available ${cardType} card IDs:`, cardIds);
      
      if (cardIds.length === 0) {
        console.log(`No ${cardType} cards found`);
        return null;
      }

      // Create new PDF document
      const doc = new jsPDF({
        orientation: outputSettings.pageSize.width > outputSettings.pageSize.height ? 'landscape' : 'portrait',
        unit: 'in',
        format: [outputSettings.pageSize.width, outputSettings.pageSize.height]
      });      let cardCount = 0;
      
      console.log(`Processing ${cardIds.length} ${cardType} cards...`);
      
      // Process each card ID that matches the type we're generating
      for (const cardId of cardIds) {
        console.log(`Processing ${cardType} card ID ${cardId}...`);
        
        // Find the card index that corresponds to this card ID
        let cardIndex = -1;
        const maxCardIndex = activePages.length * cardsPerPage;
        
        for (let i = 0; i < maxCardIndex; i++) {
          const cardInfo = getCardInfo(
            i,
            activePages,
            settings.extractionSettings || DEFAULT_SETTINGS.extractionSettings,
            settings.pdfMode || DEFAULT_SETTINGS.pdfMode,
            cardsPerPage
          );
          
          if (cardInfo.id === cardId && cardInfo.type.toLowerCase() === cardType) {
            cardIndex = i;
            break;
          }
        }
        
        if (cardIndex === -1) {
          console.warn(`Could not find card index for ${cardType} card ID ${cardId}`);
          continue;
        }
        
        console.log(`Found ${cardType} card ID ${cardId} at index ${cardIndex}...`);        
        // Extract the card image
        const cardImageUrl = await extractCardImageUtil(
          cardIndex,
          settings.pdfData,
          settings.pdfMode || DEFAULT_SETTINGS.pdfMode,
          activePages,
          settings.pageSettings || [],
          settings.extractionSettings || DEFAULT_SETTINGS.extractionSettings
        );
        
        if (!cardImageUrl) {
          console.warn(`Failed to extract card image for ${cardType} card ID ${cardId}`);
          continue;
        }

        // Create a new page for each card
        if (cardCount > 0) {
          doc.addPage();
        }

        // Calculate card dimensions using output settings
        const cardDimensions = calculateCardDimensions(outputSettings);        // Apply card image sizing and cropping to match the preview exactly
        const sizingMode = outputSettings.cardImageSizingMode || 'actual-size';
        let processedImageUrl = cardImageUrl;
        let finalWidth = cardDimensions.scaledCardWidthInches;
        let finalHeight = cardDimensions.scaledCardHeightInches;
        
        try {
          // Process the image to apply sizing mode with actual cropping/scaling
          processedImageUrl = await this.processCardImageForSizing(
            cardImageUrl,
            cardDimensions.scaledCardWidthInches,
            cardDimensions.scaledCardHeightInches,
            sizingMode
          );
        } catch (error) {
          console.warn(`Failed to process card image sizing for ${cardType} card ID ${cardId}:`, error);
          // Continue with original image
        }

        // Apply rotation if needed
        const rotation = getRotationForCardType(outputSettings, cardType);
        let finalImageUrl = processedImageUrl;
        
        if (rotation !== 0) {
          console.log(`Applying ${rotation}° rotation to ${cardType} card ID ${cardId}`);
          
          try {
            const rotatedResult = await this.rotateImage(cardImageUrl, rotation);
            finalImageUrl = rotatedResult.imageUrl;
            finalWidth = rotatedResult.width;
            finalHeight = rotatedResult.height;
          } catch (error) {
            console.warn(`Failed to apply rotation to ${cardType} card ID ${cardId}:`, error);
          }
        }

        // Calculate position
        const finalX = (outputSettings.pageSize.width - finalWidth) / 2 + outputSettings.offset.horizontal;
        const finalY = (outputSettings.pageSize.height - finalHeight) / 2 + outputSettings.offset.vertical;

        // Warn if card goes off page
        if (finalX < 0 || finalX + finalWidth > outputSettings.pageSize.width) {
          console.warn(`Card ID ${cardId} X position (${finalX.toFixed(3)}") may be off page (width: ${outputSettings.pageSize.width}")`);
        }
        if (finalY < 0 || finalY + finalHeight > outputSettings.pageSize.height) {
          console.warn(`Card ID ${cardId} Y position (${finalY.toFixed(3)}") may be off page (height: ${outputSettings.pageSize.height}")`);
        }

        console.log(`Adding ${cardType} card ID ${cardId} to PDF at position (${finalX.toFixed(2)}", ${finalY.toFixed(2)}") with size ${finalWidth.toFixed(2)}" × ${finalHeight.toFixed(2)}"`);

        // Add the card image to PDF
        doc.addImage(
          finalImageUrl,
          'PNG',
          finalX,
          finalY,
          finalWidth,
          finalHeight
        );

        cardCount++;
      }

      console.log(`${cardType} PDF generation completed with ${cardCount} cards`);

      if (cardCount === 0) return null;

      // Return the PDF as a blob
      return new Blob([doc.output('arraybuffer')], { type: 'application/pdf' });
    } catch (error) {
      console.error(`Error generating ${cardType} PDF:`, error);
      return null;
    }
  }

  private async rotateImage(imageUrl: string, rotation: number): Promise<{ imageUrl: string; width: number; height: number }> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          
          if (!ctx) {
            throw new Error('Unable to create canvas context');
          }

          // Calculate the canvas size needed for rotation
          const radians = (rotation * Math.PI) / 180;
          const cos = Math.abs(Math.cos(radians));
          const sin = Math.abs(Math.sin(radians));
          
          const rotatedCanvasWidth = img.width * cos + img.height * sin;
          const rotatedCanvasHeight = img.width * sin + img.height * cos;
          
          canvas.width = rotatedCanvasWidth;
          canvas.height = rotatedCanvasHeight;
          
          // Clear canvas and setup transformation
          ctx.clearRect(0, 0, rotatedCanvasWidth, rotatedCanvasHeight);
          ctx.save();
          
          // Move to center, rotate, then draw image centered
          ctx.translate(rotatedCanvasWidth / 2, rotatedCanvasHeight / 2);
          ctx.rotate(radians);
          ctx.drawImage(img, -img.width / 2, -img.height / 2);
          
          ctx.restore();
          
          // Calculate final dimensions (swap for 90° or 270° rotations)
          let finalWidth = img.width;
          let finalHeight = img.height;
          if (rotation === 90 || rotation === 270) {
            finalWidth = img.height;
            finalHeight = img.width;
          }
          
          resolve({
            imageUrl: canvas.toDataURL('image/png'),
            width: finalWidth,
            height: finalHeight
          });
        } catch (error) {
          reject(error);
        }
      };
      img.onerror = reject;
      img.src = imageUrl;
    });
  }

  /**
   * Process card image to apply sizing mode with actual cropping/scaling to match preview exactly
   */
  private async processCardImageForSizing(
    cardImageUrl: string,
    targetWidthInches: number,
    targetHeightInches: number,
    sizingMode: 'actual-size' | 'fit-to-card' | 'fill-card' = 'actual-size'
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        try {
          // Get image dimensions
          const imageWidth = img.naturalWidth;
          const imageHeight = img.naturalHeight;
          
          // Convert target dimensions to pixels at extraction DPI
          const targetWidthPx = targetWidthInches * DPI_CONSTANTS.EXTRACTION_DPI;
          const targetHeightPx = targetHeightInches * DPI_CONSTANTS.EXTRACTION_DPI;
          
          // Create canvas for the final processed image
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          
          if (!ctx) {
            throw new Error('Unable to create canvas context');
          }
          
          // Set canvas to target card dimensions
          canvas.width = targetWidthPx;
          canvas.height = targetHeightPx;
          
          // Calculate image dimensions based on sizing mode
          const imageAspectRatio = imageWidth / imageHeight;
          const cardAspectRatio = targetWidthPx / targetHeightPx;
          
          let drawWidth = imageWidth;
          let drawHeight = imageHeight;
          let offsetX = 0;
          let offsetY = 0;
          
          switch (sizingMode) {
            case 'actual-size':
              // Use image at its actual extracted size, centered in card area
              drawWidth = imageWidth;
              drawHeight = imageHeight;
              offsetX = (targetWidthPx - drawWidth) / 2;
              offsetY = (targetHeightPx - drawHeight) / 2;
              break;
              
            case 'fit-to-card':
              // Scale image to fit entirely within card boundaries, maintaining aspect ratio
              if (imageAspectRatio > cardAspectRatio) {
                // Image is wider relative to its height than the card - fit to width
                drawWidth = targetWidthPx;
                drawHeight = targetWidthPx / imageAspectRatio;
                offsetX = 0;
                offsetY = (targetHeightPx - drawHeight) / 2;
              } else {
                // Image is taller relative to its width than the card - fit to height
                drawHeight = targetHeightPx;
                drawWidth = targetHeightPx * imageAspectRatio;
                offsetX = (targetWidthPx - drawWidth) / 2;
                offsetY = 0;
              }
              break;
              
            case 'fill-card':
              // Scale image to fill entire card area, maintaining aspect ratio (may crop edges)
              if (imageAspectRatio > cardAspectRatio) {
                // Image is wider - scale to fill height and crop width
                drawHeight = targetHeightPx;
                drawWidth = targetHeightPx * imageAspectRatio;
                offsetX = (targetWidthPx - drawWidth) / 2; // This will be negative, cropping the sides
                offsetY = 0;
              } else {
                // Image is taller - scale to fill width and crop height
                drawWidth = targetWidthPx;
                drawHeight = targetWidthPx / imageAspectRatio;
                offsetX = 0;
                offsetY = (targetHeightPx - drawHeight) / 2; // This will be negative, cropping top/bottom
              }
              break;
          }
          
          // Clear canvas with white background
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, targetWidthPx, targetHeightPx);
          
          // Draw the image with calculated dimensions and position
          ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);
          
          resolve(canvas.toDataURL('image/png'));
        } catch (error) {
          reject(error);
        }
      };
      img.onerror = reject;
      img.src = cardImageUrl;
    });
  }
}
