import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import { AddFilesButton } from './AddFilesButton';
import { FileManagerPanel } from './FileManagerPanel';
import { ExportPageButton } from './shared/ExportPageButton';
import { PageSizeSettings } from './ConfigureStep/components/PageSizeSettings';
import { CardPositionSettings } from './ConfigureStep/components/CardPositionSettings';
import { CardSizeSettings } from './ConfigureStep/components/CardSizeSettings';
import { CalibrationSection } from './ConfigureStep/components/CalibrationSection';
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
  
  // Calculate total cards from extraction settings and active pages
  const activePages = useMemo(() => 
    getActivePagesWithSource(unifiedPages), 
    [unifiedPages]
  );
  
  const cardsPerPage = extractionSettings.grid.rows * extractionSettings.grid.columns;

  // Calculate total unique cards based on PDF mode and card type
  const totalCards = useMemo(() => 
    calculateTotalCards(pdfMode, activePages, cardsPerPage), 
    [pdfMode, activePages, cardsPerPage]
  );

  // Calculate card front/back identification based on PDF mode (using utility function)
  const getCardInfoCallback = useCallback((cardIndex: number) => 
    getCardInfo(cardIndex, activePages, extractionSettings, pdfMode, cardsPerPage, extractionSettings.pageDimensions?.width, extractionSettings.pageDimensions?.height), 
    [activePages, extractionSettings, pdfMode, cardsPerPage]
  );
  // Calculate cards filtered by type (front/back) - get all card IDs available in current view mode
  const availableCardIds = useMemo(() => 
    getAvailableCardIds(viewMode, totalCards, pdfMode, activePages, cardsPerPage, extractionSettings), 
    [viewMode, totalCards, pdfMode, activePages, cardsPerPage, extractionSettings]
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
    const maxIndex = pdfMode.type === 'duplex' || pdfMode.type === 'gutter-fold' 
      ? activePages.length * cardsPerPage 
      : totalCards;
    
    for (let i = 0; i < maxIndex; i++) {
      const cardInfo = getCardInfoCallback(i);
      if (cardInfo.id === currentCardId && cardInfo.type.toLowerCase() === viewMode) {
        return i;
      }
    }
    
    return null;
  }, [currentCardExists, currentCardId, viewMode, pdfMode.type, activePages.length, cardsPerPage, totalCards, getCardInfoCallback]);

  // Extract card image for preview using source-aware logic
  const extractCardImage = useCallback(async (cardIndex: number): Promise<string | null> => {
    // Calculate which page this card belongs to
    const cardsPerPageLocal = extractionSettings.grid.rows * extractionSettings.grid.columns;
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
          extractionSettings,
          cardIndex, // globalCardIndex
          activePages, 
          pdfMode
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
      return await extractCardImageFromCanvas(cardIndex, imageData, pdfMode, activePages, extractionSettings);
    }
    
    return null;
  }, [extractionSettings, pdfMode, activePages, getPdfData, getImageData]);

  // Cache management (available but not used in current implementation)
  // const clearCache = useCallback(() => {
  //   previewCacheRef.current.clear();
  // }, []);

  const getCacheKey = useCallback((cardId: number, mode: 'front' | 'back', settings: any) => {
    return JSON.stringify({ cardId, mode, settings: {
      cardSize: settings.cardSize,
      cardScalePercent: settings.cardScalePercent,
      rotation: settings.rotation,
      offset: settings.offset,
      cardImageSizingMode: settings.cardImageSizingMode,
      bleedMarginInches: settings.bleedMarginInches
    }});
  }, []);

  // Debounced settings change handler
  const debouncedSettingsChange = useCallback((newSettings: any) => {
    if (settingsChangeTimeoutRef.current) {
      clearTimeout(settingsChangeTimeoutRef.current);
    }
    
    pendingSettingsRef.current = newSettings;
    
    settingsChangeTimeoutRef.current = setTimeout(() => {
      if (pendingSettingsRef.current) {
        onSettingsChange(pendingSettingsRef.current);
        pendingSettingsRef.current = null;
      }
    }, TIMEOUT_CONSTANTS.SETTINGS_DEBOUNCE_DELAY);
  }, [onSettingsChange]);

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
      const cacheKey = getCacheKey(currentCardId, viewMode, outputSettings);
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
        const renderPromise = calculateFinalCardRenderDimensions(cardUrl, outputSettings);
        const renderTimeoutPromise = new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('Render calculation timed out')), TIMEOUT_CONSTANTS.RENDER_CALCULATION_TIMEOUT)
        );
        
        const renderDimensions = await Promise.race([renderPromise, renderTimeoutPromise]);
        
        if (isCancelled) return;
        
        // Calculate positioning
        setProgressMessage('Calculating card positioning...');
        const positioning = calculateCardPositioning(renderDimensions, outputSettings, viewMode);
        const previewScaling = calculatePreviewScaling(
          renderDimensions,
          positioning,
          outputSettings.pageSize.width,
          outputSettings.pageSize.height,
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
    outputSettings, // Add outputSettings as dependency so preview updates when settings change
    getCacheKey
  ]);

  const handlePageSizeChange = (dimension: string, value: number | { width: number; height: number }) => {
    if (dimension === 'preset' && typeof value === 'object') {
      const newSettings = {
        ...outputSettings,
        pageSize: value
      };
      debouncedSettingsChange(newSettings);
    } else if (typeof value === 'number') {
      const newSettings = {
        ...outputSettings,
        pageSize: {
          ...outputSettings.pageSize,
          [dimension]: value
        }
      };
      debouncedSettingsChange(newSettings);
    }
  };
  const handleOffsetChange = (direction: string, value: number) => {
    const newSettings = {
      ...outputSettings,
      offset: {
        ...outputSettings.offset,
        [direction]: value
      }
    };
    debouncedSettingsChange(newSettings);
  };
  const handleCardSizeChange = (dimension: 'widthInches' | 'heightInches', value: number) => {
    const newSettings = {
      ...outputSettings,
      cardSize: {
        ...(outputSettings.cardSize || DEFAULT_SETTINGS.outputSettings.cardSize),
        [dimension]: value
      }
    };
    debouncedSettingsChange(newSettings);
  };

  const handleCardScalePercentChange = (value: number) => {
    const newSettings = {
      ...outputSettings,
      cardScalePercent: value
    };
    debouncedSettingsChange(newSettings);
  };

  const handleBleedMarginChange = (value: number) => {
    const newSettings = {
      ...outputSettings,
      bleedMarginInches: value
    };
    debouncedSettingsChange(newSettings);
  };

  const handleRotationChange = (cardType: 'front' | 'back', value: number) => {
    const newSettings = {
      ...outputSettings,
      rotation: {
        ...(outputSettings.rotation || { front: 0, back: 0 }),
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
      const cacheKey = getCacheKey(adjacentCardId, viewMode, outputSettings);
      if (!previewCacheRef.current.has(cacheKey)) {
        // Find the card index for the adjacent card ID
        const maxIndex = pdfMode.type === 'duplex' || pdfMode.type === 'gutter-fold' 
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
              const renderDimensions = await calculateFinalCardRenderDimensions(cardUrl, outputSettings);
              const positioning = calculateCardPositioning(renderDimensions, outputSettings, viewMode);
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
                    outputSettings.pageSize.width,
                    outputSettings.pageSize.height,
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
  }, [availableCardIds, viewMode, outputSettings, getCacheKey, getCardInfoCallback, extractCardImage, pdfMode.type, activePages.length, cardsPerPage, totalCards]);
  
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
    const cardWidthInches = outputSettings.cardSize?.widthInches || DEFAULT_SETTINGS.outputSettings.cardSize.widthInches;
    const cardHeightInches = outputSettings.cardSize?.heightInches || DEFAULT_SETTINGS.outputSettings.cardSize.heightInches;
    
    // Apply scale percentage
    const scalePercent = outputSettings.cardScalePercent || DEFAULT_SETTINGS.outputSettings.cardScalePercent;
    const scaledWidth = cardWidthInches * (scalePercent / 100);
    const scaledHeight = cardHeightInches * (scalePercent / 100);
    
    // Get current offset settings
    const horizontalOffset = outputSettings.offset.horizontal || 0;
    const verticalOffset = outputSettings.offset.vertical || 0;
    
    // Get current rotation for the view mode being tested
    const rotation = getRotationForCardType(outputSettings, viewMode);
    
    console.log(`Calibration card: ${scaledWidth.toFixed(2)}" × ${scaledHeight}" with offset ${horizontalOffset.toFixed(3)}", ${verticalOffset.toFixed(3)}" and ${rotation}° rotation on ${outputSettings.pageSize.width}" × ${outputSettings.pageSize.height}" media`);
    
    const pdfBlob = generateCalibrationPDF(
      scaledWidth,
      scaledHeight,
      outputSettings.pageSize.width,
      outputSettings.pageSize.height,
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
  }, [outputSettings.pageSize, outputSettings.cardSize, outputSettings.cardScalePercent, outputSettings.offset, viewMode]);

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
    const cardWidthInches = outputSettings.cardSize?.widthInches || DEFAULT_SETTINGS.outputSettings.cardSize.widthInches;
    const cardHeightInches = outputSettings.cardSize?.heightInches || DEFAULT_SETTINGS.outputSettings.cardSize.heightInches;

    const settings = calculateCalibrationSettings(
      rightDistance,
      topDistance,
      crosshairLength,
      cardWidthInches,
      cardHeightInches,
      outputSettings.offset.horizontal || 0,
      outputSettings.offset.vertical || 0,
      outputSettings.cardScalePercent || DEFAULT_SETTINGS.outputSettings.cardScalePercent
    );

    // Apply the new calculated settings (batch offset changes to avoid state timing issues)
    const newSettings = {
      ...outputSettings,
      offset: {
        horizontal: settings.newHorizontalOffset,
        vertical: settings.newVerticalOffset
      },
      cardScalePercent: settings.newScalePercent
    };
    
    onSettingsChange(newSettings);
    
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
  }, [calibrationMeasurements, onSettingsChange]);

  const handleCalibrationMeasurementChange = useCallback((field: string, value: string) => {
    setCalibrationMeasurements(prev => ({
      ...prev,
      [field]: value
    }));
  }, []);

  const handleCardSizePreset = (size: { widthInches: number; heightInches: number }) => {
    const newSettings = {
      ...outputSettings,
      cardSize: size
    };
    debouncedSettingsChange(newSettings);
  };

  const handleCardImageSizingModeChange = (mode: 'actual-size' | 'fit-to-card' | 'fill-card') => {
    const newSettings = {
      ...outputSettings,
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
      
      {/* File Management Panel */}
      {multiFileImport.getFileList().length > 0 && (
        <FileManagerPanel 
          multiFileImport={multiFileImport}
          expanded={false}
          compact={true}
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
            outputSettings={outputSettings}
            onPageSizeChange={handlePageSizeChange}
          />
          <CardPositionSettings
            outputSettings={outputSettings}
            onOffsetChange={handleOffsetChange}
          />

          <CardSizeSettings
            outputSettings={outputSettings}
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
            outputSettings={outputSettings}
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
                      pdfMode={pdfMode}
                      extractionSettings={extractionSettings}
                      outputSettings={outputSettings}
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
                            const cacheKey = getCacheKey(currentCardId, viewMode, outputSettings);
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
                  {totalCards} ({activePages.length} pages × {extractionSettings.grid.rows}×{extractionSettings.grid.columns})
                </p>
                <p>
                  <span className="font-medium">Front cards:</span>{' '}
                  {getAvailableCardIds('front', totalCards, pdfMode, activePages, cardsPerPage, extractionSettings).length} 
                  {(() => {
                    const totalFronts = countCardsByType('front', activePages, cardsPerPage, pdfMode, extractionSettings);
                    const availableFronts = getAvailableCardIds('front', totalCards, pdfMode, activePages, cardsPerPage, extractionSettings).length;
                    return totalFronts !== availableFronts ? ` (${totalFronts - availableFronts} skipped)` : '';
                  })()}
                </p>
                <p>
                  <span className="font-medium">Back cards:</span>{' '}
                  {getAvailableCardIds('back', totalCards, pdfMode, activePages, cardsPerPage, extractionSettings).length}
                  {(() => {
                    const totalBacks = countCardsByType('back', activePages, cardsPerPage, pdfMode, extractionSettings);
                    const availableBacks = getAvailableCardIds('back', totalCards, pdfMode, activePages, cardsPerPage, extractionSettings).length;
                    return totalBacks !== availableBacks ? ` (${totalBacks - availableBacks} skipped)` : '';
                  })()}
                </p>
                <p>
                  <span className="font-medium">PDF mode:</span>{' '}
                  {pdfMode.type === 'simplex' ? 'Single-sided' : 
                   pdfMode.type === 'duplex' ? 'Double-sided' : 
                   pdfMode.type === 'gutter-fold' ? 'Gutter-fold' : pdfMode.type}
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
                  {outputSettings.pageSize.width}" × {outputSettings.pageSize.height}"
                </p>
                <p>
                  <span className="font-medium">Card size:</span>{' '}
                  {outputSettings.cardSize?.widthInches || DEFAULT_SETTINGS.outputSettings.cardSize.widthInches}" × {outputSettings.cardSize?.heightInches || DEFAULT_SETTINGS.outputSettings.cardSize.heightInches}"
                </p>
                <p>
                  <span className="font-medium">Card scale:</span>{' '}
                  {outputSettings.cardScalePercent || DEFAULT_SETTINGS.outputSettings.cardScalePercent}%
                </p>
                <p>
                  <span className="font-medium">Bleed margin:</span>{' '}
                  {outputSettings.bleedMarginInches || DEFAULT_SETTINGS.outputSettings.bleedMarginInches}"
                </p>
                <p>
                  <span className="font-medium">Card offset:</span>{' '}
                  {outputSettings.offset.horizontal.toFixed(3)}" horizontal, {outputSettings.offset.vertical.toFixed(3)}" vertical
                </p>
                <p>
                  <span className="font-medium">Rotation:</span>{' '}
                  Front {getRotationForCardType(outputSettings, 'front')}°, Back {getRotationForCardType(outputSettings, 'back')}°
                </p>
                <p>
                  <span className="font-medium">Final print size:</span>{' '}
                  {(() => {
                    const cardDimensions = calculateCardDimensions(outputSettings);
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
                  Distance from center dot to right edge of card (expect ~{(outputSettings.cardSize?.widthInches || DEFAULT_SETTINGS.outputSettings.cardSize.widthInches) / 2}")
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
                  Distance from center dot to top edge of card (expect ~{(outputSettings.cardSize?.heightInches || DEFAULT_SETTINGS.outputSettings.cardSize.heightInches) / 2}")
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