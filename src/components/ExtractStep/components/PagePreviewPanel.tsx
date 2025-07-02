import React, { useRef, useEffect, useCallback, useMemo } from 'react';
import { ChevronLeftIcon, ChevronRightIcon, ZoomInIcon, ZoomOutIcon, FileIcon, ImageIcon } from 'lucide-react';
import { isCardSkipped, countCardsByType } from '../../../utils/cardUtils';
import type { PdfData, ExtractionSettings, PdfMode } from '../../../types';

interface RenderedPageData {
  width: number;
  height: number;
  actualPageNumber: number;
  previewScale: number;
  dpiMultiplier: number;
  sourceType: 'pdf' | 'image';
  fileName: string;
}

interface PageDimensions {
  width: number;
  height: number;
}

interface PagePreviewPanelProps {
  activePages: any[];
  currentPage: number;
  currentCard: number;
  zoom: number;
  extractionSettings: ExtractionSettings;
  pdfMode: PdfMode;
  cardType: string;
  cardId: number;
  cardsPerPage: number;
  onPageChange: (page: number) => void;
  onCardChange: (card: number) => void;
  onZoomChange: (zoom: number) => void;
  getPdfData: (fileName: string) => PdfData | null;
  getImageData: (fileName: string) => any;
  onRenderedPageDataChange: (data: RenderedPageData | null) => void;
  onPageDimensionsChange: (dimensions: PageDimensions | null) => void;
}

/**
 * Page preview panel with canvas rendering and overlay controls
 * 
 * Handles PDF/image rendering, zoom controls, page navigation,
 * and interactive grid overlays for card selection.
 */
export const PagePreviewPanel: React.FC<PagePreviewPanelProps> = ({
  activePages,
  currentPage,
  currentCard,
  zoom,
  extractionSettings,
  pdfMode,
  cardType,
  cardId,
  cardsPerPage,
  onPageChange,
  onCardChange,
  onZoomChange,
  getPdfData,
  getImageData,
  onRenderedPageDataChange,
  onPageDimensionsChange
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderTaskRef = useRef<any>(null);
  const renderingRef = useRef(false);
  const renderAttemptCountRef = useRef(0);
  const lastRenderKeyRef = useRef<string>('');
  
  const totalPages = activePages.length;

  // Calculate total cards of the current card type for navigation display
  const totalCardsOfType = useMemo(() => {
    return countCardsByType(
      cardType.toLowerCase() as 'front' | 'back',
      activePages,
      cardsPerPage,
      pdfMode,
      extractionSettings
    );
  }, [cardType, activePages, cardsPerPage, pdfMode, extractionSettings]);

  // --- Helper: Centralize overlay scale factor ---
  const getOverlayScaleFactor = useCallback((renderedPageData: RenderedPageData | null) => {
    if (!canvasRef.current || !renderedPageData) return 1;
    
    // Get canvas dimensions - use offsetWidth/Height if available (accounts for CSS scaling)
    const canvasDisplayWidth = canvasRef.current.offsetWidth || canvasRef.current.width;
    const canvasDisplayHeight = canvasRef.current.offsetHeight || canvasRef.current.height;
    
    if (!canvasDisplayWidth || !canvasDisplayHeight) return 1;
    
    // For both PDF and image sources, we need to convert from extraction DPI coordinates
    // (where crop values are defined) to the actual canvas display coordinates
    let sourceWidthInExtractionDPI: number;
    let sourceHeightInExtractionDPI: number;
    
    if (renderedPageData.sourceType === 'pdf') {
      // PDF source: page dimensions are in PDF points (72 DPI), convert to extraction DPI
      // The rendered canvas shows the page scaled, but crop values are in extraction DPI
      const pdfToExtractionScale = 300 / 72; // Convert from PDF points to extraction DPI
      sourceWidthInExtractionDPI = (renderedPageData.width / renderedPageData.previewScale / renderedPageData.dpiMultiplier) * pdfToExtractionScale;
      sourceHeightInExtractionDPI = (renderedPageData.height / renderedPageData.previewScale / renderedPageData.dpiMultiplier) * pdfToExtractionScale;
    } else {
      // Image source: page dimensions are already in extraction DPI equivalent (300 DPI)
      sourceWidthInExtractionDPI = renderedPageData.width / renderedPageData.previewScale / renderedPageData.dpiMultiplier;
      sourceHeightInExtractionDPI = renderedPageData.height / renderedPageData.previewScale / renderedPageData.dpiMultiplier;
    }
    
    if (!sourceWidthInExtractionDPI || !sourceHeightInExtractionDPI) return 1;
    
    // Calculate scale factor: how many display pixels per extraction DPI pixel
    // This accounts for the full transformation: extraction DPI -> canvas size -> display size
    const scaleX = canvasDisplayWidth / sourceWidthInExtractionDPI;
    const scaleY = canvasDisplayHeight / sourceHeightInExtractionDPI;
    
    // Use consistent scale factor (average of X and Y to handle any minor aspect ratio differences)
    const finalScale = (scaleX + scaleY) / 2;
    
    // Validate the scale factor
    if (!isFinite(finalScale) || finalScale <= 0) {
      console.warn('Invalid overlay scale factor calculated:', finalScale, {
        canvasDisplayWidth,
        canvasDisplayHeight,
        sourceWidthInExtractionDPI,
        sourceHeightInExtractionDPI,
        scaleX,
        scaleY
      });
      return 1;
    }
    
    return finalScale;
  }, []);

  // --- Overlay: Margins ---
  const MarginOverlays = ({ scale, renderedPageData }: { scale: number; renderedPageData: RenderedPageData }) => {
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
  };

  // --- Overlay: Gutter ---
  const GutterOverlay = ({ scale, renderedPageData }: { scale: number; renderedPageData: RenderedPageData }) => {
    if (pdfMode.type !== 'gutter-fold' || !(extractionSettings.gutterWidth && extractionSettings.gutterWidth > 0)) return null;
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
  };

  // --- Overlay: Grid ---
  const GridOverlay = ({ scale, renderedPageData }: { scale: number; renderedPageData: RenderedPageData }) => {
    if (!canvasRef.current || !renderedPageData) return null;
    
    const overlayWidth = canvasRef.current.offsetWidth || canvasRef.current.width;
    const overlayHeight = canvasRef.current.offsetHeight || canvasRef.current.height;
    
    // Calculate grid area
    const gridLeft = extractionSettings.crop.left * scale;
    const gridTop = extractionSettings.crop.top * scale;
    const gridWidth = Math.max(0, overlayWidth - (extractionSettings.crop.left + extractionSettings.crop.right) * scale);
    const gridHeight = Math.max(0, overlayHeight - (extractionSettings.crop.top + extractionSettings.crop.bottom) * scale);
    
    const skippedCards = extractionSettings.skippedCards || [];
    
    // Helper function to check if a grid position is skipped
    const isGridPositionSkipped = (gridRow: number, gridCol: number): boolean => {
      return isCardSkipped(currentPage, gridRow, gridCol, skippedCards, cardType.toLowerCase() as 'front' | 'back');
    };
    
    // Helper function to render a cell with skip overlay
    const renderCell = (cardIdx: number, gridRow: number, gridCol: number, key: string) => {
      const isSkipped = isGridPositionSkipped(gridRow, gridCol);
      const isSelected = cardIdx === currentCard;
      
      return (
        <div key={key}
          className={`cursor-pointer transition-all duration-200 relative ${
            isSelected ? 'border-2 border-blue-500' : 'border border-blue-300 hover:border-blue-400'
          }`}
          style={{ 
            background: isSelected ? 'transparent' : 'rgba(0,0,0,0.25)'
          }}
          onClick={() => onCardChange(cardIdx)}
        >
          {isSkipped && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-full h-full bg-red-500 bg-opacity-30 flex items-center justify-center">
                <span className="text-red-600 text-2xl font-bold">✕</span>
              </div>
            </div>
          )}
        </div>
      );
    };

    // Gutter-fold mode
    if (pdfMode.type === 'gutter-fold' && extractionSettings.gutterWidth && extractionSettings.gutterWidth > 0) {
      const gutterSizePx = extractionSettings.gutterWidth * scale;
      if (pdfMode.orientation === 'vertical') {
        const cols = extractionSettings.grid.columns;
        const rows = extractionSettings.grid.rows;
        const leftCols = cols / 2;
        const rightCols = cols / 2;
        const totalCols = cols + 1; // +1 for gutter
        const cells = [];
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < totalCols; c++) {
            if (c === leftCols) {
              // gutter cell
              cells.push(<div key={`gutter-${r}-${c}`} style={{ pointerEvents: 'none' }} />);
            } else {
              const actualCol = c > leftCols ? c - 1 : c;
              const cardIdx = r * cols + actualCol;
              if (cardIdx >= cols * rows) continue;
              cells.push(renderCell(cardIdx, r, actualCol, `cell-${r}-${c}`));
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
        const cells = [];
        for (let r = 0; r < totalRows; r++) {
          for (let c = 0; c < cols; c++) {
            if (r === topRows) {
              cells.push(<div key={`gutter-${r}-${c}`} style={{ pointerEvents: 'none' }} />);
            } else {
              const actualRow = r > topRows ? r - 1 : r;
              const cardIdx = actualRow * cols + c;
              if (cardIdx >= cols * rows) continue;
              cells.push(renderCell(cardIdx, actualRow, c, `cell-${r}-${c}`));
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
            gridTemplateColumns: `repeat(${cols}, 1fr)`,
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
        {Array.from({ length: totalCells }).map((_, idx) => {
          const gridRow = Math.floor(idx / extractionSettings.grid.columns);
          const gridCol = idx % extractionSettings.grid.columns;
          return renderCell(idx, gridRow, gridCol, `cell-${idx}`);
        })}
      </div>
    );
  };

  // Unified page rendering for both PDF and image sources
  const [renderedPageData, setRenderedPageData] = React.useState<RenderedPageData | null>(null);

  useEffect(() => {
    // Create a unique key for this render to detect unnecessary re-renders
    const renderKey = `${currentPage}-${activePages.length}-${zoom}`;
    
    // Early exit checks first, before any async operations
    if (!canvasRef.current || !activePages.length) {
      return;
    }
    
    if (currentPage < 0 || currentPage >= activePages.length) {
      return;
    }
    
    const currentPageInfo = activePages[currentPage];
    if (!currentPageInfo) {
      return;
    }
    
    // Check if we have the necessary data for the current source type
    if (currentPageInfo.fileType === 'pdf' && !getPdfData(currentPageInfo.fileName)) {
      return;
    }
    if (currentPageInfo.fileType === 'image' && !getImageData(currentPageInfo.fileName)) {
      return;
    }
    
    // Emergency circuit breaker - prevent infinite loops
    if (lastRenderKeyRef.current === renderKey) {
      renderAttemptCountRef.current += 1;
      if (renderAttemptCountRef.current > 5) {
        console.error('ExtractStep: Emergency circuit breaker activated - too many render attempts for', renderKey);
        return;
      }
    } else {
      lastRenderKeyRef.current = renderKey;
      renderAttemptCountRef.current = 1;
    }
    
    // Prevent multiple concurrent renders using ref - check this BEFORE starting render
    if (renderingRef.current) {
      return;
    }
    
    console.log(`ExtractStep: Starting render for page ${currentPage} ${currentPageInfo.fileType} ${currentPageInfo.fileName} (attempt ${renderAttemptCountRef.current})`);
    
    const renderPage = async () => {
      renderingRef.current = true;
      
      // Cancel any existing render task
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
        renderTaskRef.current = null;
      }
      
      try {
        const canvas = canvasRef.current;
        if (!canvas) {
          renderingRef.current = false;
          return;
        }
        
        const context = canvas.getContext('2d');
        if (!context) {
          renderingRef.current = false;
          return;
        }

        if (currentPageInfo.fileType === 'pdf') {
          // PDF rendering logic - get the correct PDF data for this specific file
          const filePdfData = getPdfData(currentPageInfo.fileName);
          if (!filePdfData) {
            console.error(`No PDF data available for file: ${currentPageInfo.fileName}`);
            renderingRef.current = false;
            return;
          }
          
          // Always use originalPageIndex from unified page data
          const actualPageNumber = currentPageInfo.originalPageIndex + 1;
          const page = await filePdfData.getPage(actualPageNumber);
        
          // Calculate base scale to fit the preview area nicely
          const baseViewport = page.getViewport({ scale: 1.0 });
        
          // Store page dimensions for card info calculations
          onPageDimensionsChange({ width: baseViewport.width, height: baseViewport.height });
        
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
          const newRenderedPageData = {
            width: canvasWidth,
            height: canvasHeight,
            actualPageNumber,
            previewScale: baseScale, // Store the base preview scale for crop calculations
            dpiMultiplier, // Store the DPI multiplier for overlay calculations
            sourceType: 'pdf' as const,
            fileName: currentPageInfo.fileName
          };
          setRenderedPageData(newRenderedPageData);
          onRenderedPageDataChange(newRenderedPageData);
          
        } else if (currentPageInfo.fileType === 'image') {
          // Image rendering logic
          const imageData = getImageData(currentPageInfo.fileName);
          if (!imageData) return;
          
          const sourceCanvas = imageData.canvas;
          
          // Store original image dimensions for card info calculations
          onPageDimensionsChange({ width: sourceCanvas.width, height: sourceCanvas.height });
          
          // Calculate scale to fit the preview area
          const maxWidth = 450;
          const maxHeight = 600;
          
          const scaleX = maxWidth / sourceCanvas.width;
          const scaleY = maxHeight / sourceCanvas.height;
          const baseScale = Math.min(scaleX, scaleY, 2.0);
          
          // Apply zoom-aware scaling
          const dpiMultiplier = zoom >= 3.0 ? Math.min(zoom, 5.0) : 1.0;
          const renderScale = baseScale * dpiMultiplier;
          
          // Set canvas dimensions
          const canvasWidth = Math.max(200, sourceCanvas.width * renderScale);
          const canvasHeight = Math.max(250, sourceCanvas.height * renderScale);
          
          canvas.width = canvasWidth;
          canvas.height = canvasHeight;
          
          // Apply CSS scaling for high DPI
          if (dpiMultiplier > 1.0) {
            const cssScale = 1.0 / dpiMultiplier;
            canvas.style.width = `${canvasWidth * cssScale}px`;
            canvas.style.height = `${canvasHeight * cssScale}px`;
          } else {
            canvas.style.width = '';
            canvas.style.height = '';
          }
          
          // Clear canvas
          context.clearRect(0, 0, canvas.width, canvas.height);
          
          // Draw the image scaled to fit
          context.drawImage(
            sourceCanvas,
            0, 0, sourceCanvas.width, sourceCanvas.height,
            0, 0, canvasWidth, canvasHeight
          );
          
          // Store page data for card extraction preview
          const newRenderedPageData = {
            width: canvasWidth,
            height: canvasHeight,
            actualPageNumber: currentPageInfo.originalPageIndex + 1, // Use original page index
            previewScale: baseScale,
            dpiMultiplier,
            sourceType: 'image' as const,
            fileName: currentPageInfo.fileName
          };
          setRenderedPageData(newRenderedPageData);
          onRenderedPageDataChange(newRenderedPageData);
        }
        
      } catch (error: any) {
        if (error?.name !== 'RenderingCancelledException') {
          console.error('Error rendering page:', error);
        }
      } finally {
        renderingRef.current = false;
        renderTaskRef.current = null;
      }
    };

    // Call renderPage immediately - no setTimeout to avoid timing issues
    renderPage();
    
    // Cleanup function
    return () => {
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
        renderTaskRef.current = null;
      }
      renderingRef.current = false;
    };
  }, [getPdfData, currentPage, activePages, getImageData, zoom, onPageDimensionsChange, onRenderedPageDataChange]);

  const handlePreviousPage = () => {
    onPageChange(Math.max(0, currentPage - 1));
    onCardChange(0);
  };

  const handleNextPage = () => {
    onPageChange(Math.min(totalPages - 1, currentPage + 1));
    onCardChange(0);
  };

  const handlePreviousCard = () => {
    onCardChange(Math.max(0, currentCard - 1));
  };

  const handleNextCard = () => {
    onCardChange(Math.min(cardsPerPage - 1, currentCard + 1));
  };

  const handleZoomIn = () => {
    onZoomChange(Math.min(5.0, zoom + 0.25));
  };

  const handleZoomOut = () => {
    onZoomChange(Math.max(1.0, zoom - 0.25));
  };

  const handleZoomReset = () => {
    onZoomChange(1.0);
  };

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      {/* Header with navigation and zoom controls */}
      <div className="bg-gray-50 p-3 border-b border-gray-200 flex justify-between items-center">
        <div className="flex items-center space-x-2 flex-1 min-w-0">
          <button onClick={handlePreviousPage} disabled={currentPage === 0} className="p-1 rounded-full hover:bg-gray-200 disabled:opacity-50 flex-shrink-0">
            <ChevronLeftIcon size={16} />
          </button>
          <span className="text-sm text-gray-700 flex-shrink-0">
            Page {currentPage + 1} of {totalPages}
          </span>
          <button onClick={handleNextPage} disabled={currentPage === totalPages - 1} className="p-1 rounded-full hover:bg-gray-200 disabled:opacity-50 flex-shrink-0">
            <ChevronRightIcon size={16} />
          </button>
          {activePages[currentPage] && (
            <div className="flex items-center space-x-1 ml-2 min-w-0 flex-1">
              {activePages[currentPage].fileType === 'pdf' ? (
                <FileIcon size={14} className="text-red-600 flex-shrink-0" />
              ) : (
                <ImageIcon size={14} className="text-green-600 flex-shrink-0" />
              )}
              <span className="text-xs text-gray-500 truncate min-w-0" title={activePages[currentPage].fileName}>
                {activePages[currentPage].fileName}
              </span>
            </div>
          )}
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
            {activePages[currentPage]?.type === 'front' ? 'Front' : 'Back'} page
          </div>
        </div>
      </div>

      {/* Canvas preview area */}
      <div className="bg-gray-100 min-h-[500px] flex items-center justify-center p-4 overflow-auto">
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
                display: activePages.length > 0 ? 'block' : 'none'
              }}
            />
            {activePages.length === 0 && (
              <div className="text-gray-400 text-center p-8">
                <p>No files loaded or no active pages</p>
              </div>
            )}

            {/* Grid overlay showing the card extraction */}
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
                    const scale = getOverlayScaleFactor(renderedPageData);
                    // Only render overlays if we have a valid scale
                    if (scale <= 0 || !isFinite(scale)) return null;
                    return (
                      <>
                        <MarginOverlays scale={scale} renderedPageData={renderedPageData} />
                        <GutterOverlay scale={scale} renderedPageData={renderedPageData} />
                        <GridOverlay scale={scale} renderedPageData={renderedPageData} />
                      </>
                    );
                  })()}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer with card navigation */}
      <div className="bg-gray-50 p-3 border-t border-gray-200 flex justify-between items-center">
        <div className="flex items-center space-x-2">
          <button onClick={handlePreviousCard} disabled={currentCard === 0} className="p-1 rounded-full hover:bg-gray-200 disabled:opacity-50">
            <ChevronLeftIcon size={16} />
          </button>
          <span className="text-sm text-gray-700">
            {cardType} {cardId} of {totalCardsOfType}
          </span>
          <button onClick={handleNextCard} disabled={currentCard === cardsPerPage - 1} className="p-1 rounded-full hover:bg-gray-200 disabled:opacity-50">
            <ChevronRightIcon size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};