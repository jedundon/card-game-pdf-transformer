import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ChevronLeftIcon, ChevronRightIcon, MoveHorizontalIcon, MoveVerticalIcon, RotateCcwIcon } from 'lucide-react';
interface ConfigureStepProps {
  pdfData: any;
  extractionSettings: any;
  outputSettings: any;
  pageSettings: any;
  onSettingsChange: (settings: any) => void;
  onPrevious: () => void;
  onNext: () => void;
}
export const ConfigureStep: React.FC<ConfigureStepProps> = ({
  pdfData,
  extractionSettings,
  outputSettings,
  pageSettings,
  onSettingsChange,
  onPrevious,
  onNext
}) => {
  const [currentCard, setCurrentCard] = useState(0);
  const [cardPreviewUrl, setCardPreviewUrl] = useState<string | null>(null);
  
  // Calculate total cards from extraction settings and active pages
  const activePages = useMemo(() => 
    pageSettings.filter((page: any) => !page?.skip), 
    [pageSettings]
  );
  
  const totalCards = useMemo(() => {
    const cardsPerPage = extractionSettings.grid.rows * extractionSettings.grid.columns;
    return activePages.length * cardsPerPage;
  }, [extractionSettings.grid, activePages]);
  // Extract card image for preview
  const extractCardImage = useCallback(async (cardIndex: number): Promise<string | null> => {
    if (!pdfData || !activePages.length) {
      return null;
    }

    try {
      // Calculate which page and position the card is on
      const cardsPerPage = extractionSettings.grid.rows * extractionSettings.grid.columns;
      const pageIndex = Math.floor(cardIndex / cardsPerPage);
      const cardOnPage = cardIndex % cardsPerPage;
      
      if (pageIndex >= activePages.length) {
        return null;
      }

      // Get the actual page number from active pages
      const actualPageNumber = pageSettings.findIndex((page: any, index: number) => 
        !page?.skip && pageSettings.slice(0, index + 1).filter((p: any) => !p?.skip).length === pageIndex + 1
      ) + 1;

      const page = await pdfData.getPage(actualPageNumber);
      
      // Calculate scale for 300 DPI
      const targetDPI = 300;
      const baseDPI = 72;
      const highResScale = targetDPI / baseDPI;
      
      const viewport = page.getViewport({ scale: highResScale });
      
      // Create a high-resolution canvas
      const highResCanvas = document.createElement('canvas');
      highResCanvas.width = viewport.width;
      highResCanvas.height = viewport.height;
      const highResContext = highResCanvas.getContext('2d');
      
      if (!highResContext) {
        return null;
      }
      
      // Render the page at high resolution
      const renderContext = {
        canvasContext: highResContext,
        viewport: viewport
      };
      
      await page.render(renderContext).promise;
      
      // Calculate card dimensions after cropping
      const croppedWidth = viewport.width - extractionSettings.crop.left - extractionSettings.crop.right;
      const croppedHeight = viewport.height - extractionSettings.crop.top - extractionSettings.crop.bottom;
      
      if (croppedWidth <= 0 || croppedHeight <= 0) {
        return null;
      }
      
      const cardWidth = croppedWidth / extractionSettings.grid.columns;
      const cardHeight = croppedHeight / extractionSettings.grid.rows;
      
      // Calculate card position
      const row = Math.floor(cardOnPage / extractionSettings.grid.columns);
      const col = cardOnPage % extractionSettings.grid.columns;
      
      const x = extractionSettings.crop.left + (col * cardWidth);
      const y = extractionSettings.crop.top + (row * cardHeight);
      
      // Extract the card area
      const cardCanvas = document.createElement('canvas');
      cardCanvas.width = Math.max(1, Math.floor(cardWidth));
      cardCanvas.height = Math.max(1, Math.floor(cardHeight));
      const cardContext = cardCanvas.getContext('2d');
      
      if (!cardContext) {
        return null;
      }
      
      cardContext.drawImage(
        highResCanvas,
        Math.floor(x), Math.floor(y), Math.floor(cardWidth), Math.floor(cardHeight),
        0, 0, cardCanvas.width, cardCanvas.height
      );
      
      return cardCanvas.toDataURL('image/png');
      
    } catch (error) {
      console.error('Error extracting card image:', error);
      return null;
    }
  }, [pdfData, extractionSettings, activePages, pageSettings]);

  // Update card preview when current card changes
  useEffect(() => {
    if (totalCards > 0) {
      const updatePreview = async () => {
        const cardUrl = await extractCardImage(currentCard);
        setCardPreviewUrl(cardUrl);
      };
      updatePreview();
    }
  }, [currentCard, extractCardImage, totalCards]);

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
  const handleRotationChange = (value: number) => {
    const newSettings = {
      ...outputSettings,
      rotation: value
    };
    onSettingsChange(newSettings);
  };
  const handlePreviousCard = () => {
    setCurrentCard(prev => Math.max(0, prev - 1));
  };
  const handleNextCard = () => {
    setCurrentCard(prev => Math.min(totalCards - 1, prev + 1));
  };

  // Ensure currentCard is within bounds when totalCards changes
  useEffect(() => {
    if (currentCard >= totalCards && totalCards > 0) {
      setCurrentCard(totalCards - 1);
    }
  }, [currentCard, totalCards]);

  // Get card type (front/back) based on page settings
  const getCardType = (cardIndex: number): string => {
    if (!activePages.length) return 'Unknown';
    
    const cardsPerPage = extractionSettings.grid.rows * extractionSettings.grid.columns;
    const pageIndex = Math.floor(cardIndex / cardsPerPage);
    
    if (pageIndex >= activePages.length) return 'Unknown';
    
    const pageType = activePages[pageIndex]?.type || 'front';
    return pageType.charAt(0).toUpperCase() + pageType.slice(1);
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
          <div>
            <h3 className="text-lg font-medium text-gray-800 mb-3">
              Card Crop Settings
            </h3>
            <p className="text-sm text-gray-600 mb-3">
              Remove pixels from each edge of the extracted card (applied during final output)
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
              Card Rotation
            </h3>
            <p className="text-sm text-gray-600 mb-3">
              Rotate the final card output for different orientations
            </p>
            <div className="flex items-center space-x-4">
              <RotateCcwIcon size={16} className="text-gray-500" />
              <div className="flex-1 flex space-x-2">
                {[0, 90, 180, 270].map(degree => <button key={degree} onClick={() => handleRotationChange(degree)} className={`flex-1 py-2 border ${outputSettings.rotation === degree ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'} rounded-md text-sm font-medium`}>
                    {degree}°
                  </button>)}
              </div>
            </div>
          </div>
        </div>
        <div className="space-y-4">
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <div className="bg-gray-50 p-3 border-b border-gray-200 flex justify-between items-center">
              <div className="flex items-center space-x-2">
                <button onClick={handlePreviousCard} disabled={currentCard === 0 || totalCards === 0} className="p-1 rounded-full hover:bg-gray-200 disabled:opacity-50">
                  <ChevronLeftIcon size={16} />
                </button>
                <span className="text-sm text-gray-700">
                  {totalCards > 0 ? `Card ${currentCard + 1} of ${totalCards}` : 'No cards'}
                </span>
                <button onClick={handleNextCard} disabled={currentCard === totalCards - 1 || totalCards === 0} className="p-1 rounded-full hover:bg-gray-200 disabled:opacity-50">
                  <ChevronRightIcon size={16} />
                </button>
              </div>
              <div className="text-sm text-gray-500">
                {totalCards > 0 ? getCardType(currentCard) : 'No cards'}
              </div>
            </div>
            <div className="p-4 bg-gray-100">
              <div className="relative mx-auto bg-white shadow" style={{
              width: `${outputSettings.pageSize.width * 96}px`,
              height: `${outputSettings.pageSize.height * 96}px`,
              maxWidth: '100%',
              maxHeight: '500px'
            }}>
                {/* Card positioned on the page */}
                <div className="absolute bg-gray-200 border border-gray-300 overflow-hidden" style={{
                width: `${200 - outputSettings.crop.left - outputSettings.crop.right}px`,
                height: `${280 - outputSettings.crop.top - outputSettings.crop.bottom}px`,
                top: '50%',
                left: '50%',
                marginLeft: `calc(-${(200 - outputSettings.crop.left - outputSettings.crop.right) / 2}px + ${outputSettings.offset.horizontal * 96}px)`,
                marginTop: `calc(-${(280 - outputSettings.crop.top - outputSettings.crop.bottom) / 2}px + ${outputSettings.offset.vertical * 96}px)`,
                transform: `rotate(${outputSettings.rotation}deg)`
              }}>
                  {cardPreviewUrl ? (
                    <div 
                      className="w-full h-full bg-cover bg-center"
                      style={{
                        backgroundImage: `url(${cardPreviewUrl})`,
                        backgroundPosition: `${-outputSettings.crop.left}px ${-outputSettings.crop.top}px`,
                        backgroundSize: '200px 280px'
                      }}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-500 text-sm">
                      Card {currentCard + 1}
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
                {outputSettings.rotation}°
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
    </div>;
};