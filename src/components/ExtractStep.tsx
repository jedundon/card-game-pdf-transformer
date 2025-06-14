import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { ChevronLeftIcon, ChevronRightIcon, LayoutGridIcon, MoveIcon, ZoomInIcon, ZoomOutIcon } from 'lucide-react';
import { 
  getActivePages, 
  calculateTotalCards, 
  getCardInfo, 
  extractCardImage as extractCardImageUtil,
  getActualPageNumber,
  getDpiScaleFactor,
  countCardsByType,
  getAvailableCardIds
} from '../utils/cardUtils';
import { DPI_CONSTANTS } from '../constants';

interface ExtractStepProps {
  pdfData: any;
  pdfMode: any;
  pageSettings: any;
  extractionSettings: any;
  onSettingsChange: (settings: any) => void;
  onCardDimensionsChange: (dimensions: {
    widthPx: number;
    heightPx: number;
    widthInches: number;
    heightInches: number;
  } | null) => void;
  onPrevious: () => void;
  onNext: () => void;
}
export const ExtractStep: React.FC<ExtractStepProps> = ({
  pdfData,
  pdfMode,
  pageSettings,
  extractionSettings,
  onSettingsChange,
  onCardDimensionsChange,
  onPrevious,
  onNext
}) => {const [currentPage, setCurrentPage] = useState(0);
  const [currentCard, setCurrentCard] = useState(0);
  const [zoom, setZoom] = useState(1.0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [renderedPageData, setRenderedPageData] = useState<any>(null);
  const [cardPreviewUrl, setCardPreviewUrl] = useState<string | null>(null);
  const [isRendering, setIsRendering] = useState(false);
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
  const { type: cardType, id: cardId } = getCardInfo(globalCardIndex, activePages, extractionSettings, pdfMode, cardsPerPage);
  // Calculate total cards of the current card type for context-aware navigation
  const totalCardsOfType = useMemo(() => {
    if (pdfMode.type === 'gutter-fold') {
      // For gutter-fold mode, count only cards of the current type
      return countCardsByType(cardType.toLowerCase() as 'front' | 'back', activePages, cardsPerPage, pdfMode, extractionSettings);
    } else {
      // For other modes, use the existing total calculation
      return totalCards;
    }
  }, [cardType, pdfMode, activePages, cardsPerPage, extractionSettings, totalCards]);

  // Calculate the position of the current card within cards of the same type
  const currentCardPosition = useMemo(() => {
    if (pdfMode.type === 'gutter-fold') {
      const availableCardIds = getAvailableCardIds(cardType.toLowerCase() as 'front' | 'back', totalCards, pdfMode, activePages, cardsPerPage, extractionSettings);
      return availableCardIds.indexOf(cardId) + 1; // 1-based position
    } else {
      return cardId; // For other modes, use the card ID directly
    }
  }, [cardType, cardId, pdfMode, totalCards, activePages, cardsPerPage, extractionSettings]);

  // Calculate card dimensions for display
  const cardDimensions = useMemo(() => {
    if (!pdfData || !activePages.length || !renderedPageData) {
      return null;
    }

    try {
      // Get the extraction scale (300 DPI)
      const extractionScale = DPI_CONSTANTS.EXTRACTION_DPI / DPI_CONSTANTS.SCREEN_DPI;
      
      // Calculate cropped dimensions at extraction DPI
      const croppedWidth = (renderedPageData.width / renderedPageData.previewScale) * extractionScale - extractionSettings.crop.left - extractionSettings.crop.right;
      const croppedHeight = (renderedPageData.height / renderedPageData.previewScale) * extractionScale - extractionSettings.crop.top - extractionSettings.crop.bottom;
      
      if (croppedWidth <= 0 || croppedHeight <= 0) {
        return null;
      }

      let cardWidthPx, cardHeightPx;

      // Handle gutter-fold mode with gutter width
      if (pdfMode.type === 'gutter-fold' && (extractionSettings.gutterWidth || 0) > 0) {
        const gutterWidth = extractionSettings.gutterWidth || 0;
        
        if (pdfMode.orientation === 'vertical') {
          const availableWidthForCards = croppedWidth - gutterWidth;
          cardWidthPx = availableWidthForCards / extractionSettings.grid.columns;
          cardHeightPx = croppedHeight / extractionSettings.grid.rows;
        } else {
          const availableHeightForCards = croppedHeight - gutterWidth;
          cardWidthPx = croppedWidth / extractionSettings.grid.columns;
          cardHeightPx = availableHeightForCards / extractionSettings.grid.rows;
        }
      } else {
        // Standard mode
        cardWidthPx = croppedWidth / extractionSettings.grid.columns;
        cardHeightPx = croppedHeight / extractionSettings.grid.rows;
      }

      // Convert to inches (300 DPI means 300 pixels per inch)
      const cardWidthInches = cardWidthPx / DPI_CONSTANTS.EXTRACTION_DPI;
      const cardHeightInches = cardHeightPx / DPI_CONSTANTS.EXTRACTION_DPI;

      return {
        widthPx: Math.round(cardWidthPx),
        heightPx: Math.round(cardHeightPx),
        widthInches: cardWidthInches,
        heightInches: cardHeightInches
      };
    } catch (error) {
      console.error('Error calculating card dimensions:', error);
      return null;
    }  }, [pdfData, activePages, renderedPageData, extractionSettings, pdfMode]);

  // Notify parent component when card dimensions change
  useEffect(() => {
    onCardDimensionsChange(cardDimensions);
  }, [cardDimensions, onCardDimensionsChange]);

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
        
        // Calculate base scale to fit the preview area nicely
        const baseViewport = page.getViewport({ scale: 1.0 });
        const maxWidth = 450; // Fixed max width for consistency
        const maxHeight = 600; // Fixed max height for consistency
        
        const scaleX = maxWidth / baseViewport.width;
        const scaleY = maxHeight / baseViewport.height;
        const baseScale = Math.min(scaleX, scaleY, 2.0); // Allow up to 2x scaling
          // Apply zoom-aware DPI scaling for crisp rendering at high zoom levels
        // When zoom >= 3.0 (300%), render at higher DPI to maintain sharpness
        const dpiMultiplier = zoom >= 3.0 ? Math.min(zoom, 5.0) : 1.0;
        const renderScale = baseScale * dpiMultiplier;
        
        const viewport = page.getViewport({ scale: renderScale });
          // Set canvas internal size to the high-DPI rendered size
        const canvasWidth = Math.max(200, viewport.width);
        const canvasHeight = Math.max(250, viewport.height);
        
        canvas.width = canvasWidth;
        canvas.height = canvasHeight;
        
        // Apply CSS scaling to counteract DPI scaling so canvas appears at normal size
        // The zoom wrapper will then handle the user's intended zoom level
        if (dpiMultiplier > 1.0) {
          const cssScale = 1.0 / dpiMultiplier;
          canvas.style.width = `${canvasWidth * cssScale}px`;
          canvas.style.height = `${canvasHeight * cssScale}px`;
        } else {
          canvas.style.width = '';
          canvas.style.height = '';
        }
        
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
          previewScale: baseScale, // Store the base preview scale for crop calculations
          dpiMultiplier // Store the DPI multiplier for overlay calculations
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
  }, [pdfData, currentPage, activePages, pageSettings, zoom]); // Add zoom dependency
  // Update card preview when current card or extraction settings change
  useEffect(() => {
    let cancelled = false;
    
    if (renderedPageData && !isRendering && canvasRef.current) {
      // Delay the card extraction to ensure canvas is fully rendered
      const timer = setTimeout(async () => {
        if (!cancelled) {
          const cardUrl = await extractCardImage(globalCardIndex);
          if (!cancelled) {
            setCardPreviewUrl(cardUrl);
          }
        }
      }, 100); // Reduced delay for better responsiveness
      
      return () => {
        cancelled = true;
        clearTimeout(timer);
      };
    } else {
      // Clear the preview if prerequisites aren't met
      setCardPreviewUrl(null);
    }  }, [currentCard, currentPage, renderedPageData, isRendering, extractionSettings.crop, extractionSettings.grid, extractionSettings.gutterWidth, extractCardImage, globalCardIndex]);

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
  };  const handleNextCard = () => {
    setCurrentCard(prev => Math.min(cardsPerPage - 1, prev + 1));
  };

  // Zoom controls
  const handleZoomIn = () => {
    setZoom(prev => Math.min(5.0, prev + 0.25));
  };

  const handleZoomOut = () => {
    setZoom(prev => Math.max(1.0, prev - 0.25));
  };

  const handleZoomReset = () => {
    setZoom(1.0);
  };  // --- Helper: Centralize overlay scale factor ---
  const getOverlayScaleFactor = useCallback(() => {
    if (!canvasRef.current || !renderedPageData) return 1;
    
    // Since we're inside the zoom wrapper, we don't need to multiply by zoom
    // The CSS transform handles the zoom scaling automatically
    // We just need the scale to convert from 300 DPI pixels to canvas pixels
    const extractionToPreviewScale = renderedPageData.previewScale / getDpiScaleFactor();
    
    // When DPI scaling is active (dpiMultiplier > 1), we apply CSS counter-scaling
    // to the canvas, so the overlays should use the CSS-scaled dimensions
    // and NOT apply additional DPI scaling to avoid double-scaling
    const dpiMultiplier = renderedPageData.dpiMultiplier || 1.0;
    if (dpiMultiplier > 1.0) {
      // CSS scaling is applied, so overlays use offsetWidth/Height which are already scaled down
      // Don't apply additional DPI scaling
      return extractionToPreviewScale;
    } else {
      // No CSS scaling applied, overlays use canvas width/height directly
      return extractionToPreviewScale;
    }
  }, [renderedPageData]);// --- Overlay: Margins ---
  const MarginOverlays = ({ scale }: { scale: number }) => {
    if (!canvasRef.current || !renderedPageData) return null;
    const overlayWidth = canvasRef.current.offsetWidth || canvasRef.current.width;
    const overlayHeight = canvasRef.current.offsetHeight || canvasRef.current.height;
    
    return (
      <>
        {/* Top */}
        <div className="absolute" style={{
          top: 0, left: 0, width: `${overlayWidth}px`,
          height: `${extractionSettings.crop.top * scale}px`,
          background: 'rgba(0,0,0,0.6)', pointerEvents: 'none'
        }}/>
        {/* Bottom */}
        <div className="absolute" style={{
          bottom: 0, left: 0, width: `${overlayWidth}px`,
          height: `${extractionSettings.crop.bottom * scale}px`,
          background: 'rgba(0,0,0,0.6)', pointerEvents: 'none'
        }}/>
        {/* Left */}
        <div className="absolute" style={{
          top: `${extractionSettings.crop.top * scale}px`, left: 0,
          width: `${extractionSettings.crop.left * scale}px`,
          height: `${Math.max(0, overlayHeight - (extractionSettings.crop.top + extractionSettings.crop.bottom) * scale)}px`,
          background: 'rgba(0,0,0,0.6)', pointerEvents: 'none'
        }}/>
        {/* Right */}
        <div className="absolute" style={{
          top: `${extractionSettings.crop.top * scale}px`, right: 0,
          width: `${extractionSettings.crop.right * scale}px`,
          height: `${Math.max(0, overlayHeight - (extractionSettings.crop.top + extractionSettings.crop.bottom) * scale)}px`,
          background: 'rgba(0,0,0,0.6)', pointerEvents: 'none'
        }}/>
      </>
    );
  };  // --- Overlay: Gutter ---
  const GutterOverlay = ({ scale }: { scale: number }) => {
    if (pdfMode.type !== 'gutter-fold' || !(extractionSettings.gutterWidth > 0)) return null;
    if (!canvasRef.current || !renderedPageData) return null;
    
    const overlayWidth = canvasRef.current.offsetWidth || canvasRef.current.width;
    const overlayHeight = canvasRef.current.offsetHeight || canvasRef.current.height;
    const gutterSizePx = extractionSettings.gutterWidth * scale;
    
    if (pdfMode.orientation === 'vertical') {
      const croppedWidth = overlayWidth - (extractionSettings.crop.left + extractionSettings.crop.right) * scale;
      const availableWidthForCards = croppedWidth - gutterSizePx;
      const leftSectionWidth = availableWidthForCards / 2;
      return (
        <div className="absolute" style={{
          top: `${extractionSettings.crop.top * scale}px`,
          left: `${extractionSettings.crop.left * scale + leftSectionWidth}px`,
          width: `${gutterSizePx}px`,
          height: `${Math.max(0, overlayHeight - (extractionSettings.crop.top + extractionSettings.crop.bottom) * scale)}px`,
          background: 'rgba(255,0,0,0.3)', pointerEvents: 'none'
        }}/>
      );
    } else {
      const croppedHeight = overlayHeight - (extractionSettings.crop.top + extractionSettings.crop.bottom) * scale;
      const availableHeightForCards = croppedHeight - gutterSizePx;
      const topSectionHeight = availableHeightForCards / 2;
      return (
        <div className="absolute" style={{
          top: `${extractionSettings.crop.top * scale + topSectionHeight}px`,
          left: `${extractionSettings.crop.left * scale}px`,
          width: `${Math.max(0, overlayWidth - (extractionSettings.crop.left + extractionSettings.crop.right) * scale)}px`,
          height: `${gutterSizePx}px`,
          background: 'rgba(255,0,0,0.3)', pointerEvents: 'none'
        }}/>
      );
    }
  };  // --- Overlay: Grid ---
  const GridOverlay = ({ scale }: { scale: number }) => {
    if (!canvasRef.current || !renderedPageData) return null;
    
    const overlayWidth = canvasRef.current.offsetWidth || canvasRef.current.width;
    const overlayHeight = canvasRef.current.offsetHeight || canvasRef.current.height;
    
    // Calculate grid area
    const gridLeft = extractionSettings.crop.left * scale;
    const gridTop = extractionSettings.crop.top * scale;
    const gridWidth = Math.max(0, overlayWidth - (extractionSettings.crop.left + extractionSettings.crop.right) * scale);
    const gridHeight = Math.max(0, overlayHeight - (extractionSettings.crop.top + extractionSettings.crop.bottom) * scale);

    // Gutter-fold mode
    if (pdfMode.type === 'gutter-fold' && extractionSettings.gutterWidth > 0) {
      const gutterSizePx = extractionSettings.gutterWidth * scale;
      if (pdfMode.orientation === 'vertical') {
        const cols = extractionSettings.grid.columns;
        const rows = extractionSettings.grid.rows;
        const leftCols = cols / 2;
        const rightCols = cols / 2;
        const totalCols = cols + 1; // +1 for gutter
        let cells = [];
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < totalCols; c++) {
            if (c === leftCols) {
              // gutter cell
              cells.push(<div key={`gutter-${r}-${c}`} style={{ pointerEvents: 'none' }} />);
            } else {
              const actualCol = c > leftCols ? c - 1 : c;
              const cardIdx = r * cols + actualCol;
              if (cardIdx >= cols * rows) continue;
              cells.push(
                <div key={`cell-${r}-${c}`}
                  className={`cursor-pointer transition-all duration-200 ${cardIdx === currentCard ? 'border-2 border-blue-500' : 'border border-blue-300 hover:border-blue-400'}`}
                  style={{ background: cardIdx === currentCard ? 'transparent' : 'rgba(0,0,0,0.25)' }}
                  onClick={() => setCurrentCard(cardIdx)}
                />
              );
            }
          }
        }
        return (
          <div style={{
            position: 'absolute',
            top: `${gridTop}px`, left: `${gridLeft}px`,
            width: `${gridWidth}px`, height: `${gridHeight}px`,
            display: 'grid',
            gridTemplateRows: `repeat(${rows}, 1fr)`,
            gridTemplateColumns: `repeat(${leftCols}, 1fr) ${gutterSizePx}px repeat(${rightCols}, 1fr)`,
            gap: '1px', pointerEvents: 'auto'
          }}>{cells}</div>
        );
      } else {
        // horizontal gutter
        const cols = extractionSettings.grid.columns;
        const rows = extractionSettings.grid.rows;
        const topRows = rows / 2;
        const bottomRows = rows / 2;
        const totalRows = rows + 1;
        let cells = [];
        for (let r = 0; r < totalRows; r++) {
          for (let c = 0; c < cols; c++) {
            if (r === topRows) {
              cells.push(<div key={`gutter-${r}-${c}`} style={{ pointerEvents: 'none' }} />);
            } else {
              const actualRow = r > topRows ? r - 1 : r;
              const cardIdx = actualRow * cols + c;
              if (cardIdx >= cols * rows) continue;
              cells.push(
                <div key={`cell-${r}-${c}`}
                  className={`cursor-pointer transition-all duration-200 ${cardIdx === currentCard ? 'border-2 border-blue-500' : 'border border-blue-300 hover:border-blue-400'}`}
                  style={{ background: cardIdx === currentCard ? 'transparent' : 'rgba(0,0,0,0.25)' }}
                  onClick={() => setCurrentCard(cardIdx)}
                />
              );
            }
          }
        }
        return (
          <div style={{
            position: 'absolute',
            top: `${gridTop}px`, left: `${gridLeft}px`,
            width: `${gridWidth}px`, height: `${gridHeight}px`,
            display: 'grid',
            gridTemplateRows: `repeat(${topRows}, 1fr) ${gutterSizePx}px repeat(${bottomRows}, 1fr)`,
            gridTemplateColumns: `repeat(${cols}, 1fr)` ,
            gap: '1px', pointerEvents: 'auto'
          }}>{cells}</div>
        );
      }
    }
    // Standard grid
    const totalCells = extractionSettings.grid.rows * extractionSettings.grid.columns;
    return (
      <div style={{
        position: 'absolute',
        top: `${gridTop}px`, left: `${gridLeft}px`,
        width: `${gridWidth}px`, height: `${gridHeight}px`,
        display: 'grid',
        gridTemplateRows: `repeat(${extractionSettings.grid.rows}, 1fr)`,
        gridTemplateColumns: `repeat(${extractionSettings.grid.columns}, 1fr)`,
        gap: '1px', pointerEvents: 'auto'
      }}>
        {Array.from({ length: totalCells }).map((_, idx) => (
          <div key={idx}
            className={`cursor-pointer transition-all duration-200 ${idx === currentCard ? 'border-2 border-blue-500' : 'border border-blue-300 hover:border-blue-400'}`}
            style={{ background: idx === currentCard ? 'transparent' : 'rgba(0,0,0,0.25)' }}
            onClick={() => setCurrentCard(idx)}
          />
        ))}
      </div>
    );
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
            </p>            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Top Margin
                </label>
                <input type="number" value={extractionSettings.crop.top} onChange={e => handleCropChange('top', parseInt(e.target.value))} className="w-full border border-gray-300 rounded-md px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Right Margin
                </label>
                <input type="number" value={extractionSettings.crop.right} onChange={e => handleCropChange('right', parseInt(e.target.value))} className="w-full border border-gray-300 rounded-md px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Bottom Margin
                </label>
                <input type="number" value={extractionSettings.crop.bottom} onChange={e => handleCropChange('bottom', parseInt(e.target.value))} className="w-full border border-gray-300 rounded-md px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Left Margin
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
          </div>          {/* Card dimensions display */}
          {cardDimensions && (
            <div className="p-3 bg-gray-50 rounded-md">
              <div className="flex items-center">
                <span className="text-sm font-medium text-gray-800 mr-3">
                  Card Dimensions:
                </span>
                <span className="text-sm text-gray-600">
                  {cardDimensions.widthPx} × {cardDimensions.heightPx} px ({cardDimensions.widthInches.toFixed(2)}" × {cardDimensions.heightInches.toFixed(2)}")
                </span>
              </div>
            </div>
          )}

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
          <div className="border border-gray-200 rounded-lg overflow-hidden">            <div className="bg-gray-50 p-3 border-b border-gray-200 flex justify-between items-center">
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
              <div className="flex items-center space-x-3">
                <div className="flex items-center space-x-1">
                  <button onClick={handleZoomOut} disabled={zoom <= 1.0} className="p-1 rounded-full hover:bg-gray-200 disabled:opacity-50">
                    <ZoomOutIcon size={14} />
                  </button>
                  <span className="text-xs text-gray-600 min-w-[40px] text-center">
                    {Math.round(zoom * 100)}%
                  </span>
                  <button onClick={handleZoomIn} disabled={zoom >= 5.0} className="p-1 rounded-full hover:bg-gray-200 disabled:opacity-50">
                    <ZoomInIcon size={14} />
                  </button>
                  <button onClick={handleZoomReset} className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded">
                    Reset
                  </button>
                </div>
                <div className="text-sm text-gray-500">
                  {activePages[currentPage]?.type === 'front' ? 'Front' : 'Back'}{' '}
                  page
                </div>
              </div>
            </div>            <div className="bg-gray-100 min-h-[500px] flex items-center justify-center p-4 overflow-auto">
              <div className="relative bg-white shadow-lg rounded-lg p-4 min-w-[300px] min-h-[400px] flex items-center justify-center overflow-auto">
                {/* Zoom wrapper */}
                <div 
                  className="zoom-wrapper"
                  style={{ 
                    transform: `scale(${zoom})`,
                    transformOrigin: 'top left',
                    display: 'inline-block'
                  }}
                >
                  <canvas 
                    ref={canvasRef}
                    className="block"
                    style={{ 
                      display: pdfData && activePages.length > 0 ? 'block' : 'none'
                    }}
                  />
                  {(!pdfData || activePages.length === 0) && (
                    <div className="text-gray-400 text-center p-8">
                      <p>No PDF loaded or no active pages</p>
                    </div>
                  )}                  {/* Grid overlay showing the card extraction */}
                  {renderedPageData && canvasRef.current && renderedPageData.previewScale && (
                    <div 
                      className="absolute pointer-events-none"
                      style={{
                        top: '0',
                        left: '0',
                        width: `${canvasRef.current.offsetWidth || canvasRef.current.width}px`,
                        height: `${canvasRef.current.offsetHeight || canvasRef.current.height}px`
                      }}
                    >
                      <div
                        className="pointer-events-auto"
                        style={{
                          position: 'relative',
                          width: `${canvasRef.current.offsetWidth || canvasRef.current.width}px`,
                          height: `${canvasRef.current.offsetHeight || canvasRef.current.height}px`
                        }}
                      >
                        {/* --- Simplified overlays --- */}
                        {(() => {
                          const scale = getOverlayScaleFactor();
                          // Only render overlays if we have a valid scale
                          if (scale <= 0 || !isFinite(scale)) return null;
                          return (
                            <>
                              <MarginOverlays scale={scale} />
                              <GutterOverlay scale={scale} />
                              <GridOverlay scale={scale} />
                            </>
                          );
                        })()}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="bg-gray-50 p-3 border-t border-gray-200 flex justify-between items-center">              <div className="flex items-center space-x-2">
                <button onClick={handlePreviousCard} disabled={currentCard === 0} className="p-1 rounded-full hover:bg-gray-200 disabled:opacity-50">
                  <ChevronLeftIcon size={16} />
                </button>                <span className="text-sm text-gray-700">
                  {cardType} {currentCardPosition} of {totalCardsOfType}
                </span>
                <button onClick={handleNextCard} disabled={currentCard === cardsPerPage - 1} className="p-1 rounded-full hover:bg-gray-200 disabled:opacity-50">
                  <ChevronRightIcon size={16} />
                </button>
              </div>
            </div>
          </div>          <div className="p-4 border border-gray-200 rounded-lg">            <div className="flex justify-between items-center mb-2">
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
            
            <div className="bg-gray-100 border border-gray-300 rounded p-4 min-h-[200px] flex items-center justify-center">{cardPreviewUrl ? (
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