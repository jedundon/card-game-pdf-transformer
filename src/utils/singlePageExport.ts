/**
 * Single-page export utility for generating preview PDFs
 * 
 * Extracts the core export logic from ExportStep to create single-page PDFs
 * with individual cards for testing and preview purposes.
 */

import jsPDF from 'jspdf';
import { 
  getCardInfo, 
  extractCardImageFromCanvas
} from './cardUtils';
import { 
  calculateFinalCardRenderDimensions,
  calculateCardPositioning,
  processCardImageForRendering
} from './renderUtils';
import { 
  applyColorTransformation,
  ColorTransformation,
  hasNonDefaultColorSettings
} from './colorUtils';
import { extractCardImageFromPdfPage } from './pdfCardExtraction';
import { TIMEOUT_CONSTANTS } from '../constants';
import type { 
  PdfMode, 
  ExtractionSettings, 
  OutputSettings,
  MultiFileImportHook,
  PageSettings,
  PageSource
} from '../types';

export interface SinglePageExportOptions {
  cardId: number;
  cardType: 'front' | 'back';
  pdfData?: any;
  pdfMode: PdfMode;
  extractionSettings: ExtractionSettings;
  outputSettings: OutputSettings;
  colorTransformation?: ColorTransformation;
  multiFileImport: MultiFileImportHook;
  activePages: (PageSettings & PageSource)[];
  cardsPerPage: number;
}

/**
 * Generates a single-page PDF containing one card
 * Uses the same rendering logic as the main export for consistency
 */
export async function generateSinglePagePDF(options: SinglePageExportOptions): Promise<Blob> {
  const {
    cardId,
    cardType,
    pdfData,
    pdfMode,
    extractionSettings,
    outputSettings,
    colorTransformation,
    multiFileImport,
    activePages,
    cardsPerPage
  } = options;

  // Validate inputs
  if (!pdfData && (!multiFileImport.multiFileState.files || multiFileImport.multiFileState.files.length === 0)) {
    throw new Error('No files available for export');
  }

  if (activePages.length === 0) {
    throw new Error('No active pages available');
  }

  if (!outputSettings.pageSize || outputSettings.pageSize.width <= 0 || outputSettings.pageSize.height <= 0) {
    throw new Error('Invalid page size settings');
  }

  try {
    console.log(`Starting single-page export for ${cardType} card ${cardId}...`);

    // Find the card index for this card ID and type
    const cardIndex = findCardIndexByIDAndType(cardId, cardType, activePages, extractionSettings, pdfMode, cardsPerPage);
    
    if (cardIndex === null) {
      throw new Error(`Could not find card index for ${cardType} card ID ${cardId}`);
    }

    console.log(`Processing ${cardType} card ${cardId} at index ${cardIndex}...`);

    // Create PDF document
    const doc = new jsPDF({
      orientation: outputSettings.pageSize.width > outputSettings.pageSize.height ? 'landscape' : 'portrait',
      unit: 'in',
      format: [outputSettings.pageSize.width, outputSettings.pageSize.height]
    });

    // Extract the card image
    const cardImageUrl = await extractCardImage(cardIndex, activePages, cardsPerPage, extractionSettings, pdfMode, pdfData, multiFileImport);
    
    if (!cardImageUrl) {
      throw new Error(`Failed to extract card image for ${cardType} card ${cardId}`);
    }

    // Process the card image using unified rendering functions
    const renderDimensions = await Promise.race([
      calculateFinalCardRenderDimensions(cardImageUrl, outputSettings),
      new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error(`Card ${cardId} render calculation timed out`)), TIMEOUT_CONSTANTS.IMAGE_PROCESSING_TIMEOUT)
      )
    ]);

    const positioning = calculateCardPositioning(renderDimensions, outputSettings, cardType);
    
    const processedImage = await Promise.race([
      processCardImageForRendering(cardImageUrl, renderDimensions, positioning.rotation),
      new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error(`Card ${cardId} image processing timed out`)), TIMEOUT_CONSTANTS.IMAGE_PROCESSING_TIMEOUT)
      )
    ]);

    // Apply color transformation if provided
    let finalImageUrl = processedImage.imageUrl;
    const hasColorAdjustments = colorTransformation && hasNonDefaultColorSettings(colorTransformation);
    
    if (hasColorAdjustments) {
      try {
        finalImageUrl = await Promise.race([
          applyColorTransformation(processedImage.imageUrl, colorTransformation!),
          new Promise<never>((_, reject) => 
            setTimeout(() => reject(new Error(`Card ${cardId} color transformation timed out`)), TIMEOUT_CONSTANTS.COLOR_TRANSFORMATION_TIMEOUT)
          )
        ]);
        console.log(`Applied color transformation to ${cardType} card ${cardId}`);
      } catch (error) {
        console.warn(`Failed to apply color transformation to ${cardType} card ${cardId}:`, error);
        // Use original image if color transformation fails
        finalImageUrl = processedImage.imageUrl;
      }
    }

    // Validate final dimensions
    if (positioning.width <= 0 || positioning.height <= 0) {
      throw new Error(`Invalid dimensions for card ${cardId}: ${positioning.width}" × ${positioning.height}"`);
    }

    // Add the card image to PDF
    console.log(`Adding ${cardType} card ${cardId} to PDF at position (${positioning.x.toFixed(2)}", ${positioning.y.toFixed(2)}") with size ${positioning.width.toFixed(2)}" × ${positioning.height.toFixed(2)}"`);
    
    doc.addImage(
      finalImageUrl,
      'PNG',
      positioning.x,
      positioning.y,
      positioning.width,
      positioning.height
    );

    // Generate PDF blob
    console.log(`Single-page PDF generation completed for ${cardType} card ${cardId}`);
    return new Blob([doc.output('arraybuffer')], { type: 'application/pdf' });

  } catch (error) {
    console.error(`Error generating single-page PDF for ${cardType} card ${cardId}:`, error);
    throw error;
  }
}

/**
 * Helper function to find card index by card ID and type
 */
function findCardIndexByIDAndType(
  targetCardID: number, 
  targetCardType: 'front' | 'back',
  activePages: (PageSettings & PageSource)[],
  extractionSettings: ExtractionSettings,
  pdfMode: PdfMode,
  cardsPerPage: number
): number | null {
  const maxIndex = activePages.length * cardsPerPage;
  
  for (let cardIndex = 0; cardIndex < maxIndex; cardIndex++) {
    const cardInfo = getCardInfo(
      cardIndex, 
      activePages, 
      extractionSettings, 
      pdfMode, 
      cardsPerPage, 
      extractionSettings.pageDimensions?.width, 
      extractionSettings.pageDimensions?.height
    );
    
    if (cardInfo.id === targetCardID && cardInfo.type.toLowerCase() === targetCardType) {
      return cardIndex;
    }
  }
  
  return null;
}

/**
 * Helper function to extract card image from appropriate source
 */
async function extractCardImage(
  cardIndex: number,
  activePages: (PageSettings & PageSource)[],
  cardsPerPage: number,
  extractionSettings: ExtractionSettings,
  pdfMode: PdfMode,
  pdfData: any,
  multiFileImport: MultiFileImportHook
): Promise<string | null> {
  // Get current page info to determine extraction method
  const pageIndex = Math.floor(cardIndex / cardsPerPage);
  const currentPageInfo = activePages[pageIndex];
  
  if (!currentPageInfo) {
    throw new Error(`No page info found for page index ${pageIndex}`);
  }

  // Create stable image data map
  const imageDataMap = new Map();
  if (multiFileImport?.multiFileState?.pages) {
    multiFileImport.multiFileState.pages.forEach((page: any) => {
      if (page.fileType === 'image') {
        const imageData = multiFileImport.getImageData(page.fileName);
        if (imageData) {
          imageDataMap.set(page.fileName, imageData);
        }
      }
    });
  }

  // Create stable PDF data map
  const pdfDataMap = new Map();
  if (multiFileImport?.multiFileState?.files) {
    multiFileImport.multiFileState.files.forEach((file: any) => {
      if (file.type === 'pdf') {
        const filePdfData = multiFileImport.getPdfData(file.name);
        if (filePdfData) {
          pdfDataMap.set(file.name, filePdfData);
        }
      }
    });
  }

  if (currentPageInfo.fileType === 'image') {
    // Extract from image file
    const imageData = imageDataMap.get(currentPageInfo.fileName);
    if (!imageData) {
      throw new Error(`No image data found for file: ${currentPageInfo.fileName}`);
    }
    
    return await Promise.race([
      extractCardImageFromCanvas(cardIndex, imageData, pdfMode, activePages, extractionSettings),
      new Promise<null>((_, reject) => 
        setTimeout(() => reject(new Error(`Card ${cardIndex} extraction timed out`)), TIMEOUT_CONSTANTS.CARD_EXTRACTION_TIMEOUT)
      )
    ]);
    
  } else if (currentPageInfo.fileType === 'pdf') {
    // Extract from PDF file
    const filePdfData = pdfDataMap.get(currentPageInfo.fileName) || pdfData;
    if (!filePdfData) {
      throw new Error(`No PDF data available for file ${currentPageInfo.fileName}`);
    }
    
    const cardOnPage = cardIndex % cardsPerPage;
    const actualPageNumber = currentPageInfo.originalPageIndex + 1;
    
    return await Promise.race([
      extractCardImageFromPdfPage(
        filePdfData, 
        actualPageNumber, 
        cardOnPage, 
        extractionSettings,
        cardIndex,
        activePages, 
        pdfMode
      ),
      new Promise<null>((_, reject) => 
        setTimeout(() => reject(new Error(`Card ${cardIndex} extraction timed out`)), TIMEOUT_CONSTANTS.CARD_EXTRACTION_TIMEOUT)
      )
    ]);
    
  } else {
    throw new Error(`Invalid page file type: ${currentPageInfo.fileType}`);
  }
}