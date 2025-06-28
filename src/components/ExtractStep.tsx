import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { ChevronLeftIcon, ChevronRightIcon, MoveIcon, ZoomInIcon, ZoomOutIcon, FileIcon, ImageIcon } from 'lucide-react';
import { AddFilesButton } from './AddFilesButton';
import { FileManagerPanel } from './FileManagerPanel';
import { 
  getActivePagesWithSource,
  calculateTotalCards, 
  getCardInfo, 
  extractCardImageFromCanvas,
  getAvailableCardIds,
  isCardSkipped,
  toggleCardSkip,
  skipAllInRow,
  skipAllInColumn,
  clearAllSkips
} from '../utils/cardUtils';
import { extractCardImageFromPdfPage } from '../utils/pdfCardExtraction';
import { TIMEOUT_CONSTANTS } from '../constants';
import type { ExtractStepProps, MultiFileImportHook } from '../types';
import { useCardDimensions } from './ExtractStep/hooks/useCardDimensions';
import { GridSettings } from './ExtractStep/components/GridSettings';
import { GutterSettings } from './ExtractStep/components/GutterSettings';

export const ExtractStep: React.FC<ExtractStepProps> = ({
  pdfData,
  pdfMode,
  pageSettings,
  extractionSettings,
  multiFileImport,
  onSettingsChange,
  onCardDimensionsChange,
  onPrevious,
  onNext
}) => {
  
  const [currentPage, setCurrentPage] = useState(0);
  const [currentCard, setCurrentCard] = useState(0);
  const [zoom, setZoom] = useState(1.0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cardPreviewContainerRef = useRef<HTMLDivElement>(null);
  const [renderedPageData, setRenderedPageData] = useState<any>(null);
  const [cardPreviewUrl, setCardPreviewUrl] = useState<string | null>(null);
  const renderTaskRef = useRef<any>(null);
  const renderingRef = useRef(false);
  const renderAttemptCountRef = useRef(0);
  const lastRenderKeyRef = useRef<string>('');
  const [hoverPosition, setHoverPosition] = useState<{ x: number; y: number } | null>(null);
  const [pageDimensions, setPageDimensions] = useState<{ width: number; height: number } | null>(null);
  
  // Unified page data handling for both single PDF and multi-file sources
  const unifiedPages = useMemo(() => {
    if (multiFileImport.multiFileState.pages.length > 0) {
      // Multi-file mode: use pages from multi-file import with source information
      return multiFileImport.multiFileState.pages;
    } else if (pageSettings.length > 0) {
      // Single PDF mode: convert pageSettings to unified format
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
  
  // Memoize activePages to prevent unnecessary re-renders - use unified pages with source info
  const activePages = useMemo(() => 
    getActivePagesWithSource(unifiedPages), 
    [unifiedPages]
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
  const { type: cardType, id: cardId } = getCardInfo(
    globalCardIndex, 
    activePages, 
    extractionSettings, 
    pdfMode, 
    cardsPerPage,
    pageDimensions?.width,
    pageDimensions?.height
  );
  // Calculate total cards of the current card type for context-aware navigation (excluding skipped cards)
  const totalCardsOfType = useMemo(() => {
    const availableCardIds = getAvailableCardIds(cardType.toLowerCase() as 'front' | 'back', totalCards, pdfMode, activePages, cardsPerPage, extractionSettings);
    return availableCardIds.length;
  }, [cardType, totalCards, pdfMode, activePages, cardsPerPage, extractionSettings]);

  // Calculate the position of the current card within cards of the same type (excluding skipped cards)
  const currentCardPosition = useMemo(() => {
    const availableCardIds = getAvailableCardIds(cardType.toLowerCase() as 'front' | 'back', totalCards, pdfMode, activePages, cardsPerPage, extractionSettings);
    return availableCardIds.indexOf(cardId) + 1; // 1-based position, -1 if not found (skipped)
  }, [cardType, cardId, totalCards, pdfMode, activePages, cardsPerPage, extractionSettings]);

  // Calculate card dimensions for display with rotation effects
  const cardDimensions = useCardDimensions({
    pdfData,
    activePages,
    renderedPageData,
    extractionSettings,
    pdfMode,
    globalCardIndex,
    cardsPerPage,
    pageDimensions
  });

  // Notify parent component when card dimensions change (memoized to prevent loops)
  const handleCardDimensionsChange = useCallback(() => {
    onCardDimensionsChange(cardDimensions);
  }, [cardDimensions, onCardDimensionsChange]);
  
  useEffect(() => {
    handleCardDimensionsChange();
  }, [handleCardDimensionsChange]);

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
  }, [multiFileImport?.multiFileState?.pages]);
  
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
  }, [multiFileImport?.multiFileState?.pages]);
  
  // Get PDF data from stable map
  const getPdfData = useCallback((fileName: string) => {
    return pdfDataMap.get(fileName);
  }, [pdfDataMap]);
  
  // Extract individual card using source-aware logic
  const extractCardImage = useCallback(async (cardIndex: number): Promise<string | null> => {
    // Calculate which page this card belongs to
    const cardsPerPage = extractionSettings.grid.rows * extractionSettings.grid.columns;
    const pageIndex = Math.floor(cardIndex / cardsPerPage);
    
    if (pageIndex >= activePages.length || pageIndex < 0) {
      console.warn(`ExtractStep: Invalid page index ${pageIndex} for card ${cardIndex} (activePages.length: ${activePages.length})`);
      return null;
    }
    
    const currentPageInfo = activePages[pageIndex];
    
    if (!currentPageInfo || !currentPageInfo.fileType) {
      console.warn(`ExtractStep: Invalid page info for page ${pageIndex}:`, currentPageInfo);
      return null;
    }
    
    
    
    if (currentPageInfo.fileType === 'pdf') {
      // Get the correct PDF data for this specific file
      const filePdfData = getPdfData(currentPageInfo.fileName);
      if (!filePdfData) {
        console.warn(`ExtractStep: No PDF data available for file ${currentPageInfo.fileName} on page ${pageIndex}`);
        return null;
      }
      
      // For multi-file scenarios, calculate the card extraction directly
      // instead of using the complex extractCardImageUtil logic
      const cardsPerPage = extractionSettings.grid.rows * extractionSettings.grid.columns;
      const cardOnPage = cardIndex % cardsPerPage;
      
      // Use the original page index from the current page info
      const actualPageNumber = currentPageInfo.originalPageIndex + 1;
      
      try {
        // Extract the card directly using the file-specific PDF data and page number
        return await extractCardImageFromPdfPage(
          filePdfData, 
          actualPageNumber, 
          cardOnPage, 
          extractionSettings
        );
      } catch (error) {
        console.error(`Failed to extract card ${cardIndex} from PDF page ${actualPageNumber}:`, error);
        return null;
      }
    } else if (currentPageInfo.fileType === 'image') {
      // Use image extraction
      const imageData = getImageData(currentPageInfo.fileName);
      if (!imageData) {
        console.error(`No image data found for file: ${currentPageInfo.fileName}`);
        return null;
      }
      return await extractCardImageFromCanvas(cardIndex, imageData, pdfMode, activePages, extractionSettings);
    }
    
    console.warn(`ExtractStep: Unknown file type ${currentPageInfo.fileType} for page ${pageIndex}`);
    return null;
  }, [extractionSettings, pdfMode, activePages, unifiedPages, getPdfData, getImageData]);
  // Unified page rendering for both PDF and image sources
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
    if (currentPageInfo.fileType === 'pdf' && !pdfData) {
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
        setPageDimensions({ width: baseViewport.width, height: baseViewport.height });
        
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
            dpiMultiplier, // Store the DPI multiplier for overlay calculations
            sourceType: 'pdf',
            fileName: currentPageInfo.fileName
          });
          
        } else if (currentPageInfo.fileType === 'image') {
          // Image rendering logic
          const imageData = getImageData(currentPageInfo.fileName);
          if (!imageData) return;
          
          const sourceCanvas = imageData.canvas;
          
          // Store original image dimensions for card info calculations
          setPageDimensions({ width: sourceCanvas.width, height: sourceCanvas.height });
          
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
          setRenderedPageData({
            width: canvasWidth,
            height: canvasHeight,
            actualPageNumber: currentPageInfo.originalPageIndex + 1, // Use original page index
            previewScale: baseScale,
            dpiMultiplier,
            sourceType: 'image',
            fileName: currentPageInfo.fileName
          });
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
  }, [getPdfData, currentPage, activePages, unifiedPages, getImageData, zoom]);
  // Update card preview when current card or extraction settings change
  useEffect(() => {
    let cancelled = false;
    
    // Add stabilization check to prevent rapid re-renders
    if (renderedPageData && !renderingRef.current && canvasRef.current && activePages.length > 0) {
      // Use centralized timeout constant for preview updates
      const timer = setTimeout(async () => {
        if (!cancelled && renderedPageData && !renderingRef.current) {
          try {
            const cardUrl = await extractCardImage(globalCardIndex);
            if (!cancelled) {
              setCardPreviewUrl(cardUrl);
            }
          } catch (error) {
            console.error('Card preview extraction failed:', error);
            if (!cancelled) {
              setCardPreviewUrl(null);
            }
          }
        }
      }, TIMEOUT_CONSTANTS.PREVIEW_UPDATE_DELAY);
      
      return () => {
        cancelled = true;
        clearTimeout(timer);
      };
    } else {
      // Clear the preview if prerequisites aren't met
      setCardPreviewUrl(null);
    }  }, [currentCard, currentPage, renderedPageData, extractionSettings.crop, extractionSettings.grid, extractionSettings.gutterWidth, extractionSettings.cardCrop, extractionSettings.imageRotation, extractCardImage, globalCardIndex, activePages.length]);

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

  const handleCardCropChange = (edge: string, value: number) => {
    // Ensure value is a valid number, default to 0 if NaN
    const validValue = isNaN(value) ? 0 : value;
    
    const newSettings = {
      ...extractionSettings,
      cardCrop: {
        ...(extractionSettings.cardCrop || { top: 0, right: 0, bottom: 0, left: 0 }),
        [edge]: validValue
      }
    };
    
    onSettingsChange(newSettings);
  };

  const handleImageRotationChange = (cardType: 'front' | 'back', rotation: number) => {
    const newSettings = {
      ...extractionSettings,
      imageRotation: {
        ...(extractionSettings.imageRotation || { front: 0, back: 0 }),
        [cardType]: rotation
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
  };

  // Handle mouse hover on card preview for alignment assistance
  const handleCardPreviewMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const container = e.currentTarget;
    const img = container.querySelector('img');
    if (!img) return;
    
    // Get mouse position relative to the container
    const containerRect = container.getBoundingClientRect();
    const mouseX = e.clientX - containerRect.left;
    const mouseY = e.clientY - containerRect.top;
    
    // Get image position and dimensions within the container
    const imgRect = img.getBoundingClientRect();
    const imgLeft = imgRect.left - containerRect.left;
    const imgTop = imgRect.top - containerRect.top;
    
    // Calculate mouse position relative to the image
    const relativeX = mouseX - imgLeft;
    const relativeY = mouseY - imgTop;
    
    // Only set hover position if mouse is within the image bounds
    if (relativeX >= 0 && relativeX <= img.offsetWidth && relativeY >= 0 && relativeY <= img.offsetHeight) {
      setHoverPosition({ x: relativeX, y: relativeY });
    } else {
      setHoverPosition(null);
    }
  };

  const handleCardPreviewMouseLeave = () => {
    setHoverPosition(null);
  };  // --- Helper: Centralize overlay scale factor ---
  const getOverlayScaleFactor = useCallback(() => {
    if (!canvasRef.current || !renderedPageData) return 1;
    
    // Since we're inside the zoom wrapper, we don't need to multiply by zoom
    // The CSS transform handles the zoom scaling automatically  
    // Use preview scale directly to match extraction logic (crop values are source image pixels)
    const extractionToPreviewScale = renderedPageData.previewScale;
    
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
          onClick={() => setCurrentCard(cardIdx)}
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
    if (pdfMode.type === 'gutter-fold' && extractionSettings.gutterWidth > 0) {
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
        {Array.from({ length: totalCells }).map((_, idx) => {
          const gridRow = Math.floor(idx / extractionSettings.grid.columns);
          const gridCol = idx % extractionSettings.grid.columns;
          return renderCell(idx, gridRow, gridCol, `cell-${idx}`);
        })}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-800">Extract Cards</h2>
        
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
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-medium text-gray-800 mb-3">
              Page Crop Settings
            </h3>
            <p className="text-sm text-gray-600 mb-3">
              Specify margins to crop from each edge (values in source image pixels)
            </p>
            <div className="grid grid-cols-2 gap-4">
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
          </div>

          {/* Total crop indicator - immediately after page crop settings */}
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
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

          <GridSettings
            grid={extractionSettings.grid}
            onGridChange={handleGridChange}
          />

          <GutterSettings
            pdfMode={pdfMode}
            gutterWidth={extractionSettings.gutterWidth || 0}
            onGutterWidthChange={handleGutterWidthChange}
          />

          {/* Card Skip Controls */}
          <div>
            <h3 className="text-lg font-medium text-gray-800 mb-3">
              Card Skip Controls
            </h3>
            <p className="text-sm text-gray-600 mb-3">
              Mark cards to exclude from extraction and export. Click on the grid to the right to select a card, then use the controls below.
            </p>
            
            {/* Export summary */}
            <div className="bg-blue-50 border border-blue-200 rounded-md p-3 mb-4">
              <div className="text-sm text-blue-800 mb-3">
                <strong>Export Summary:</strong> {(() => {
                  const skippedCards = extractionSettings.skippedCards || [];
                  const totalCards = calculateTotalCards(pdfMode, activePages, cardsPerPage);
                  const skippedCount = skippedCards.length;
                  return `${totalCards - skippedCount} of ${totalCards} cards will be exported`;
                })()}
                {(() => {
                  const skippedCount = extractionSettings.skippedCards?.length || 0;
                  return skippedCount > 0 ? ` (${skippedCount} skipped)` : '';
                })()}
              </div>
              <button
                onClick={() => {
                  onSettingsChange({
                    ...extractionSettings,
                    skippedCards: clearAllSkips()
                  });
                }}
                className="px-3 py-1 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700"
              >
                Clear All Skips
              </button>
            </div>
            
            {/* Current card skip controls */}
            <div className="space-y-3">
              <div className="border border-gray-300 rounded-md p-3 bg-gray-50">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm">
                    <div className="font-medium text-gray-800">
                      Selected: {cardType} {cardId}
                    </div>
                    <div className="text-gray-600">
                      Row {Math.floor(currentCard / extractionSettings.grid.columns) + 1}, 
                      Column {(currentCard % extractionSettings.grid.columns) + 1}
                    </div>
                  </div>
                  <div className="text-sm text-gray-600">
                    {(() => {
                      const skippedCards = extractionSettings.skippedCards || [];
                      const gridRow = Math.floor(currentCard / extractionSettings.grid.columns);
                      const gridCol = currentCard % extractionSettings.grid.columns;
                      const isSkipped = isCardSkipped(currentPage, gridRow, gridCol, skippedCards, cardType.toLowerCase() as 'front' | 'back');
                      return isSkipped ? '🚫 Skipped' : '✓ Will export';
                    })()}
                  </div>
                </div>
                
                <button
                  onClick={() => {
                    const skippedCards = extractionSettings.skippedCards || [];
                    const gridRow = Math.floor(currentCard / extractionSettings.grid.columns);
                    const gridCol = currentCard % extractionSettings.grid.columns;
                    const newSkippedCards = toggleCardSkip(
                      currentPage, 
                      gridRow, 
                      gridCol, 
                      cardType.toLowerCase() as 'front' | 'back',
                      skippedCards
                    );
                    onSettingsChange({
                      ...extractionSettings,
                      skippedCards: newSkippedCards
                    });
                  }}
                  className={(() => {
                    const skippedCards = extractionSettings.skippedCards || [];
                    const gridRow = Math.floor(currentCard / extractionSettings.grid.columns);
                    const gridCol = currentCard % extractionSettings.grid.columns;
                    const isSkipped = isCardSkipped(currentPage, gridRow, gridCol, skippedCards, cardType.toLowerCase() as 'front' | 'back');
                    return isSkipped 
                      ? 'w-full px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm font-medium'
                      : 'w-full px-3 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 text-sm font-medium';
                  })()}
                >
                  {(() => {
                    const skippedCards = extractionSettings.skippedCards || [];
                    const gridRow = Math.floor(currentCard / extractionSettings.grid.columns);
                    const gridCol = currentCard % extractionSettings.grid.columns;
                    const isSkipped = isCardSkipped(currentPage, gridRow, gridCol, skippedCards, cardType.toLowerCase() as 'front' | 'back');
                    return isSkipped ? 'Include This Card' : 'Skip This Card';
                  })()}
                </button>
                
                {/* Row/Column skip buttons */}
                <div className="grid grid-cols-2 gap-2 mt-3">
                  <button
                    onClick={() => {
                      const skippedCards = extractionSettings.skippedCards || [];
                      const currentRow = Math.floor(currentCard / extractionSettings.grid.columns);
                      const newSkippedCards = skipAllInRow(
                        currentPage,
                        currentRow,
                        extractionSettings.grid.columns,
                        cardType.toLowerCase() as 'front' | 'back',
                        skippedCards
                      );
                      onSettingsChange({
                        ...extractionSettings,
                        skippedCards: newSkippedCards
                      });
                    }}
                    className="px-2 py-1 bg-gray-600 text-white rounded text-xs hover:bg-gray-700"
                  >
                    Skip All in Row {Math.floor(currentCard / extractionSettings.grid.columns) + 1}
                  </button>
                  <button
                    onClick={() => {
                      const skippedCards = extractionSettings.skippedCards || [];
                      const currentCol = currentCard % extractionSettings.grid.columns;
                      const newSkippedCards = skipAllInColumn(
                        currentPage,
                        currentCol,
                        extractionSettings.grid.rows,
                        cardType.toLowerCase() as 'front' | 'back',
                        skippedCards
                      );
                      onSettingsChange({
                        ...extractionSettings,
                        skippedCards: newSkippedCards
                      });
                    }}
                    className="px-2 py-1 bg-gray-600 text-white rounded text-xs hover:bg-gray-700"
                  >
                    Skip All in Column {(currentCard % extractionSettings.grid.columns) + 1}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <div className="space-y-4">
          <div className="border border-gray-200 rounded-lg overflow-hidden">            <div className="bg-gray-50 p-3 border-b border-gray-200 flex justify-between items-center">
              <div className="flex items-center space-x-2">
                <button onClick={handlePreviousPage} disabled={currentPage === 0} className="p-1 rounded-full hover:bg-gray-200 disabled:opacity-50">
                  <ChevronLeftIcon size={16} />
                </button>
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-700">
                    Page {currentPage + 1} of {totalPages}
                  </span>
                  {activePages[currentPage] && (
                    <div className="flex items-center space-x-1">
                      {activePages[currentPage].fileType === 'pdf' ? (
                        <FileIcon size={14} className="text-red-600" />
                      ) : (
                        <ImageIcon size={14} className="text-green-600" />
                      )}
                      <span className="text-xs text-gray-500 max-w-[150px] truncate" title={activePages[currentPage].fileName}>
                        {activePages[currentPage].fileName}
                      </span>
                    </div>
                  )}
                </div>
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
                      display: activePages.length > 0 && 
                               (pdfData || multiFileImport.multiFileState.pages.length > 0) 
                               ? 'block' : 'none'
                    }}
                  />
                  {(activePages.length === 0 || 
                    (!pdfData && multiFileImport.multiFileState.pages.length === 0)) && (
                    <div className="text-gray-400 text-center p-8">
                      <p>No files loaded or no active pages</p>
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
            
            <div 
              ref={cardPreviewContainerRef}
              className="bg-gray-100 border border-gray-300 rounded p-4 min-h-[200px] flex items-center justify-center relative card-preview-container"
              onMouseMove={handleCardPreviewMouseMove}
              onMouseLeave={handleCardPreviewMouseLeave}
            >
              {cardPreviewUrl ? (
                <div className="relative inline-block">
                  <img 
                    src={cardPreviewUrl} 
                    alt={`${cardType} ${cardId}`}
                    className="max-w-full max-h-full object-contain"
                  />
                  {/* Center crosshairs overlay */}
                  <div className="absolute inset-0 pointer-events-none">
                    {/* Horizontal dashed line */}
                    <div 
                      className="absolute left-0 right-0 h-0.5 opacity-90"
                      style={{ 
                        top: '50%', 
                        transform: 'translateY(-50%)',
                        background: 'repeating-linear-gradient(to right, #ef4444 0, #ef4444 6px, transparent 6px, transparent 12px)'
                      }}
                    />
                    {/* Horizontal dashed line white outline */}
                    <div 
                      className="absolute left-0 right-0 h-1 opacity-60"
                      style={{ 
                        top: '50%', 
                        transform: 'translateY(-50%)',
                        background: 'repeating-linear-gradient(to right, rgba(255,255,255,0.8) 0, rgba(255,255,255,0.8) 6px, transparent 6px, transparent 12px)',
                        zIndex: -1
                      }}
                    />
                    {/* Vertical dashed line */}
                    <div 
                      className="absolute top-0 bottom-0 w-0.5 opacity-90"
                      style={{ 
                        left: '50%', 
                        transform: 'translateX(-50%)',
                        background: 'repeating-linear-gradient(to bottom, #ef4444 0, #ef4444 6px, transparent 6px, transparent 12px)'
                      }}
                    />
                    {/* Vertical dashed line white outline */}
                    <div 
                      className="absolute top-0 bottom-0 w-1 opacity-60"
                      style={{ 
                        left: '50%', 
                        transform: 'translateX(-50%)',
                        background: 'repeating-linear-gradient(to bottom, rgba(255,255,255,0.8) 0, rgba(255,255,255,0.8) 6px, transparent 6px, transparent 12px)',
                        zIndex: -1
                      }}
                    />
                    {/* Center dot */}
                    <div 
                      className="absolute w-3 h-3 bg-red-500 rounded-full opacity-90 border-2 border-white shadow-sm"
                      style={{ 
                        top: '50%', 
                        left: '50%', 
                        transform: 'translate(-50%, -50%)' 
                      }}
                    />
                    
                    {/* Hover rectangle overlay for alignment assistance */}
                    {hoverPosition && (() => {
                      // Get the container and image elements using the ref
                      const container = cardPreviewContainerRef.current;
                      const img = container?.querySelector('img');
                      if (!img || !container) return null;
                      
                      // Calculate center point of the image
                      const centerX = img.offsetWidth / 2;
                      const centerY = img.offsetHeight / 2;
                      
                      // Calculate distances from center to hover position
                      const deltaX = Math.abs(hoverPosition.x - centerX);
                      const deltaY = Math.abs(hoverPosition.y - centerY);
                      
                      // Create mirrored rectangle that spans all four quadrants
                      const rectLeft = centerX - deltaX;
                      const rectTop = centerY - deltaY;
                      const rectWidth = deltaX * 2;
                      const rectHeight = deltaY * 2;
                      
                      return (
                        <div className="absolute inset-0 pointer-events-none">
                          {/* Mirrored hover rectangle with properly dashed borders */}
                          {/* Top border - horizontal line with vertical dashes */}
                          <div 
                            className="absolute h-0.5 opacity-70"
                            style={{
                              left: `${rectLeft}px`,
                              top: `${rectTop}px`,
                              width: `${rectWidth}px`,
                              background: 'repeating-linear-gradient(90deg, #3b82f6 0, #3b82f6 6px, transparent 6px, transparent 12px)'
                            }}
                          />
                          {/* Bottom border - horizontal line with vertical dashes */}
                          <div 
                            className="absolute h-0.5 opacity-70"
                            style={{
                              left: `${rectLeft}px`,
                              top: `${rectTop + rectHeight}px`,
                              width: `${rectWidth}px`,
                              background: 'repeating-linear-gradient(90deg, #3b82f6 0, #3b82f6 6px, transparent 6px, transparent 12px)'
                            }}
                          />
                          {/* Left border - vertical line with horizontal dashes */}
                          <div 
                            className="absolute w-0.5 opacity-70"
                            style={{
                              left: `${rectLeft}px`,
                              top: `${rectTop}px`,
                              height: `${rectHeight}px`,
                              background: 'repeating-linear-gradient(0deg, #3b82f6 0, #3b82f6 6px, transparent 6px, transparent 12px)'
                            }}
                          />
                          {/* Right border - vertical line with horizontal dashes */}
                          <div 
                            className="absolute w-0.5 opacity-70"
                            style={{
                              left: `${rectLeft + rectWidth}px`,
                              top: `${rectTop}px`,
                              height: `${rectHeight}px`,
                              background: 'repeating-linear-gradient(0deg, #3b82f6 0, #3b82f6 6px, transparent 6px, transparent 12px)'
                            }}
                          />
                          {/* Distance indicators */}
                          <div 
                            className="absolute bg-blue-600 text-white text-xs px-1 py-0.5 rounded shadow-lg z-10"
                            style={{
                              left: `${hoverPosition.x + 8}px`,
                              top: `${hoverPosition.y - 24}px`,
                              fontSize: '10px'
                            }}
                          >
                            {Math.round(deltaX)}×{Math.round(deltaY)}px from center
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center text-gray-400">
                  {renderingRef.current ? 'Rendering...' : `Card ${currentCard + 1} Preview`}
                </div>
              )}
            </div>
          </div>


          {/* Individual Card Settings - next to preview */}
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="flex justify-between items-center mb-3">
              <h4 className="text-sm font-medium text-gray-700">
                Individual Card Settings
              </h4>
              <button
                onClick={() => {
                  const newSettings = {
                    ...extractionSettings,
                    cardCrop: { top: 0, right: 0, bottom: 0, left: 0 },
                    imageRotation: { front: 0, back: 0 }
                  };
                  onSettingsChange(newSettings);
                }}
                className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded text-gray-600"
                title="Reset rotation and crop values to defaults"
              >
                Reset All
              </button>
            </div>

            {/* Card Dimensions Display */}
            {cardDimensions && (
              <div className="mb-4 p-3 bg-gray-50 rounded-md">
                <h5 className="text-xs font-medium text-gray-700 mb-2">
                  Extracted Card Dimensions
                </h5>
                <div className="space-y-1">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-600">Final Size:</span>
                    <span className="font-medium text-gray-800">
                      {cardDimensions.widthPx} × {cardDimensions.heightPx} px
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-600">Inches:</span>
                    <span className="font-medium text-gray-800">
                      {cardDimensions.widthInches.toFixed(2)}" × {cardDimensions.heightInches.toFixed(2)}"
                    </span>
                  </div>
                  {cardDimensions.rotation !== 0 && (
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-600">Rotation Applied:</span>
                      <span className="font-medium text-blue-600">
                        {cardDimensions.rotation}° ({cardDimensions.cardType})
                      </span>
                    </div>
                  )}
                  <div className="text-xs text-gray-500 mt-2">
                    Live preview updates as you change settings above
                  </div>
                </div>
              </div>
            )}

            {/* Image Rotation Controls */}
            <div className="mb-4">
              <h5 className="text-xs font-medium text-gray-700 mb-2">
                Image Rotation
              </h5>
              <p className="text-xs text-gray-600 mb-3">
                Rotate card images during extraction (different from layout rotation in Configure step)
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Front Cards
                  </label>
                  <select 
                    value={extractionSettings.imageRotation?.front || 0}
                    onChange={e => handleImageRotationChange('front', parseInt(e.target.value))}
                    className="w-full border border-gray-300 rounded-md px-2 py-1 text-sm"
                  >
                    <option value={0}>0° (No rotation)</option>
                    <option value={90}>90° (Clockwise)</option>
                    <option value={180}>180° (Upside down)</option>
                    <option value={270}>270° (Counter-clockwise)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Back Cards
                  </label>
                  <select 
                    value={extractionSettings.imageRotation?.back || 0}
                    onChange={e => handleImageRotationChange('back', parseInt(e.target.value))}
                    className="w-full border border-gray-300 rounded-md px-2 py-1 text-sm"
                  >
                    <option value={0}>0° (No rotation)</option>
                    <option value={90}>90° (Clockwise)</option>
                    <option value={180}>180° (Upside down)</option>
                    <option value={270}>270° (Counter-clockwise)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Card Crop Controls */}
            <div>
              <h5 className="text-xs font-medium text-gray-700 mb-2">
                Card Cropping
              </h5>
              <p className="text-xs text-gray-600 mb-3">
                Fine-tune cropping for individual cards after grid extraction (values in 300 DPI pixels)
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Card Top Crop
                  </label>
                  <input 
                    type="number" 
                    value={extractionSettings.cardCrop?.top || 0} 
                    onChange={e => handleCardCropChange('top', parseInt(e.target.value) || 0)} 
                    className="w-full border border-gray-300 rounded-md px-2 py-1 text-sm" 
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Card Right Crop
                  </label>
                  <input 
                    type="number" 
                    value={extractionSettings.cardCrop?.right || 0} 
                    onChange={e => handleCardCropChange('right', parseInt(e.target.value) || 0)} 
                    className="w-full border border-gray-300 rounded-md px-2 py-1 text-sm" 
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Card Bottom Crop
                  </label>
                  <input 
                    type="number" 
                    value={extractionSettings.cardCrop?.bottom || 0} 
                    onChange={e => handleCardCropChange('bottom', parseInt(e.target.value) || 0)} 
                    className="w-full border border-gray-300 rounded-md px-2 py-1 text-sm" 
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Card Left Crop
                  </label>
                  <input 
                    type="number" 
                    value={extractionSettings.cardCrop?.left || 0} 
                    onChange={e => handleCardCropChange('left', parseInt(e.target.value) || 0)} 
                    className="w-full border border-gray-300 rounded-md px-2 py-1 text-sm" 
                  />
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Use the red crosshairs in the preview above to align with your card's center.
                Hover over the card preview to see a mirrored measurement rectangle for checking symmetrical alignment and margins.
              </p>
            </div>
          </div>

          {/* Card crop indicator - immediately after card crop settings */}
          {extractionSettings.cardCrop && (
            (extractionSettings.cardCrop.top > 0 || extractionSettings.cardCrop.right > 0 || 
             extractionSettings.cardCrop.bottom > 0 || extractionSettings.cardCrop.left > 0)
          ) && (
            <div className="p-3 bg-orange-50 rounded-md">
              <div className="flex items-center">
                <span className="text-sm font-medium text-orange-800">
                  Individual card cropping active
                </span>
              </div>
              <p className="text-xs text-orange-600 mt-1">
                {(extractionSettings.cardCrop.top || 0) + (extractionSettings.cardCrop.right || 0) + (extractionSettings.cardCrop.bottom || 0) + (extractionSettings.cardCrop.left || 0)} px total crop applied to each card.
              </p>
            </div>
          )}
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