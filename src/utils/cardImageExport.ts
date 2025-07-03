/**
 * @fileoverview Card Image Export Utilities
 * 
 * Provides functionality to export all extracted card images as a labeled zip file
 * directly from the Extract Step. Supports both PDF and image file sources with
 * consistent filename conventions and memory-efficient processing.
 */

import JSZip from 'jszip';
import { 
  extractCardImage,
  getCardInfo,
  getActivePagesWithSource,
  calculateTotalCardsForMixedContent,
  isCardSkipped
} from './cardUtils';
import type { 
  PdfData, 
  PdfMode, 
  ExtractionSettings, 
  PageSettings,
  MultiFileImportHook
} from '../types';

export interface CardImageExportOptions {
  pdfData?: PdfData | null;
  pdfMode: PdfMode;
  extractionSettings: ExtractionSettings;
  pageSettings: PageSettings[];
  multiFileImport: MultiFileImportHook;
  onProgress?: (progress: number, message: string) => void;
  onError?: (error: Error) => void;
}

export interface ExportedCard {
  cardId: number;
  cardType: 'front' | 'back';
  filename: string;
  imageData: string;
  sourceFile: string;
}

/**
 * Generate filename for exported card following the convention:
 * {front/back}_{cardID}_{originalFilename}.{extension}
 */
function generateCardFilename(
  cardId: number,
  cardType: 'front' | 'back',
  originalFilename: string,
  extension: string = 'png'
): string {
  // Clean the original filename by removing extension and invalid characters
  const cleanFilename = originalFilename
    .replace(/\.[^/.]+$/, '') // Remove extension
    .replace(/[^a-zA-Z0-9-_]/g, '-') // Replace invalid chars with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single
    .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens
  
  // Format card ID with leading zeros (e.g., "01", "02", "123")
  const formattedCardId = String(cardId).padStart(2, '0');
  
  return `${cardType}_${formattedCardId}_${cleanFilename}.${extension}`;
}

/**
 * Extract image data from card using appropriate extraction method
 */
async function extractCardImageData(
  cardIndex: number,
  options: CardImageExportOptions
): Promise<string | null> {
  const { pdfData, pdfMode, extractionSettings, pageSettings, multiFileImport } = options;
  
  // Get active pages with source information
  const activePages = getActivePagesWithSource(pageSettings, multiFileImport);
  
  try {
    // For single PDF files
    if (pdfData) {
      return await extractCardImage(
        cardIndex,
        pdfData,
        pdfMode,
        activePages,
        pageSettings,
        extractionSettings
      );
    }
    
    // TODO: For multi-file sources or image files, implement proper canvas-based extraction
    // For now, skip multi-file sources until we can properly implement the extraction
    console.warn(`Multi-file card extraction not yet supported for export. Skipping card ${cardIndex}.`);
    return null;
  } catch (error) {
    console.error(`Failed to extract card ${cardIndex}:`, error);
    return null;
  }
}

/**
 * Get source filename for a card based on its page source
 */
function getSourceFilename(
  cardIndex: number,
  activePages: any[],
  extractionSettings: ExtractionSettings,
  pdfMode: PdfMode,
  cardsPerPage: number
): string {
  try {
    const cardInfo = getCardInfo(
      cardIndex,
      activePages,
      extractionSettings,
      pdfMode,
      cardsPerPage
    );
    
    // Get page info from card index and cards per page
    const pageIndex = Math.floor(cardIndex / cardsPerPage);
    if (cardInfo && pageIndex >= 0 && pageIndex < activePages.length) {
      const page = activePages[pageIndex];
      return page.fileName || 'unknown-file';
    }
  } catch (error) {
    console.error(`Failed to get source filename for card ${cardIndex}:`, error);
  }
  
  return 'unknown-file';
}

/**
 * Export all extracted cards as individual PNG images in a zip file
 */
export async function exportCardImagesAsZip(
  options: CardImageExportOptions
): Promise<Blob> {
  const { 
    pdfMode, 
    extractionSettings, 
    pageSettings, 
    multiFileImport,
    onProgress,
    onError
  } = options;
  
  const zip = new JSZip();
  const activePages = getActivePagesWithSource(pageSettings, multiFileImport);
  const cardsPerPage = extractionSettings.grid.rows * extractionSettings.grid.columns;
  const totalCards = calculateTotalCardsForMixedContent(activePages, pdfMode, cardsPerPage);
  
  let processedCards = 0;
  let successfulExports = 0;
  const failedCards: number[] = [];
  
  onProgress?.(0, 'Starting card image export...');
  
  try {
    // Process cards in batches to manage memory usage
    const batchSize = 5; // Process 5 cards at a time
    
    for (let batchStart = 0; batchStart < totalCards; batchStart += batchSize) {
      const batchEnd = Math.min(batchStart + batchSize, totalCards);
      const batchPromises: Promise<void>[] = [];
      
      for (let cardIndex = batchStart; cardIndex < batchEnd; cardIndex++) {
        batchPromises.push(async function processCard() {
          try {
            // Check if card is skipped
            if (isCardSkipped(cardIndex, extractionSettings.skippedCards || [])) {
              processedCards++;
              onProgress?.(
                (processedCards / totalCards) * 100,
                `Skipping card ${cardIndex + 1}/${totalCards} (marked as skipped)`
              );
              return;
            }
            
            // Get card information
            const cardInfo = getCardInfo(
              cardIndex,
              activePages,
              extractionSettings,
              pdfMode,
              cardsPerPage
            );
            
            if (!cardInfo || cardInfo.type === 'Unknown') {
              failedCards.push(cardIndex);
              processedCards++;
              return;
            }
            
            // Convert card type to simplified format
            const cardType = cardInfo.type.toLowerCase() as 'front' | 'back';
            
            onProgress?.(
              (processedCards / totalCards) * 100,
              `Processing ${cardType} card ${cardInfo.id}/${totalCards}...`
            );
            
            // Extract card image
            const imageData = await extractCardImageData(cardIndex, options);
            
            if (imageData) {
              // Generate filename
              const sourceFilename = getSourceFilename(
                cardIndex, 
                activePages, 
                extractionSettings, 
                pdfMode, 
                cardsPerPage
              );
              
              const filename = generateCardFilename(
                cardInfo.id,
                cardType,
                sourceFilename
              );
              
              // Convert data URL to blob and add to zip
              const base64Data = imageData.split(',')[1];
              zip.file(filename, base64Data, { base64: true });
              
              successfulExports++;
            } else {
              failedCards.push(cardIndex);
            }
            
            processedCards++;
            onProgress?.(
              (processedCards / totalCards) * 100,
              `Processed ${processedCards}/${totalCards} cards`
            );
            
          } catch (error) {
            console.error(`Error processing card ${cardIndex}:`, error);
            failedCards.push(cardIndex);
            processedCards++;
          }
        }());
      }
      
      // Wait for current batch to complete before starting next batch
      await Promise.all(batchPromises);
      
      // Small delay to prevent UI blocking
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    
    // Add summary file if there were any failures
    if (failedCards.length > 0) {
      const summaryContent = [
        'Card Image Export Summary',
        '=' .repeat(30),
        '',
        `Total cards processed: ${totalCards}`,
        `Successful exports: ${successfulExports}`,
        `Failed exports: ${failedCards.length}`,
        '',
        'Failed card indices:',
        ...failedCards.map(index => `- Card ${index + 1}`)
      ].join('\n');
      
      zip.file('export-summary.txt', summaryContent);
    }
    
    onProgress?.(95, 'Generating zip file...');
    
    // Generate zip file
    const zipBlob = await zip.generateAsync({
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: {
        level: 6 // Balanced compression
      }
    });
    
    onProgress?.(100, `Export complete! ${successfulExports} cards exported successfully.`);
    
    return zipBlob;
    
  } catch (error) {
    const exportError = error instanceof Error ? error : new Error(String(error));
    onError?.(exportError);
    throw exportError;
  }
}

/**
 * Download zip file with automatic filename generation
 */
export function downloadZipFile(blob: Blob, baseFilename: string = 'card-images'): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  
  // Generate filename with timestamp
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  const filename = `${baseFilename}-${timestamp}.zip`;
  
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  // Clean up object URL
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Complete card image export workflow with download
 */
export async function exportAndDownloadCardImages(
  options: CardImageExportOptions,
  baseFilename?: string
): Promise<void> {
  try {
    const zipBlob = await exportCardImagesAsZip(options);
    downloadZipFile(zipBlob, baseFilename);
  } catch (error) {
    console.error('Card image export failed:', error);
    throw error;
  }
}