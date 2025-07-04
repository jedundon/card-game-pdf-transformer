import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import { AddFilesButton } from './AddFilesButton';
import { CardImageExportButton } from './shared/CardImageExportButton';
import { 
  getActivePagesWithSource,
  getCardInfo, 
  extractCardImageFromCanvas
} from '../utils/cardUtils';
import { extractCardImageFromPdfPage } from '../utils/pdfCardExtraction';
import type { ExtractStepProps } from '../types';
import { useCardDimensions } from './ExtractStep/hooks/useCardDimensions';
import { GridSettings } from './ExtractStep/components/GridSettings';
import { GutterSettings } from './ExtractStep/components/GutterSettings';
import { PageCropSettings } from './ExtractStep/components/PageCropSettings';
import { CardSkipControls } from './ExtractStep/components/CardSkipControls';
import { CardTypeOverrideControls } from './ExtractStep/components/CardTypeOverrideControls';
import { PagePreviewPanel } from './ExtractStep/components/PagePreviewPanel';
import { CardPreviewPanel } from './ExtractStep/components/CardPreviewPanel';
import { IndividualCardSettings } from './ExtractStep/components/IndividualCardSettings';

export const ExtractStep: React.FC<ExtractStepProps> = ({
  pdfData,
  pdfMode,
  pageSettings,
  extractionSettings,
  multiFileImport,
  onSettingsChange,
  onCardDimensionsChange,
  onPrevious,
  onNext
}) => {
  
  const [currentPage, setCurrentPage] = useState(0);
  const [currentCard, setCurrentCard] = useState(0);
  const [zoom, setZoom] = useState(1.0);
  const [renderedPageData, setRenderedPageData] = useState<any>(null);
  const [pageDimensions, setPageDimensions] = useState<{ width: number; height: number } | null>(null);
  const renderingRef = useRef(false);
  
  // Unified page data handling for both single PDF and multi-file sources
  const unifiedPages = useMemo(() => {
    if (multiFileImport.multiFileState.pages.length > 0) {
      // Multi-file mode: use pages from multi-file import with source information
      return multiFileImport.multiFileState.pages;
    } else if (pageSettings.length > 0) {
      // Single PDF mode: convert pageSettings to unified format
      return pageSettings.map((page: any, index: number) => ({
        ...page,
        fileName: 'current.pdf', // Default filename for single PDF mode
        fileType: 'pdf' as const,
        originalPageIndex: index,
        displayOrder: index
      }));
    } else {
      // No data available
      return [];
    }
  }, [multiFileImport.multiFileState.pages, pageSettings]);
  
  
  const activePages = useMemo(() => 
    getActivePagesWithSource(unifiedPages), 
    [unifiedPages]
  );
  const cardsPerPage = extractionSettings.grid.rows * extractionSettings.grid.columns;
  // Calculate the global card index from current page and card
  const globalCardIndex = currentPage * cardsPerPage + currentCard;
  
  // Get current card info (type and ID) for display
  const { type: cardType, id: cardId } = getCardInfo(
    globalCardIndex, 
    activePages, 
    extractionSettings, 
    pdfMode, 
    cardsPerPage,
    pageDimensions?.width,
    pageDimensions?.height
  );

  // Calculate card dimensions for display with rotation effects
  const cardDimensions = useCardDimensions({
    pdfData,
    activePages,
    renderedPageData,
    extractionSettings,
    pdfMode,
    globalCardIndex,
    cardsPerPage,
    pageDimensions
  });

  // Notify parent component when card dimensions change (memoized to prevent loops)
  const handleCardDimensionsChange = useCallback(() => {
    onCardDimensionsChange(cardDimensions);
  }, [cardDimensions, onCardDimensionsChange]);
  
  useEffect(() => {
    handleCardDimensionsChange();
  }, [handleCardDimensionsChange]);

  // Create a stable reference to image data map to prevent dependency issues
  const imageDataMap = useMemo(() => {
    const map = new Map();
    if (multiFileImport?.multiFileState?.pages) {
      multiFileImport.multiFileState.pages.forEach((page: any) => {
        if (page.fileType === 'image') {
          const imageData = multiFileImport.getImageData(page.fileName);
          if (imageData) {
            map.set(page.fileName, imageData);
          }
        }
      });
    }
    return map;
  }, [multiFileImport]);
  
  // Get image data from stable map
  const getImageData = useCallback((fileName: string) => {
    return imageDataMap.get(fileName);
  }, [imageDataMap]);
  
  // Create a stable reference to PDF data map to prevent dependency issues
  const pdfDataMap = useMemo(() => {
    const map = new Map();
    if (multiFileImport?.multiFileState?.pages) {
      multiFileImport.multiFileState.pages.forEach((page: any) => {
        if (page.fileType === 'pdf') {
          const pdfData = multiFileImport.getPdfData(page.fileName);
          if (pdfData) {
            map.set(page.fileName, pdfData);
          }
        }
      });
    }
    return map;
  }, [multiFileImport]);
  
  // Get PDF data from stable map
  const getPdfData = useCallback((fileName: string) => {
    return pdfDataMap.get(fileName);
  }, [pdfDataMap]);
  
  // Extract individual card using source-aware logic
  const extractCardImage = useCallback(async (cardIndex: number): Promise<string | null> => {
    // Calculate which page this card belongs to
    const cardsPerPage = extractionSettings.grid.rows * extractionSettings.grid.columns;
    const pageIndex = Math.floor(cardIndex / cardsPerPage);
    
    if (pageIndex >= activePages.length || pageIndex < 0) {
      console.warn(`ExtractStep: Invalid page index ${pageIndex} for card ${cardIndex} (activePages.length: ${activePages.length})`);
      return null;
    }
    
    const currentPageInfo = activePages[pageIndex];
    
    if (!currentPageInfo || !currentPageInfo.fileType) {
      console.warn(`ExtractStep: Invalid page info for page ${pageIndex}:`, currentPageInfo);
      return null;
    }
    
    if (currentPageInfo.fileType === 'pdf') {
      // Get the correct PDF data for this specific file
      const filePdfData = getPdfData(currentPageInfo.fileName);
      if (!filePdfData) {
        console.warn(`ExtractStep: No PDF data available for file ${currentPageInfo.fileName} on page ${pageIndex}`);
        return null;
      }
      
      // For multi-file scenarios, calculate the card extraction directly
      const cardsPerPage = extractionSettings.grid.rows * extractionSettings.grid.columns;
      const cardOnPage = cardIndex % cardsPerPage;
      
      // Use the original page index from the current page info
      const actualPageNumber = currentPageInfo.originalPageIndex + 1;
      
      try {
        // Extract the card directly using the file-specific PDF data and page number
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
      // Use image extraction
      const imageData = getImageData(currentPageInfo.fileName);
      if (!imageData) {
        console.error(`No image data found for file: ${currentPageInfo.fileName}`);
        return null;
      }
      return await extractCardImageFromCanvas(cardIndex, imageData, pdfMode, activePages, extractionSettings);
    }
    
    console.warn(`ExtractStep: Unknown file type ${currentPageInfo.fileType} for page ${pageIndex}`);
    return null;
  }, [extractionSettings, pdfMode, activePages, getPdfData, getImageData]);

  const handleCropChange = (edge: string, value: number) => {
    const newSettings = {
      ...extractionSettings,
      crop: {
        ...extractionSettings.crop,
        [edge]: value
      }
    };
    onSettingsChange(newSettings);
  };
  
  const handleGridChange = (dimension: string, value: number) => {
    const newSettings = {
      ...extractionSettings,
      grid: {
        ...extractionSettings.grid,
        [dimension]: value
      }
    };
    onSettingsChange(newSettings);
  };

  const handleGutterWidthChange = (value: number) => {
    const newSettings = {
      ...extractionSettings,
      gutterWidth: value
    };
    onSettingsChange(newSettings);
  };

  // Update extractionSettings with pageDimensions when they become available
  useEffect(() => {
    if (pageDimensions && 
        (!extractionSettings.pageDimensions || 
         extractionSettings.pageDimensions.width !== pageDimensions.width ||
         extractionSettings.pageDimensions.height !== pageDimensions.height)) {
      const newSettings = {
        ...extractionSettings,
        pageDimensions: { ...pageDimensions }
      };
      onSettingsChange(newSettings);
    }
  }, [pageDimensions, extractionSettings, onSettingsChange]);


  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-800">Extract Cards</h2>
        
        {/* Add Files button */}
        <AddFilesButton 
          multiFileImport={multiFileImport}
          variant="subtle"
          size="sm"
        />
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <PageCropSettings
            crop={extractionSettings.crop}
            pdfMode={pdfMode}
            gutterWidth={extractionSettings.gutterWidth}
            onCropChange={handleCropChange}
          />

          <GridSettings
            grid={extractionSettings.grid}
            onGridChange={handleGridChange}
          />

          <GutterSettings
            pdfMode={pdfMode}
            gutterWidth={extractionSettings.gutterWidth || 0}
            onGutterWidthChange={handleGutterWidthChange}
          />

          <CardSkipControls
            pdfMode={pdfMode}
            activePages={activePages}
            extractionSettings={extractionSettings}
            currentPage={currentPage}
            currentCard={currentCard}
            cardsPerPage={cardsPerPage}
            cardType={cardType}
            cardId={String(cardId)}
            onSettingsChange={onSettingsChange}
          />

          <CardTypeOverrideControls
            pdfMode={pdfMode}
            extractionSettings={extractionSettings}
            currentPage={currentPage}
            currentCard={currentCard}
            cardType={cardType}
            cardId={String(cardId)}
            onSettingsChange={onSettingsChange}
          />
        </div>
        
        <div className="space-y-4">
          <PagePreviewPanel
            activePages={activePages}
            currentPage={currentPage}
            currentCard={currentCard}
            zoom={zoom}
            extractionSettings={extractionSettings}
            pdfMode={pdfMode}
            cardType={cardType}
            cardId={cardId}
            cardsPerPage={cardsPerPage}
            onPageChange={setCurrentPage}
            onCardChange={setCurrentCard}
            onZoomChange={setZoom}
            getPdfData={getPdfData}
            getImageData={getImageData}
            onRenderedPageDataChange={setRenderedPageData}
            onPageDimensionsChange={setPageDimensions}
          />

          <CardPreviewPanel
            cardType={cardType}
            cardId={String(cardId)}
            globalCardIndex={globalCardIndex}
            extractCardImage={extractCardImage}
            renderedPageData={renderedPageData}
            renderingRef={renderingRef}
            activePages={activePages}
          />


          <IndividualCardSettings
            extractionSettings={extractionSettings}
            cardDimensions={cardDimensions}
            onSettingsChange={onSettingsChange}
          />
        </div>
      </div>
      
      
      {/* Export Section */}
      <div className="border-t pt-6 mt-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-3">Export Card Images</h3>
        <p className="text-sm text-gray-600 mb-4">
          Export all extracted cards as individual PNG images in a labeled zip file for use in external tools or prototyping.
        </p>
        <CardImageExportButton
          pdfData={pdfData}
          pdfMode={pdfMode}
          extractionSettings={extractionSettings}
          pageSettings={pageSettings}
          multiFileImport={multiFileImport}
        />
      </div>
      
      <div className="flex justify-between mt-6">
        <button onClick={onPrevious} className="flex items-center bg-gray-200 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-300">
          <ChevronLeftIcon size={16} className="mr-2" />
          Previous Step
        </button>
        <button onClick={onNext} className="flex items-center bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700">
          Next Step
          <ChevronRightIcon size={16} className="ml-2" />
        </button>
      </div>
    </div>
  );
};