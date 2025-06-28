import { useMemo } from 'react';
import { getCardInfo } from '../../../utils/cardUtils';
import { DPI_CONSTANTS } from '../../../constants';
import type { PdfData, ExtractionSettings, PdfMode } from '../../../types';

export interface CardDimensions {
  widthPx: number;
  heightPx: number;
  widthInches: number;
  heightInches: number;
  originalWidthPx: number;
  originalHeightPx: number;
  rotation: number;
  cardType: 'front' | 'back';
}

interface UseCardDimensionsParams {
  pdfData: PdfData | null;
  activePages: any[];
  renderedPageData: any;
  extractionSettings: ExtractionSettings;
  pdfMode: PdfMode;
  globalCardIndex: number;
  cardsPerPage: number;
  pageDimensions: { width: number; height: number } | null;
}

/**
 * Calculate card dimensions with rotation effects and gutter-fold support
 * 
 * This hook handles the complex logic of calculating card dimensions across different
 * file types (PDF/image), processing modes (simplex/duplex/gutter-fold), and 
 * rotation settings.
 * 
 * **Key Features:**
 * - Source-aware calculations for PDF vs image files
 * - DPI conversions between screen, extraction, and display contexts
 * - Gutter-fold mode with adjustable gutter width
 * - Individual card cropping support
 * - Rotation effect handling (90°/270° swap width/height)
 * - Comprehensive error handling
 * 
 * @param params - Configuration object with all required calculation parameters
 * @returns Card dimensions object or null if calculation fails
 */
export function useCardDimensions({
  pdfData,
  activePages,
  renderedPageData,
  extractionSettings,
  pdfMode,
  globalCardIndex,
  cardsPerPage,
  pageDimensions
}: UseCardDimensionsParams): CardDimensions | null {
  return useMemo(() => {
    const hasValidDataSource = pdfData || (renderedPageData?.sourceType === 'image');
    if (!hasValidDataSource || !activePages.length || !renderedPageData) {
      return null;
    }

    try {
      // Calculate source dimensions based on file type
      let sourceWidth: number, sourceHeight: number;
      
      if (renderedPageData.sourceType === 'image') {
        // For image files, use pageDimensions directly (source image pixels)
        sourceWidth = pageDimensions?.width || 0;
        sourceHeight = pageDimensions?.height || 0;
      } else {
        // For PDF files, calculate from rendered data and scale
        const extractionScale = DPI_CONSTANTS.EXTRACTION_DPI / DPI_CONSTANTS.SCREEN_DPI;
        sourceWidth = (renderedPageData.width / renderedPageData.previewScale) * extractionScale;
        sourceHeight = (renderedPageData.height / renderedPageData.previewScale) * extractionScale;
      }
      
      // Apply page-level cropping
      const croppedWidth = sourceWidth - extractionSettings.crop.left - extractionSettings.crop.right;
      const croppedHeight = sourceHeight - extractionSettings.crop.top - extractionSettings.crop.bottom;
      
      if (croppedWidth <= 0 || croppedHeight <= 0) {
        return null;
      }

      let cardWidthPx, cardHeightPx;

      // Handle gutter-fold mode with gutter width
      if (pdfMode.type === 'gutter-fold' && (extractionSettings.gutterWidth || 0) > 0) {
        const gutterWidth = extractionSettings.gutterWidth || 0;
        
        if (pdfMode.orientation === 'vertical') {
          const availableWidthForCards = croppedWidth - gutterWidth;
          cardWidthPx = availableWidthForCards / extractionSettings.grid.columns;
          cardHeightPx = croppedHeight / extractionSettings.grid.rows;
        } else {
          const availableHeightForCards = croppedHeight - gutterWidth;
          cardWidthPx = croppedWidth / extractionSettings.grid.columns;
          cardHeightPx = availableHeightForCards / extractionSettings.grid.rows;
        }
      } else {
        // Standard mode
        cardWidthPx = croppedWidth / extractionSettings.grid.columns;
        cardHeightPx = croppedHeight / extractionSettings.grid.rows;
      }

      // Apply individual card crop if specified
      if (extractionSettings.cardCrop) {
        cardWidthPx = Math.max(1, cardWidthPx - (extractionSettings.cardCrop.left || 0) - (extractionSettings.cardCrop.right || 0));
        cardHeightPx = Math.max(1, cardHeightPx - (extractionSettings.cardCrop.top || 0) - (extractionSettings.cardCrop.bottom || 0));
      }

      // Get current card type and rotation for this specific card
      const currentCardInfo = getCardInfo(
        globalCardIndex, 
        activePages, 
        extractionSettings, 
        pdfMode, 
        cardsPerPage,
        pageDimensions?.width,
        pageDimensions?.height
      );
      const currentCardType = currentCardInfo.type.toLowerCase() as 'front' | 'back';
      const currentRotation = extractionSettings.imageRotation?.[currentCardType] || 0;

      // Apply rotation effects to displayed dimensions
      let finalWidthPx = cardWidthPx;
      let finalHeightPx = cardHeightPx;
      
      // For 90° or 270° rotations, swap width and height
      if (currentRotation === 90 || currentRotation === 270) {
        finalWidthPx = cardHeightPx;
        finalHeightPx = cardWidthPx;
      }

      // Convert to inches (300 DPI means 300 pixels per inch)
      const cardWidthInches = finalWidthPx / DPI_CONSTANTS.EXTRACTION_DPI;
      const cardHeightInches = finalHeightPx / DPI_CONSTANTS.EXTRACTION_DPI;

      return {
        widthPx: Math.round(finalWidthPx),
        heightPx: Math.round(finalHeightPx),
        widthInches: cardWidthInches,
        heightInches: cardHeightInches,
        originalWidthPx: Math.round(cardWidthPx),
        originalHeightPx: Math.round(cardHeightPx),
        rotation: currentRotation,
        cardType: currentCardType
      };
    } catch (error) {
      console.error('Error calculating card dimensions:', error);
      return null;
    }
  }, [pdfData, activePages, renderedPageData, extractionSettings, pdfMode, globalCardIndex, cardsPerPage, pageDimensions]);
}