import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import { AddFilesButton } from './AddFilesButton';
import { ExportPageButton } from './shared/ExportPageButton';
import { PageSizeSettings } from './ConfigureStep/components/PageSizeSettings';
import { CardPositionSettings } from './ConfigureStep/components/CardPositionSettings';
import { CardSizeSettings } from './ConfigureStep/components/CardSizeSettings';
import { CalibrationSection } from './ConfigureStep/components/CalibrationSection';
import { GroupContextBar } from './ExtractStep/components/GroupContextBar';
// import { CardPreviewPanel } from './ConfigureStep/components/CardPreviewPanel';
// import { CalibrationWizardModal } from './ConfigureStep/components/CalibrationWizardModal';
import { 
  getActivePagesWithSource, 
  calculateTotalCards, 
  getCardInfo, 
  extractCardImageFromCanvas,
  getAvailableCardIds,
  getRotationForCardType,
  countCardsByType,
  calculateCardDimensions
} from '../utils/cardUtils';
import { 
  calculateFinalCardRenderDimensions,
  calculateCardPositioning,
  calculatePreviewScaling,
  processCardImageForRendering
} from '../utils/renderUtils';
import { extractCardImageFromPdfPage } from '../utils/pdfCardExtraction';
import { generateCalibrationPDF, calculateCalibrationSettings } from '../utils/calibrationUtils';
import { PREVIEW_CONSTRAINTS, /* DPI_CONSTANTS, */ TIMEOUT_CONSTANTS } from '../constants';
import { DEFAULT_SETTINGS } from '../defaults';
import type { ConfigureStepProps /*, MultiFileImportHook */ } from '../types';

export const ConfigureStep: React.FC<ConfigureStepProps> = ({
  pdfData,
  pdfMode,
  extractionSettings,
  outputSettings,
  pageSettings,
  cardDimensions,
  multiFileImport,
  onSettingsChange,
  onPrevious,
  onNext
}) => {
  const [currentCardId, setCurrentCardId] = useState(1); // Track logical card ID (1-based)
  
  // Group management state - start with null (default group)
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);

  // Reset card navigation and preview when switching groups
  useEffect(() => {
    console.log('ConfigureStep: Active group changed to:', activeGroupId);
    setCurrentCardId(1); // Reset to first card in new group context
    
    // Clear preview state to force fresh loading for new group
    setCardPreviewUrl(null);
    setProcessedPreviewUrl(null);
    setCardRenderData(null);
    setPreviewError('');
    setPreviewLoading(false);
    setProgressMessage('');
  }, [activeGroupId]);
  const [cardPreviewUrl, setCardPreviewUrl] = useState<string | null>(null);
  const [processedPreviewUrl, setProcessedPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState<boolean>(false);
  const [previewError, setPreviewError] = useState<string>('');
  const [progressMessage, setProgressMessage] = useState<string>('');
  const [cardRenderData, setCardRenderData] = useState<{
    renderDimensions: any;
    positioning: any;
    previewScaling: any;
  } | null>(null);
  const [viewMode, setViewMode] = useState<'front' | 'back'>('front');
  
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
   * Get the effective output settings for the current context
   * If a group is active, use group-specific settings merged with global settings
   * Otherwise, use global output settings
   */
  const effectiveOutputSettings = useMemo(() => {
    if (!activeGroupId) {
      // No group active, use global settings
      return outputSettings;
    }

    // Find the active group
    const activeGroup = multiFileImport.multiFileState.pageGroups.find(
      group => group.id === activeGroupId
    );

    if (!activeGroup || !activeGroup.settings?.output) {
      // Group not found or no group-specific settings, use global settings
      return outputSettings;
    }

    // Merge group settings with global settings (group settings take precedence)
    return {
      ...outputSettings,
      ...activeGroup.settings.output
    };
  }, [activeGroupId, outputSettings, multiFileImport.multiFileState.pageGroups]);

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
            output: newSettings
          },
          modifiedAt: Date.now()
        };
      }
      return group;
    });

    // Update groups in multiFileImport state
    multiFileImport.updatePageGroups(updatedGroups);
  }, [activeGroupId, multiFileImport, onSettingsChange]);

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
  
  // Debouncing and caching
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const previewCacheRef = useRef<Map<string, {
    cardPreviewUrl: string | null;
    processedPreviewUrl: string | null;
    cardRenderData: any;
    timestamp: number;
  }>>(new Map());
  const settingsChangeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pendingSettingsRef = useRef<any>(null);
  const [showCalibrationWizard, setShowCalibrationWizard] = useState(false);
  const [calibrationMeasurements, setCalibrationMeasurements] = useState({
    rightDistance: '',
    topDistance: '',
    crosshairLength: ''
  });
  
  // Unified page data handling - always prioritize multi-file state
  const unifiedPages = useMemo(() => {
    if (multiFileImport.multiFileState.pages.length > 0) {
      // Use pages from multi-file import with source information
      return multiFileImport.multiFileState.pages;
    } else if (pageSettings.length > 0) {
      // Fallback: convert pageSettings to unified format for backward compatibility
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

  // Calculate total unique cards based on PDF mode and card type
  const totalCards = useMemo(() => 
    calculateTotalCards(effectivePdfMode, activePages, cardsPerPage), 
    [effectivePdfMode, activePages, cardsPerPage]
  );

  // Calculate card front/back identification based on PDF mode (using utility function)
  const getCardInfoCallback = useCallback((cardIndex: number) => 
    getCardInfo(
      cardIndex, 
      activePages, 
      effectiveExtractionSettings, 
      effectivePdfMode, 
      cardsPerPage,
      effectiveExtractionSettings.pageDimensions?.width,
      effectiveExtractionSettings.pageDimensions?.height
    ), 
    [activePages, effectiveExtractionSettings, effectivePdfMode, cardsPerPage]
  );
  // Calculate cards filtered by type (front/back) - get all card IDs available in current view mode
  const availableCardIds = useMemo(() => 
    getAvailableCardIds(viewMode, totalCards, effectivePdfMode, activePages, cardsPerPage, effectiveExtractionSettings), 
    [viewMode, totalCards, effectivePdfMode, activePages, cardsPerPage, effectiveExtractionSettings]
  );

  const totalFilteredCards = availableCardIds.length;

  // Get the position of current card ID in the available cards list
  const currentCardPosition = useMemo(() => {
    return availableCardIds.indexOf(currentCardId) + 1; // 1-based position
  }, [availableCardIds, currentCardId]);

  // Check if current card ID exists in available cards
  const currentCardExists = useMemo(() => {
    return availableCardIds.includes(currentCardId);
  }, [availableCardIds, currentCardId]);

  // Find the card index for the current card ID in the filtered view
  const currentCardIndex = useMemo(() => {
    if (!currentCardExists) return null;
    
    // Find the first card index that matches the current card ID and view mode
    const maxIndex = effectivePdfMode.type === 'duplex' || effectivePdfMode.type === 'gutter-fold' 
      ? activePages.length * cardsPerPage 
      : totalCards;
    
    for (let i = 0; i < maxIndex; i++) {
      const cardInfo = getCardInfoCallback(i);
      if (cardInfo.id === currentCardId && cardInfo.type.toLowerCase() === viewMode) {
        return i;
      }
    }
    
    return null;
  }, [currentCardExists, currentCardId, viewMode, effectivePdfMode.type, activePages.length, cardsPerPage, totalCards, getCardInfoCallback]);

  // Extract card image for preview using source-aware logic
  const extractCardImage = useCallback(async (cardIndex: number): Promise<string | null> => {
    // Calculate which page this card belongs to
    const cardsPerPageLocal = effectiveExtractionSettings.grid.rows * effectiveExtractionSettings.grid.columns;
    const pageIndex = Math.floor(cardIndex / cardsPerPageLocal);
    
    if (pageIndex >= activePages.length || pageIndex < 0) {
      console.warn(`ConfigureStep: Invalid page index ${pageIndex} for card ${cardIndex} (activePages.length: ${activePages.length})`);
      return null;
    }
    
    const currentPageInfo = activePages[pageIndex];
    
    if (!currentPageInfo || !currentPageInfo.fileType) {
      console.warn(`ConfigureStep: Invalid page info for page ${pageIndex}:`, currentPageInfo);
      return null;
    }
    
    if (currentPageInfo.fileType === 'pdf') {
      // Get the correct PDF data for this specific file
      const filePdfData = getPdfData(currentPageInfo.fileName);
      if (!filePdfData) {
        console.warn(`ConfigureStep: No PDF data available for file ${currentPageInfo.fileName} on page ${pageIndex}`);
        return null;
      }
      
      // For multi-file scenarios, calculate the card extraction directly
      const cardOnPage = cardIndex % cardsPerPageLocal;
      
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
        console.error(`ConfigureStep: Failed to extract card ${cardIndex} from PDF page ${actualPageNumber}:`, error);
        return null;
      }
    } else if (currentPageInfo.fileType === 'image') {
      // Use image extraction
      const imageData = getImageData(currentPageInfo.fileName);
      if (!imageData) {
        console.error(`ConfigureStep: No image data found for file: ${currentPageInfo.fileName}`);
        return null;
      }
      return await extractCardImageFromCanvas(cardIndex, imageData, effectivePdfMode, activePages, effectiveExtractionSettings);
    }
    
    return null;
  }, [effectiveExtractionSettings, effectivePdfMode, activePages, getPdfData, getImageData]);

  // Cache management (available but not used in current implementation)
  // const clearCache = useCallback(() => {
  //   previewCacheRef.current.clear();
  // }, []);

  const getCacheKey = useCallback((cardId: number, mode: 'front' | 'back', settings: any) => {
    return JSON.stringify({ 
      cardId, 
      mode, 
      activeGroupId, // Include group ID so different groups have separate cache entries
      settings: {
        cardSize: settings.cardSize,
        cardScalePercent: settings.cardScalePercent,
        rotation: settings.rotation,
        offset: settings.offset,
        cardImageSizingMode: settings.cardImageSizingMode,
        bleedMarginInches: settings.bleedMarginInches
      }
    });
  }, [activeGroupId]);

  // Debounced settings change handler
  const debouncedSettingsChange = useCallback((newSettings: any) => {
    if (settingsChangeTimeoutRef.current) {
      clearTimeout(settingsChangeTimeoutRef.current);
    }
    
    pendingSettingsRef.current = newSettings;
    
    settingsChangeTimeoutRef.current = setTimeout(() => {
      if (pendingSettingsRef.current) {
        handleGroupAwareSettingsChange(pendingSettingsRef.current);
        pendingSettingsRef.current = null;
      }
    }, TIMEOUT_CONSTANTS.SETTINGS_DEBOUNCE_DELAY);
  }, [handleGroupAwareSettingsChange]);

  // Update card preview when current card changes
  useEffect(() => {
    let isCancelled = false;
    
    const updatePreview = async () => {
      if (totalFilteredCards === 0 || !currentCardExists || currentCardIndex === null) {
        setCardPreviewUrl(null);
        setCardRenderData(null);
        setProcessedPreviewUrl(null);
        setPreviewError('');
        setPreviewLoading(false);
        setProgressMessage('');
        return;
      }

      // Check cache first
      const cacheKey = getCacheKey(currentCardId, viewMode, effectiveOutputSettings);
      const cached = previewCacheRef.current.get(cacheKey);
      const cacheAge = cached ? Date.now() - cached.timestamp : Infinity;
      
      // Use cache if it's less than 5 minutes old
      if (cached && cacheAge < 300000) {
        setCardPreviewUrl(cached.cardPreviewUrl);
        setProcessedPreviewUrl(cached.processedPreviewUrl);
        setCardRenderData(cached.cardRenderData);
        setPreviewLoading(false);
        setPreviewError('');
        setProgressMessage('');
        return;
      }

      setPreviewLoading(true);
      setPreviewError('');
      setProgressMessage('Initializing preview...');
      
      try {
        // Extract card image with timeout
        setProgressMessage('Extracting card image...');
        const extractPromise = extractCardImage(currentCardIndex);
        const timeoutPromise = new Promise<null>((_, reject) => 
          setTimeout(() => reject(new Error('Card extraction timed out')), TIMEOUT_CONSTANTS.CARD_EXTRACTION_TIMEOUT)
        );
        
        const cardUrl = await Promise.race([extractPromise, timeoutPromise]);
        
        if (isCancelled) return;
        
        setCardPreviewUrl(cardUrl);
        
        if (!cardUrl) {
          throw new Error(`Failed to extract card image for card ${currentCardId}`);
        }

        // Calculate render dimensions with timeout
        setProgressMessage('Calculating render dimensions...');
        const renderPromise = calculateFinalCardRenderDimensions(cardUrl, effectiveOutputSettings);
        const renderTimeoutPromise = new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('Render calculation timed out')), TIMEOUT_CONSTANTS.RENDER_CALCULATION_TIMEOUT)
        );
        
        const renderDimensions = await Promise.race([renderPromise, renderTimeoutPromise]);
        
        if (isCancelled) return;
        
        // Calculate positioning
        setProgressMessage('Calculating card positioning...');
        const positioning = calculateCardPositioning(renderDimensions, effectiveOutputSettings, viewMode);
        const previewScaling = calculatePreviewScaling(
          renderDimensions,
          positioning,
          effectiveOutputSettings.pageSize.width,
          effectiveOutputSettings.pageSize.height,
          PREVIEW_CONSTRAINTS.MAX_WIDTH,
          PREVIEW_CONSTRAINTS.MAX_HEIGHT
        );
        
        if (isCancelled) return;
        
        const cardRenderData = {
          renderDimensions,
          positioning,
          previewScaling
        };
        setCardRenderData(cardRenderData);
        
        // Process the image for preview with timeout
        setProgressMessage('Processing image for preview...');
        const processPromise = processCardImageForRendering(cardUrl, renderDimensions, positioning.rotation);
        const processTimeoutPromise = new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('Image processing timed out')), TIMEOUT_CONSTANTS.IMAGE_PROCESSING_TIMEOUT)
        );
        
        const processedImage = await Promise.race([processPromise, processTimeoutPromise]);
        
        if (isCancelled) return;
        
        setProcessedPreviewUrl(processedImage.imageUrl);
        
        // Cache the result for future use
        if (!isCancelled) {
          setProgressMessage('Finalizing preview...');
          previewCacheRef.current.set(cacheKey, {
            cardPreviewUrl: cardUrl,
            processedPreviewUrl: processedImage.imageUrl,
            cardRenderData,
            timestamp: Date.now()
          });
          
          // Limit cache size to prevent memory issues
          if (previewCacheRef.current.size > 50) {
            const entries = Array.from(previewCacheRef.current.entries());
            entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
            // Remove oldest 10 entries
            for (let i = 0; i < 10; i++) {
              previewCacheRef.current.delete(entries[i][0]);
            }
          }
        }
        
      } catch (error) {
        if (isCancelled) return;
        
        console.error('Failed to update card preview:', error);
        
        // Provide specific error messages
        let errorMessage = 'Failed to load card preview';
        
        if (error instanceof Error) {
          if (error.message.includes('timed out')) {
            errorMessage = 'Preview generation timed out. The card may be too complex to process.';
          } else if (error.message.includes('Failed to extract')) {
            errorMessage = 'Could not extract card image. Please check your extraction settings.';
          } else if (error.message.includes('memory') || error.message.includes('out of memory')) {
            errorMessage = 'Not enough memory to process this card. Try refreshing the page.';
          } else if (error.message.includes('dimensions') || error.message.includes('invalid')) {
            errorMessage = 'Invalid card dimensions. Please check your output settings.';
          }
        }
        
        setPreviewError(errorMessage);
        setCardPreviewUrl(null);
        setCardRenderData(null);
        setProcessedPreviewUrl(null);
      } finally {
        if (!isCancelled) {
          setPreviewLoading(false);
          setProgressMessage('');
        }
      }
    };

    updatePreview();
    
    // Cleanup function to cancel in-flight operations
    return () => {
      isCancelled = true;
    };
  }, [
    currentCardId,
    viewMode,
    extractCardImage, 
    totalFilteredCards,
    currentCardExists,
    currentCardIndex,
    effectiveOutputSettings, // Add effectiveOutputSettings as dependency so preview updates when settings change
    getCacheKey,
    activeGroupId, // Add activeGroupId so preview updates when group changes
    activePages // Add activePages so preview updates when filtered pages change
  ]);

  const handlePageSizeChange = (dimension: string, value: number | { width: number; height: number }) => {
    if (dimension === 'preset' && typeof value === 'object') {
      const newSettings = {
        ...effectiveOutputSettings,
        pageSize: value
      };
      debouncedSettingsChange(newSettings);
    } else if (typeof value === 'number') {
      const newSettings = {
        ...effectiveOutputSettings,
        pageSize: {
          ...effectiveOutputSettings.pageSize,
          [dimension]: value
        }
      };
      debouncedSettingsChange(newSettings);
    }
  };
  const handleOffsetChange = (direction: string, value: number) => {
    const newSettings = {
      ...effectiveOutputSettings,
      offset: {
        ...effectiveOutputSettings.offset,
        [direction]: value
      }
    };
    debouncedSettingsChange(newSettings);
  };
  const handleCardSizeChange = (dimension: 'widthInches' | 'heightInches', value: number) => {
    const newSettings = {
      ...effectiveOutputSettings,
      cardSize: {
        ...(effectiveOutputSettings.cardSize || DEFAULT_SETTINGS.outputSettings.cardSize),
        [dimension]: value
      }
    };
    debouncedSettingsChange(newSettings);
  };

  const handleCardScalePercentChange = (value: number) => {
    const newSettings = {
      ...effectiveOutputSettings,
      cardScalePercent: value
    };
    debouncedSettingsChange(newSettings);
  };

  const handleBleedMarginChange = (value: number) => {
    const newSettings = {
      ...effectiveOutputSettings,
      bleedMarginInches: value
    };
    debouncedSettingsChange(newSettings);
  };

  const handleRotationChange = (cardType: 'front' | 'back', value: number) => {
    const newSettings = {
      ...effectiveOutputSettings,
      rotation: {
        ...(effectiveOutputSettings.rotation || { front: 0, back: 0 }),
        [cardType]: value
      }
    };
    debouncedSettingsChange(newSettings);
  };
  const handlePreviousCard = () => {
    const currentIndex = availableCardIds.indexOf(currentCardId);
    if (currentIndex > 0) {
      const newCardId = availableCardIds[currentIndex - 1];
      setCurrentCardId(newCardId);
      // Preload adjacent cards after a short delay
      setTimeout(() => preloadAdjacentCards(newCardId), 100);
    }
  };
  
  // Preload adjacent cards for better navigation performance
  const preloadAdjacentCards = useCallback(async (cardId: number) => {
    const currentIndex = availableCardIds.indexOf(cardId);
    const adjacentCards = [
      currentIndex > 0 ? availableCardIds[currentIndex - 1] : null,
      currentIndex < availableCardIds.length - 1 ? availableCardIds[currentIndex + 1] : null
    ].filter(id => id !== null) as number[];

    for (const adjacentCardId of adjacentCards) {
      const cacheKey = getCacheKey(adjacentCardId, viewMode, effectiveOutputSettings);
      if (!previewCacheRef.current.has(cacheKey)) {
        // Find the card index for the adjacent card ID
        const maxIndex = effectivePdfMode.type === 'duplex' || effectivePdfMode.type === 'gutter-fold' 
          ? activePages.length * cardsPerPage 
          : totalCards;
        
        let cardIndex = null;
        for (let i = 0; i < maxIndex; i++) {
          const cardInfo = getCardInfoCallback(i);
          if (cardInfo.id === adjacentCardId && cardInfo.type.toLowerCase() === viewMode) {
            cardIndex = i;
            break;
          }
        }
        
        if (cardIndex !== null) {
          // Start preloading in background (don't await to avoid blocking)
          extractCardImage(cardIndex).then(async (cardUrl) => {
            if (cardUrl) {
              const renderDimensions = await calculateFinalCardRenderDimensions(cardUrl, effectiveOutputSettings);
              const positioning = calculateCardPositioning(renderDimensions, effectiveOutputSettings, viewMode);
              const processedImage = await processCardImageForRendering(cardUrl, renderDimensions, positioning.rotation);
              
              // Cache the preloaded result
              previewCacheRef.current.set(cacheKey, {
                cardPreviewUrl: cardUrl,
                processedPreviewUrl: processedImage.imageUrl,
                cardRenderData: {
                  renderDimensions,
                  positioning,
                  previewScaling: calculatePreviewScaling(
                    renderDimensions,
                    positioning,
                    effectiveOutputSettings.pageSize.width,
                    effectiveOutputSettings.pageSize.height,
                    PREVIEW_CONSTRAINTS.MAX_WIDTH,
                    PREVIEW_CONSTRAINTS.MAX_HEIGHT
                  )
                },
                timestamp: Date.now()
              });
            }
          }).catch(() => {
            // Silently fail preloading - not critical
          });
        }
      }
    }
  }, [availableCardIds, viewMode, effectiveOutputSettings, getCacheKey, getCardInfoCallback, extractCardImage, effectivePdfMode.type, activePages.length, cardsPerPage, totalCards]);
  
  const handleNextCard = () => {
    const currentIndex = availableCardIds.indexOf(currentCardId);
    if (currentIndex < availableCardIds.length - 1) {
      const newCardId = availableCardIds[currentIndex + 1];
      setCurrentCardId(newCardId);
      // Preload adjacent cards after a short delay
      setTimeout(() => preloadAdjacentCards(newCardId), 100);
    }
  };

  // Handle view mode toggle - maintain current card ID when switching between front/back
  const handleViewModeToggle = (mode: 'front' | 'back') => {
    setViewMode(mode);
    // Don't reset card ID - let it stay on the same logical card if it exists
    // If the current card ID doesn't exist in the new mode, it will be handled by the effect below
  };

  // Ensure currentCardId is valid for the current view mode
  useEffect(() => {
    if (totalFilteredCards > 0 && !currentCardExists) {
      // Current card ID doesn't exist in current mode, fallback to first available card
      setCurrentCardId(availableCardIds[0]);
    }
  }, [currentCardExists, totalFilteredCards, availableCardIds]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    const settingsTimeout = settingsChangeTimeoutRef.current;
    const debounceTimeout = debounceTimeoutRef.current;
    return () => {
      if (settingsTimeout) {
        clearTimeout(settingsTimeout);
      }
      if (debounceTimeout) {
        clearTimeout(debounceTimeout);
      }
    };
  }, []);

  // Initial preload of adjacent cards when current card changes
  useEffect(() => {
    if (currentCardExists && totalFilteredCards > 1) {
      // Delay initial preload to not interfere with current card loading
      const timer = setTimeout(() => preloadAdjacentCards(currentCardId), 1000);
      return () => clearTimeout(timer);
    }
  }, [currentCardId, currentCardExists, totalFilteredCards, preloadAdjacentCards]);

  // Handle calibration PDF generation
  const handlePrintCalibration = useCallback(() => {
    // Use new card size settings for calibration
    const cardWidthInches = effectiveOutputSettings.cardSize?.widthInches || DEFAULT_SETTINGS.outputSettings.cardSize.widthInches;
    const cardHeightInches = effectiveOutputSettings.cardSize?.heightInches || DEFAULT_SETTINGS.outputSettings.cardSize.heightInches;
    
    // Apply scale percentage
    const scalePercent = effectiveOutputSettings.cardScalePercent || DEFAULT_SETTINGS.outputSettings.cardScalePercent;
    const scaledWidth = cardWidthInches * (scalePercent / 100);
    const scaledHeight = cardHeightInches * (scalePercent / 100);
    
    // Get current offset settings
    const horizontalOffset = effectiveOutputSettings.offset.horizontal || 0;
    const verticalOffset = effectiveOutputSettings.offset.vertical || 0;
    
    // Get current rotation for the view mode being tested
    const rotation = getRotationForCardType(effectiveOutputSettings, viewMode);
    
    console.log(`Calibration card: ${scaledWidth.toFixed(2)}" × ${scaledHeight}" with offset ${horizontalOffset.toFixed(3)}", ${verticalOffset.toFixed(3)}" and ${rotation}° rotation on ${effectiveOutputSettings.pageSize.width}" × ${effectiveOutputSettings.pageSize.height}" media`);
    
    const pdfBlob = generateCalibrationPDF(
      scaledWidth,
      scaledHeight,
      effectiveOutputSettings.pageSize.width,
      effectiveOutputSettings.pageSize.height,
      horizontalOffset,
      verticalOffset,
      rotation,
      scalePercent
    );
    
    // Create a download link and click it programmatically
    const url = URL.createObjectURL(pdfBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'printer_calibration_card.pdf';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [effectiveOutputSettings, viewMode]);

  // Handle calibration measurements and apply settings
  const handleApplyCalibration = useCallback(() => {
    const measurements = calibrationMeasurements;
    
    if (!measurements.rightDistance || !measurements.topDistance || !measurements.crosshairLength) {
      alert('Please enter all 3 measurements before applying calibration.');
      return;
    }

    // Validate that all measurements are valid numbers
    const rightDistance = parseFloat(measurements.rightDistance);
    const topDistance = parseFloat(measurements.topDistance);
    const crosshairLength = parseFloat(measurements.crosshairLength);
    
    if (isNaN(rightDistance) || isNaN(topDistance) || isNaN(crosshairLength)) {
      alert('Please enter valid numeric measurements.');
      return;
    }

    // Get current card dimensions for calculation
    const cardWidthInches = effectiveOutputSettings.cardSize?.widthInches || DEFAULT_SETTINGS.outputSettings.cardSize.widthInches;
    const cardHeightInches = effectiveOutputSettings.cardSize?.heightInches || DEFAULT_SETTINGS.outputSettings.cardSize.heightInches;

    const settings = calculateCalibrationSettings(
      rightDistance,
      topDistance,
      crosshairLength,
      cardWidthInches,
      cardHeightInches,
      effectiveOutputSettings.offset.horizontal || 0,
      effectiveOutputSettings.offset.vertical || 0,
      effectiveOutputSettings.cardScalePercent || DEFAULT_SETTINGS.outputSettings.cardScalePercent
    );

    // Apply the new calculated settings (batch offset changes to avoid state timing issues)
    const newSettings = {
      ...effectiveOutputSettings,
      offset: {
        horizontal: settings.newHorizontalOffset,
        vertical: settings.newVerticalOffset
      },
      cardScalePercent: settings.newScalePercent
    };
    
    handleGroupAwareSettingsChange(newSettings);
    
    // Show feedback about what was changed with diagnostics
    const adjustments = settings.adjustments;
    const diagnostics = settings.diagnostics;
    
    let message = 'Calibration applied!\n\n';
    
    // Add diagnostic information
    message += 'Analysis:\n';
    message += `• Horizontal: ${diagnostics.horizontalCentering}\n`;
    message += `• Vertical: ${diagnostics.verticalCentering}\n`;
    message += `• Scale: ${diagnostics.scaleAccuracy}\n\n`;
    
    // Add adjustments made
    message += 'Adjustments made:\n';
    message += `• Horizontal offset: ${adjustments.horizontalOffsetChange >= 0 ? '+' : ''}${adjustments.horizontalOffsetChange.toFixed(3)}"\n`;
    message += `• Vertical offset: ${adjustments.verticalOffsetChange >= 0 ? '+' : ''}${adjustments.verticalOffsetChange.toFixed(3)}"\n`;
    message += `• Scale: ${adjustments.scalePercentChange >= 0 ? '+' : ''}${adjustments.scalePercentChange}%\n\n`;
    
    // Suggest next steps
    if (Math.abs(adjustments.horizontalOffsetChange) < 0.01 && 
        Math.abs(adjustments.verticalOffsetChange) < 0.01 && 
        Math.abs(adjustments.scalePercentChange) < 1) {
      message += 'Settings are well calibrated! You can proceed with card printing.';
    } else {
      message += 'Print a new calibration card to verify the adjustments or proceed with card printing.';
    }
    
    alert(message);
    
    // Close the wizard
    setShowCalibrationWizard(false);
    
    // Clear measurements
    setCalibrationMeasurements({
      rightDistance: '',
      topDistance: '',
      crosshairLength: ''
    });
  }, [calibrationMeasurements, effectiveOutputSettings, handleGroupAwareSettingsChange]);

  const handleCalibrationMeasurementChange = useCallback((field: string, value: string) => {
    setCalibrationMeasurements(prev => ({
      ...prev,
      [field]: value
    }));
  }, []);

  const handleCardSizePreset = (size: { widthInches: number; heightInches: number }) => {
    const newSettings = {
      ...effectiveOutputSettings,
      cardSize: size
    };
    debouncedSettingsChange(newSettings);
  };

  const handleCardImageSizingModeChange = (mode: 'actual-size' | 'fit-to-card' | 'fill-card') => {
    const newSettings = {
      ...effectiveOutputSettings,
      cardImageSizingMode: mode
    };
    debouncedSettingsChange(newSettings);
  };

  return <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-800">Configure Layout</h2>
        
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
      
      {!pdfData && multiFileImport.multiFileState.pages.length === 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-yellow-800">
            Please load files in the Import step to continue.
          </p>
        </div>
      )}
      
      {(pdfData || multiFileImport.multiFileState.pages.length > 0) && totalCards === 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-yellow-800">
            No cards available. Please configure extraction settings in the previous step.
          </p>
        </div>
      )}
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <PageSizeSettings
            outputSettings={effectiveOutputSettings}
            onPageSizeChange={handlePageSizeChange}
          />
          <CardPositionSettings
            outputSettings={effectiveOutputSettings}
            onOffsetChange={handleOffsetChange}
          />

          <CardSizeSettings
            outputSettings={effectiveOutputSettings}
            onCardImageSizingModeChange={handleCardImageSizingModeChange}
            onCardSizeChange={handleCardSizeChange}
            onBleedMarginChange={handleBleedMarginChange}
            onCardSizePreset={handleCardSizePreset}
            onCardScalePercentChange={handleCardScalePercentChange}
            onRotationChange={handleRotationChange}
            getRotationForCardType={getRotationForCardType}
          />


          {/* Printer Calibration Section */}
          <CalibrationSection
            outputSettings={effectiveOutputSettings}
            viewMode={viewMode}
            onPrintCalibration={handlePrintCalibration}
            onShowCalibrationWizard={() => setShowCalibrationWizard(true)}
            getRotationForCardType={getRotationForCardType}
          />
        </div>
        <div className="space-y-4">
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <div className="bg-gray-50 p-3 border-b border-gray-200">
              {/* Combined Controls Row */}
              <div className="relative flex items-center">
                {/* View Mode Toggle - Left */}
                <div className="flex bg-gray-200 rounded-lg p-1">
                  <button
                    onClick={() => handleViewModeToggle('front')}
                    className={`px-3 py-1 text-sm rounded-md transition-colors ${
                      viewMode === 'front'
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    Fronts
                  </button>
                  <button
                    onClick={() => handleViewModeToggle('back')}
                    className={`px-3 py-1 text-sm rounded-md transition-colors ${
                      viewMode === 'back'
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    Backs
                  </button>
                </div>
                
                {/* Card Navigation - Perfectly Centered */}
                <div className="absolute left-1/2 transform -translate-x-1/2 flex items-center space-x-2">
                  <button onClick={handlePreviousCard} disabled={!currentCardExists || availableCardIds.indexOf(currentCardId) === 0} className="p-1 rounded-full hover:bg-gray-200 disabled:opacity-50">
                    <ChevronLeftIcon size={16} />
                  </button>
                  <span className="text-sm text-gray-700">
                    {totalFilteredCards > 0 && currentCardExists ? `${viewMode.charAt(0).toUpperCase() + viewMode.slice(1)} ${currentCardPosition} of ${totalFilteredCards}` : `No ${viewMode} cards`}
                  </span>
                  <button onClick={handleNextCard} disabled={!currentCardExists || availableCardIds.indexOf(currentCardId) === availableCardIds.length - 1} className="p-1 rounded-full hover:bg-gray-200 disabled:opacity-50">
                    <ChevronRightIcon size={16} />
                  </button>
                </div>
                
                {/* Card ID and Export Button - Right */}
                <div className="ml-auto flex items-center gap-3">
                  <div className="text-sm text-gray-500">
                    {totalFilteredCards > 0 && currentCardExists ? `Card ID: ${currentCardId}` : 'No cards'}
                  </div>
                  
                  {/* Export Page Button */}
                  {totalFilteredCards > 0 && currentCardExists && (
                    <ExportPageButton
                      cardId={currentCardId}
                      cardType={viewMode}
                      pdfData={pdfData}
                      pdfMode={effectivePdfMode}
                      extractionSettings={effectiveExtractionSettings}
                      outputSettings={effectiveOutputSettings}
                      multiFileImport={multiFileImport}
                      activePages={activePages}
                      cardsPerPage={cardsPerPage}
                      className="text-xs"
                    >
                      Export Page
                    </ExportPageButton>
                  )}
                </div>
              </div>
            </div>
            <div className="p-4 bg-gray-100">
              <div className="relative mx-auto bg-white shadow" style={{
                ...(cardRenderData ? {
                  width: `${cardRenderData.previewScaling.previewPageWidth}px`,
                  height: `${cardRenderData.previewScaling.previewPageHeight}px`
                } : {
                  width: '400px',
                  height: '300px'
                })
              }}>
                {/* Card positioned on the page */}
                <div className="absolute bg-gray-200 border border-gray-300 overflow-hidden" style={{
                  ...(cardRenderData ? {
                    width: `${cardRenderData.previewScaling.previewCardWidth}px`,
                    height: `${cardRenderData.previewScaling.previewCardHeight}px`,
                    left: `${cardRenderData.previewScaling.previewX}px`,
                    top: `${cardRenderData.previewScaling.previewY}px`
                    // Note: No CSS rotation needed - processedPreviewUrl already contains rotated image
                  } : {
                    width: '100px',
                    height: '140px',
                    left: '50%',
                    top: '50%',
                    marginLeft: '-50px',
                    marginTop: '-70px'
                  })
                }}>
                  {previewLoading ? (
                    <div className="w-full h-full flex flex-col items-center justify-center text-gray-500 text-sm">
                      <div className="animate-spin w-8 h-8 border-2 border-gray-300 border-t-blue-600 rounded-full mb-2"></div>
                      <span className="text-center">{progressMessage || 'Loading preview...'}</span>
                      {pendingSettingsRef.current && (
                        <span className="text-xs text-gray-400 mt-1">Settings pending...</span>
                      )}
                    </div>
                  ) : previewError ? (
                    <div className="w-full h-full flex flex-col items-center justify-center p-4">
                      <div className="text-red-500 text-center">
                        <div className="mb-2">⚠️</div>
                        <div className="text-xs mb-2 font-medium">Preview Error</div>
                        <div className="text-xs text-red-600 mb-3">{previewError}</div>
                        <button
                          onClick={() => {
                            setPreviewError('');
                            // Clear cache for current card to force fresh render
                            const cacheKey = getCacheKey(currentCardId, viewMode, effectiveOutputSettings);
                            previewCacheRef.current.delete(cacheKey);
                            // Force re-render by updating a dependency
                            setCurrentCardId(prev => prev);
                          }}
                          className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200"
                        >
                          Retry
                        </button>
                      </div>
                    </div>
                  ) : processedPreviewUrl && cardRenderData ? (
                    <div 
                      className="w-full h-full bg-cover bg-center"
                      style={{
                        backgroundImage: `url(${processedPreviewUrl})`,
                        backgroundPosition: 'center center',
                        backgroundSize: 'contain',
                        backgroundRepeat: 'no-repeat'
                      }}
                    />
                  ) : cardPreviewUrl ? (
                    <div className="w-full h-full flex items-center justify-center text-gray-500 text-sm">
                      Processing preview...
                    </div>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-500 text-sm">
                      {totalFilteredCards > 0 ? `Card ID ${currentCardId}` : 'No cards available'}
                    </div>
                  )}
                </div>
                
                {/* Page boundary indicators */}
                <div className="absolute inset-0 border border-dashed border-gray-400 pointer-events-none"></div>
                
                {/* Center guides */}
                <div className="absolute inset-0 pointer-events-none">
                  <div className="absolute top-1/2 left-0 w-full h-px bg-blue-300 opacity-50"></div>
                  <div className="absolute left-1/2 top-0 w-px h-full bg-blue-300 opacity-50"></div>
                </div>
              </div>
            </div>
            
          </div>
          
          {/* Information Display - Two Column Layout */}
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Input/Source Information Column */}
            <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
              <h4 className="text-sm font-medium text-gray-700 mb-3">
                Input Information
              </h4>
              <div className="text-sm text-gray-600 space-y-2">
                {cardDimensions && (
                  <p>
                    <span className="font-medium">Card image:</span>{' '}
                    {cardDimensions.widthPx} × {cardDimensions.heightPx} px ({cardDimensions.widthInches.toFixed(2)}" × {cardDimensions.heightInches.toFixed(2)}")
                  </p>
                )}
                <p>
                  <span className="font-medium">Total cards:</span>{' '}
                  {totalCards} ({activePages.length} pages × {effectiveExtractionSettings.grid.rows}×{effectiveExtractionSettings.grid.columns})
                </p>
                <p>
                  <span className="font-medium">Front cards:</span>{' '}
                  {getAvailableCardIds('front', totalCards, effectivePdfMode, activePages, cardsPerPage, effectiveExtractionSettings).length} 
                  {(() => {
                    const totalFronts = countCardsByType('front', activePages, cardsPerPage, effectivePdfMode, effectiveExtractionSettings);
                    const availableFronts = getAvailableCardIds('front', totalCards, effectivePdfMode, activePages, cardsPerPage, effectiveExtractionSettings).length;
                    return totalFronts !== availableFronts ? ` (${totalFronts - availableFronts} skipped)` : '';
                  })()}
                </p>
                <p>
                  <span className="font-medium">Back cards:</span>{' '}
                  {getAvailableCardIds('back', totalCards, effectivePdfMode, activePages, cardsPerPage, effectiveExtractionSettings).length}
                  {(() => {
                    const totalBacks = countCardsByType('back', activePages, cardsPerPage, effectivePdfMode, effectiveExtractionSettings);
                    const availableBacks = getAvailableCardIds('back', totalCards, effectivePdfMode, activePages, cardsPerPage, effectiveExtractionSettings).length;
                    return totalBacks !== availableBacks ? ` (${totalBacks - availableBacks} skipped)` : '';
                  })()}
                </p>
                <p>
                  <span className="font-medium">PDF mode:</span>{' '}
                  {effectivePdfMode.type === 'simplex' ? 'Single-sided' : 
                   effectivePdfMode.type === 'duplex' ? 'Double-sided' : 
                   effectivePdfMode.type === 'gutter-fold' ? 'Gutter-fold' : effectivePdfMode.type}
                </p>
              </div>
            </div>

            {/* Output/Final Settings Column */}
            <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
              <h4 className="text-sm font-medium text-gray-700 mb-3">
                Output Settings
              </h4>
              <div className="text-sm text-gray-600 space-y-2">
                <p>
                  <span className="font-medium">Page size:</span>{' '}
                  {effectiveOutputSettings.pageSize.width}" × {effectiveOutputSettings.pageSize.height}"
                </p>
                <p>
                  <span className="font-medium">Card size:</span>{' '}
                  {effectiveOutputSettings.cardSize?.widthInches || DEFAULT_SETTINGS.outputSettings.cardSize.widthInches}" × {effectiveOutputSettings.cardSize?.heightInches || DEFAULT_SETTINGS.outputSettings.cardSize.heightInches}"
                </p>
                <p>
                  <span className="font-medium">Card scale:</span>{' '}
                  {effectiveOutputSettings.cardScalePercent || DEFAULT_SETTINGS.outputSettings.cardScalePercent}%
                </p>
                <p>
                  <span className="font-medium">Bleed margin:</span>{' '}
                  {effectiveOutputSettings.bleedMarginInches || DEFAULT_SETTINGS.outputSettings.bleedMarginInches}"
                </p>
                <p>
                  <span className="font-medium">Card offset:</span>{' '}
                  {effectiveOutputSettings.offset.horizontal.toFixed(3)}" horizontal, {effectiveOutputSettings.offset.vertical.toFixed(3)}" vertical
                </p>
                <p>
                  <span className="font-medium">Rotation:</span>{' '}
                  Front {getRotationForCardType(effectiveOutputSettings, 'front')}°, Back {getRotationForCardType(effectiveOutputSettings, 'back')}°
                </p>
                <p>
                  <span className="font-medium">Final print size:</span>{' '}
                  {(() => {
                    const cardDimensions = calculateCardDimensions(effectiveOutputSettings);
                    return `${cardDimensions.scaledCardWidthInches.toFixed(2)}" × ${cardDimensions.scaledCardHeightInches.toFixed(2)}"`;
                  })()}
                </p>
              </div>
            </div>
          </div>
        </div>
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

      {/* Calibration Wizard Modal */}
      {showCalibrationWizard && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">
              Calibration Measurements
            </h3>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
              <h4 className="text-sm font-medium text-blue-800 mb-2">Simple 3-Measurement Guide</h4>
              <p className="text-sm text-blue-700 mb-2">
                Measure with a ruler from the <strong>center dot</strong> to the <strong>card edges</strong> and the <strong>crosshair end</strong>:
              </p>
              <div className="text-xs text-blue-600 space-y-1">
                <p>• <strong>Right edge:</strong> Distance from center dot to right edge of card</p>
                <p>• <strong>Top edge:</strong> Distance from center dot to top edge of card</p>
                <p>• <strong>Crosshair length:</strong> Length of crosshair arm (from center to end)</p>
              </div>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Distance to Right Edge (inches)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={calibrationMeasurements.rightDistance}
                  onChange={(e) => handleCalibrationMeasurementChange('rightDistance', e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                  placeholder="1.25"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Distance from center dot to right edge of card (expect ~{(effectiveOutputSettings.cardSize?.widthInches || DEFAULT_SETTINGS.outputSettings.cardSize.widthInches) / 2}")
                </p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Distance to Top Edge (inches)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={calibrationMeasurements.topDistance}
                  onChange={(e) => handleCalibrationMeasurementChange('topDistance', e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                  placeholder="1.75"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Distance from center dot to top edge of card (expect ~{(effectiveOutputSettings.cardSize?.heightInches || DEFAULT_SETTINGS.outputSettings.cardSize.heightInches) / 2}")
                </p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Crosshair Arm Length (inches)
                </label>
                <input
                  type="number"
                  step="0.001"
                  value={calibrationMeasurements.crosshairLength}
                  onChange={(e) => handleCalibrationMeasurementChange('crosshairLength', e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                  placeholder="1.000"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Actual printed length of crosshair arm from center to end (expect ~1.0")
                </p>
              </div>
            </div>
            
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowCalibrationWizard(false)}
                className="px-4 py-2 text-sm bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={handleApplyCalibration}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Apply Adjustments
              </button>
            </div>
          </div>
        </div>
      )}
    </div>;
};