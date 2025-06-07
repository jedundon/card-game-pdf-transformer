import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { ChevronLeftIcon, ChevronRightIcon, LayoutGridIcon, MoveIcon } from 'lucide-react';
interface ExtractStepProps {
  pdfData: any;
  pdfMode: any;
  pageSettings: any;
  extractionSettings: any;
  onSettingsChange: (settings: any) => void;
  onPrevious: () => void;
  onNext: () => void;
}
export const ExtractStep: React.FC<ExtractStepProps> = ({
  pdfData,
  pdfMode,
  pageSettings,
  extractionSettings,
  onSettingsChange,
  onPrevious,
  onNext
}) => {
  const [currentPage, setCurrentPage] = useState(0);
  const [currentCard, setCurrentCard] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [renderedPageData, setRenderedPageData] = useState<any>(null);
  const [cardPreviewUrl, setCardPreviewUrl] = useState<string | null>(null);
  const [isRendering, setIsRendering] = useState(false);
  const renderTaskRef = useRef<any>(null);
  const renderingRef = useRef(false);
  
  // Memoize activePages to prevent unnecessary re-renders
  const activePages = useMemo(() => 
    pageSettings.filter((page: any) => !page?.skip), 
    [pageSettings]
  );
    const totalPages = activePages.length;
  const cardsPerPage = extractionSettings.grid.rows * extractionSettings.grid.columns;
  // Calculate total unique cards based on PDF mode and card type
  const totalCards = useMemo(() => {
    if (pdfMode.type === 'duplex') {
      // In duplex mode, front and back pages alternate
      const frontPages = activePages.filter((page: any) => page.type === 'front').length;
      const totalUniqueCards = frontPages * cardsPerPage; // Each front card has a corresponding back card
      return totalUniqueCards;
    } else if (pdfMode.type === 'gutter-fold') {
      // In gutter-fold mode, each page contains both front and back cards
      // Total unique cards = total pages * cards per page (each card is unique)
      return totalPages * cardsPerPage;
    } else {
      // Fallback: treat each image as a unique card
      return totalPages * cardsPerPage;
    }
  }, [pdfMode.type, activePages, cardsPerPage]);
  // Calculate total cards of the current type (for navigation display)
  const totalCardsOfCurrentType = useMemo(() => {
    if (pdfMode.type === 'duplex') {
      // In duplex mode, both front and back have the same count
      const frontPages = activePages.filter((page: any) => page.type === 'front').length;
      return frontPages * cardsPerPage;
    } else if (pdfMode.type === 'gutter-fold') {
      // In gutter-fold mode, each page has front/back pairs
      // Count unique cards (each page contributes half the cards since they're mirrored)
      const cardsPerHalfPage = Math.floor(cardsPerPage / 2);
      return totalPages * cardsPerHalfPage;
    } else {
      // For other modes, use the total cards calculation
      return totalCards;
    }
  }, [pdfMode.type, activePages, cardsPerPage, totalCards, totalPages]);

  // Calculate card front/back identification based on PDF mode
  const getCardInfo = useCallback((cardIndex: number) => {
    if (!activePages.length) return { type: 'Unknown', id: 0 };
    
    const pageIndex = Math.floor(cardIndex / cardsPerPage);
    const cardOnPage = cardIndex % cardsPerPage;
    
    if (pageIndex >= activePages.length) return { type: 'Unknown', id: 0 };
    
    const pageType = activePages[pageIndex]?.type || 'front';
    
    if (pdfMode.type === 'duplex') {
      // In duplex mode, front and back pages alternate
      // Calculate global card ID based on which front page this card logically belongs to
      
      if (pageType === 'front') {
        // Front cards: global sequential numbering
        // Find which front page this is (0-indexed)
        const frontPageIndex = Math.floor(pageIndex / 2);
        const globalCardId = frontPageIndex * cardsPerPage + cardOnPage + 1;
        return { type: 'Front', id: globalCardId };
      } else {
        // Back cards: need to map physical position to logical card ID
        // Find which front page this back page corresponds to
        const correspondingFrontPageIndex = Math.floor((pageIndex - 1) / 2);
        
        if (pdfMode.flipEdge === 'short') {
          // Short edge flip: horizontally mirrored
          // Top-left becomes top-right, etc.
          const row = Math.floor(cardOnPage / extractionSettings.grid.columns);
          const col = cardOnPage % extractionSettings.grid.columns;
          const flippedCol = extractionSettings.grid.columns - 1 - col;
          const logicalCardOnPage = row * extractionSettings.grid.columns + flippedCol;
          const globalCardId = correspondingFrontPageIndex * cardsPerPage + logicalCardOnPage + 1;
          return { type: 'Back', id: globalCardId };
        } else {
          // Long edge flip: vertically mirrored
          // Top-left becomes bottom-left, etc.
          const row = Math.floor(cardOnPage / extractionSettings.grid.columns);
          const col = cardOnPage % extractionSettings.grid.columns;
          const flippedRow = extractionSettings.grid.rows - 1 - row;
          const logicalCardOnPage = flippedRow * extractionSettings.grid.columns + col;
          const globalCardId = correspondingFrontPageIndex * cardsPerPage + logicalCardOnPage + 1;
          return { type: 'Back', id: globalCardId };
        }
      }    } else if (pdfMode.type === 'gutter-fold') {
      // In gutter-fold mode, each page contains both front and back cards
      // Front and back cards have matching IDs (e.g., Front 1 and Back 1 are the same logical card)
      // Card IDs should continue across pages
      
      if (pdfMode.orientation === 'portrait') {
        // Portrait gutter-fold: left side is front, right side is back
        // Cards should be mirrored across the vertical gutter line
        const row = Math.floor(cardOnPage / extractionSettings.grid.columns);
        const col = cardOnPage % extractionSettings.grid.columns;
        const halfColumns = extractionSettings.grid.columns / 2;
        const isLeftSide = col < halfColumns;
        
        // Calculate cards per half-page (only count front or back cards)
        const cardsPerHalfPage = extractionSettings.grid.rows * halfColumns;
        const pageOffset = pageIndex * cardsPerHalfPage;
        
        if (isLeftSide) {
          // Front card: calculate ID based on position in left half + page offset
          const cardIdInSection = row * halfColumns + col + 1;
          const globalCardId = pageOffset + cardIdInSection;
          return { type: 'Front', id: globalCardId };
        } else {
          // Back card: mirror position across gutter line
          // Rightmost card (col = columns-1) matches leftmost (col = 0)
          const rightCol = col - halfColumns; // Position within right half (0-based)
          const mirroredCol = halfColumns - 1 - rightCol; // Mirror across the gutter
          const cardIdInSection = row * halfColumns + mirroredCol + 1;
          const globalCardId = pageOffset + cardIdInSection;
          return { type: 'Back', id: globalCardId };
        }
      } else {
        // Landscape gutter-fold: top is front, bottom is back
        // Cards should be mirrored across the horizontal gutter line
        const row = Math.floor(cardOnPage / extractionSettings.grid.columns);
        const col = cardOnPage % extractionSettings.grid.columns;
        const halfRows = extractionSettings.grid.rows / 2;
        const isTopHalf = row < halfRows;
        
        // Calculate cards per half-page (only count front or back cards)
        const cardsPerHalfPage = halfRows * extractionSettings.grid.columns;
        const pageOffset = pageIndex * cardsPerHalfPage;
        
        if (isTopHalf) {
          // Front card: calculate ID based on position in top half + page offset
          const cardIdInSection = row * extractionSettings.grid.columns + col + 1;
          const globalCardId = pageOffset + cardIdInSection;
          return { type: 'Front', id: globalCardId };
        } else {
          // Back card: mirror position across gutter line
          // Bottom row matches top row in mirrored fashion
          const bottomRow = row - halfRows; // Position within bottom half (0-based)
          const mirroredRow = halfRows - 1 - bottomRow; // Mirror across the gutter
          const cardIdInSection = mirroredRow * extractionSettings.grid.columns + col + 1;
          const globalCardId = pageOffset + cardIdInSection;
          return { type: 'Back', id: globalCardId };
        }
      }
    }
    
    // Fallback - use global card indexing
    return { type: pageType.charAt(0).toUpperCase() + pageType.slice(1), id: cardIndex + 1 };
  }, [activePages, extractionSettings.grid, pdfMode, cardsPerPage]);

  // Calculate the global card index from current page and card
  const globalCardIndex = currentPage * cardsPerPage + currentCard;

  // Get current card info (type and ID) for display
  const { type: cardType, id: cardId } = getCardInfo(globalCardIndex);

  // Remove excessive logging
  // Extract individual card from canvas at 300 DPI
  const extractCardImage = useCallback(async (cardIndex: number): Promise<string | null> => {
    if (!pdfData || !activePages.length) {
      return null;
    }

    try {
      // Calculate which page and card position this cardIndex represents
      const pageIndex = Math.floor(cardIndex / cardsPerPage);
      const cardOnPage = cardIndex % cardsPerPage;

      // Get the actual page number from active pages
      const actualPageNumber = pageSettings.findIndex((page: any, index: number) => 
        !page?.skip && pageSettings.slice(0, index + 1).filter((p: any) => !p?.skip).length === pageIndex + 1
      ) + 1;

      const page = await pdfData.getPage(actualPageNumber);
      
      // Calculate scale for 300 DPI (PDF.js uses 72 DPI as base, so 300/72 = ~4.17)
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
        console.error('Could not get high-resolution canvas context');
        return null;
      }
      
      // Render the page at high resolution
      const renderContext = {
        canvasContext: highResContext,
        viewport: viewport
      };
      
      await page.render(renderContext).promise;
      
      // Calculate card dimensions after cropping at high resolution
      // Crop settings are in 300 DPI pixels, so they can be used directly
      const croppedWidth = viewport.width - extractionSettings.crop.left - extractionSettings.crop.right;
      const croppedHeight = viewport.height - extractionSettings.crop.top - extractionSettings.crop.bottom;
      
      // Validate cropped dimensions
      if (croppedWidth <= 0 || croppedHeight <= 0) {
        console.error('Card extraction failed: crop values too large for high-res canvas');
        return null;
      }
      
      const cardWidth = croppedWidth / extractionSettings.grid.columns;
      const cardHeight = croppedHeight / extractionSettings.grid.rows;
      
      // Validate card dimensions
      if (cardWidth <= 0 || cardHeight <= 0) {
        console.error('Card extraction failed: invalid card dimensions at high resolution');
        return null;
      }
        // Calculate card position at high resolution using cardOnPage (not cardIndex)
      const row = Math.floor(cardOnPage / extractionSettings.grid.columns);
      const col = cardOnPage % extractionSettings.grid.columns;
      
      const x = extractionSettings.crop.left + (col * cardWidth);
      const y = extractionSettings.crop.top + (row * cardHeight);
      
      // Ensure extraction coordinates are within canvas bounds
      const sourceX = Math.max(0, Math.min(Math.floor(x), viewport.width - 1));
      const sourceY = Math.max(0, Math.min(Math.floor(y), viewport.height - 1));
      const sourceWidth = Math.max(1, Math.min(Math.floor(cardWidth), viewport.width - sourceX));
      const sourceHeight = Math.max(1, Math.min(Math.floor(cardHeight), viewport.height - sourceY));
      
      // Create a new canvas for the extracted card
      const cardCanvas = document.createElement('canvas');
      cardCanvas.width = Math.max(1, sourceWidth);
      cardCanvas.height = Math.max(1, sourceHeight);
      const cardContext = cardCanvas.getContext('2d');
      
      if (!cardContext) {
        console.error('Card extraction failed: could not get card canvas context');
        return null;
      }
      
      // Extract the card area from the high-resolution canvas
      cardContext.drawImage(
        highResCanvas,
        sourceX, sourceY, sourceWidth, sourceHeight,
        0, 0, cardCanvas.width, cardCanvas.height
      );
      
      const dataUrl = cardCanvas.toDataURL('image/png');
      return dataUrl;
      
    } catch (error) {
      console.error('Error in high-DPI card extraction:', error);
      return null;
    }
  }, [pdfData, extractionSettings.crop, extractionSettings.grid, activePages, pageSettings, cardsPerPage]);

  // Render PDF page to canvas
  useEffect(() => {
    const renderPage = async () => {
      if (!pdfData || !canvasRef.current || !activePages.length) return;
      
      // Prevent multiple concurrent renders using ref
      if (renderingRef.current || isRendering) {
        return;
      }
      
      renderingRef.current = true;
      setIsRendering(true);
      
      // Cancel any existing render task
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
        renderTaskRef.current = null;
      }
      
      try {
        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');
        if (!context) {
          setIsRendering(false);
          return;
        }

        // Get the actual page number from active pages
        const actualPageNumber = pageSettings.findIndex((page: any, index: number) => 
          !page?.skip && pageSettings.slice(0, index + 1).filter((p: any) => !p?.skip).length === currentPage + 1
        ) + 1;

        const page = await pdfData.getPage(actualPageNumber);
        
        // Calculate scale to fit the preview area nicely
        const baseViewport = page.getViewport({ scale: 1.0 });
        const maxWidth = 450; // Fixed max width for consistency
        const maxHeight = 600; // Fixed max height for consistency
        
        const scaleX = maxWidth / baseViewport.width;
        const scaleY = maxHeight / baseViewport.height;
        const scale = Math.min(scaleX, scaleY, 2.0); // Allow up to 2x scaling
        
        const viewport = page.getViewport({ scale });
        
        // Set canvas size to match scaled viewport with minimum dimensions
        const canvasWidth = Math.max(200, viewport.width);
        const canvasHeight = Math.max(250, viewport.height);
        
        canvas.width = canvasWidth;
        canvas.height = canvasHeight;
        
        // Clear the canvas after setting dimensions
        context.clearRect(0, 0, canvas.width, canvas.height);
        
        // Render the page
        const renderContext = {
          canvasContext: context,
          viewport: viewport
        };
        
        const renderTask = page.render(renderContext);
        renderTaskRef.current = renderTask;
        
        await renderTask.promise;
        
        // Store page data for card extraction preview including the scale
        setRenderedPageData({
          width: canvasWidth,
          height: canvasHeight,
          actualPageNumber,
          previewScale: scale // Store the preview scale for crop calculations
        });
        
      } catch (error: any) {
        if (error?.name !== 'RenderingCancelledException') {
          console.error('Error rendering PDF page:', error);
        }
      } finally {
        renderingRef.current = false;
        setIsRendering(false);
        renderTaskRef.current = null;
      }
    };

    renderPage();
    
    // Cleanup function
    return () => {
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
        renderTaskRef.current = null;
      }
      renderingRef.current = false;
    };
  }, [pdfData, currentPage, activePages, pageSettings]);

  // Update card preview when current card or extraction settings change  // Update card preview when current card or extraction settings change
  useEffect(() => {
    if (renderedPageData && !isRendering && canvasRef.current) {
      // Delay the card extraction to ensure canvas is fully rendered
      const timer = setTimeout(async () => {
        const cardUrl = await extractCardImage(globalCardIndex);
        setCardPreviewUrl(cardUrl);
      }, 500);
      
      return () => clearTimeout(timer);
    } else {
      // Clear the preview if prerequisites aren't met
      setCardPreviewUrl(null);
    }
  }, [currentCard, currentPage, renderedPageData, isRendering, extractionSettings.crop, extractionSettings.grid, extractCardImage, globalCardIndex]);

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
  const handlePreviousPage = () => {
    setCurrentPage(prev => Math.max(0, prev - 1));
    setCurrentCard(0);
  };
  const handleNextPage = () => {
    setCurrentPage(prev => Math.min(totalPages - 1, prev + 1));
    setCurrentCard(0);
  };
  const handlePreviousCard = () => {
    setCurrentCard(prev => Math.max(0, prev - 1));
  };
  const handleNextCard = () => {
    setCurrentCard(prev => Math.min(totalCards - 1, prev + 1));
  };

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-gray-800">Extract Cards</h2>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-medium text-gray-800 mb-3">
              Page Crop Settings
            </h3>
            <p className="text-sm text-gray-600 mb-3">
              Specify margins to crop from each edge (values in 300 DPI pixels for precise control)
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Top Margin (px at 300 DPI)
                </label>
                <input type="number" value={extractionSettings.crop.top} onChange={e => handleCropChange('top', parseInt(e.target.value))} className="w-full border border-gray-300 rounded-md px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Right Margin (px at 300 DPI)
                </label>
                <input type="number" value={extractionSettings.crop.right} onChange={e => handleCropChange('right', parseInt(e.target.value))} className="w-full border border-gray-300 rounded-md px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Bottom Margin (px at 300 DPI)
                </label>
                <input type="number" value={extractionSettings.crop.bottom} onChange={e => handleCropChange('bottom', parseInt(e.target.value))} className="w-full border border-gray-300 rounded-md px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Left Margin (px at 300 DPI)
                </label>
                <input type="number" value={extractionSettings.crop.left} onChange={e => handleCropChange('left', parseInt(e.target.value))} className="w-full border border-gray-300 rounded-md px-3 py-2" />
              </div>
            </div>
          </div>
          <div>
            <h3 className="text-lg font-medium text-gray-800 mb-3">
              Card Grid
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Rows
                </label>
                <input type="number" min="1" max="10" value={extractionSettings.grid.rows} onChange={e => handleGridChange('rows', parseInt(e.target.value))} className="w-full border border-gray-300 rounded-md px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Columns
                </label>
                <input type="number" min="1" max="10" value={extractionSettings.grid.columns} onChange={e => handleGridChange('columns', parseInt(e.target.value))} className="w-full border border-gray-300 rounded-md px-3 py-2" />
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
            <div className="flex items-center">
              <LayoutGridIcon size={16} className="text-gray-600 mr-2" />
              <span className="text-sm text-gray-600">
                {extractionSettings.grid.rows * extractionSettings.grid.columns}{' '}
                cards per page
              </span>
            </div>
            <div className="flex items-center">
              <MoveIcon size={16} className="text-gray-600 mr-2" />
              <span className="text-sm text-gray-600">
                Total crop applied:{' '}
                {extractionSettings.crop.top + extractionSettings.crop.right + extractionSettings.crop.bottom + extractionSettings.crop.left}
                px (300 DPI)
              </span>
            </div>
          </div>

          {/* 300 DPI indicator */}
          <div className="p-3 bg-blue-50 rounded-md">
            <div className="flex items-center">
              <span className="text-sm font-medium text-blue-800">
                Card extraction quality: 300 DPI
              </span>
            </div>
            <p className="text-xs text-blue-600 mt-1">
              Cards will be extracted at high resolution for optimal print quality.
              Crop settings are specified directly in 300 DPI pixels for precise control.
            </p>
          </div>
        </div>
        <div className="space-y-4">
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <div className="bg-gray-50 p-3 border-b border-gray-200 flex justify-between items-center">
              <div className="flex items-center space-x-2">
                <button onClick={handlePreviousPage} disabled={currentPage === 0} className="p-1 rounded-full hover:bg-gray-200 disabled:opacity-50">
                  <ChevronLeftIcon size={16} />
                </button>
                <span className="text-sm text-gray-700">
                  Page {currentPage + 1} of {totalPages}
                </span>
                <button onClick={handleNextPage} disabled={currentPage === totalPages - 1} className="p-1 rounded-full hover:bg-gray-200 disabled:opacity-50">
                  <ChevronRightIcon size={16} />
                </button>
              </div>
              <div className="text-sm text-gray-500">
                {activePages[currentPage]?.type === 'front' ? 'Front' : 'Back'}{' '}
                page
              </div>
            </div>
            <div className="bg-gray-100 min-h-[500px] flex items-center justify-center p-4">
              <div className="relative bg-white shadow-lg rounded-lg p-4 min-w-[300px] min-h-[400px] flex items-center justify-center">
                <canvas 
                  ref={canvasRef}
                  className="block"
                  style={{ 
                    display: pdfData && activePages.length > 0 ? 'block' : 'none',
                    maxWidth: '100%',
                    maxHeight: '100%'
                  }}
                />
                {(!pdfData || activePages.length === 0) && (
                  <div className="text-gray-400 text-center p-8">
                    <p>No PDF loaded or no active pages</p>
                  </div>
                )}
                
                {/* Grid overlay showing the card extraction */}
                {renderedPageData && canvasRef.current && renderedPageData.previewScale && (
                  <div 
                    className="absolute pointer-events-none"
                    style={{
                      top: '0',
                      left: '0',
                      width: '100%',
                      height: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    <div
                      className="pointer-events-auto"
                      style={{
                        position: 'relative',
                        width: `${canvasRef.current.width}px`,
                        height: `${canvasRef.current.height}px`
                      }}
                    >
                      {/* Overlay for cropped margins only - four separate rectangles */}
                      {/* Top margin */}
                      <div
                        className="absolute"
                        style={{
                          top: 0,
                          left: 0,
                          width: `${canvasRef.current.width}px`,
                          height: `${extractionSettings.crop.top * renderedPageData.previewScale / (300/72)}px`,
                          background: 'rgba(0, 0, 0, 0.6)',
                          pointerEvents: 'none'
                        }}
                      />
                      {/* Bottom margin */}
                      <div
                        className="absolute"
                        style={{
                          bottom: 0,
                          left: 0,
                          width: `${canvasRef.current.width}px`,
                          height: `${extractionSettings.crop.bottom * renderedPageData.previewScale / (300/72)}px`,
                          background: 'rgba(0, 0, 0, 0.6)',
                          pointerEvents: 'none'
                        }}
                      />
                      {/* Left margin */}
                      <div
                        className="absolute"
                        style={{
                          top: `${extractionSettings.crop.top * renderedPageData.previewScale / (300/72)}px`,
                          left: 0,
                          width: `${extractionSettings.crop.left * renderedPageData.previewScale / (300/72)}px`,
                          height: `${Math.max(0, canvasRef.current.height - (extractionSettings.crop.top + extractionSettings.crop.bottom) * renderedPageData.previewScale / (300/72))}px`,
                          background: 'rgba(0, 0, 0, 0.6)',
                          pointerEvents: 'none'
                        }}
                      />
                      {/* Right margin */}
                      <div
                        className="absolute"
                        style={{
                          top: `${extractionSettings.crop.top * renderedPageData.previewScale / (300/72)}px`,
                          right: 0,
                          width: `${extractionSettings.crop.right * renderedPageData.previewScale / (300/72)}px`,
                          height: `${Math.max(0, canvasRef.current.height - (extractionSettings.crop.top + extractionSettings.crop.bottom) * renderedPageData.previewScale / (300/72))}px`,
                          background: 'rgba(0, 0, 0, 0.6)',
                          pointerEvents: 'none'
                        }}
                      />
                      
                      {/* Grid overlay for card selection */}
                      <div 
                        style={{
                          position: 'absolute',
                          top: `${extractionSettings.crop.top * renderedPageData.previewScale / (300/72)}px`,
                          left: `${extractionSettings.crop.left * renderedPageData.previewScale / (300/72)}px`,
                          width: `${Math.max(0, canvasRef.current.width - (extractionSettings.crop.left + extractionSettings.crop.right) * renderedPageData.previewScale / (300/72))}px`,
                          height: `${Math.max(0, canvasRef.current.height - (extractionSettings.crop.top + extractionSettings.crop.bottom) * renderedPageData.previewScale / (300/72))}px`,
                          display: 'grid',
                          gridTemplateRows: `repeat(${extractionSettings.grid.rows}, 1fr)`,
                          gridTemplateColumns: `repeat(${extractionSettings.grid.columns}, 1fr)`,
                          gap: '1px',
                          pointerEvents: 'auto'
                        }}
                      >
                        {Array.from({
                          length: extractionSettings.grid.rows * extractionSettings.grid.columns
                        }).map((_, idx) => (
                          <div 
                            key={idx} 
                            className={`cursor-pointer transition-all duration-200 ${
                              idx === currentCard 
                                ? 'border-2 border-blue-500' 
                                : 'border border-blue-300 hover:border-blue-400'
                            }`}
                            style={{
                              // Selected card: completely transparent to match card preview brightness
                              // Unselected cards: dimmed to show they're not selected
                              background: idx === currentCard 
                                ? 'transparent' // Completely clear - no tint, no overlay
                                : 'rgba(0, 0, 0, 0.25)' // Dim unselected cards
                            }}
                            onClick={() => setCurrentCard(idx)}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="bg-gray-50 p-3 border-t border-gray-200 flex justify-between items-center">              <div className="flex items-center space-x-2">
                <button onClick={handlePreviousCard} disabled={currentCard === 0} className="p-1 rounded-full hover:bg-gray-200 disabled:opacity-50">
                  <ChevronLeftIcon size={16} />
                </button>                <span className="text-sm text-gray-700">
                  Card {cardId} of {totalCardsOfCurrentType}
                </span>
                <button onClick={handleNextCard} disabled={currentCard === cardsPerPage - 1} className="p-1 rounded-full hover:bg-gray-200 disabled:opacity-50">
                  <ChevronRightIcon size={16} />
                </button>
              </div>
            </div>
          </div>
          <div className="p-4 border border-gray-200 rounded-lg">            <div className="flex justify-between items-center mb-2">
              <h4 className="text-sm font-medium text-gray-700">
                {cardType} {cardId} Preview
              </h4>
              <button 
                onClick={async () => {
                  const cardUrl = await extractCardImage(globalCardIndex);
                  setCardPreviewUrl(cardUrl);
                }}
                className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded"
              >
                Refresh
              </button>
            </div>
            <div className="bg-gray-100 border border-gray-300 rounded p-4 min-h-[200px] flex items-center justify-center">              {cardPreviewUrl ? (
                <img 
                  src={cardPreviewUrl} 
                  alt={`${cardType} ${cardId}`}
                  className="max-w-full max-h-full object-contain"
                />
              ) : (
                <div className="flex items-center justify-center text-gray-400">
                  {isRendering ? 'Rendering...' : `Card ${currentCard + 1} Preview`}
                </div>
              )}
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
    </div>
  );
};