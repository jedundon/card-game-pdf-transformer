import React, { useRef, useState, useEffect } from 'react';
import { TIMEOUT_CONSTANTS } from '../../../constants';

interface CardPreviewPanelProps {
  cardType: string;
  cardId: string;
  globalCardIndex: number;
  extractCardImage: (cardIndex: number) => Promise<string | null>;
  renderedPageData: any;
  renderingRef: React.MutableRefObject<boolean>;
  activePages: any[];
}

/**
 * Card preview panel with individual card extraction preview
 * 
 * Displays the extracted card with alignment crosshairs and hover-based
 * measurement tools for precise card positioning and cropping feedback.
 */
export const CardPreviewPanel: React.FC<CardPreviewPanelProps> = ({
  cardType,
  cardId,
  globalCardIndex,
  extractCardImage,
  renderedPageData,
  renderingRef,
  activePages
}) => {
  const cardPreviewContainerRef = useRef<HTMLDivElement>(null);
  const [cardPreviewUrl, setCardPreviewUrl] = useState<string | null>(null);
  const [hoverPosition, setHoverPosition] = useState<{ x: number; y: number } | null>(null);

  // Update card preview when current card or extraction settings change
  useEffect(() => {
    let cancelled = false;
    
    // Add stabilization check to prevent rapid re-renders
    if (renderedPageData && !renderingRef.current && activePages.length > 0) {
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
    }
  }, [globalCardIndex, renderedPageData, renderingRef, activePages.length, extractCardImage]);

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
  };

  const handleRefresh = async () => {
    const cardUrl = await extractCardImage(globalCardIndex);
    setCardPreviewUrl(cardUrl);
  };

  return (
    <div className="p-4 border border-gray-200 rounded-lg">
      <div className="flex justify-between items-center mb-2">
        <h4 className="text-sm font-medium text-gray-700">
          {cardType} {cardId} Preview
        </h4>
        <button 
          onClick={handleRefresh}
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
            {renderingRef.current ? 'Rendering...' : `Card Preview`}
          </div>
        )}
      </div>
    </div>
  );
};