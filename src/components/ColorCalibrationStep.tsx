/**
 * @fileoverview Color calibration component for printer color matching
 * 
 * This component provides professional color calibration tools for matching
 * screen colors to printed output. It generates test grids with varying
 * color transformations and allows users to compare them with printed samples.
 * 
 * **Key Features:**
 * - Pixel-perfect grid extraction for accurate color comparison
 * - Professional color transformation controls
 * - Grid-based calibration with customizable parameters
 * - Real-time preview of color adjustments
 * - Export calibration results to PDF for printing
 * 
 * **Workflow:**
 * 1. User selects a region on a card for color calibration
 * 2. Component generates a grid of color variations
 * 3. User prints the calibration grid
 * 4. User compares printed grid with screen preview
 * 5. User applies optimal color settings to final output
 * 
 * @author Card Game PDF Transformer
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ChevronLeftIcon, ChevronRightIcon, PaletteIcon, RotateCcwIcon } from 'lucide-react';
import { AddFilesButton } from './AddFilesButton';
import { FileManagerPanel } from './FileManagerPanel';
import { PrecisionSliderInput } from './PrecisionSliderInput';
import { 
  getActivePagesWithSource, 
  calculateTotalCards, 
  getCardInfo, 
  extractCardImage as extractCardImageUtil,
  extractCardImageFromCanvas,
  getAvailableCardIds
} from '../utils/cardUtils';
import { 
  calculateFinalCardRenderDimensions,
  calculateCardPositioning,
  calculatePreviewScaling,
  processCardImageForRendering
} from '../utils/renderUtils';
import { generateColorCalibrationPDF } from '../utils/calibrationUtils';
import { 
  applyColorTransformation,
  getDefaultColorTransformation,
  ColorTransformation,
  COLOR_PRESETS,
  ColorPresetKey,
  getTransformationRange,
  hasNonDefaultColorSettings
} from '../utils/colorUtils';
import { PREVIEW_CONSTRAINTS } from '../constants';

/**
 * GridPreview component for showing the actual calibration grid
 * 
 * Generates and displays a grid of color-transformed images for calibration
 * comparison. Each cell in the grid applies different color transformation
 * values along two axes (horizontal and vertical).
 */
interface GridPreviewProps {
  /** Function to extract crop region with optional grid configuration for pixel-perfect sizing */
  cropImageUrl: (gridConfig?: { columns: number; rows: number }) => Promise<string | null>;
  /** Grid configuration defining number of rows and columns */
  gridConfig: { columns: number; rows: number };
  /** Transformation parameters for horizontal and vertical axes */
  transformations: {
    horizontal: { type: string; min: number; max: number };
    vertical: { type: string; min: number; max: number };
  };
  /** User's current color settings to apply as base transformation */
  userColorSettings: ColorTransformation;
}

const GridPreview: React.FC<GridPreviewProps> = ({ 
  cropImageUrl, 
  gridConfig, 
  transformations, 
  userColorSettings 
}) => {
  const [gridImages, setGridImages] = useState<(string | null)[][]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Generate transformation values for each axis (copied from calibrationUtils.ts)
  const generateTransformationValues = useCallback((min: number, max: number, count: number): number[] => {
    if (count === 1) return [(min + max) / 2];
    
    const values: number[] = [];
    const step = (max - min) / (count - 1);
    
    for (let i = 0; i < count; i++) {
      values.push(min + i * step);
    }
    
    return values;
  }, []);

  // Apply transformation value to transformation object (copied from calibrationUtils.ts)
  const applyTransformationValue = useCallback((
    transformation: ColorTransformation,
    type: string,
    value: number
  ): void => {
    (transformation as any)[type] = value;
  }, []);

  // Generate grid images with transformations
  const generateGridImages = useCallback(async () => {
    setIsLoading(true);
    try {
      const cropImage = await cropImageUrl(gridConfig);
      if (!cropImage) {
        setGridImages([]);
        return;
      }

      const horizontalValues = generateTransformationValues(
        transformations.horizontal.min,
        transformations.horizontal.max,
        gridConfig.columns
      );

      const verticalValues = generateTransformationValues(
        transformations.vertical.min,
        transformations.vertical.max,
        gridConfig.rows
      );

      const newGridImages: (string | null)[][] = [];
      
      for (let row = 0; row < gridConfig.rows; row++) {
        const rowImages: (string | null)[] = [];
        
        for (let col = 0; col < gridConfig.columns; col++) {
          try {
            // Create transformation for this cell - start with user's current settings
            const transformation: ColorTransformation = { ...userColorSettings };
            
            // Apply horizontal transformation (column-based)
            const horizontalValue = horizontalValues[col];
            applyTransformationValue(transformation, transformations.horizontal.type, horizontalValue);
            
            // Apply vertical transformation (row-based)
            const verticalValue = verticalValues[row];
            applyTransformationValue(transformation, transformations.vertical.type, verticalValue);

            // Apply color transformation to crop image
            const transformedImageUrl = await applyColorTransformation(cropImage, transformation);
            rowImages.push(transformedImageUrl);
          } catch (error) {
            console.warn(`Failed to generate cell image for row ${row}, col ${col}:`, error);
            rowImages.push(null);
          }
        }
        
        newGridImages.push(rowImages);
      }

      setGridImages(newGridImages);
    } catch (error) {
      console.warn('Failed to generate grid preview:', error);
      setGridImages([]);
    } finally {
      setIsLoading(false);
    }
  }, [cropImageUrl, gridConfig, transformations, userColorSettings, generateTransformationValues, applyTransformationValue]);

  // Regenerate grid when settings change
  useEffect(() => {
    generateGridImages();
  }, [generateGridImages]);

  if (isLoading) {
    return (
      <div className="bg-gray-50 p-8 rounded-md text-center">
        <div className="text-gray-400 mb-2">
          <svg className="animate-spin mx-auto h-8 w-8" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        </div>
        <p className="text-sm text-gray-500">Generating grid preview...</p>
      </div>
    );
  }

  if (gridImages.length === 0) {
    return (
      <div className="bg-gray-50 p-8 rounded-md text-center">
        <p className="text-sm text-gray-500">Failed to generate grid preview</p>
      </div>
    );
  }

  // Generate transformation values for labels (same as used for images)
  const horizontalValues = generateTransformationValues(
    transformations.horizontal.min,
    transformations.horizontal.max,
    gridConfig.columns
  );

  const verticalValues = generateTransformationValues(
    transformations.vertical.min,
    transformations.vertical.max,
    gridConfig.rows
  );

  // Format transformation values for display (copied from calibrationUtils.ts)
  const formatTransformationValue = (type: string, value: number): string => {
    const range = getTransformationRange(type);
    switch (type) {
      case 'brightness':
      case 'saturation':
      case 'hue':
      case 'vibrance':
      case 'shadows':
      case 'highlights':
      case 'midtoneBalance':
        return `${value >= 0 ? '+' : ''}${Math.round(value)}${range.unit}`;
      case 'contrast':
      case 'gamma':
      case 'redMultiplier':
      case 'greenMultiplier':
      case 'blueMultiplier':
        return `${value.toFixed(2)}${range.unit}`;
      case 'blackPoint':
      case 'whitePoint':
      case 'outputBlack':
      case 'outputWhite':
        return `${Math.round(value)}${range.unit}`;
      default:
        return `${value.toFixed(1)}${range.unit}`;
    }
  };

  return (
    <div className="bg-gray-50 p-3 rounded-md">
      <div className="relative" style={{ maxWidth: '280px', margin: '0 auto' }}>
        {/* Column header with transformation type label */}
        <div 
          className="grid gap-1 mb-1"
          style={{ 
            gridTemplateColumns: `20px repeat(${gridConfig.columns}, 1fr)`,
            marginBottom: '2px'
          }}
        >
          <div></div> {/* Empty space above row labels */}
          <div 
            className="text-xs font-medium text-gray-700 text-center capitalize"
            style={{ gridColumn: `2 / ${gridConfig.columns + 2}` }}
          >
            {transformations.horizontal.type}
          </div>
        </div>
        
        {/* Column value labels */}
        <div 
          className="grid gap-1 mb-1"
          style={{ 
            gridTemplateColumns: `20px repeat(${gridConfig.columns}, 1fr)`,
            marginBottom: '4px'
          }}
        >
          <div></div> {/* Empty space above row labels */}
          {horizontalValues.map((value, index) => (
            <div key={index} className="text-xs text-gray-600 text-center font-mono">
              {formatTransformationValue(transformations.horizontal.type, value)}
            </div>
          ))}
        </div>

        {/* Grid with row labels */}
        <div 
          className="grid gap-1"
          style={{ 
            gridTemplateColumns: `20px repeat(${gridConfig.columns}, 1fr)`,
            gridTemplateRows: `repeat(${gridConfig.rows}, 1fr)`
          }}
        >
          {Array.from({ length: gridConfig.rows }).map((_, rowIndex) => (
            <React.Fragment key={`row-${rowIndex}`}>
              {/* Row label */}
              <div className="flex items-center justify-center relative">
                {rowIndex === Math.floor(gridConfig.rows / 2) && (
                  <div 
                    className="absolute text-xs font-medium text-gray-700 capitalize"
                    style={{ 
                      transform: 'rotate(-90deg)',
                      whiteSpace: 'nowrap',
                      left: '-45px',
                      transformOrigin: 'center'
                    }}
                  >
                    {transformations.vertical.type}
                  </div>
                )}
                <div 
                  className="text-xs text-gray-600 text-center font-mono"
                  style={{ 
                    transform: 'rotate(-90deg)',
                    whiteSpace: 'nowrap',
                    minWidth: '20px'
                  }}
                >
                  {formatTransformationValue(transformations.vertical.type, verticalValues[rowIndex])}
                </div>
              </div>
              
              {/* Grid cells for this row */}
              {Array.from({ length: gridConfig.columns }).map((_, colIndex) => {
                const imageUrl = gridImages[rowIndex]?.[colIndex];
                return (
                  <div
                    key={`${rowIndex}-${colIndex}`}
                    className="bg-gray-200 border border-gray-300 rounded-sm overflow-hidden flex items-center justify-center"
                    style={{ aspectRatio: '1' }}
                    title={`${transformations.horizontal.type}: ${formatTransformationValue(transformations.horizontal.type, horizontalValues[colIndex])}, ${transformations.vertical.type}: ${formatTransformationValue(transformations.vertical.type, verticalValues[rowIndex])}`}
                  >
                    {imageUrl ? (
                      <img
                        src={imageUrl}
                        alt={`Grid cell with transformations`}
                        className="w-full h-full object-contain"
                        style={{ imageRendering: 'pixelated' }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <span className="text-xs text-gray-400">✗</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </React.Fragment>
          ))}
        </div>
      </div>
      
      <div className="mt-3 text-xs text-gray-600 space-y-1">
        <p>
          <span className="font-medium">Range:</span> {transformations.horizontal.type} 
          ({transformations.horizontal.min} to {transformations.horizontal.max}) × {transformations.vertical.type} 
          ({transformations.vertical.min} to {transformations.vertical.max})
        </p>
        <p className="text-gray-500">
          Hover over cells to see exact transformation values
        </p>
      </div>
    </div>
  );
};

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
  multiFileImport: any; // Add multiFileImport as a prop
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
  colorSettings,
  multiFileImport,
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
    
    const gridColumns = colorSettings?.gridConfig?.columns || 4;
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

  // Update selected region preview coordinates when grid configuration changes
  useEffect(() => {
    if (!colorSettings?.selectedRegion || !cardRenderData || !cropRegionDimensions) {
      return;
    }

    // Recalculate preview coordinates based on the stored real-world coordinates
    const centerXPreview = (colorSettings.selectedRegion.centerX / cardRenderData.renderDimensions.cardWidthInches) * cardRenderData.previewScaling.previewCardWidth + cardRenderData.previewScaling.previewX;
    const centerYPreview = (colorSettings.selectedRegion.centerY / cardRenderData.renderDimensions.cardHeightInches) * cardRenderData.previewScaling.previewCardHeight + cardRenderData.previewScaling.previewY;

    // Check if preview coordinates need updating
    const needsUpdate = 
      Math.abs(colorSettings.selectedRegion.previewCenterX - centerXPreview) > 0.1 ||
      Math.abs(colorSettings.selectedRegion.previewCenterY - centerYPreview) > 0.1 ||
      Math.abs(colorSettings.selectedRegion.previewWidth - cropRegionDimensions.widthPreview) > 0.1 ||
      Math.abs(colorSettings.selectedRegion.previewHeight - cropRegionDimensions.heightPreview) > 0.1;

    if (needsUpdate) {
      const updatedSettings = {
        ...colorSettings,
        selectedRegion: {
          ...colorSettings.selectedRegion,
          // Update preview coordinates based on current grid configuration
          previewCenterX: centerXPreview,
          previewCenterY: centerYPreview,
          previewWidth: cropRegionDimensions.widthPreview,
          previewHeight: cropRegionDimensions.heightPreview,
          // Update real-world dimensions to match current grid configuration
          width: cropRegionDimensions.widthInches,
          height: cropRegionDimensions.heightInches
        }
      };
      onColorSettingsChange(updatedSettings);
    }
  }, [colorSettings?.gridConfig, cardRenderData, cropRegionDimensions, colorSettings, onColorSettingsChange]);

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

  // Calculate card front/back identification based on PDF mode
  const getCardInfoCallback = useCallback((cardIndex: number) => 
    getCardInfo(cardIndex, activePages, extractionSettings, pdfMode, cardsPerPage, undefined, undefined), 
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
    
    if (pageIndex >= activePages.length) {
      return null;
    }
    
    const currentPageInfo = activePages[pageIndex];
    
    if (currentPageInfo.fileType === 'pdf') {
      // Use PDF extraction
      return await extractCardImageUtil(cardIndex, pdfData, pdfMode, activePages, unifiedPages, extractionSettings);
    } else if (currentPageInfo.fileType === 'image') {
      // Use image extraction
      const imageData = multiFileImport.getImageData(currentPageInfo.fileName);
      if (!imageData) {
        console.error(`No image data found for file: ${currentPageInfo.fileName}`);
        return null;
      }
      return await extractCardImageFromCanvas(cardIndex, imageData, pdfMode, activePages, extractionSettings);
    }
    
    return null;
  }, [extractionSettings, pdfMode, activePages, unifiedPages, pdfData, multiFileImport]);

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
  const handleCardClick = useCallback(() => {
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

  // Helper function to update color transformation
  const updateColorTransformation = useCallback((field: keyof ColorTransformation, value: number) => {
    const newSettings = {
      ...colorSettings,
      finalAdjustments: {
        ...colorSettings.finalAdjustments,
        [field]: value
      }
    };
    onColorSettingsChange(newSettings);
  }, [colorSettings, onColorSettingsChange]);

  // Helper function to apply color preset
  const applyColorPreset = useCallback((presetKey: ColorPresetKey) => {
    // If user is selecting 'none' (custom), just update the preset selection
    if (presetKey === 'none') {
      const newSettings = {
        ...colorSettings,
        selectedPreset: presetKey
      };
      onColorSettingsChange(newSettings);
      return;
    }

    // Check if user has non-default settings
    const hasCustomSettings = hasNonDefaultColorSettings(currentColorTransformation);
    
    if (hasCustomSettings) {
      // Show confirmation dialog
      const confirmed = window.confirm(
        `Applying "${COLOR_PRESETS[presetKey].name}" will overwrite your current color adjustments.\n\nDo you want to continue?`
      );
      
      if (!confirmed) {
        return; // User cancelled, don't apply preset
      }
    }

    // Apply the preset
    const preset = COLOR_PRESETS[presetKey];
    const newSettings = {
      ...colorSettings,
      selectedPreset: presetKey,
      finalAdjustments: { ...preset.transformation }
    };
    onColorSettingsChange(newSettings);
  }, [colorSettings, onColorSettingsChange, currentColorTransformation]);

  // Helper function to reset all color adjustments
  const resetAllAdjustments = useCallback(() => {
    // Check if user has non-default settings
    const hasCustomSettings = hasNonDefaultColorSettings(currentColorTransformation);
    
    if (hasCustomSettings) {
      // Show confirmation dialog
      const confirmed = window.confirm(
        "This will reset all color adjustments to their default values.\n\nDo you want to continue?"
      );
      
      if (!confirmed) {
        return; // User cancelled, don't reset
      }
    }

    // Reset to defaults
    const newSettings = {
      ...colorSettings,
      selectedPreset: 'none',
      finalAdjustments: { ...getDefaultColorTransformation() }
    };
    onColorSettingsChange(newSettings);
  }, [colorSettings, onColorSettingsChange, currentColorTransformation]);

  // Helper function to update horizontal transformation type and auto-adjust range
  const updateHorizontalTransformationType = useCallback((type: string) => {
    const range = getTransformationRange(type);
    const newSettings = {
      ...colorSettings,
      transformations: {
        ...colorSettings.transformations,
        horizontal: {
          type,
          min: range.defaultMin,
          max: range.defaultMax
        }
      }
    };
    onColorSettingsChange(newSettings);
  }, [colorSettings, onColorSettingsChange]);

  // Helper function to update vertical transformation type and auto-adjust range
  const updateVerticalTransformationType = useCallback((type: string) => {
    const range = getTransformationRange(type);
    const newSettings = {
      ...colorSettings,
      transformations: {
        ...colorSettings.transformations,
        vertical: {
          type,
          min: range.defaultMin,
          max: range.defaultMax
        }
      }
    };
    onColorSettingsChange(newSettings);
  }, [colorSettings, onColorSettingsChange]);

  /**
   * Extract crop region from card image with pixel-perfect sizing
   * 
   * This function implements pixel-perfect extraction for color calibration grids.
   * It calculates the exact number of pixels needed for each grid cell in the final
   * printed output and extracts that exact amount from the source image, eliminating
   * scaling artifacts that could affect color calibration accuracy.
   * 
   * **Algorithm:**
   * 1. Calculate final card dimensions in pixels at print DPI (300)
   * 2. Determine target grid cell dimensions in print pixels
   * 3. Calculate source extraction size to match target pixel count
   * 4. Extract crop region with exact pixel dimensions
   * 5. Return data URL for grid cell display
   * 
   * **Pixel-Perfect Logic:**
   * When gridConfig is provided, the function calculates precise extraction
   * dimensions so that each grid cell contains exactly the right number of
   * pixels for the final output, preventing any interpolation or scaling
   * artifacts that could alter colors.
   * 
   * @param gridConfig - Optional grid configuration for pixel-perfect extraction
   * @returns Promise resolving to data URL of extracted region, or null if failed
   */
  const extractCropRegion = useCallback(async (gridConfig?: { columns: number; rows: number }): Promise<string | null> => {
    if (!cardPreviewUrl || !colorSettings?.selectedRegion || !cardRenderData) {
      return null;
    }

    return new Promise((resolve) => {
      const img = new Image();
      
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          
          if (!ctx) {
            resolve(null);
            return;
          }
          
          // Calculate crop region in image coordinates
          const imageWidth = img.naturalWidth;
          const imageHeight = img.naturalHeight;
          
          // Calculate crop position (same as before)
          const cropXPx = (colorSettings.selectedRegion.centerX / cardRenderData.renderDimensions.cardWidthInches) * imageWidth - 
                         (colorSettings.selectedRegion.width / cardRenderData.renderDimensions.cardWidthInches) * imageWidth / 2;
          const cropYPx = (colorSettings.selectedRegion.centerY / cardRenderData.renderDimensions.cardHeightInches) * imageHeight - 
                         (colorSettings.selectedRegion.height / cardRenderData.renderDimensions.cardHeightInches) * imageHeight / 2;
          
          let cropWidthPx: number;
          let cropHeightPx: number;
          
          if (gridConfig && outputSettings && gridConfig.columns > 0 && gridConfig.rows > 0) {
            // PIXEL-PERFECT EXTRACTION: Calculate target pixel dimensions for grid cell
            // Determine the final output pixel dimensions for a single grid cell
            
            // Calculate card dimensions in final output at 300 DPI (print resolution)
            const finalCardWidthPx = cardRenderData.renderDimensions.cardWidthInches * 300;
            const finalCardHeightPx = cardRenderData.renderDimensions.cardHeightInches * 300;
            
            // Validate final card dimensions
            if (finalCardWidthPx <= 0 || finalCardHeightPx <= 0) {
              console.warn('Invalid final card dimensions, falling back to region-based extraction');
              cropWidthPx = (colorSettings.selectedRegion.width / cardRenderData.renderDimensions.cardWidthInches) * imageWidth;
              cropHeightPx = (colorSettings.selectedRegion.height / cardRenderData.renderDimensions.cardHeightInches) * imageHeight;
            } else {
              // Calculate target grid cell dimensions in final output pixels
              const targetCellWidthPx = finalCardWidthPx / gridConfig.columns;
              const targetCellHeightPx = finalCardHeightPx / gridConfig.rows;
              
              // Extract exactly the target pixel count from the source image
              // Scale from final output (300 DPI) to source image resolution
              const sourceToFinalScale = imageWidth / finalCardWidthPx;
              cropWidthPx = targetCellWidthPx * sourceToFinalScale;
              cropHeightPx = targetCellHeightPx * sourceToFinalScale;
              
              // Ensure minimum 1px dimensions
              cropWidthPx = Math.max(1, cropWidthPx);
              cropHeightPx = Math.max(1, cropHeightPx);
              
              console.log(`Pixel-perfect extraction: Grid ${gridConfig.columns}x${gridConfig.rows}, Target cell: ${targetCellWidthPx.toFixed(0)}x${targetCellHeightPx.toFixed(0)}px, Source crop: ${cropWidthPx.toFixed(0)}x${cropHeightPx.toFixed(0)}px`);
            }
          } else {
            // Fallback to original behavior for backward compatibility
            cropWidthPx = (colorSettings.selectedRegion.width / cardRenderData.renderDimensions.cardWidthInches) * imageWidth;
            cropHeightPx = (colorSettings.selectedRegion.height / cardRenderData.renderDimensions.cardHeightInches) * imageHeight;
          }
          
          // Set canvas size to target pixel dimensions
          canvas.width = Math.round(cropWidthPx);
          canvas.height = Math.round(cropHeightPx);
          
          // Draw cropped region at exact pixel dimensions
          ctx.drawImage(
            img,
            Math.max(0, cropXPx),
            Math.max(0, cropYPx),
            Math.min(cropWidthPx, imageWidth - cropXPx),
            Math.min(cropHeightPx, imageHeight - cropYPx),
            0,
            0,
            canvas.width,
            canvas.height
          );
          
          // Return cropped image as data URL
          resolve(canvas.toDataURL('image/png'));
        } catch (error) {
          console.warn('Failed to extract crop region:', error);
          resolve(null);
        }
      };
      
      img.onerror = () => resolve(null);
      img.src = cardPreviewUrl;
    });
  }, [cardPreviewUrl, colorSettings?.selectedRegion, cardRenderData, outputSettings]);

  // Generate color calibration test grid PDF
  const handleGenerateTestGrid = useCallback(async () => {
    if (!colorSettings?.selectedRegion || !colorSettings?.gridConfig || !colorSettings?.transformations) {
      console.warn('Missing required settings for test grid generation');
      return;
    }

    try {
      // Extract crop region from card image with pixel-perfect grid sizing
      const cropImageUrl = await extractCropRegion(colorSettings.gridConfig);
      if (!cropImageUrl) {
        alert('Failed to extract crop region from card image');
        return;
      }

      // Generate color calibration PDF with user's current settings as baseline
      const pdfBlob = await generateColorCalibrationPDF(
        cropImageUrl,
        colorSettings.gridConfig,
        colorSettings.transformations,
        outputSettings,
        colorSettings.selectedRegion,
        currentColorTransformation
      );

      // Download PDF
      const url = URL.createObjectURL(pdfBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'color_calibration_test_grid.pdf';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to generate test grid PDF:', error);
      alert('Failed to generate test grid PDF. Please try again.');
    }
  }, [colorSettings, outputSettings, extractCropRegion]);

  // Ensure currentCardId is valid for the current view mode
  useEffect(() => {
    if (totalFilteredCards > 0 && !currentCardExists) {
      // Current card ID doesn't exist in current mode, fallback to first available card
      setCurrentCardId(availableCardIds[0]);
    }
  }, [currentCardExists, totalFilteredCards, availableCardIds]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-800">Color Calibration</h2>
        
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
            No cards available. Please configure extraction settings in the previous steps.
          </p>
        </div>
      )}
      
      {/* First Row: Basic Color Controls and Card Preview */}
      <h3 className="text-lg font-medium text-gray-800 mb-3 flex items-center">
        <PaletteIcon size={20} className="mr-2" />
        Color Transformation
      </h3>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Left Panel: Basic Color Controls */}
        <div className="space-y-4">
          {/* Color Presets */}
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <h4 className="text-sm font-medium text-gray-700 mb-3">
              Color Presets
            </h4>
            <div className="space-y-2">
              <select
                value={colorSettings?.selectedPreset || 'none'}
                onChange={(e) => applyColorPreset(e.target.value as ColorPresetKey)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white"
              >
                {Object.entries(COLOR_PRESETS).map(([key, preset]) => (
                  <option key={key} value={key}>
                    {preset.name}
                  </option>
                ))}
              </select>
              {colorSettings?.selectedPreset && colorSettings.selectedPreset !== 'none' && (
                <p className="text-xs text-gray-600 mt-2">
                  {COLOR_PRESETS[colorSettings.selectedPreset as ColorPresetKey]?.description}
                </p>
              )}
            </div>
          </div>

          {/* Basic Adjustments */}
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <h4 className="text-sm font-medium text-gray-700 mb-3">
              Basic Adjustments
            </h4>
            <div className="grid grid-cols-2 gap-x-4 gap-y-3">
              {/* Brightness */}
              <div>
                <PrecisionSliderInput
                  value={currentColorTransformation.brightness}
                  type="brightness"
                  onChange={(value) => updateColorTransformation('brightness', value)}
                  onDoubleClick={() => updateColorTransformation('brightness', 0)}
                />
                <input
                  type="range"
                  min="-100"
                  max="100"
                  step="1"
                  value={currentColorTransformation.brightness}
                  onChange={(e) => updateColorTransformation('brightness', parseInt(e.target.value))}
                  onDoubleClick={() => updateColorTransformation('brightness', 0)}
                  className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                />
              </div>

              {/* Contrast */}
              <div>
                <PrecisionSliderInput
                  value={currentColorTransformation.contrast}
                  type="contrast"
                  onChange={(value) => updateColorTransformation('contrast', value)}
                  onDoubleClick={() => updateColorTransformation('contrast', 1.0)}
                />
                <input
                  type="range"
                  min="0.5"
                  max="2.0"
                  step="0.05"
                  value={currentColorTransformation.contrast}
                  onChange={(e) => updateColorTransformation('contrast', parseFloat(e.target.value))}
                  onDoubleClick={() => updateColorTransformation('contrast', 1.0)}
                  className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                />
              </div>

              {/* Saturation */}
              <div>
                <PrecisionSliderInput
                  value={currentColorTransformation.saturation}
                  type="saturation"
                  onChange={(value) => updateColorTransformation('saturation', value)}
                  onDoubleClick={() => updateColorTransformation('saturation', 0)}
                />
                <input
                  type="range"
                  min="-100"
                  max="100"
                  step="1"
                  value={currentColorTransformation.saturation}
                  onChange={(e) => updateColorTransformation('saturation', parseInt(e.target.value))}
                  onDoubleClick={() => updateColorTransformation('saturation', 0)}
                  className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                />
              </div>

              {/* Hue */}
              <div>
                <PrecisionSliderInput
                  value={currentColorTransformation.hue}
                  type="hue"
                  onChange={(value) => updateColorTransformation('hue', value)}
                  onDoubleClick={() => updateColorTransformation('hue', 0)}
                />
                <input
                  type="range"
                  min="-180"
                  max="180"
                  step="1"
                  value={currentColorTransformation.hue}
                  onChange={(e) => updateColorTransformation('hue', parseInt(e.target.value))}
                  onDoubleClick={() => updateColorTransformation('hue', 0)}
                  className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                />
              </div>

              {/* Gamma */}
              <div>
                <PrecisionSliderInput
                  value={currentColorTransformation.gamma}
                  type="gamma"
                  onChange={(value) => updateColorTransformation('gamma', value)}
                  onDoubleClick={() => updateColorTransformation('gamma', 1.0)}
                />
                <input
                  type="range"
                  min="0.5"
                  max="2.0"
                  step="0.05"
                  value={currentColorTransformation.gamma}
                  onChange={(e) => updateColorTransformation('gamma', parseFloat(e.target.value))}
                  onDoubleClick={() => updateColorTransformation('gamma', 1.0)}
                  className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                />
              </div>

              {/* Vibrance */}
              <div>
                <PrecisionSliderInput
                  value={currentColorTransformation.vibrance}
                  type="vibrance"
                  onChange={(value) => updateColorTransformation('vibrance', value)}
                  onDoubleClick={() => updateColorTransformation('vibrance', 0)}
                />
                <input
                  type="range"
                  min="-100"
                  max="100"
                  step="1"
                  value={currentColorTransformation.vibrance}
                  onChange={(e) => updateColorTransformation('vibrance', parseInt(e.target.value))}
                  onDoubleClick={() => updateColorTransformation('vibrance', 0)}
                  className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* Per-Channel RGB Controls */}
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <h4 className="text-sm font-medium text-gray-700 mb-3">
              RGB Channel Control
            </h4>
            <div className="grid grid-cols-3 gap-x-3 gap-y-3">
              {/* Red Channel */}
              <div>
                <PrecisionSliderInput
                  value={currentColorTransformation.redMultiplier}
                  type="redMultiplier"
                  label="Red"
                  labelColorClass="text-red-600"
                  onChange={(value) => updateColorTransformation('redMultiplier', value)}
                  onDoubleClick={() => updateColorTransformation('redMultiplier', 1.0)}
                />
                <input
                  type="range"
                  min="0.5"
                  max="1.5"
                  step="0.01"
                  value={currentColorTransformation.redMultiplier}
                  onChange={(e) => updateColorTransformation('redMultiplier', parseFloat(e.target.value))}
                  onDoubleClick={() => updateColorTransformation('redMultiplier', 1.0)}
                  className="w-full h-1 bg-red-200 rounded-lg appearance-none cursor-pointer"
                />
              </div>

              {/* Green Channel */}
              <div>
                <PrecisionSliderInput
                  value={currentColorTransformation.greenMultiplier}
                  type="greenMultiplier"
                  label="Green"
                  labelColorClass="text-green-600"
                  onChange={(value) => updateColorTransformation('greenMultiplier', value)}
                  onDoubleClick={() => updateColorTransformation('greenMultiplier', 1.0)}
                />
                <input
                  type="range"
                  min="0.5"
                  max="1.5"
                  step="0.01"
                  value={currentColorTransformation.greenMultiplier}
                  onChange={(e) => updateColorTransformation('greenMultiplier', parseFloat(e.target.value))}
                  onDoubleClick={() => updateColorTransformation('greenMultiplier', 1.0)}
                  className="w-full h-1 bg-green-200 rounded-lg appearance-none cursor-pointer"
                />
              </div>

              {/* Blue Channel */}
              <div>
                <PrecisionSliderInput
                  value={currentColorTransformation.blueMultiplier}
                  type="blueMultiplier"
                  label="Blue"
                  labelColorClass="text-blue-600"
                  onChange={(value) => updateColorTransformation('blueMultiplier', value)}
                  onDoubleClick={() => updateColorTransformation('blueMultiplier', 1.0)}
                />
                <input
                  type="range"
                  min="0.5"
                  max="1.5"
                  step="0.01"
                  value={currentColorTransformation.blueMultiplier}
                  onChange={(e) => updateColorTransformation('blueMultiplier', parseFloat(e.target.value))}
                  onDoubleClick={() => updateColorTransformation('blueMultiplier', 1.0)}
                  className="w-full h-1 bg-blue-200 rounded-lg appearance-none cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* Shadows/Highlights */}
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <h4 className="text-sm font-medium text-gray-700 mb-3">
              Shadows & Highlights
            </h4>
            <div className="grid grid-cols-3 gap-x-3 gap-y-3">
              {/* Shadows */}
              <div>
                <PrecisionSliderInput
                  value={currentColorTransformation.shadows}
                  type="shadows"
                  onChange={(value) => updateColorTransformation('shadows', value)}
                  onDoubleClick={() => updateColorTransformation('shadows', 0)}
                />
                <input
                  type="range"
                  min="-50"
                  max="50"
                  step="1"
                  value={currentColorTransformation.shadows}
                  onChange={(e) => updateColorTransformation('shadows', parseInt(e.target.value))}
                  onDoubleClick={() => updateColorTransformation('shadows', 0)}
                  className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                />
              </div>

              {/* Highlights */}
              <div>
                <PrecisionSliderInput
                  value={currentColorTransformation.highlights}
                  type="highlights"
                  onChange={(value) => updateColorTransformation('highlights', value)}
                  onDoubleClick={() => updateColorTransformation('highlights', 0)}
                />
                <input
                  type="range"
                  min="-50"
                  max="50"
                  step="1"
                  value={currentColorTransformation.highlights}
                  onChange={(e) => updateColorTransformation('highlights', parseInt(e.target.value))}
                  onDoubleClick={() => updateColorTransformation('highlights', 0)}
                  className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                />
              </div>

              {/* Midtone Balance */}
              <div>
                <PrecisionSliderInput
                  value={currentColorTransformation.midtoneBalance}
                  type="midtoneBalance"
                  label="Midtone Balance"
                  onChange={(value) => updateColorTransformation('midtoneBalance', value)}
                  onDoubleClick={() => updateColorTransformation('midtoneBalance', 0)}
                />
                <input
                  type="range"
                  min="-100"
                  max="100"
                  step="1"
                  value={currentColorTransformation.midtoneBalance}
                  onChange={(e) => updateColorTransformation('midtoneBalance', parseInt(e.target.value))}
                  onDoubleClick={() => updateColorTransformation('midtoneBalance', 0)}
                  className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* Levels */}
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <h4 className="text-sm font-medium text-gray-700 mb-3">
              Levels
            </h4>
            <div className="grid grid-cols-2 gap-x-4 gap-y-3">
              {/* Input Black Point */}
              <div>
                <PrecisionSliderInput
                  value={currentColorTransformation.blackPoint}
                  type="blackPoint"
                  label="Input Black"
                  onChange={(value) => updateColorTransformation('blackPoint', value)}
                  onDoubleClick={() => updateColorTransformation('blackPoint', 0)}
                />
                <input
                  type="range"
                  min="0"
                  max="50"
                  step="1"
                  value={currentColorTransformation.blackPoint}
                  onChange={(e) => updateColorTransformation('blackPoint', parseInt(e.target.value))}
                  onDoubleClick={() => updateColorTransformation('blackPoint', 0)}
                  className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                />
              </div>

              {/* Input White Point */}
              <div>
                <PrecisionSliderInput
                  value={currentColorTransformation.whitePoint}
                  type="whitePoint"
                  label="Input White"
                  onChange={(value) => updateColorTransformation('whitePoint', value)}
                  onDoubleClick={() => updateColorTransformation('whitePoint', 255)}
                />
                <input
                  type="range"
                  min="205"
                  max="255"
                  step="1"
                  value={currentColorTransformation.whitePoint}
                  onChange={(e) => updateColorTransformation('whitePoint', parseInt(e.target.value))}
                  onDoubleClick={() => updateColorTransformation('whitePoint', 255)}
                  className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                />
              </div>

              {/* Output Black */}
              <div>
                <PrecisionSliderInput
                  value={currentColorTransformation.outputBlack}
                  type="outputBlack"
                  label="Output Black"
                  onChange={(value) => updateColorTransformation('outputBlack', value)}
                  onDoubleClick={() => updateColorTransformation('outputBlack', 0)}
                />
                <input
                  type="range"
                  min="0"
                  max="30"
                  step="1"
                  value={currentColorTransformation.outputBlack}
                  onChange={(e) => updateColorTransformation('outputBlack', parseInt(e.target.value))}
                  onDoubleClick={() => updateColorTransformation('outputBlack', 0)}
                  className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                />
              </div>

              {/* Output White */}
              <div>
                <PrecisionSliderInput
                  value={currentColorTransformation.outputWhite}
                  type="outputWhite"
                  label="Output White"
                  onChange={(value) => updateColorTransformation('outputWhite', value)}
                  onDoubleClick={() => updateColorTransformation('outputWhite', 255)}
                />
                <input
                  type="range"
                  min="225"
                  max="255"
                  step="1"
                  value={currentColorTransformation.outputWhite}
                  onChange={(e) => updateColorTransformation('outputWhite', parseInt(e.target.value))}
                  onDoubleClick={() => updateColorTransformation('outputWhite', 255)}
                  className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* Reset Controls */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <button
              onClick={resetAllAdjustments}
              className="w-full flex items-center justify-center px-3 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 text-sm"
            >
              <RotateCcwIcon size={16} className="mr-2" />
              Reset All Adjustments
            </button>
          </div>
        </div>

        {/* Right Panel: Card Preview */}
        <div className="space-y-4">
          {/* Color Calibration Workflow Info */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="text-sm font-medium text-blue-800 mb-2">
              Color Calibration Workflow
            </h4>
            <div className="text-sm text-blue-700 space-y-1">
              <p>1. Adjust color settings and see real-time preview on the right</p>
              <p>2. Select a region for calibration testing</p>
              <p>3. Configure grid axes (your current settings become the baseline)</p>
              <p>4. Generate test grid PDF for physical printer comparison</p>
              <p>5. Apply optimal settings from test results</p>
            </div>
            <div className="mt-3 p-2 bg-blue-100 rounded text-xs text-blue-800">
              <span className="font-medium">💡 Tip:</span> The test grid uses your current color adjustments as the starting point, 
              then varies the selected parameters around those values. This lets you iteratively refine your settings.
            </div>
          </div>

          {/* Card Preview */}
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
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <span className="text-xs text-gray-400">No preview</span>
                    </div>
                  )}
                </div>

                {/* Hover Crop Region Preview */}
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
          
          {/* Color Transformation Summary */}
          <div className="mt-4 p-4 bg-gray-50 border border-gray-200 rounded-lg">
            <h4 className="text-sm font-medium text-gray-700 mb-3">
              Current Color Settings
            </h4>
            <div className="text-xs text-gray-600 space-y-1">
              {/* Basic Adjustments */}
              <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                <div><span className="font-medium">Brightness:</span> {currentColorTransformation.brightness > 0 ? '+' : ''}{currentColorTransformation.brightness}%</div>
                <div><span className="font-medium">Contrast:</span> {currentColorTransformation.contrast.toFixed(2)}×</div>
                <div><span className="font-medium">Saturation:</span> {currentColorTransformation.saturation > 0 ? '+' : ''}{currentColorTransformation.saturation}%</div>
                <div><span className="font-medium">Hue:</span> {currentColorTransformation.hue > 0 ? '+' : ''}{currentColorTransformation.hue}°</div>
                <div><span className="font-medium">Gamma:</span> {currentColorTransformation.gamma.toFixed(2)}</div>
                <div><span className="font-medium">Vibrance:</span> {currentColorTransformation.vibrance > 0 ? '+' : ''}{currentColorTransformation.vibrance}%</div>
              </div>
              
              {/* RGB Channels - only show if not neutral */}
              {(currentColorTransformation.redMultiplier !== 1.0 || 
                currentColorTransformation.greenMultiplier !== 1.0 || 
                currentColorTransformation.blueMultiplier !== 1.0) && (
                <div className="pt-1 border-t border-gray-300">
                  <div className="grid grid-cols-3 gap-x-4">
                    <div><span className="font-medium text-red-600">R:</span> {currentColorTransformation.redMultiplier.toFixed(2)}×</div>
                    <div><span className="font-medium text-green-600">G:</span> {currentColorTransformation.greenMultiplier.toFixed(2)}×</div>
                    <div><span className="font-medium text-blue-600">B:</span> {currentColorTransformation.blueMultiplier.toFixed(2)}×</div>
                  </div>
                </div>
              )}
              
              {/* Shadows/Highlights - only show if not neutral */}
              {(currentColorTransformation.shadows !== 0 || 
                currentColorTransformation.highlights !== 0 || 
                currentColorTransformation.midtoneBalance !== 0) && (
                <div className="pt-1 border-t border-gray-300">
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                    {currentColorTransformation.shadows !== 0 && (
                      <div><span className="font-medium">Shadows:</span> {currentColorTransformation.shadows > 0 ? '+' : ''}{currentColorTransformation.shadows}</div>
                    )}
                    {currentColorTransformation.highlights !== 0 && (
                      <div><span className="font-medium">Highlights:</span> {currentColorTransformation.highlights > 0 ? '+' : ''}{currentColorTransformation.highlights}</div>
                    )}
                    {currentColorTransformation.midtoneBalance !== 0 && (
                      <div className="col-span-2"><span className="font-medium">Midtones:</span> {currentColorTransformation.midtoneBalance > 0 ? '+' : ''}{currentColorTransformation.midtoneBalance}%</div>
                    )}
                  </div>
                </div>
              )}
              
              {/* Levels - only show if not neutral */}
              {(currentColorTransformation.blackPoint !== 0 || 
                currentColorTransformation.whitePoint !== 255 || 
                currentColorTransformation.outputBlack !== 0 || 
                currentColorTransformation.outputWhite !== 255) && (
                <div className="pt-1 border-t border-gray-300">
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                    {currentColorTransformation.blackPoint !== 0 && (
                      <div><span className="font-medium">In Black:</span> {currentColorTransformation.blackPoint}</div>
                    )}
                    {currentColorTransformation.whitePoint !== 255 && (
                      <div><span className="font-medium">In White:</span> {currentColorTransformation.whitePoint}</div>
                    )}
                    {currentColorTransformation.outputBlack !== 0 && (
                      <div><span className="font-medium">Out Black:</span> {currentColorTransformation.outputBlack}</div>
                    )}
                    {currentColorTransformation.outputWhite !== 255 && (
                      <div><span className="font-medium">Out White:</span> {currentColorTransformation.outputWhite}</div>
                    )}
                  </div>
                </div>
              )}
              
              {/* Preset info */}
              {colorSettings?.selectedPreset && colorSettings.selectedPreset !== 'none' && (
                <div className="pt-1 border-t border-gray-300">
                  <div><span className="font-medium">Preset:</span> {COLOR_PRESETS[colorSettings.selectedPreset as ColorPresetKey]?.name}</div>
                </div>
              )}
              
              {/* Show if all settings are neutral */}
              {currentColorTransformation.brightness === 0 && 
               currentColorTransformation.contrast === 1.0 && 
               currentColorTransformation.saturation === 0 && 
               currentColorTransformation.hue === 0 && 
               currentColorTransformation.gamma === 1.0 && 
               currentColorTransformation.vibrance === 0 && 
               currentColorTransformation.redMultiplier === 1.0 && 
               currentColorTransformation.greenMultiplier === 1.0 && 
               currentColorTransformation.blueMultiplier === 1.0 && 
               currentColorTransformation.shadows === 0 && 
               currentColorTransformation.highlights === 0 && 
               currentColorTransformation.midtoneBalance === 0 && 
               currentColorTransformation.blackPoint === 0 && 
               currentColorTransformation.whitePoint === 255 && 
               currentColorTransformation.outputBlack === 0 && 
               currentColorTransformation.outputWhite === 255 && (
                <div className="text-center text-gray-500 italic py-2">
                  No color adjustments applied
                </div>
              )}
            </div>
          </div>

          {/* Crop Region Selection */}
          <div className="p-4 bg-white border border-gray-200 rounded-lg">
            <h4 className="text-sm font-medium text-gray-700 mb-3">
              Crop Region Selection
            </h4>
            <div className="text-sm text-gray-600 space-y-2">
              <p>
                <span className="font-medium">Grid size:</span>{' '}
                {colorSettings?.gridConfig?.columns || 4}×{colorSettings?.gridConfig?.rows || 4}
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
        </div>
      </div>

      {/* Second Row: Calibration Settings and Grid Preview */}
      <h3 className="text-lg font-medium text-gray-800 mb-3 flex items-center">
        🧪 Calibration Testing (Optional)
      </h3>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Panel: Calibration Settings */}
        <div className="space-y-4">
          {/* Test Grid Configuration */}
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <h4 className="text-sm font-medium text-gray-700 mb-3">
              Test Grid Configuration
            </h4>
            
            {/* Grid Size Selection */}
            <div className="mb-4">
              <label className="block text-xs font-medium text-gray-600 mb-2">
                Grid Size (Columns × Rows)
              </label>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Columns</label>
                  <input
                    type="number"
                    min="2"
                    max="10"
                    value={colorSettings?.gridConfig?.columns || 4}
                    onChange={(e) => {
                      const cols = Math.max(2, Math.min(10, parseInt(e.target.value) || 2));
                      const newSettings = {
                        ...colorSettings,
                        gridConfig: {
                          ...colorSettings.gridConfig,
                          columns: cols
                        }
                      };
                      onColorSettingsChange(newSettings);
                    }}
                    className="w-full border border-gray-300 rounded-md px-2 py-1 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Rows</label>
                  <input
                    type="number"
                    min="2"
                    max="10"
                    value={colorSettings?.gridConfig?.rows || 4}
                    onChange={(e) => {
                      const rows = Math.max(2, Math.min(10, parseInt(e.target.value) || 2));
                      const newSettings = {
                        ...colorSettings,
                        gridConfig: {
                          ...colorSettings.gridConfig,
                          rows: rows
                        }
                      };
                      onColorSettingsChange(newSettings);
                    }}
                    className="w-full border border-gray-300 rounded-md px-2 py-1 text-xs"
                  />
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Total variations: {(colorSettings?.gridConfig?.columns || 4) * (colorSettings?.gridConfig?.rows || 4)}
              </p>
            </div>

            {/* Column Transformation Type */}
            <div className="mb-4">
              <label className="block text-xs font-medium text-gray-600 mb-2">
                Column Transformation
              </label>
              <select
                value={colorSettings?.transformations?.horizontal?.type || 'brightness'}
                onChange={(e) => updateHorizontalTransformationType(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-2 py-1 text-sm"
              >
                <option value="brightness">Brightness</option>
                <option value="contrast">Contrast</option>
                <option value="saturation">Saturation</option>
                <option value="hue">Hue</option>
                <option value="gamma">Gamma</option>
                <option value="vibrance">Vibrance</option>
                <option value="shadows">Shadows</option>
                <option value="highlights">Highlights</option>
                <option value="midtoneBalance">Midtone Balance</option>
                <option value="redMultiplier">Red Channel</option>
                <option value="greenMultiplier">Green Channel</option>
                <option value="blueMultiplier">Blue Channel</option>
              </select>
              
              {/* Column Range Controls */}
              <div className="grid grid-cols-2 gap-2 mt-2">
                {(() => {
                  const horizontalType = colorSettings?.transformations?.horizontal?.type || 'brightness';
                  const range = getTransformationRange(horizontalType);
                  return (
                    <>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">
                          Min {range.unit && `(${range.unit})`}
                        </label>
                        <input
                          type="number"
                          step={range.step}
                          min={range.min}
                          max={range.max}
                          value={colorSettings?.transformations?.horizontal?.min ?? range.defaultMin}
                          onChange={(e) => {
                            const newSettings = {
                              ...colorSettings,
                              transformations: {
                                ...colorSettings.transformations,
                                horizontal: {
                                  ...colorSettings.transformations.horizontal,
                                  min: parseFloat(e.target.value)
                                }
                              }
                            };
                            onColorSettingsChange(newSettings);
                          }}
                          className="w-full border border-gray-300 rounded-md px-2 py-1 text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">
                          Max {range.unit && `(${range.unit})`}
                        </label>
                        <input
                          type="number"
                          step={range.step}
                          min={range.min}
                          max={range.max}
                          value={colorSettings?.transformations?.horizontal?.max ?? range.defaultMax}
                          onChange={(e) => {
                            const newSettings = {
                              ...colorSettings,
                              transformations: {
                                ...colorSettings.transformations,
                                horizontal: {
                                  ...colorSettings.transformations.horizontal,
                                  max: parseFloat(e.target.value)
                                }
                              }
                            };
                            onColorSettingsChange(newSettings);
                          }}
                          className="w-full border border-gray-300 rounded-md px-2 py-1 text-xs"
                        />
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>

            {/* Row Transformation Type */}
            <div className="mb-4">
              <label className="block text-xs font-medium text-gray-600 mb-2">
                Row Transformation
              </label>
              <select
                value={colorSettings?.transformations?.vertical?.type || 'contrast'}
                onChange={(e) => updateVerticalTransformationType(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-2 py-1 text-sm"
              >
                <option value="brightness">Brightness</option>
                <option value="contrast">Contrast</option>
                <option value="saturation">Saturation</option>
                <option value="hue">Hue</option>
                <option value="gamma">Gamma</option>
                <option value="vibrance">Vibrance</option>
                <option value="shadows">Shadows</option>
                <option value="highlights">Highlights</option>
                <option value="midtoneBalance">Midtone Balance</option>
                <option value="redMultiplier">Red Channel</option>
                <option value="greenMultiplier">Green Channel</option>
                <option value="blueMultiplier">Blue Channel</option>
              </select>
              
              {/* Row Range Controls */}
              <div className="grid grid-cols-2 gap-2 mt-2">
                {(() => {
                  const verticalType = colorSettings?.transformations?.vertical?.type || 'contrast';
                  const range = getTransformationRange(verticalType);
                  return (
                    <>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">
                          Min {range.unit && `(${range.unit})`}
                        </label>
                        <input
                          type="number"
                          step={range.step}
                          min={range.min}
                          max={range.max}
                          value={colorSettings?.transformations?.vertical?.min ?? range.defaultMin}
                          onChange={(e) => {
                            const newSettings = {
                              ...colorSettings,
                              transformations: {
                                ...colorSettings.transformations,
                                vertical: {
                                  ...colorSettings.transformations.vertical,
                                  min: parseFloat(e.target.value)
                                }
                              }
                            };
                            onColorSettingsChange(newSettings);
                          }}
                          className="w-full border border-gray-300 rounded-md px-2 py-1 text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">
                          Max {range.unit && `(${range.unit})`}
                        </label>
                        <input
                          type="number"
                          step={range.step}
                          min={range.min}
                          max={range.max}
                          value={colorSettings?.transformations?.vertical?.max ?? range.defaultMax}
                          onChange={(e) => {
                            const newSettings = {
                              ...colorSettings,
                              transformations: {
                                ...colorSettings.transformations,
                                vertical: {
                                  ...colorSettings.transformations.vertical,
                                  max: parseFloat(e.target.value)
                                }
                              }
                            };
                            onColorSettingsChange(newSettings);
                          }}
                          className="w-full border border-gray-300 rounded-md px-2 py-1 text-xs"
                        />
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>

            {/* Grid Summary */}
            <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
              <h5 className="text-xs font-medium text-blue-800 mb-2">Grid Summary</h5>
              <div className="text-xs text-blue-700 space-y-1">
                <p>
                  <span className="font-medium">Size:</span>{' '}
                  {colorSettings?.gridConfig?.columns || 4}×{colorSettings?.gridConfig?.rows || 4} = {((colorSettings?.gridConfig?.columns || 4) * (colorSettings?.gridConfig?.rows || 4))} variations
                </p>
                {(() => {
                  const horizontalType = colorSettings?.transformations?.horizontal?.type || 'brightness';
                  const horizontalRange = getTransformationRange(horizontalType);
                  const horizontalMin = colorSettings?.transformations?.horizontal?.min ?? horizontalRange.defaultMin;
                  const horizontalMax = colorSettings?.transformations?.horizontal?.max ?? horizontalRange.defaultMax;
                  
                  const verticalType = colorSettings?.transformations?.vertical?.type || 'contrast';
                  const verticalRange = getTransformationRange(verticalType);
                  const verticalMin = colorSettings?.transformations?.vertical?.min ?? verticalRange.defaultMin;
                  const verticalMax = colorSettings?.transformations?.vertical?.max ?? verticalRange.defaultMax;
                  
                  return (
                    <>
                      <p>
                        <span className="font-medium">Columns:</span>{' '}
                        {horizontalType} ({horizontalMin} to {horizontalMax}{horizontalRange.unit})
                      </p>
                      <p>
                        <span className="font-medium">Rows:</span>{' '}
                        {verticalType} ({verticalMin} to {verticalMax}{verticalRange.unit})
                      </p>
                      <p className="font-medium text-green-700 mt-2">
                        ✓ Grid uses your current color settings as baseline
                      </p>
                      {(() => {
                        // Check if user's grid axes overlap with current non-neutral settings
                        const horizontalType = colorSettings?.transformations?.horizontal?.type || 'brightness';
                        const verticalType = colorSettings?.transformations?.vertical?.type || 'contrast';
                        
                        // Check if horizontal axis parameter has non-neutral user setting
                        const horizontalUserValue = (currentColorTransformation as any)[horizontalType];
                        let horizontalIsNeutral = false;
                        if (['brightness', 'saturation', 'hue', 'vibrance', 'shadows', 'highlights', 'midtoneBalance'].includes(horizontalType)) {
                          horizontalIsNeutral = horizontalUserValue === 0;
                        } else if (['contrast', 'gamma', 'redMultiplier', 'greenMultiplier', 'blueMultiplier'].includes(horizontalType)) {
                          horizontalIsNeutral = horizontalUserValue === 1.0;
                        } else if (horizontalType === 'blackPoint' || horizontalType === 'outputBlack') {
                          horizontalIsNeutral = horizontalUserValue === 0;
                        } else if (horizontalType === 'whitePoint' || horizontalType === 'outputWhite') {
                          horizontalIsNeutral = horizontalUserValue === 255;
                        }
                        
                        // Check if vertical axis parameter has non-neutral user setting
                        const verticalUserValue = (currentColorTransformation as any)[verticalType];
                        let verticalIsNeutral = false;
                        if (['brightness', 'saturation', 'hue', 'vibrance', 'shadows', 'highlights', 'midtoneBalance'].includes(verticalType)) {
                          verticalIsNeutral = verticalUserValue === 0;
                        } else if (['contrast', 'gamma', 'redMultiplier', 'greenMultiplier', 'blueMultiplier'].includes(verticalType)) {
                          verticalIsNeutral = verticalUserValue === 1.0;
                        } else if (verticalType === 'blackPoint' || verticalType === 'outputBlack') {
                          verticalIsNeutral = verticalUserValue === 0;
                        } else if (verticalType === 'whitePoint' || verticalType === 'outputWhite') {
                          verticalIsNeutral = verticalUserValue === 255;
                        }
                        
                        if (!horizontalIsNeutral && !verticalIsNeutral && horizontalType !== verticalType) {
                          return (
                            <p className="text-xs text-amber-700 mt-1">
                              ⚠️ Grid will override your current {horizontalType} and {verticalType} settings
                            </p>
                          );
                        } else if (!horizontalIsNeutral && horizontalType !== verticalType) {
                          return (
                            <p className="text-xs text-amber-700 mt-1">
                              ⚠️ Grid will override your current {horizontalType} setting
                            </p>
                          );
                        } else if (!verticalIsNeutral && horizontalType !== verticalType) {
                          return (
                            <p className="text-xs text-amber-700 mt-1">
                              ⚠️ Grid will override your current {verticalType} setting
                            </p>
                          );
                        }
                        return null;
                      })()}
                    </>
                  );
                })()}
              </div>
            </div>

            {/* Generate Test Grid Button */}
            <button
              disabled={!colorSettings?.selectedRegion}
              onClick={handleGenerateTestGrid}
              className={`w-full mt-4 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                colorSettings?.selectedRegion
                  ? 'bg-orange-600 text-white hover:bg-orange-700'
                  : 'bg-gray-200 text-gray-500 cursor-not-allowed'
              }`}
            >
              {colorSettings?.selectedRegion 
                ? 'Generate Test Grid PDF' 
                : 'Select crop region first'
              }
            </button>
          </div>
        </div>

        {/* Right Panel: Grid Preview */}
        <div className="space-y-4">
          {/* Calibration Testing Info */}
          <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-lg p-4">
            <p className="text-sm text-purple-700 mb-3">
              Generate test grids to fine-tune color settings for your specific printer and media. 
              This step is optional - you can proceed directly to Export if your preview looks good.
            </p>
            <div className="bg-purple-100 rounded-md p-3 text-xs text-purple-800">
              <p className="font-medium mb-1">How it works:</p>
              <p>1. Select a crop region from your card • 2. Configure grid parameters • 3. Generate test PDF • 4. Print and compare results • 5. Apply best settings</p>
            </div>
          </div>

          {/* Grid Preview */}
          {colorSettings?.selectedRegion ? (
            <div className="p-4 bg-white border border-gray-200 rounded-lg">
              <h4 className="text-sm font-medium text-gray-700 mb-3">
                Grid Preview
              </h4>
              <GridPreview
                cropImageUrl={extractCropRegion}
                gridConfig={colorSettings.gridConfig}
                transformations={colorSettings.transformations}
                userColorSettings={currentColorTransformation}
              />
            </div>
          ) : (
            <div className="p-4 bg-white border border-gray-200 rounded-lg">
              <h4 className="text-sm font-medium text-gray-700 mb-3">
                Grid Preview
              </h4>
              <div className="bg-gray-50 p-8 rounded-md text-center">
                <div className="text-gray-400 mb-2">
                  <svg width="48" height="48" fill="none" stroke="currentColor" viewBox="0 0 24 24" className="mx-auto">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <p className="text-sm text-gray-500">Select a crop region to see grid preview</p>
                <p className="text-xs text-gray-400 mt-1">Click on the card image to choose an area</p>
              </div>
            </div>
          )}
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
