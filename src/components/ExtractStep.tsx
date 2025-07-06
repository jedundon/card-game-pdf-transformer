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
import { GroupContextBar } from './ExtractStep/components/GroupContextBar';

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
  
  // Group management state - start with null (default group)
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);

  // Reset page and card navigation when switching groups
  useEffect(() => {
    console.log('ExtractStep: Active group changed to:', activeGroupId);
    setCurrentPage(0);
    setCurrentCard(0);
  }, [activeGroupId]);

  /**
   * Get the effective PDF mode for the current context
   * If a group is active, use group-specific processing mode
   * Otherwise, use global PDF mode
   */
  const effectivePdfMode = useMemo(() => {
    if (!activeGroupId) {
      // No group active, use global PDF mode
      return pdfMode;
    }

    // Find the active group
    const activeGroup = multiFileImport.multiFileState.pageGroups.find(
      group => group.id === activeGroupId
    );

    if (!activeGroup || !activeGroup.processingMode) {
      // Group not found or no group-specific processing mode, use global PDF mode
      return pdfMode;
    }

    // Use group-specific processing mode
    return activeGroup.processingMode;
  }, [activeGroupId, pdfMode, multiFileImport.multiFileState.pageGroups]);

  /**
   * Get the effective extraction settings for the current context
   * If a group is active, use group-specific settings merged with global settings
   * Otherwise, use global extraction settings
   */
  const effectiveExtractionSettings = useMemo(() => {
    if (!activeGroupId) {
      // No group active, use global settings
      return extractionSettings;
    }

    // Find the active group
    const activeGroup = multiFileImport.multiFileState.pageGroups.find(
      group => group.id === activeGroupId
    );

    if (!activeGroup || !activeGroup.settings?.extraction) {
      // Group not found or no group-specific settings, use global settings
      return extractionSettings;
    }

    // Merge group settings with global settings (group settings take precedence)
    return {
      ...extractionSettings,
      ...activeGroup.settings.extraction
    };
  }, [activeGroupId, extractionSettings, multiFileImport.multiFileState.pageGroups]);

  /**
   * Handle group-aware settings changes
   * If a group is active, save settings to the group
   * Otherwise, save to global settings
   */
  const handleGroupAwareSettingsChange = useCallback((newSettings: any) => {
    if (!activeGroupId) {
      // No group active, save to global settings
      onSettingsChange(newSettings);
      return;
    }

    // Update the group's settings
    const updatedGroups = multiFileImport.multiFileState.pageGroups.map(group => {
      if (group.id === activeGroupId) {
        return {
          ...group,
          settings: {
            ...group.settings,
            extraction: newSettings
          },
          modifiedAt: Date.now()
        };
      }
      return group;
    });

    // Update groups in multiFileImport state
    multiFileImport.updatePageGroups(updatedGroups);
  }, [activeGroupId, multiFileImport, onSettingsChange]);
  
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
  
  
  // Constants for default group (matching PageGroupsManager and GroupContextBar)
  const DEFAULT_GROUP_ID = 'default';

  // Get pages filtered by active group
  const filteredPages = useMemo(() => {
    // First get only active pages (exclude removed/skipped)
    const activeUnifiedPages = getActivePagesWithSource(unifiedPages);
    
    if (!activeGroupId) {
      // No group selected, show default group (ungrouped active pages)
      const groupedPageIndices = new Set(
        multiFileImport.multiFileState.pageGroups
          .filter(g => g.id !== DEFAULT_GROUP_ID)
          .flatMap(g => g.pageIndices)
      );
      
      // Filter active pages to exclude those in custom groups
      return activeUnifiedPages.filter(page => {
        const pageOriginalIndex = unifiedPages.findIndex(p => p === page);
        return !groupedPageIndices.has(pageOriginalIndex);
      });
    }
    
    // Find the active group
    const activeGroup = multiFileImport.multiFileState.pageGroups.find(
      group => group.id === activeGroupId
    );
    
    if (!activeGroup) {
      // Group not found, fallback to default group (ungrouped active pages)
      const groupedPageIndices = new Set(
        multiFileImport.multiFileState.pageGroups
          .filter(g => g.id !== DEFAULT_GROUP_ID)
          .flatMap(g => g.pageIndices)
      );
      
      return activeUnifiedPages.filter(page => {
        const pageOriginalIndex = unifiedPages.findIndex(p => p === page);
        return !groupedPageIndices.has(pageOriginalIndex);
      });
    }
    
    // Return only active pages that belong to this group
    const groupPages = activeGroup.pageIndices
      .map(index => unifiedPages[index])
      .filter(Boolean);
    
    return getActivePagesWithSource(groupPages);
  }, [unifiedPages, activeGroupId, multiFileImport.multiFileState.pageGroups]);

  const activePages = filteredPages;
  const cardsPerPage = effectiveExtractionSettings.grid.rows * effectiveExtractionSettings.grid.columns;
  // Calculate the global card index from current page and card
  const globalCardIndex = currentPage * cardsPerPage + currentCard;
  
  // Get current card info (type and ID) for display
  const { type: cardType, id: cardId } = getCardInfo(
    globalCardIndex, 
    activePages, 
    effectiveExtractionSettings, 
    effectivePdfMode, 
    cardsPerPage,
    pageDimensions?.width,
    pageDimensions?.height
  );

  // Calculate card dimensions for display with rotation effects
  const cardDimensions = useCardDimensions({
    pdfData,
    activePages,
    renderedPageData,
    extractionSettings: effectiveExtractionSettings,
    pdfMode: effectivePdfMode,
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
    const cardsPerPage = effectiveExtractionSettings.grid.rows * effectiveExtractionSettings.grid.columns;
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
      const cardsPerPage = effectiveExtractionSettings.grid.rows * effectiveExtractionSettings.grid.columns;
      const cardOnPage = cardIndex % cardsPerPage;
      
      // Use the original page index from the current page info
      const actualPageNumber = currentPageInfo.originalPageIndex + 1;
      
      try {
        // Extract the card directly using the file-specific PDF data and page number
        return await extractCardImageFromPdfPage(
          filePdfData, 
          actualPageNumber, 
          cardOnPage, 
          effectiveExtractionSettings,
          cardIndex, // globalCardIndex
          activePages, 
          effectivePdfMode
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
      return await extractCardImageFromCanvas(cardIndex, imageData, effectivePdfMode, activePages, effectiveExtractionSettings);
    }
    
    console.warn(`ExtractStep: Unknown file type ${currentPageInfo.fileType} for page ${pageIndex}`);
    return null;
  }, [effectiveExtractionSettings, effectivePdfMode, activePages, getPdfData, getImageData]);

  const handleCropChange = (edge: string, value: number) => {
    const newSettings = {
      ...effectiveExtractionSettings,
      crop: {
        ...effectiveExtractionSettings.crop,
        [edge]: value
      }
    };
    handleGroupAwareSettingsChange(newSettings);
  };
  
  const handleGridChange = (dimension: string, value: number) => {
    const newSettings = {
      ...effectiveExtractionSettings,
      grid: {
        ...effectiveExtractionSettings.grid,
        [dimension]: value
      }
    };
    handleGroupAwareSettingsChange(newSettings);
  };

  const handleGutterWidthChange = (value: number) => {
    const newSettings = {
      ...effectiveExtractionSettings,
      gutterWidth: value
    };
    handleGroupAwareSettingsChange(newSettings);
  };

  // Update extractionSettings with pageDimensions when they become available
  useEffect(() => {
    if (pageDimensions && 
        (!effectiveExtractionSettings.pageDimensions || 
         effectiveExtractionSettings.pageDimensions.width !== pageDimensions.width ||
         effectiveExtractionSettings.pageDimensions.height !== pageDimensions.height)) {
      const newSettings = {
        ...effectiveExtractionSettings,
        pageDimensions: { ...pageDimensions }
      };
      handleGroupAwareSettingsChange(newSettings);
    }
  }, [pageDimensions, effectiveExtractionSettings, handleGroupAwareSettingsChange]);


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

      {/* Group Context Bar - only show if groups exist */}
      {multiFileImport.multiFileState.pageGroups.length > 0 && (
        <GroupContextBar
          pages={unifiedPages}
          groups={multiFileImport.multiFileState.pageGroups}
          activeGroupId={activeGroupId}
          extractionSettings={effectiveExtractionSettings}
          globalPdfMode={pdfMode}
          onActiveGroupChange={setActiveGroupId}
        />
      )}
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <PageCropSettings
            crop={effectiveExtractionSettings.crop}
            pdfMode={effectivePdfMode}
            gutterWidth={effectiveExtractionSettings.gutterWidth}
            onCropChange={handleCropChange}
          />

          <GridSettings
            grid={effectiveExtractionSettings.grid}
            onGridChange={handleGridChange}
          />

          <GutterSettings
            pdfMode={effectivePdfMode}
            gutterWidth={effectiveExtractionSettings.gutterWidth || 0}
            onGutterWidthChange={handleGutterWidthChange}
          />

          <CardSkipControls
            pdfMode={effectivePdfMode}
            activePages={activePages}
            extractionSettings={effectiveExtractionSettings}
            currentPage={currentPage}
            currentCard={currentCard}
            cardsPerPage={cardsPerPage}
            cardType={cardType}
            cardId={String(cardId)}
            onSettingsChange={handleGroupAwareSettingsChange}
          />

          <CardTypeOverrideControls
            pdfMode={effectivePdfMode}
            extractionSettings={effectiveExtractionSettings}
            currentPage={currentPage}
            currentCard={currentCard}
            cardType={cardType}
            cardId={String(cardId)}
            onSettingsChange={handleGroupAwareSettingsChange}
          />
        </div>
        
        <div className="space-y-4">
          <PagePreviewPanel
            key={`preview-${activeGroupId || 'default'}`}
            activePages={activePages}
            currentPage={currentPage}
            currentCard={currentCard}
            zoom={zoom}
            extractionSettings={effectiveExtractionSettings}
            pdfMode={effectivePdfMode}
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
            extractionSettings={effectiveExtractionSettings}
            cardDimensions={cardDimensions}
            onSettingsChange={handleGroupAwareSettingsChange}
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
          pdfMode={effectivePdfMode}
          extractionSettings={effectiveExtractionSettings}
          pageSettings={pageSettings}
          multiFileImport={multiFileImport}
          activeGroupId={activeGroupId}
          pageGroups={multiFileImport.multiFileState.pageGroups}
          exportMode="current-group"
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