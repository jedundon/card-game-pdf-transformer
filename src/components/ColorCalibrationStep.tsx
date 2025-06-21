import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ChevronLeftIcon, ChevronRightIcon, PaletteIcon } from 'lucide-react';
import { 
  getActivePages, 
  calculateTotalCards, 
  getCardInfo, 
  extractCardImage as extractCardImageUtil,
  getAvailableCardIds,
  getRotationForCardType,
  countCardsByType
} from '../utils/cardUtils';
import { 
  calculateFinalCardRenderDimensions,
  calculateCardPositioning,
  calculatePreviewScaling,
  processCardImageForRendering
} from '../utils/renderUtils';
import { 
  applyColorTransformation,
  getDefaultColorTransformation,
  ColorTransformation
} from '../utils/colorUtils';
import { PREVIEW_CONSTRAINTS } from '../constants';

interface ColorCalibrationStepProps {
  pdfData: any;
  pdfMode: any;
  extractionSettings: any;
  outputSettings: any;
  pageSettings: any;
  cardDimensions: {
    widthPx: number;
    heightPx: number;
    widthInches: number;
    heightInches: number;
  } | null;
  colorSettings: any;
  onColorSettingsChange: (settings: any) => void;
  onPrevious: () => void;
  onNext: () => void;
}

export const ColorCalibrationStep: React.FC<ColorCalibrationStepProps> = ({
  pdfData,
  pdfMode,
  extractionSettings,
  outputSettings,
  pageSettings,
  cardDimensions,
  colorSettings,
  onColorSettingsChange,
  onPrevious,
  onNext
}) => {
  const [currentCardId, setCurrentCardId] = useState(1);
  const [cardPreviewUrl, setCardPreviewUrl] = useState<string | null>(null);
  const [processedPreviewUrl, setProcessedPreviewUrl] = useState<string | null>(null);
  const [colorTransformedPreviewUrl, setColorTransformedPreviewUrl] = useState<string | null>(null);
  const [cardRenderData, setCardRenderData] = useState<{
    renderDimensions: any;
    positioning: any;
    previewScaling: any;
  } | null>(null);
  const [viewMode, setViewMode] = useState<'front' | 'back'>('front');
  const [hoverPosition, setHoverPosition] = useState<{ x: number; y: number } | null>(null);
  
  // Current color transformation settings from finalAdjustments
  const currentColorTransformation: ColorTransformation = useMemo(() => {
    return colorSettings?.finalAdjustments || getDefaultColorTransformation();
  }, [colorSettings?.finalAdjustments]);

  // Calculate crop region dimensions based on grid configuration
  const cropRegionDimensions = useMemo(() => {
    if (!cardRenderData) return null;
    
    const gridColumns = colorSettings?.gridConfig?.columns || 5;
    const gridRows = colorSettings?.gridConfig?.rows || 4;
    
    // Calculate crop region size in preview pixels
    const cropWidthPreview = cardRenderData.previewScaling.previewCardWidth / gridColumns;
    const cropHeightPreview = cardRenderData.previewScaling.previewCardHeight / gridRows;
    
    // Calculate crop region size in actual inches
    const cropWidthInches = cardRenderData.renderDimensions.cardWidthInches / gridColumns;
    const cropHeightInches = cardRenderData.renderDimensions.cardHeightInches / gridRows;
    
    return {
      widthPreview: cropWidthPreview,
      heightPreview: cropHeightPreview,
      widthInches: cropWidthInches,
      heightInches: cropHeightInches
    };
  }, [cardRenderData, colorSettings?.gridConfig]);

  // Calculate total cards from extraction settings and active pages
  const activePages = useMemo(() => 
    getActivePages(pageSettings), 
    [pageSettings]
  );
  
  const cardsPerPage = extractionSettings.grid.rows * extractionSettings.grid.columns;

  // Calculate total unique cards based on PDF mode and card type
  const totalCards = useMemo(() => 
    calculateTotalCards(pdfMode, activePages, cardsPerPage), 
    [pdfMode, activePages, cardsPerPage]
  );

  // Calculate card front/back identification based on PDF mode
  const getCardInfoCallback = useCallback((cardIndex: number) => 
    getCardInfo(cardIndex, activePages, extractionSettings, pdfMode, cardsPerPage), 
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

  // Extract card image for preview using utility function
  const extractCardImage = useCallback(async (cardIndex: number): Promise<string | null> => {
    return await extractCardImageUtil(cardIndex, pdfData, pdfMode, activePages, pageSettings, extractionSettings);
  }, [pdfData, pdfMode, activePages, pageSettings, extractionSettings]);

  // Update card preview when current card changes
  useEffect(() => {
    if (totalFilteredCards > 0 && currentCardExists && currentCardIndex !== null) {
      const updatePreview = async () => {
        const cardUrl = await extractCardImage(currentCardIndex);
        setCardPreviewUrl(cardUrl);
        
        if (cardUrl) {
          try {
            // Use unified rendering functions to calculate preview data
            const renderDimensions = await calculateFinalCardRenderDimensions(cardUrl, outputSettings);
            const positioning = calculateCardPositioning(renderDimensions, outputSettings, viewMode);
            const previewScaling = calculatePreviewScaling(
              renderDimensions,
              positioning,
              outputSettings.pageSize.width,
              outputSettings.pageSize.height,
              PREVIEW_CONSTRAINTS.MAX_WIDTH,
              PREVIEW_CONSTRAINTS.MAX_HEIGHT
            );
            
            setCardRenderData({
              renderDimensions,
              positioning,
              previewScaling
            });
            
            // Process the image for preview (with clipping and rotation)
            const processedImage = await processCardImageForRendering(cardUrl, renderDimensions, positioning.rotation);
            setProcessedPreviewUrl(processedImage.imageUrl);
          } catch (error) {
            console.warn('Failed to calculate render data for preview:', error);
            setCardRenderData(null);
            setProcessedPreviewUrl(null);
          }
        } else {
          setCardRenderData(null);
          setProcessedPreviewUrl(null);
        }
      };
      updatePreview();
    } else {
      setCardPreviewUrl(null);
      setCardRenderData(null);
      setProcessedPreviewUrl(null);
    }
  }, [
    currentCardId,
    viewMode,
    extractCardImage, 
    totalFilteredCards,
    currentCardExists,
    currentCardIndex,
    outputSettings
  ]);

  // Apply color transformation to processed preview when color settings change
  useEffect(() => {
    if (processedPreviewUrl && currentColorTransformation) {
      const applyColorTransform = async () => {
        try {
          const colorTransformedUrl = await applyColorTransformation(processedPreviewUrl, currentColorTransformation);
          setColorTransformedPreviewUrl(colorTransformedUrl);
        } catch (error) {
          console.warn('Failed to apply color transformation:', error);
          setColorTransformedPreviewUrl(processedPreviewUrl);
        }
      };
      applyColorTransform();
    } else {
      setColorTransformedPreviewUrl(processedPreviewUrl);
    }
  }, [processedPreviewUrl, currentColorTransformation]);

  const handlePreviousCard = () => {
    const currentIndex = availableCardIds.indexOf(currentCardId);
    if (currentIndex > 0) {
      setCurrentCardId(availableCardIds[currentIndex - 1]);
    }
  };
  
  const handleNextCard = () => {
    const currentIndex = availableCardIds.indexOf(currentCardId);
    if (currentIndex < availableCardIds.length - 1) {
      setCurrentCardId(availableCardIds[currentIndex + 1]);
    }
  };

  // Handle view mode toggle - maintain current card ID when switching between front/back
  const handleViewModeToggle = (mode: 'front' | 'back') => {
    setViewMode(mode);
  };

  // Handle mouse move over card for crop region preview
  const handleCardMouseMove = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRenderData || !cropRegionDimensions) return;
    
    const rect = event.currentTarget.getBoundingClientRect();
    const relativeX = event.clientX - rect.left;
    const relativeY = event.clientY - rect.top;
    
    // Convert to card-relative coordinates
    const cardRect = {
      left: cardRenderData.previewScaling.previewX,
      top: cardRenderData.previewScaling.previewY,
      width: cardRenderData.previewScaling.previewCardWidth,
      height: cardRenderData.previewScaling.previewCardHeight
    };
    
    // Check if mouse is over the card
    if (relativeX >= cardRect.left && relativeX <= cardRect.left + cardRect.width &&
        relativeY >= cardRect.top && relativeY <= cardRect.top + cardRect.height) {
      
      // Calculate constrained center position for crop region
      const minX = cardRect.left + cropRegionDimensions.widthPreview / 2;
      const maxX = cardRect.left + cardRect.width - cropRegionDimensions.widthPreview / 2;
      const minY = cardRect.top + cropRegionDimensions.heightPreview / 2;
      const maxY = cardRect.top + cardRect.height - cropRegionDimensions.heightPreview / 2;
      
      const constrainedX = Math.max(minX, Math.min(maxX, relativeX));
      const constrainedY = Math.max(minY, Math.min(maxY, relativeY));
      
      setHoverPosition({ x: constrainedX, y: constrainedY });
    } else {
      setHoverPosition(null);
    }
  }, [cardRenderData, cropRegionDimensions]);

  // Handle mouse leave card area
  const handleCardMouseLeave = useCallback(() => {
    setHoverPosition(null);
  }, []);

  // Handle click to select crop region center
  const handleCardClick = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRenderData || !cropRegionDimensions || !hoverPosition) return;
    
    // Convert hover position to card-relative coordinates (0-1 normalized)
    const cardRect = {
      left: cardRenderData.previewScaling.previewX,
      top: cardRenderData.previewScaling.previewY,
      width: cardRenderData.previewScaling.previewCardWidth,
      height: cardRenderData.previewScaling.previewCardHeight
    };
    
    const normalizedX = (hoverPosition.x - cardRect.left) / cardRect.width;
    const normalizedY = (hoverPosition.y - cardRect.top) / cardRect.height;
    
    // Convert to actual card coordinates in inches
    const centerXInches = normalizedX * cardRenderData.renderDimensions.cardWidthInches;
    const centerYInches = normalizedY * cardRenderData.renderDimensions.cardHeightInches;
    
    // Update color settings with selected region
    const newSettings = {
      ...colorSettings,
      selectedRegion: {
        centerX: centerXInches,
        centerY: centerYInches,
        width: cropRegionDimensions.widthInches,
        height: cropRegionDimensions.heightInches,
        // Store preview coordinates for display
        previewCenterX: hoverPosition.x,
        previewCenterY: hoverPosition.y,
        previewWidth: cropRegionDimensions.widthPreview,
        previewHeight: cropRegionDimensions.heightPreview
      }
    };
    
    onColorSettingsChange(newSettings);
  }, [cardRenderData, cropRegionDimensions, hoverPosition, colorSettings, onColorSettingsChange]);

  // Ensure currentCardId is valid for the current view mode
  useEffect(() => {
    if (totalFilteredCards > 0 && !currentCardExists) {
      // Current card ID doesn't exist in current mode, fallback to first available card
      setCurrentCardId(availableCardIds[0]);
    }
  }, [currentCardExists, totalFilteredCards, availableCardIds]);

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-gray-800">Color Calibration</h2>
      
      {!pdfData && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-yellow-800">
            Please load a PDF file in the Import step to continue.
          </p>
        </div>
      )}
      
      {pdfData && totalCards === 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-yellow-800">
            No cards available. Please configure extraction settings in the previous steps.
          </p>
        </div>
      )}
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Panel: Color Controls */}
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-medium text-gray-800 mb-3 flex items-center">
              <PaletteIcon size={20} className="mr-2" />
              Color Transformation
            </h3>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="text-sm font-medium text-blue-800 mb-2">
                Color Calibration Workflow
              </h4>
              <div className="text-sm text-blue-700 space-y-1">
                <p>1. Adjust color settings and see real-time preview on the right</p>
                <p>2. Select a region for calibration testing</p>
                <p>3. Generate test grid PDF for physical printer comparison</p>
                <p>4. Apply optimal settings from test results</p>
              </div>
            </div>
          </div>

          {/* Basic Color Controls */}
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <h4 className="text-sm font-medium text-gray-700 mb-3">
              Basic Color Controls
            </h4>
            <div className="space-y-4">
              {/* Brightness */}
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">
                  Brightness: {currentColorTransformation.brightness}%
                </label>
                <input
                  type="range"
                  min="-100"
                  max="100"
                  step="1"
                  value={currentColorTransformation.brightness}
                  onChange={(e) => {
                    const newSettings = {
                      ...colorSettings,
                      finalAdjustments: {
                        ...colorSettings.finalAdjustments,
                        brightness: parseInt(e.target.value)
                      }
                    };
                    onColorSettingsChange(newSettings);
                  }}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                />
              </div>

              {/* Contrast */}
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">
                  Contrast: {currentColorTransformation.contrast.toFixed(2)}x
                </label>
                <input
                  type="range"
                  min="0.5"
                  max="2.0"
                  step="0.05"
                  value={currentColorTransformation.contrast}
                  onChange={(e) => {
                    const newSettings = {
                      ...colorSettings,
                      finalAdjustments: {
                        ...colorSettings.finalAdjustments,
                        contrast: parseFloat(e.target.value)
                      }
                    };
                    onColorSettingsChange(newSettings);
                  }}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                />
              </div>

              {/* Saturation */}
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">
                  Saturation: {currentColorTransformation.saturation}%
                </label>
                <input
                  type="range"
                  min="-100"
                  max="100"
                  step="1"
                  value={currentColorTransformation.saturation}
                  onChange={(e) => {
                    const newSettings = {
                      ...colorSettings,
                      finalAdjustments: {
                        ...colorSettings.finalAdjustments,
                        saturation: parseInt(e.target.value)
                      }
                    };
                    onColorSettingsChange(newSettings);
                  }}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                />
              </div>

              {/* Reset Button */}
              <button
                onClick={() => {
                  const newSettings = {
                    ...colorSettings,
                    finalAdjustments: getDefaultColorTransformation()
                  };
                  onColorSettingsChange(newSettings);
                }}
                className="w-full mt-3 px-3 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 text-sm"
              >
                Reset to Default
              </button>
            </div>
          </div>

          {/* Crop Region Selection */}
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <h4 className="text-sm font-medium text-gray-700 mb-3">
              Crop Region Selection
            </h4>
            <div className="text-sm text-gray-600 space-y-2">
              <p>
                <span className="font-medium">Grid size:</span>{' '}
                {colorSettings?.gridConfig?.columns || 5}×{colorSettings?.gridConfig?.rows || 4}
              </p>
              {cropRegionDimensions && (
                <p>
                  <span className="font-medium">Crop size:</span>{' '}
                  {cropRegionDimensions.widthInches.toFixed(3)}" × {cropRegionDimensions.heightInches.toFixed(3)}"
                </p>
              )}
              {colorSettings?.selectedRegion ? (
                <div>
                  <p className="text-green-700 font-medium">✓ Region selected</p>
                  <p>
                    <span className="font-medium">Center:</span>{' '}
                    ({colorSettings.selectedRegion.centerX.toFixed(3)}", {colorSettings.selectedRegion.centerY.toFixed(3)}")
                  </p>
                </div>
              ) : (
                <p className="text-orange-700">
                  🎯 Hover over card and click to select crop region
                </p>
              )}
            </div>
          </div>

          {/* Test Grid Configuration (Coming Soon) */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <h4 className="text-sm font-medium text-gray-700 mb-3">
              Test Grid Configuration (Coming Soon)
            </h4>
            <div className="text-sm text-gray-600 space-y-2">
              <p>• Column transformations: Brightness ±20%</p>
              <p>• Row transformations: Contrast ±30%</p>
              <p>• Grid generation and PDF export</p>
            </div>
          </div>
        </div>

        {/* Right Panel: Live Preview (copied from ConfigureStep) */}
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
                  <button 
                    onClick={handlePreviousCard} 
                    disabled={!currentCardExists || availableCardIds.indexOf(currentCardId) === 0} 
                    className="p-1 rounded-full hover:bg-gray-200 disabled:opacity-50"
                  >
                    <ChevronLeftIcon size={16} />
                  </button>
                  <span className="text-sm text-gray-700">
                    {totalFilteredCards > 0 && currentCardExists ? `${viewMode.charAt(0).toUpperCase() + viewMode.slice(1)} ${currentCardPosition} of ${totalFilteredCards}` : `No ${viewMode} cards`}
                  </span>
                  <button 
                    onClick={handleNextCard} 
                    disabled={!currentCardExists || availableCardIds.indexOf(currentCardId) === availableCardIds.length - 1} 
                    className="p-1 rounded-full hover:bg-gray-200 disabled:opacity-50"
                  >
                    <ChevronRightIcon size={16} />
                  </button>
                </div>
                
                {/* Card ID - Right */}
                <div className="ml-auto text-sm text-gray-500">
                  {totalFilteredCards > 0 && currentCardExists ? `Card ID: ${currentCardId}` : 'No cards'}
                </div>
              </div>
            </div>
            
            {/* Card Preview Area */}
            <div className="p-4 bg-gray-100">
              <div 
                className="relative mx-auto bg-white shadow cursor-crosshair" 
                style={{
                  ...(cardRenderData ? {
                    width: `${cardRenderData.previewScaling.previewPageWidth}px`,
                    height: `${cardRenderData.previewScaling.previewPageHeight}px`
                  } : {
                    width: '400px',
                    height: '300px'
                  })
                }}
                onMouseMove={handleCardMouseMove}
                onMouseLeave={handleCardMouseLeave}
                onClick={handleCardClick}
              >
                {/* Card positioned on the page */}
                <div className="absolute bg-gray-200 border border-gray-300 overflow-hidden" style={{
                  ...(cardRenderData ? {
                    width: `${cardRenderData.previewScaling.previewCardWidth}px`,
                    height: `${cardRenderData.previewScaling.previewCardHeight}px`,
                    left: `${cardRenderData.previewScaling.previewX}px`,
                    top: `${cardRenderData.previewScaling.previewY}px`
                  } : {
                    width: '100px',
                    height: '140px',
                    left: '50%',
                    top: '50%',
                    marginLeft: '-50px',
                    marginTop: '-70px'
                  })
                }}>
                  {colorTransformedPreviewUrl && cardRenderData ? (
                    <div 
                      className="w-full h-full bg-cover bg-center"
                      style={{
                        backgroundImage: `url(${colorTransformedPreviewUrl})`,
                        backgroundPosition: 'center center',
                        backgroundSize: 'contain',
                        backgroundRepeat: 'no-repeat'
                      }}
                    />
                  ) : cardPreviewUrl ? (
                    <div className="w-full h-full flex items-center justify-center text-gray-500 text-sm">
                      Loading dimensions...
                    </div>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-500 text-sm">
                      Card ID {currentCardId}
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

                {/* Crop Region Hover Preview */}
                {hoverPosition && cropRegionDimensions && (
                  <div 
                    className="absolute border-2 border-orange-400 bg-orange-200 bg-opacity-30 pointer-events-none"
                    style={{
                      left: `${hoverPosition.x - cropRegionDimensions.widthPreview / 2}px`,
                      top: `${hoverPosition.y - cropRegionDimensions.heightPreview / 2}px`,
                      width: `${cropRegionDimensions.widthPreview}px`,
                      height: `${cropRegionDimensions.heightPreview}px`
                    }}
                  >
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-xs text-orange-800 bg-white bg-opacity-90 px-1 rounded">
                        Click to select
                      </span>
                    </div>
                  </div>
                )}

                {/* Selected Crop Region */}
                {colorSettings?.selectedRegion && (
                  <div 
                    className="absolute border-2 border-green-500 bg-green-200 bg-opacity-30 pointer-events-none"
                    style={{
                      left: `${colorSettings.selectedRegion.previewCenterX - colorSettings.selectedRegion.previewWidth / 2}px`,
                      top: `${colorSettings.selectedRegion.previewCenterY - colorSettings.selectedRegion.previewHeight / 2}px`,
                      width: `${colorSettings.selectedRegion.previewWidth}px`,
                      height: `${colorSettings.selectedRegion.previewHeight}px`
                    }}
                  >
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-xs text-green-800 bg-white bg-opacity-90 px-1 rounded">
                        Selected region
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
          
          {/* Information Display */}
          <div className="mt-4 p-4 bg-gray-50 border border-gray-200 rounded-lg">
            <h4 className="text-sm font-medium text-gray-700 mb-3">
              Current Settings
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
                {countCardsByType('front', activePages, cardsPerPage, pdfMode, extractionSettings)}
              </p>
              <p>
                <span className="font-medium">Back cards:</span>{' '}
                {countCardsByType('back', activePages, cardsPerPage, pdfMode, extractionSettings)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex justify-between mt-6">
        <button 
          onClick={onPrevious} 
          className="flex items-center bg-gray-200 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-300"
        >
          <ChevronLeftIcon size={16} className="mr-2" />
          Previous Step
        </button>
        <button 
          onClick={onNext} 
          className="flex items-center bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
        >
          Next Step
          <ChevronRightIcon size={16} className="ml-2" />
        </button>
      </div>
    </div>
  );
};