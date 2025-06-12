import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ChevronLeftIcon, ChevronRightIcon, MoveHorizontalIcon, MoveVerticalIcon, RotateCcwIcon, PrinterIcon, RulerIcon } from 'lucide-react';
import { 
  getActivePages, 
  calculateTotalCards, 
  getCardInfo, 
  extractCardImage as extractCardImageUtil,
  getAvailableCardIds,
  getRotationForCardType,
  countCardsByType,
  calculatePreviewScale
} from '../utils/cardUtils';
import { generateCalibrationPDF, calculateCalibrationSettings } from '../utils/calibrationUtils';
import { DEFAULT_CARD_DIMENSIONS, DPI_CONSTANTS, PREVIEW_CONSTRAINTS } from '../constants';
import { DEFAULT_SETTINGS } from '../defaults';
interface ConfigureStepProps {
  pdfData: any;
  pdfMode: any;
  extractionSettings: any;
  outputSettings: any;
  pageSettings: any;
  onSettingsChange: (settings: any) => void;
  onPrevious: () => void;
  onNext: () => void;
}
export const ConfigureStep: React.FC<ConfigureStepProps> = ({
  pdfData,
  pdfMode,
  extractionSettings,
  outputSettings,
  pageSettings,
  onSettingsChange,
  onPrevious,
  onNext
}) => {
  const [currentCardId, setCurrentCardId] = useState(1); // Track logical card ID (1-based)
  const [cardPreviewUrl, setCardPreviewUrl] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'front' | 'back'>('front');
  const [showCalibrationWizard, setShowCalibrationWizard] = useState(false);
  const [calibrationMeasurements, setCalibrationMeasurements] = useState({
    leftMargin: '',
    rightMargin: '',
    topMargin: '',
    bottomMargin: '',
    horizontalScale: '',
    verticalScale: ''
  });
  
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

  // Calculate card front/back identification based on PDF mode (using utility function)
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
      };
      updatePreview();
    }
  }, [
    currentCardId,
    viewMode,
    extractCardImage, 
    totalFilteredCards,
    currentCardExists,
    currentCardIndex
  ]);

  const handlePageSizeChange = (dimension: string, value: number | { width: number; height: number }) => {
    if (dimension === 'preset' && typeof value === 'object') {
      const newSettings = {
        ...outputSettings,
        pageSize: value
      };
      onSettingsChange(newSettings);
    } else if (typeof value === 'number') {
      const newSettings = {
        ...outputSettings,
        pageSize: {
          ...outputSettings.pageSize,
          [dimension]: value
        }
      };
      onSettingsChange(newSettings);
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
    onSettingsChange(newSettings);
  };
  const handleCropChange = (edge: string, value: number) => {
    const newSettings = {
      ...outputSettings,
      crop: {
        ...outputSettings.crop,
        [edge]: value
      }
    };
    onSettingsChange(newSettings);
  };
  const handleRotationChange = (cardType: 'front' | 'back', value: number) => {
    const newSettings = {
      ...outputSettings,
      rotation: {
        ...(outputSettings.rotation || { front: 0, back: 0 }),
        [cardType]: value
      }
    };
    onSettingsChange(newSettings);
  };
  const handleCardScaleChange = (targetHeight: number) => {
    const newSettings = {
      ...outputSettings,
      cardScale: {
        targetHeight: targetHeight
      }
    };
    onSettingsChange(newSettings);
  };
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

  // Handle calibration PDF generation
  const handlePrintCalibration = useCallback(() => {
    // Calculate actual target card dimensions based on user settings
    const targetHeight = outputSettings.cardScale?.targetHeight || DEFAULT_SETTINGS.outputSettings.cardScale.targetHeight;
    
    // Convert pixel dimensions to inches for aspect ratio calculation
    const originalWidthPx = DEFAULT_CARD_DIMENSIONS.width;
    const originalHeightPx = DEFAULT_CARD_DIMENSIONS.height;
    
    // Calculate the width based on cropped aspect ratio
    const croppedWidthPx = originalWidthPx - (outputSettings.crop.left + outputSettings.crop.right);
    const croppedHeightPx = originalHeightPx - (outputSettings.crop.top + outputSettings.crop.bottom);
    const aspectRatio = croppedWidthPx / croppedHeightPx;
    const targetWidth = targetHeight * aspectRatio;
    
    console.log(`Calibration card: ${targetWidth.toFixed(2)}" × ${targetHeight}" on ${outputSettings.pageSize.width}" × ${outputSettings.pageSize.height}" media`);
    
    const pdfBlob = generateCalibrationPDF(
      targetWidth,
      targetHeight,
      outputSettings.pageSize.width,
      outputSettings.pageSize.height
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
  }, [outputSettings.pageSize, outputSettings.cardScale, outputSettings.crop]);

  // Handle calibration measurements and apply settings
  const handleApplyCalibration = useCallback(() => {
    const measurements = calibrationMeasurements;
    
    if (!measurements.leftMargin || !measurements.rightMargin || 
        !measurements.topMargin || !measurements.bottomMargin || 
        !measurements.horizontalScale || !measurements.verticalScale) {
      alert('Please enter all measurements before applying calibration.');
      return;
    }

    const settings = calculateCalibrationSettings(
      parseFloat(measurements.leftMargin),
      parseFloat(measurements.rightMargin),
      parseFloat(measurements.topMargin),
      parseFloat(measurements.bottomMargin),
      parseFloat(measurements.horizontalScale),
      parseFloat(measurements.verticalScale)
    );

    // Apply the calculated offsets
    handleOffsetChange('horizontal', settings.horizontalOffset);
    handleOffsetChange('vertical', settings.verticalOffset);
    
    // Apply the scale factors to the card height (use vertical scale factor for height)
    const currentHeight = outputSettings.cardScale?.targetHeight || DEFAULT_SETTINGS.outputSettings.cardScale.targetHeight;
    handleCardScaleChange(currentHeight * settings.verticalScaleFactor);
    
    // Close the wizard
    setShowCalibrationWizard(false);
    
    // Clear measurements
    setCalibrationMeasurements({
      leftMargin: '',
      rightMargin: '',
      topMargin: '',
      bottomMargin: '',
      horizontalScale: '',
      verticalScale: ''
    });
  }, [calibrationMeasurements, outputSettings.cardScale, handleOffsetChange, handleCardScaleChange]);

  const handleCalibrationMeasurementChange = useCallback((field: string, value: string) => {
    setCalibrationMeasurements(prev => ({
      ...prev,
      [field]: value
    }));
  }, []);

  return <div className="space-y-6">
      <h2 className="text-xl font-semibold text-gray-800">Configure Layout</h2>
      
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
            No cards available. Please configure extraction settings in the previous step.
          </p>
        </div>
      )}
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-medium text-gray-800 mb-3">
              Output Page Size
            </h3>
            <div className="mb-3">
              <div className="flex flex-wrap gap-2 mb-3">
                <button
                  onClick={() => handlePageSizeChange('preset', { width: 8.5, height: 11 })}
                  className="px-3 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50"
                >
                  Letter (8.5×11")
                </button>
                <button
                  onClick={() => handlePageSizeChange('preset', { width: 8.27, height: 11.69 })}
                  className="px-3 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50"
                >
                  A4 (8.27×11.69")
                </button>
                <button
                  onClick={() => handlePageSizeChange('preset', { width: 3.5, height: 3.5 })}
                  className="px-3 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50"
                >
                  Square (3.5×3.5")
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Width (inches)
                </label>
                <input type="number" step="0.1" min="1" max="12" value={outputSettings.pageSize.width} onChange={e => handlePageSizeChange('width', parseFloat(e.target.value))} className="w-full border border-gray-300 rounded-md px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Height (inches)
                </label>
                <input type="number" step="0.1" min="1" max="12" value={outputSettings.pageSize.height} onChange={e => handlePageSizeChange('height', parseFloat(e.target.value))} className="w-full border border-gray-300 rounded-md px-3 py-2" />
              </div>
            </div>
          </div>
          <div>
            <h3 className="text-lg font-medium text-gray-800 mb-3">
              Card Position Offset
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Horizontal (inches)
                </label>
                <div className="flex items-center">
                  <MoveHorizontalIcon size={16} className="text-gray-400 mr-2" />
                  <input type="number" step="0.01" min="-2" max="2" value={outputSettings.offset.horizontal} onChange={e => handleOffsetChange('horizontal', parseFloat(e.target.value))} className="w-full border border-gray-300 rounded-md px-3 py-2" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Vertical (inches)
                </label>
                <div className="flex items-center">
                  <MoveVerticalIcon size={16} className="text-gray-400 mr-2" />
                  <input type="number" step="0.01" min="-2" max="2" value={outputSettings.offset.vertical} onChange={e => handleOffsetChange('vertical', parseFloat(e.target.value))} className="w-full border border-gray-300 rounded-md px-3 py-2" />
                </div>
              </div>
            </div>
          </div>

          {/* Printer Calibration Section */}
          <div>
            <h3 className="text-lg font-medium text-gray-800 mb-3">
              Printer Calibration
            </h3>
            <p className="text-sm text-gray-600 mb-2">
              Print a test card on larger media to determine your printer's exact offset and scale. Place poker card stock in the center of the media for borderless printing.
            </p>
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 mb-4">
              <p className="text-xs text-gray-600">
                <span className="font-medium">Calibration target:</span>{' '}
                {(() => {
                  const targetHeight = outputSettings.cardScale?.targetHeight || DEFAULT_SETTINGS.outputSettings.cardScale.targetHeight;
                  const originalWidthPx = DEFAULT_CARD_DIMENSIONS.width;
                  const originalHeightPx = DEFAULT_CARD_DIMENSIONS.height;
                  const croppedWidthPx = originalWidthPx - (outputSettings.crop.left + outputSettings.crop.right);
                  const croppedHeightPx = originalHeightPx - (outputSettings.crop.top + outputSettings.crop.bottom);
                  const aspectRatio = croppedWidthPx / croppedHeightPx;
                  const targetWidth = targetHeight * aspectRatio;
                  return `${targetWidth.toFixed(2)}" × ${targetHeight}" direct card printing`;
                })()}
              </p>
            </div>
            
            <div className="space-y-4">
              {/* Step 1: Print Calibration Card */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="text-sm font-medium text-blue-800 mb-2 flex items-center">
                  <PrinterIcon size={16} className="mr-2" />
                  Step 1: Print Calibration Card
                </h4>
                <p className="text-sm text-blue-700 mb-3">
                  Download and print this test card using borderless mode. Place poker card stock in the center of the media where the calibration pattern is positioned.
                </p>
                <button
                  onClick={handlePrintCalibration}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
                >
                  Download Calibration PDF
                </button>
              </div>

              {/* Step 2: Measure and Enter Values */}
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h4 className="text-sm font-medium text-green-800 mb-2 flex items-center">
                  <RulerIcon size={16} className="mr-2" />
                  Step 2: Measure and Enter Values
                </h4>
                <p className="text-sm text-green-700 mb-3">
                  Use a ruler to measure the printed card. The card should be centered where the calibration pattern appears on the media.
                </p>
                
                <button
                  onClick={() => setShowCalibrationWizard(true)}
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm"
                >
                  Enter Measurements
                </button>
              </div>
            </div>
          </div>
          
          <div>
            <h3 className="text-lg font-medium text-gray-800 mb-3">
              Card Crop Settings
            </h3>
            <p className="text-sm text-gray-600 mb-3">
              Remove pixels from each edge of the extracted card (applied before scaling)
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Top Crop (px)
                </label>
                <input type="number" value={outputSettings.crop.top} onChange={e => handleCropChange('top', parseInt(e.target.value))} className="w-full border border-gray-300 rounded-md px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Right Crop (px)
                </label>
                <input type="number" value={outputSettings.crop.right} onChange={e => handleCropChange('right', parseInt(e.target.value))} className="w-full border border-gray-300 rounded-md px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Bottom Crop (px)
                </label>
                <input type="number" value={outputSettings.crop.bottom} onChange={e => handleCropChange('bottom', parseInt(e.target.value))} className="w-full border border-gray-300 rounded-md px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Left Crop (px)
                </label>
                <input type="number" value={outputSettings.crop.left} onChange={e => handleCropChange('left', parseInt(e.target.value))} className="w-full border border-gray-300 rounded-md px-3 py-2" />
              </div>
            </div>
          </div>
          <div>
            <h3 className="text-lg font-medium text-gray-800 mb-3">
              Card Size
            </h3>
            <p className="text-sm text-gray-600 mb-3">
              Set the target height for cards after cropping (before rotation)
            </p>
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Target Height (inches)
                </label>
                <input 
                  type="number" 
                  step="0.1" 
                  min="0.5" 
                  max="10" 
                  value={outputSettings.cardScale?.targetHeight || DEFAULT_SETTINGS.outputSettings.cardScale.targetHeight} 
                  onChange={e => handleCardScaleChange(parseFloat(e.target.value))} 
                  className="w-full border border-gray-300 rounded-md px-3 py-2" 
                />
                <p className="text-xs text-gray-500 mt-1">
                  Width will be calculated automatically to maintain aspect ratio
                </p>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-medium text-gray-800 mb-3">
              Card Rotation
            </h3>
            <p className="text-sm text-gray-600 mb-3">
              Rotate the final card output for different orientations
            </p>
            
            {/* Front Card Rotation */}
            <div className="mb-4">
              <h4 className="text-sm font-medium text-gray-700 mb-2">
                Front Cards
              </h4>
              <div className="flex items-center space-x-4">
                <RotateCcwIcon size={16} className="text-gray-500" />
                <div className="flex-1 flex space-x-2">
                  {[0, 90, 180, 270].map(degree => <button key={`front-${degree}`} onClick={() => handleRotationChange('front', degree)} className={`flex-1 py-2 border ${
                    getRotationForCardType(outputSettings, 'front') === degree 
                      ? 'bg-blue-50 border-blue-300 text-blue-700' 
                      : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                  } rounded-md text-sm font-medium`}>
                      {degree}°
                    </button>)}
                </div>
              </div>
            </div>
            
            {/* Back Card Rotation */}
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">
                Back Cards
              </h4>
              <div className="flex items-center space-x-4">
                <RotateCcwIcon size={16} className="text-gray-500" />
                <div className="flex-1 flex space-x-2">
                  {[0, 90, 180, 270].map(degree => <button key={`back-${degree}`} onClick={() => handleRotationChange('back', degree)} className={`flex-1 py-2 border ${
                    getRotationForCardType(outputSettings, 'back') === degree 
                      ? 'bg-blue-50 border-blue-300 text-blue-700' 
                      : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                  } rounded-md text-sm font-medium`}>
                      {degree}°
                    </button>)}
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="space-y-4">
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <div className="bg-gray-50 p-3 border-b border-gray-200">
              {/* View Mode Toggle */}
              <div className="flex items-center justify-center mb-3">
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
              </div>
              
              {/* Card Navigation */}
              <div className="flex justify-between items-center">
                <div className="flex items-center space-x-2">
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
                <div className="text-sm text-gray-500">
                  {totalFilteredCards > 0 && currentCardExists ? `Card ID: ${currentCardId}` : 'No cards'}
                </div>
              </div>
            </div>
            <div className="p-4 bg-gray-100">
              <div className="relative mx-auto bg-white shadow" style={{
              ...(() => {
                const { previewWidth, previewHeight } = calculatePreviewScale(
                  outputSettings.pageSize.width,
                  outputSettings.pageSize.height,
                  PREVIEW_CONSTRAINTS.MAX_WIDTH,
                  PREVIEW_CONSTRAINTS.MAX_HEIGHT
                );
                
                return { width: `${previewWidth}px`, height: `${previewHeight}px` };
              })()
            }}>
                {/* Card positioned on the page */}
                <div className="absolute bg-gray-200 border border-gray-300 overflow-hidden" style={{
                ...(() => {
                  // Calculate the same scale factor used for the page preview
                  const { scale } = calculatePreviewScale(
                    outputSettings.pageSize.width,
                    outputSettings.pageSize.height,
                    PREVIEW_CONSTRAINTS.MAX_WIDTH,
                    PREVIEW_CONSTRAINTS.MAX_HEIGHT
                  );
                  
                  // Calculate actual card dimensions with correct transformation order:
                  // 1. Extract card at original size
                  // 2. Apply crop (remove pixels from edges)
                  // 3. Apply scale (resize to target height) 
                  // 4. Apply rotation (handled by CSS transform)
                  
                  const targetHeight = outputSettings.cardScale?.targetHeight || DEFAULT_SETTINGS.outputSettings.cardScale.targetHeight; // inches
                  
                  // Get original extracted card dimensions (before any transformations)
                  const originalCardWidth = DEFAULT_CARD_DIMENSIONS.width; 
                  const originalCardHeight = DEFAULT_CARD_DIMENSIONS.height;
                  
                  // Step 1: Apply cropping to original dimensions
                  const croppedCardWidth = originalCardWidth - (outputSettings.crop.left + outputSettings.crop.right);
                  const croppedCardHeight = originalCardHeight - (outputSettings.crop.top + outputSettings.crop.bottom);
                  
                  // Step 2: Calculate scale factor based on target height of cropped card
                  const targetHeightPx = targetHeight * DPI_CONSTANTS.EXTRACTION_DPI;
                  const cardScaleFactor = targetHeightPx / croppedCardHeight;
                  
                  // Step 3: Apply scaling to cropped dimensions
                  const finalCardWidth = croppedCardWidth * cardScaleFactor;
                  const finalCardHeight = croppedCardHeight * cardScaleFactor;
                  
                  // Convert to preview scale for display
                  const cardWidth = finalCardWidth * scale / DPI_CONSTANTS.EXTRACTION_DPI * DPI_CONSTANTS.SCREEN_DPI; // Convert to screen pixels
                  const cardHeight = finalCardHeight * scale / DPI_CONSTANTS.EXTRACTION_DPI * DPI_CONSTANTS.SCREEN_DPI;
                  const offsetX = outputSettings.offset.horizontal * DPI_CONSTANTS.SCREEN_DPI * scale;
                  const offsetY = outputSettings.offset.vertical * DPI_CONSTANTS.SCREEN_DPI * scale;
                  
                  return {
                    width: `${cardWidth}px`,
                    height: `${cardHeight}px`,
                    top: '50%',
                    left: '50%',
                    marginLeft: `calc(-${cardWidth / 2}px + ${offsetX}px)`,
                    marginTop: `calc(-${cardHeight / 2}px + ${offsetY}px)`,
                    transform: `rotate(${getRotationForCardType(outputSettings, viewMode)}deg)`
                  };
                })()
              }}>
                  {cardPreviewUrl ? (
                    <div 
                      className="w-full h-full bg-cover bg-center"
                      style={{
                        ...(() => {
                          // Calculate the same scale factor for background sizing
                          const { scale } = calculatePreviewScale(
                            outputSettings.pageSize.width,
                            outputSettings.pageSize.height,
                            PREVIEW_CONSTRAINTS.MAX_WIDTH,
                            PREVIEW_CONSTRAINTS.MAX_HEIGHT
                          );
                          
                          // Calculate card scaling for background with correct transformation order
                          const targetHeight = outputSettings.cardScale?.targetHeight || DEFAULT_SETTINGS.outputSettings.cardScale.targetHeight; // inches
                          
                          // Original extracted card dimensions
                          const originalCardWidth = DEFAULT_CARD_DIMENSIONS.width;
                          const originalCardHeight = DEFAULT_CARD_DIMENSIONS.height;
                          
                          // Apply cropping first
                          const croppedCardHeight = originalCardHeight - (outputSettings.crop.top + outputSettings.crop.bottom);
                          
                          // Then apply scaling
                          const targetHeightPx = targetHeight * DPI_CONSTANTS.EXTRACTION_DPI;
                          const cardScaleFactor = targetHeightPx / croppedCardHeight;
                          
                          return {
                            backgroundImage: `url(${cardPreviewUrl})`,
                            backgroundPosition: `${-outputSettings.crop.left * cardScaleFactor * scale / DPI_CONSTANTS.EXTRACTION_DPI * DPI_CONSTANTS.SCREEN_DPI}px ${-outputSettings.crop.top * cardScaleFactor * scale / DPI_CONSTANTS.EXTRACTION_DPI * DPI_CONSTANTS.SCREEN_DPI}px`,
                            backgroundSize: `${originalCardWidth * cardScaleFactor * scale / DPI_CONSTANTS.EXTRACTION_DPI * DPI_CONSTANTS.SCREEN_DPI}px ${originalCardHeight * cardScaleFactor * scale / DPI_CONSTANTS.EXTRACTION_DPI * DPI_CONSTANTS.SCREEN_DPI}px`
                          };
                        })()
                      }}
                    />
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
              </div>
            </div>
          </div>
          <div className="p-4 border border-gray-200 rounded-lg">
            <h4 className="text-sm font-medium text-gray-700 mb-2">
              Output Preview
            </h4>
            <div className="text-sm text-gray-600 space-y-2">
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
              <p>
                <span className="font-medium">Page size:</span>{' '}
                {outputSettings.pageSize.width}" ×{' '}
                {outputSettings.pageSize.height}"
              </p>
              <p>
                <span className="font-medium">Card offset:</span>{' '}
                {outputSettings.offset.horizontal}" horizontal,{' '}
                {outputSettings.offset.vertical}" vertical
              </p>
              <p>
                <span className="font-medium">Card crop:</span>{' '}
                {outputSettings.crop.top}px top, {outputSettings.crop.right}px
                right, {outputSettings.crop.bottom}px bottom,{' '}
                {outputSettings.crop.left}px left
              </p>
              <p>
                <span className="font-medium">Rotation:</span>{' '}
                Front {getRotationForCardType(outputSettings, 'front')}°, Back {getRotationForCardType(outputSettings, 'back')}°
              </p>
              <p>
                <span className="font-medium">Card size:</span>{' '}
                {(() => {
                  const targetHeight = outputSettings.cardScale?.targetHeight || DEFAULT_SETTINGS.outputSettings.cardScale.targetHeight;
                  // Calculate width based on cropped dimensions, not original
                  const originalWidth = DEFAULT_CARD_DIMENSIONS.width;
                  const originalHeight = DEFAULT_CARD_DIMENSIONS.height;
                  const croppedWidth = originalWidth - (outputSettings.crop.left + outputSettings.crop.right);
                  const croppedHeight = originalHeight - (outputSettings.crop.top + outputSettings.crop.bottom);
                  const aspectRatio = croppedWidth / croppedHeight;
                  const targetWidth = targetHeight * aspectRatio;
                  return `${targetWidth.toFixed(2)}" × ${targetHeight}" (after crop)`;
                })()}
              </p>
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
            <p className="text-sm text-gray-600 mb-4">
              Measure the printed calibration card with a ruler. For a perfectly aligned printer, all margins should measure approximately 0.5 inches:
            </p>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Left Margin (inches)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={calibrationMeasurements.leftMargin}
                    onChange={(e) => handleCalibrationMeasurementChange('leftMargin', e.target.value)}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                    placeholder="0.00"
                  />
                  <p className="text-xs text-gray-500 mt-1">Distance from left card edge to reference line</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Right Margin (inches)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={calibrationMeasurements.rightMargin}
                    onChange={(e) => handleCalibrationMeasurementChange('rightMargin', e.target.value)}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                    placeholder="0.00"
                  />
                  <p className="text-xs text-gray-500 mt-1">Distance from right card edge to reference line</p>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Top Margin (inches)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={calibrationMeasurements.topMargin}
                    onChange={(e) => handleCalibrationMeasurementChange('topMargin', e.target.value)}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                    placeholder="0.00"
                  />
                  <p className="text-xs text-gray-500 mt-1">Distance from top card edge to reference line</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Bottom Margin (inches)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={calibrationMeasurements.bottomMargin}
                    onChange={(e) => handleCalibrationMeasurementChange('bottomMargin', e.target.value)}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                    placeholder="0.00"
                  />
                  <p className="text-xs text-gray-500 mt-1">Distance from bottom card edge to reference line</p>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Horizontal Scale Bar (inches)
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    value={calibrationMeasurements.horizontalScale}
                    onChange={(e) => handleCalibrationMeasurementChange('horizontalScale', e.target.value)}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                    placeholder="1.000"
                  />
                  <p className="text-xs text-gray-500 mt-1">Actual printed length of the horizontal crosshair</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Vertical Scale Bar (inches)
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    value={calibrationMeasurements.verticalScale}
                    onChange={(e) => handleCalibrationMeasurementChange('verticalScale', e.target.value)}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                    placeholder="1.000"
                  />
                  <p className="text-xs text-gray-500 mt-1">Actual printed length of the vertical crosshair</p>
                </div>
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
                Apply Settings
              </button>
            </div>
          </div>
        </div>
      )}
    </div>;
};