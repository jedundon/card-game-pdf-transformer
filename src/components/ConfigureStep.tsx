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
  calculateCardDimensions
} from '../utils/cardUtils';
import { 
  calculateFinalCardRenderDimensions,
  calculateCardPositioning,
  calculatePreviewScaling,
  processCardImageForRendering
} from '../utils/renderUtils';
import { generateCalibrationPDF, calculateCalibrationSettings } from '../utils/calibrationUtils';
import { PREVIEW_CONSTRAINTS } from '../constants';
import { DEFAULT_SETTINGS } from '../defaults';
interface ConfigureStepProps {
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
  cardDimensions,
  onSettingsChange,
  onPrevious,
  onNext
}) => {
  const [currentCardId, setCurrentCardId] = useState(1); // Track logical card ID (1-based)
  const [cardPreviewUrl, setCardPreviewUrl] = useState<string | null>(null);
  const [processedPreviewUrl, setProcessedPreviewUrl] = useState<string | null>(null);
  const [cardRenderData, setCardRenderData] = useState<{
    renderDimensions: any;
    positioning: any;
    previewScaling: any;
  } | null>(null);
  const [viewMode, setViewMode] = useState<'front' | 'back'>('front');
  const [showCalibrationWizard, setShowCalibrationWizard] = useState(false);
  const [calibrationMeasurements, setCalibrationMeasurements] = useState({
    rightDistance: '',
    topDistance: '',
    crosshairLength: ''
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
    outputSettings // Add outputSettings as dependency so preview updates when settings change
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
  const handleCardSizeChange = (dimension: 'widthInches' | 'heightInches', value: number) => {
    const newSettings = {
      ...outputSettings,
      cardSize: {
        ...(outputSettings.cardSize || DEFAULT_SETTINGS.outputSettings.cardSize),
        [dimension]: value
      }
    };
    onSettingsChange(newSettings);
  };

  const handleCardScalePercentChange = (value: number) => {
    const newSettings = {
      ...outputSettings,
      cardScalePercent: value
    };
    onSettingsChange(newSettings);
  };

  const handleBleedMarginChange = (value: number) => {
    const newSettings = {
      ...outputSettings,
      bleedMarginInches: value
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
  }, [calibrationMeasurements, outputSettings, onSettingsChange]);

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
    onSettingsChange(newSettings);
  };

  const handleCardImageSizingModeChange = (mode: 'actual-size' | 'fit-to-card' | 'fill-card') => {
    const newSettings = {
      ...outputSettings,
      cardImageSizingMode: mode
    };
    onSettingsChange(newSettings);
  };

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
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                onClick={() => handlePageSizeChange('preset', { width: 3.5, height: 3.5 })}
                className="px-3 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50"
              >
                Square (3.5×3.5")
              </button>
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
                  <input type="number" step="0.001" min="-2" max="2" value={outputSettings.offset.horizontal} onChange={e => handleOffsetChange('horizontal', parseFloat(e.target.value))} className="w-full border border-gray-300 rounded-md px-3 py-2" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Vertical (inches)
                </label>
                <div className="flex items-center">
                  <MoveVerticalIcon size={16} className="text-gray-400 mr-2" />
                  <input type="number" step="0.001" min="-2" max="2" value={outputSettings.offset.vertical} onChange={e => handleOffsetChange('vertical', parseFloat(e.target.value))} className="w-full border border-gray-300 rounded-md px-3 py-2" />
                </div>
              </div>
            </div>
          </div>

          {/* Card Size Section */}
          <div>
            <h3 className="text-lg font-medium text-gray-800 mb-3">
              Card Image Size
            </h3>
            <p className="text-sm text-gray-600 mb-3">
              Set the target card dimensions. Bleed extends the print area beyond the card edges for better coverage.
            </p>
            
            {/* Card Image Sizing Mode */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Image Sizing Mode
              </label>
              <div className="flex space-x-2">
                <button
                  onClick={() => handleCardImageSizingModeChange('actual-size')}
                  className={`flex-1 py-2 px-3 text-sm border rounded-md transition-colors ${
                    (outputSettings.cardImageSizingMode || DEFAULT_SETTINGS.outputSettings.cardImageSizingMode) === 'actual-size'
                      ? 'bg-blue-50 border-blue-300 text-blue-700'
                      : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  Actual Size
                </button>
                <button
                  onClick={() => handleCardImageSizingModeChange('fit-to-card')}
                  className={`flex-1 py-2 px-3 text-sm border rounded-md transition-colors ${
                    (outputSettings.cardImageSizingMode || DEFAULT_SETTINGS.outputSettings.cardImageSizingMode) === 'fit-to-card'
                      ? 'bg-blue-50 border-blue-300 text-blue-700'
                      : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  Fit to Card
                </button>
                <button
                  onClick={() => handleCardImageSizingModeChange('fill-card')}
                  className={`flex-1 py-2 px-3 text-sm border rounded-md transition-colors ${
                    (outputSettings.cardImageSizingMode || DEFAULT_SETTINGS.outputSettings.cardImageSizingMode) === 'fill-card'
                      ? 'bg-blue-50 border-blue-300 text-blue-700'
                      : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  Fill Card
                </button>
              </div>
              <div className="mt-2 text-xs text-gray-500">
                {(() => {
                  const mode = outputSettings.cardImageSizingMode || DEFAULT_SETTINGS.outputSettings.cardImageSizingMode;
                  switch (mode) {
                    case 'actual-size':
                      return 'Use the image at its original size without scaling';
                    case 'fit-to-card':
                      return 'Scale the image to fit entirely within the card boundaries, maintaining aspect ratio';
                    case 'fill-card':
                      return 'Scale the image to fill the entire card area, maintaining aspect ratio (may crop edges)';
                    default:
                      return '';
                  }
                })()}
              </div>
            </div>
            
            <div className="grid grid-cols-3 gap-4">
              {/* Width */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Width (inches)
                </label>
                <input 
                  type="number" 
                  step="0.1" 
                  min="1" 
                  max="12" 
                  value={outputSettings.cardSize?.widthInches || DEFAULT_SETTINGS.outputSettings.cardSize.widthInches} 
                  onChange={e => handleCardSizeChange('widthInches', parseFloat(e.target.value))} 
                  className="w-full border border-gray-300 rounded-md px-3 py-2" 
                />
              </div>
              
              {/* Height */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Height (inches)
                </label>
                <input 
                  type="number" 
                  step="0.1" 
                  min="1" 
                  max="12" 
                  value={outputSettings.cardSize?.heightInches || DEFAULT_SETTINGS.outputSettings.cardSize.heightInches} 
                  onChange={e => handleCardSizeChange('heightInches', parseFloat(e.target.value))} 
                  className="w-full border border-gray-300 rounded-md px-3 py-2" 
                />
              </div>
              
              {/* Bleed */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Bleed (inches)
                </label>
                <input 
                  type="number" 
                  step="0.01" 
                  min="0" 
                  max="0.5" 
                  value={outputSettings.bleedMarginInches || DEFAULT_SETTINGS.outputSettings.bleedMarginInches} 
                  onChange={e => handleBleedMarginChange(parseFloat(e.target.value))} 
                  className="w-full border border-gray-300 rounded-md px-3 py-2" 
                />
              </div>
            </div>
            
            {/* Card Size Presets and Bleed Presets Row */}
            <div className="grid grid-cols-3 gap-4 mt-3">
              {/* Card Size Presets - spans first two columns */}
              <div className="col-span-2">
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => handleCardSizePreset({ widthInches: 2.5, heightInches: 3.5 })}
                    className="px-3 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50"
                  >
                    Poker (2.5×3.5")
                  </button>
                  <button
                    onClick={() => handleCardSizePreset({ widthInches: 2.25, heightInches: 3.5 })}
                    className="px-3 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50"
                  >
                    Bridge (2.25×3.5")
                  </button>
                  <button
                    onClick={() => handleCardSizePreset({ widthInches: 3.5, heightInches: 3.5 })}
                    className="px-3 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50"
                  >
                    Square (3.5×3.5")
                  </button>
                </div>
              </div>
              
              {/* Bleed Presets - third column */}
              <div>
                <div className="flex gap-1">
                  <button
                    onClick={() => handleBleedMarginChange(0)}
                    className="px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50 flex-1"
                  >
                    0
                  </button>
                  <button
                    onClick={() => handleBleedMarginChange(0.05)}
                    className="px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50 flex-1"
                  >
                    0.05
                  </button>
                  <button
                    onClick={() => handleBleedMarginChange(0.1)}
                    className="px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50 flex-1"
                  >
                    0.1
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Card Scale Section */}
          <div>
            <h3 className="text-lg font-medium text-gray-800 mb-3">
              Card Scale
            </h3>
            <p className="text-sm text-gray-600 mb-3">
              Adjust the scale to compensate for printer enlargement during borderless printing
            </p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Scale (percent)
              </label>
              <input 
                type="number" 
                step="1" 
                min="50" 
                max="150" 
                value={outputSettings.cardScalePercent || DEFAULT_SETTINGS.outputSettings.cardScalePercent} 
                onChange={e => handleCardScalePercentChange(parseFloat(e.target.value))} 
                className="w-full border border-gray-300 rounded-md px-3 py-2" 
              />
              <p className="text-xs text-gray-500 mt-1">
                100% = actual size, &lt;100% = smaller (compensate for printer enlargement)
              </p>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                onClick={() => handleCardScalePercentChange(100)}
                className="px-3 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50"
              >
                100% (No scaling)
              </button>
              <button
                onClick={() => handleCardScalePercentChange(95)}
                className="px-3 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50"
              >
                95% (Common adjustment)
              </button>
              <button
                onClick={() => handleCardScalePercentChange(90)}
                className="px-3 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50"
              >
                90% (Strong adjustment)
              </button>
            </div>
          </div>

          {/* Card Rotation Section */}
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

          {/* Printer Calibration Section */}
          <div>
            <h3 className="text-lg font-medium text-gray-800 mb-3">
              Printer Calibration
            </h3>
            <p className="text-sm text-gray-600 mb-2">
              Print a test card using your current settings to determine your printer's exact offset and scale. This creates a feedback loop to iteratively improve your settings.
            </p>
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 mb-4">
              <p className="text-xs text-gray-600">
                <span className="font-medium">Current calibration target:</span>{' '}
                {(() => {
                  const cardWidthInches = outputSettings.cardSize?.widthInches || DEFAULT_SETTINGS.outputSettings.cardSize.widthInches;
                  const cardHeightInches = outputSettings.cardSize?.heightInches || DEFAULT_SETTINGS.outputSettings.cardSize.heightInches;
                  const scalePercent = outputSettings.cardScalePercent || DEFAULT_SETTINGS.outputSettings.cardScalePercent;
                  const horizontalOffset = outputSettings.offset.horizontal || 0;
                  const verticalOffset = outputSettings.offset.vertical || 0;
                  const rotation = getRotationForCardType(outputSettings, viewMode);
                  const sizingMode = outputSettings.cardImageSizingMode || DEFAULT_SETTINGS.outputSettings.cardImageSizingMode;
                  
                  const sizingModeText = sizingMode === 'actual-size' ? 'actual size' : 
                                       sizingMode === 'fit-to-card' ? 'fit to card' : 
                                       'fill card';
                  
                  return `${cardWidthInches.toFixed(2)}" × ${cardHeightInches.toFixed(2)}" card at ${scalePercent}% scale with ${horizontalOffset >= 0 ? '+' : ''}${horizontalOffset.toFixed(3)}", ${verticalOffset >= 0 ? '+' : ''}${verticalOffset.toFixed(3)}" offset, ${rotation}° rotation, ${sizingModeText} sizing (${viewMode} cards)`;
                })()}
              </p>
            </div>
            
            <div className="space-y-4">
              {/* Step 1: Print Calibration Card */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="text-sm font-medium text-blue-800 mb-2 flex items-center">
                  <PrinterIcon size={16} className="mr-2" />
                  Step 1: Print Current Settings Test Card
                </h4>
                <p className="text-sm text-blue-700 mb-3">
                  Download and print a calibration card using your current settings. Use borderless mode and place poker card stock in the center of the media.
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
                  Step 2: Measure and Refine Settings
                </h4>
                <p className="text-sm text-green-700 mb-3">
                  Measure the printed card with a ruler and enter the values. The app will adjust your settings to improve alignment. Repeat until satisfied.
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
                
                {/* Card ID - Right */}
                <div className="ml-auto text-sm text-gray-500">
                  {totalFilteredCards > 0 && currentCardExists ? `Card ID: ${currentCardId}` : 'No cards'}
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
                  {processedPreviewUrl && cardRenderData ? (
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
                  {countCardsByType('front', activePages, cardsPerPage, pdfMode, extractionSettings)}
                </p>
                <p>
                  <span className="font-medium">Back cards:</span>{' '}
                  {countCardsByType('back', activePages, cardsPerPage, pdfMode, extractionSettings)}
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