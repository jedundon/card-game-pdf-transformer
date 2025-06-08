import React, { useState, useRef, useEffect, useCallback, useMemo, useLayoutEffect } from 'react';
import { ChevronLeftIcon, ChevronRightIcon, LayoutGridIcon, MoveIcon } from 'lucide-react';
import { 
  getActivePages, 
  calculateTotalCards, 
  getCardInfo, 
  extractCardImage as extractCardImageUtil,
  getActualPageNumber,
  getDpiScaleFactor
} from '../utils/cardUtils';
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
  const [canvasDisplaySize, setCanvasDisplaySize] = useState({ width: 0, height: 0 });
  const renderTaskRef = useRef<any>(null);
  const renderingRef = useRef(false);
    // Memoize activePages to prevent unnecessary re-renders
  const activePages = useMemo(() => 
    getActivePages(pageSettings), 
    [pageSettings]
  );
  const totalPages = activePages.length;
  const cardsPerPage = extractionSettings.grid.rows * extractionSettings.grid.columns;
  
  // Calculate total unique cards based on PDF mode and card type
  const totalCards = useMemo(() => 
    calculateTotalCards(pdfMode, activePages, cardsPerPage), 
    [pdfMode, activePages, cardsPerPage]
  );
    // Calculate card front/back identification based on PDF mode
  // Calculate the global card index from current page and card
  const globalCardIndex = currentPage * cardsPerPage + currentCard;
  
  // Get current card info (type and ID) for display
  const { type: cardType, id: cardId } = getCardInfo(globalCardIndex, activePages, extractionSettings, pdfMode, cardsPerPage);  // Remove excessive logging
  // Extract individual card from canvas at 300 DPI using utility function
  const extractCardImage = useCallback(async (cardIndex: number): Promise<string | null> => {
    return await extractCardImageUtil(cardIndex, pdfData, pdfMode, activePages, pageSettings, extractionSettings);
  }, [pdfData, extractionSettings, pdfMode, activePages, pageSettings]);

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
        }        // Get the actual page number from active pages
        const actualPageNumber = getActualPageNumber(currentPage, pageSettings);

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
    }  }, [currentCard, currentPage, renderedPageData, isRendering, extractionSettings.crop, extractionSettings.grid, extractionSettings.gutterWidth, extractCardImage, globalCardIndex]);

  // Track canvas display size for proper overlay scaling
  useLayoutEffect(() => {
    const updateCanvasDisplaySize = () => {
      if (canvasRef.current) {
        const rect = canvasRef.current.getBoundingClientRect();
        setCanvasDisplaySize({ width: rect.width, height: rect.height });
      }
    };

    updateCanvasDisplaySize();
    
    const resizeObserver = new ResizeObserver(updateCanvasDisplaySize);
    if (canvasRef.current) {
      resizeObserver.observe(canvasRef.current);
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, [renderedPageData, extractionSettings.grid, extractionSettings.crop]);

  const handleCropChange = (edge: string, value: number) => {
    const newSettings = {
      ...extractionSettings,
      crop: {
        ...extractionSettings.crop,
        [edge]: value
      }
    };
    onSettingsChange(newSettings);
  };  const handleGridChange = (dimension: string, value: number) => {
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
          </div>          <div>
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

          {/* Gutter Width Control - only show for gutter-fold mode */}
          {pdfMode.type === 'gutter-fold' && (
            <div>
              <h3 className="text-lg font-medium text-gray-800 mb-3">
                Gutter Settings
              </h3>
              <p className="text-sm text-gray-600 mb-3">
                Specify the width of the gutter area between front and back cards (in 300 DPI pixels)
              </p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Gutter Width (px at 300 DPI)
                </label>
                <input 
                  type="number" 
                  min="0" 
                  value={extractionSettings.gutterWidth || 0} 
                  onChange={e => handleGutterWidthChange(parseInt(e.target.value))} 
                  className="w-full border border-gray-300 rounded-md px-3 py-2" 
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                This area will be cropped out from the center of the page between front and back cards
              </p>
            </div>
          )}          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
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
                {pdfMode.type === 'gutter-fold' && (extractionSettings.gutterWidth || 0) > 0 && (
                  <>
                    {' + '}
                    {extractionSettings.gutterWidth}px gutter
                  </>
                )}
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
                )}                {/* Grid overlay showing the card extraction */}
                {renderedPageData && canvasRef.current && renderedPageData.previewScale && canvasDisplaySize.width > 0 && (
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
                        width: `${canvasDisplaySize.width}px`,
                        height: `${canvasDisplaySize.height}px`
                      }}
                    >                      {/* Overlay for cropped margins only - four separate rectangles */}
                      {(() => {
                        // Calculate scale factor for CSS scaling
                        const canvas = canvasRef.current;
                        const cssScaleX = canvasDisplaySize.width / canvas.width;
                        const cssScaleY = canvasDisplaySize.height / canvas.height;
                        const cssScale = Math.min(cssScaleX, cssScaleY);
                        
                        const scaleFactor = renderedPageData.previewScale / getDpiScaleFactor() * cssScale;
                        
                        return (
                          <>
                            {/* Top margin */}
                            <div
                              className="absolute"
                              style={{
                                top: 0,
                                left: 0,
                                width: `${canvasDisplaySize.width}px`,
                                height: `${extractionSettings.crop.top * scaleFactor}px`,
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
                                width: `${canvasDisplaySize.width}px`,
                                height: `${extractionSettings.crop.bottom * scaleFactor}px`,
                                background: 'rgba(0, 0, 0, 0.6)',
                                pointerEvents: 'none'
                              }}
                            />
                            {/* Left margin */}
                            <div
                              className="absolute"
                              style={{
                                top: `${extractionSettings.crop.top * scaleFactor}px`,
                                left: 0,
                                width: `${extractionSettings.crop.left * scaleFactor}px`,
                                height: `${Math.max(0, canvasDisplaySize.height - (extractionSettings.crop.top + extractionSettings.crop.bottom) * scaleFactor)}px`,
                                background: 'rgba(0, 0, 0, 0.6)',
                                pointerEvents: 'none'
                              }}
                            />
                            {/* Right margin */}
                            <div
                              className="absolute"
                              style={{
                                top: `${extractionSettings.crop.top * scaleFactor}px`,
                                right: 0,
                                width: `${extractionSettings.crop.right * scaleFactor}px`,
                                height: `${Math.max(0, canvasDisplaySize.height - (extractionSettings.crop.top + extractionSettings.crop.bottom) * scaleFactor)}px`,
                                background: 'rgba(0, 0, 0, 0.6)',
                                pointerEvents: 'none'
                              }}
                            />
                          </>
                        );
                      })()}
                      
                      {/* Gutter overlay for gutter-fold mode */}
                      {pdfMode.type === 'gutter-fold' && (extractionSettings.gutterWidth || 0) > 0 && (() => {
                        const canvas = canvasRef.current;
                        const cssScaleX = canvasDisplaySize.width / canvas.width;
                        const cssScaleY = canvasDisplaySize.height / canvas.height;
                        const cssScale = Math.min(cssScaleX, cssScaleY);
                        
                        const gutterWidth = extractionSettings.gutterWidth || 0;
                        const scaleFactor = renderedPageData.previewScale / getDpiScaleFactor() * cssScale;
                        const gutterSizePx = gutterWidth * scaleFactor;
                        
                        return (
                          <div
                            className="absolute"
                            style={(() => {
                              if (pdfMode.orientation === 'vertical') {
                                // Vertical gutter down the middle
                                const croppedWidth = canvasDisplaySize.width - (extractionSettings.crop.left + extractionSettings.crop.right) * scaleFactor;
                                const availableWidthForCards = croppedWidth - gutterSizePx;
                                const leftSectionWidth = availableWidthForCards / 2;
                                
                                return {
                                  top: `${extractionSettings.crop.top * scaleFactor}px`,
                                  left: `${extractionSettings.crop.left * scaleFactor + leftSectionWidth}px`,
                                  width: `${gutterSizePx}px`,
                                  height: `${Math.max(0, canvasDisplaySize.height - (extractionSettings.crop.top + extractionSettings.crop.bottom) * scaleFactor)}px`,
                                  background: 'rgba(255, 0, 0, 0.3)', // Red tint to show gutter area
                                  pointerEvents: 'none'
                                };
                              } else {
                                // Horizontal gutter across the middle
                                const croppedHeight = canvasDisplaySize.height - (extractionSettings.crop.top + extractionSettings.crop.bottom) * scaleFactor;
                                const availableHeightForCards = croppedHeight - gutterSizePx;
                                const topSectionHeight = availableHeightForCards / 2;
                                
                                return {
                                  top: `${extractionSettings.crop.top * scaleFactor + topSectionHeight}px`,
                                  left: `${extractionSettings.crop.left * scaleFactor}px`,
                                  width: `${Math.max(0, canvasDisplaySize.width - (extractionSettings.crop.left + extractionSettings.crop.right) * scaleFactor)}px`,
                                  height: `${gutterSizePx}px`,
                                  background: 'rgba(255, 0, 0, 0.3)', // Red tint to show gutter area
                                  pointerEvents: 'none'
                                };
                              }
                            })()}
                          />
                        );
                      })()}                      {/* Grid overlay for card selection */}
                      <div 
                        style={(() => {
                          const canvas = canvasRef.current;
                          const cssScaleX = canvasDisplaySize.width / canvas.width;
                          const cssScaleY = canvasDisplaySize.height / canvas.height;
                          const cssScale = Math.min(cssScaleX, cssScaleY);
                          
                          const scaleFactor = renderedPageData.previewScale / getDpiScaleFactor() * cssScale;
                          
                          if (pdfMode.type === 'gutter-fold' && (extractionSettings.gutterWidth || 0) > 0) {
                            // For gutter-fold mode with gutter width, we need a more complex layout
                            const gutterWidth = extractionSettings.gutterWidth || 0;
                            const gutterSizePx = gutterWidth * scaleFactor;
                            
                            if (pdfMode.orientation === 'vertical') {
                              const croppedWidth = canvasDisplaySize.width - (extractionSettings.crop.left + extractionSettings.crop.right) * scaleFactor;
                              
                              // Create a custom grid that spans around the gutter
                              return {
                                position: 'absolute',
                                top: `${extractionSettings.crop.top * scaleFactor}px`,
                                left: `${extractionSettings.crop.left * scaleFactor}px`,
                                width: `${croppedWidth}px`,
                                height: `${Math.max(0, canvasDisplaySize.height - (extractionSettings.crop.top + extractionSettings.crop.bottom) * scaleFactor)}px`,
                                display: 'grid',
                                gridTemplateRows: `repeat(${extractionSettings.grid.rows}, 1fr)`,
                                gridTemplateColumns: `repeat(${extractionSettings.grid.columns / 2}, 1fr) ${gutterSizePx}px repeat(${extractionSettings.grid.columns / 2}, 1fr)`,
                                gap: '1px',
                                pointerEvents: 'auto'
                              };
                            } else {
                              const croppedHeight = canvasDisplaySize.height - (extractionSettings.crop.top + extractionSettings.crop.bottom) * scaleFactor;
                              
                              return {
                                position: 'absolute',
                                top: `${extractionSettings.crop.top * scaleFactor}px`,
                                left: `${extractionSettings.crop.left * scaleFactor}px`,
                                width: `${Math.max(0, canvasDisplaySize.width - (extractionSettings.crop.left + extractionSettings.crop.right) * scaleFactor)}px`,
                                height: `${croppedHeight}px`,
                                display: 'grid',
                                gridTemplateRows: `repeat(${extractionSettings.grid.rows / 2}, 1fr) ${gutterSizePx}px repeat(${extractionSettings.grid.rows / 2}, 1fr)`,
                                gridTemplateColumns: `repeat(${extractionSettings.grid.columns}, 1fr)`,
                                gap: '1px',
                                pointerEvents: 'auto'
                              };
                            }
                          } else {
                            // Standard grid layout
                            return {
                              position: 'absolute',
                              top: `${extractionSettings.crop.top * scaleFactor}px`,
                              left: `${extractionSettings.crop.left * scaleFactor}px`,
                              width: `${Math.max(0, canvasDisplaySize.width - (extractionSettings.crop.left + extractionSettings.crop.right) * scaleFactor)}px`,
                              height: `${Math.max(0, canvasDisplaySize.height - (extractionSettings.crop.top + extractionSettings.crop.bottom) * scaleFactor)}px`,
                              display: 'grid',
                              gridTemplateRows: `repeat(${extractionSettings.grid.rows}, 1fr)`,
                              gridTemplateColumns: `repeat(${extractionSettings.grid.columns}, 1fr)`,
                              gap: '1px',
                              pointerEvents: 'auto'
                            };
                          }
                        })()}
                      >{(() => {
                          if (pdfMode.type === 'gutter-fold' && (extractionSettings.gutterWidth || 0) > 0) {
                            // For gutter-fold with gutter width, we need to map cells correctly
                            const totalCells = extractionSettings.grid.rows * extractionSettings.grid.columns;
                            
                            return Array.from({ length: totalCells + (pdfMode.orientation === 'vertical' ? extractionSettings.grid.rows : extractionSettings.grid.columns) }).map((_, idx) => {
                              // Skip gutter cells (they shouldn't be clickable)
                              if (pdfMode.orientation === 'vertical') {
                                const gridRow = Math.floor(idx / (extractionSettings.grid.columns + 1));
                                const gridCol = idx % (extractionSettings.grid.columns + 1);
                                const gutterCol = extractionSettings.grid.columns / 2;
                                
                                if (gridCol === gutterCol) {
                                  // This is a gutter cell - make it invisible/non-interactive
                                  return <div key={idx} style={{ pointerEvents: 'none' }} />;
                                }
                                
                                // Calculate the actual card index (excluding gutter cells)
                                const actualCol = gridCol > gutterCol ? gridCol - 1 : gridCol;
                                const cardIdx = gridRow * extractionSettings.grid.columns + actualCol;
                                
                                if (cardIdx >= totalCells) return null;
                                
                                return (
                                  <div 
                                    key={idx} 
                                    className={`cursor-pointer transition-all duration-200 ${
                                      cardIdx === currentCard 
                                        ? 'border-2 border-blue-500' 
                                        : 'border border-blue-300 hover:border-blue-400'
                                    }`}
                                    style={{
                                      background: cardIdx === currentCard 
                                        ? 'transparent' 
                                        : 'rgba(0, 0, 0, 0.25)'
                                    }}
                                    onClick={() => setCurrentCard(cardIdx)}
                                  />
                                );
                              } else {
                                // Horizontal gutter logic
                                const totalCols = extractionSettings.grid.columns;
                                const gridRow = Math.floor(idx / totalCols);
                                const gridCol = idx % totalCols;
                                const gutterRow = extractionSettings.grid.rows / 2;
                                
                                if (gridRow === gutterRow) {
                                  return <div key={idx} style={{ pointerEvents: 'none' }} />;
                                }
                                
                                const actualRow = gridRow > gutterRow ? gridRow - 1 : gridRow;
                                const cardIdx = actualRow * totalCols + gridCol;
                                
                                if (cardIdx >= totalCells) return null;
                                
                                return (
                                  <div 
                                    key={idx} 
                                    className={`cursor-pointer transition-all duration-200 ${
                                      cardIdx === currentCard 
                                        ? 'border-2 border-blue-500' 
                                        : 'border border-blue-300 hover:border-blue-400'
                                    }`}
                                    style={{
                                      background: cardIdx === currentCard 
                                        ? 'transparent' 
                                        : 'rgba(0, 0, 0, 0.25)'
                                    }}
                                    onClick={() => setCurrentCard(cardIdx)}
                                  />
                                );
                              }
                            }).filter(Boolean);
                          } else {
                            // Standard grid
                            return Array.from({
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
                                  background: idx === currentCard 
                                    ? 'transparent' 
                                    : 'rgba(0, 0, 0, 0.25)'
                                }}
                                onClick={() => setCurrentCard(idx)}
                              />
                            ));
                          }
                        })()}
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
                  Card {cardId} of {totalCards}
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