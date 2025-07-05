/**
 * @fileoverview Card Image Export Utilities
 * 
 * Provides functionality to export all extracted card images as a labeled zip file
 * directly from the Extract Step. Supports single PDF files, multi-file workflows,
 * and image files (PNG/JPG) with consistent filename conventions and memory-efficient
 * processing.
 */

import JSZip from 'jszip';
import { 
  extractCardImage,
  extractCardImageFromCanvas,
  getCardInfo,
  getActivePagesWithSource,
  calculateTotalCardsForMixedContent,
  isCardSkipped
} from './cardUtils';
import { extractCardImageFromPdfPage } from './pdfCardExtraction';
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
  extension = 'png'
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
 * Supports both single PDF files and multi-file workflows (PDF + images)
 */
async function extractCardImageData(
  cardIndex: number,
  options: CardImageExportOptions
): Promise<string | null> {
  const { pdfData, pdfMode, extractionSettings, pageSettings, multiFileImport } = options;
  
  // Get unified page data using same logic as ExtractStep
  const unifiedPages = multiFileImport.multiFileState.pages.length > 0
    ? multiFileImport.multiFileState.pages
    : pageSettings.map((page: any, index: number) => ({
        ...page,
        fileName: 'current.pdf',
        fileType: 'pdf' as const,
        originalPageIndex: index,
        displayOrder: index
      }));
  
  const activePages = getActivePagesWithSource(unifiedPages);
  
  const cardsPerPage = extractionSettings.grid.rows * extractionSettings.grid.columns;
  
  try {
    // Check if we're in multi-file mode or single PDF mode
    if (multiFileImport.multiFileState.pages.length > 0) {
      // Multi-file mode: determine file type and use appropriate extraction method
      
      // Calculate which page this card belongs to
      const pageIndex = Math.floor(cardIndex / cardsPerPage);
      
      if (pageIndex >= activePages.length || pageIndex < 0) {
        console.warn(`Invalid page index ${pageIndex} for card ${cardIndex} (activePages.length: ${activePages.length})`);
        return null;
      }
      
      const currentPageInfo = activePages[pageIndex];
      
      if (!currentPageInfo || !currentPageInfo.fileType) {
        console.warn(`Invalid page info for page ${pageIndex}:`, currentPageInfo);
        console.warn(`Multi-file mode: ${multiFileImport.multiFileState.pages.length > 0}`);
        console.warn(`Active pages length: ${activePages.length}`);
        console.warn(`All active pages:`, activePages);
        return null;
      }
      
      if (currentPageInfo.fileType === 'pdf') {
        // Multi-file PDF extraction
        const filePdfData = multiFileImport.getPdfData(currentPageInfo.fileName);
        if (!filePdfData) {
          console.warn(`No PDF data available for file ${currentPageInfo.fileName} on page ${pageIndex}`);
          return null;
        }
        
        // Calculate card position within the page
        const cardOnPage = cardIndex % cardsPerPage;
        // Use the original page index from the current page info (1-based)
        const actualPageNumber = currentPageInfo.originalPageIndex + 1;
        
        try {
          return await extractCardImageFromPdfPage(
            filePdfData,
            actualPageNumber,
            cardOnPage,
            extractionSettings,
            cardIndex, // globalCardIndex
            activePages,
            pdfMode
          );
        } catch (error) {
          console.error(`Failed to extract card ${cardIndex} from PDF page ${actualPageNumber}:`, error);
          return null;
        }
        
      } else if (currentPageInfo.fileType === 'image') {
        // Image file extraction
        const imageData = multiFileImport.getImageData(currentPageInfo.fileName);
        if (!imageData) {
          console.error(`No image data found for file: ${currentPageInfo.fileName}`);
          return null;
        }
        
        try {
          return await extractCardImageFromCanvas(
            cardIndex,
            imageData,
            pdfMode,
            activePages,
            extractionSettings
          );
        } catch (error) {
          console.error(`Failed to extract card ${cardIndex} from image file ${currentPageInfo.fileName}:`, error);
          return null;
        }
        
      } else {
        console.warn(`Unknown file type ${currentPageInfo.fileType} for page ${pageIndex}`);
        return null;
      }
      
    } else if (pdfData) {
      // Single PDF file mode (legacy support)
      return await extractCardImage(
        cardIndex,
        pdfData,
        pdfMode,
        activePages,
        pageSettings,
        extractionSettings
      );
      
    } else {
      console.warn(`No valid data source found for card ${cardIndex}`);
      return null;
    }
    
  } catch (error) {
    console.error(`Failed to extract card ${cardIndex}:`, error);
    return null;
  }
}

/**
 * Get source filename for a card based on its page source
 * Supports both single-file and multi-file workflows
 */
function getSourceFilename(
  cardIndex: number,
  activePages: any[],
  extractionSettings: ExtractionSettings,
  pdfMode: PdfMode,
  cardsPerPage: number
): string {
  try {
    // Calculate which page this card belongs to
    const pageIndex = Math.floor(cardIndex / cardsPerPage);
    
    if (pageIndex >= 0 && pageIndex < activePages.length) {
      const page = activePages[pageIndex];
      
      // For multi-file workflows, use the actual filename from the page
      if (page.fileName) {
        return page.fileName;
      }
      
      // For single-file workflows, try to get filename from page data
      if (page.filename) {
        return page.filename;
      }
      
      // Fallback: generate a descriptive name based on page info
      if (page.fileType === 'pdf') {
        return `pdf-page-${pageIndex + 1}`;
      } else if (page.fileType === 'image') {
        return `image-page-${pageIndex + 1}`;
      }
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
  
  // Get unified page data using same logic as ExtractStep
  const unifiedPages = multiFileImport.multiFileState.pages.length > 0
    ? multiFileImport.multiFileState.pages
    : pageSettings.map((page: any, index: number) => ({
        ...page,
        fileName: 'current.pdf',
        fileType: 'pdf' as const,
        originalPageIndex: index,
        displayOrder: index
      }));
  
  const activePages = getActivePagesWithSource(unifiedPages);
  
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
            const pageIndex = Math.floor(cardIndex / cardsPerPage);
            const cardOnPage = cardIndex % cardsPerPage;
            const gridRow = Math.floor(cardOnPage / extractionSettings.grid.columns);
            const gridCol = cardOnPage % extractionSettings.grid.columns;
            
            if (isCardSkipped(pageIndex, gridRow, gridCol, extractionSettings.skippedCards || [])) {
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
export function downloadZipFile(blob: Blob, baseFilename = 'card-images'): void {
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