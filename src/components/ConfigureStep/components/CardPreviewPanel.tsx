import React, { useRef } from 'react';
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import { DEFAULT_SETTINGS } from '../../../defaults';
import type { OutputSettings, ExtractionSettings, PdfMode } from '../../../types';

interface CardPreviewPanelProps {
  viewMode: 'front' | 'back';
  currentCardId: number;
  currentCardExists: boolean;
  availableCardIds: number[];
  totalFilteredCards: number;
  currentCardPosition: number;
  previewLoading: boolean;
  previewError: string;
  progressMessage: string;
  processedPreviewUrl: string | null;
  cardPreviewUrl: string | null;
  cardRenderData: any;
  outputSettings: OutputSettings;
  extractionSettings: ExtractionSettings;
  pdfMode: PdfMode;
  activePages: any[];
  totalCards: number;
  cardsPerPage: number;
  cardDimensions: any;
  pendingSettingsRef: React.MutableRefObject<any>;
  onViewModeToggle: (mode: 'front' | 'back') => void;
  onPreviousCard: () => void;
  onNextCard: () => void;
  onRetryPreview: () => void;
  getCacheKey: (cardId: number, mode: 'front' | 'back', settings: any) => string;
  getAvailableCardIds: (type: 'front' | 'back', totalCards: number, pdfMode: PdfMode, activePages: any[], cardsPerPage: number, extractionSettings: ExtractionSettings) => number[];
  countCardsByType: (type: 'front' | 'back', activePages: any[], cardsPerPage: number, pdfMode: PdfMode, extractionSettings: ExtractionSettings) => number;
}

/**
 * Card preview panel with navigation and preview display
 * 
 * Handles view mode switching, card navigation, and renders the card preview
 * with proper positioning, scaling, and error handling.
 */
export const CardPreviewPanel: React.FC<CardPreviewPanelProps> = ({
  viewMode,
  currentCardId,
  currentCardExists,
  availableCardIds,
  totalFilteredCards,
  currentCardPosition,
  previewLoading,
  previewError,
  progressMessage,
  processedPreviewUrl,
  cardPreviewUrl,
  cardRenderData,
  outputSettings,
  extractionSettings,
  pdfMode,
  activePages,
  totalCards,
  cardsPerPage,
  cardDimensions,
  pendingSettingsRef,
  onViewModeToggle,
  onPreviousCard,
  onNextCard,
  onRetryPreview,
  getCacheKey,
  getAvailableCardIds,
  countCardsByType
}) => {
  const previewCacheRef = useRef<Map<string, any>>(new Map());

  return (
    <div className="space-y-4">
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <div className="bg-gray-50 p-3 border-b border-gray-200">
          {/* Combined Controls Row */}
          <div className="relative flex items-center">
            {/* View Mode Toggle - Left */}
            <div className="flex bg-gray-200 rounded-lg p-1">
              <button
                onClick={() => onViewModeToggle('front')}
                className={`px-3 py-1 text-sm rounded-md transition-colors ${
                  viewMode === 'front'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Fronts
              </button>
              <button
                onClick={() => onViewModeToggle('back')}
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
                onClick={onPreviousCard} 
                disabled={!currentCardExists || availableCardIds.indexOf(currentCardId) === 0} 
                className="p-1 rounded-full hover:bg-gray-200 disabled:opacity-50"
              >
                <ChevronLeftIcon size={16} />
              </button>
              <span className="text-sm text-gray-700">
                {totalFilteredCards > 0 && currentCardExists ? `${viewMode.charAt(0).toUpperCase() + viewMode.slice(1)} ${currentCardPosition} of ${totalFilteredCards}` : `No ${viewMode} cards`}
              </span>
              <button 
                onClick={onNextCard} 
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
              {previewLoading ? (
                <div className="w-full h-full flex flex-col items-center justify-center text-gray-500 text-sm">
                  <div className="animate-spin w-8 h-8 border-2 border-gray-300 border-t-blue-600 rounded-full mb-2"></div>
                  <span className="text-center">{progressMessage || 'Loading preview...'}</span>
                  {pendingSettingsRef.current && (
                    <span className="text-xs text-gray-400 mt-1">Settings pending...</span>
                  )}
                </div>
              ) : previewError ? (
                <div className="w-full h-full flex flex-col items-center justify-center p-4">
                  <div className="text-red-500 text-center">
                    <div className="mb-2">⚠️</div>
                    <div className="text-xs mb-2 font-medium">Preview Error</div>
                    <div className="text-xs text-red-600 mb-3">{previewError}</div>
                    <button
                      onClick={onRetryPreview}
                      className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200"
                    >
                      Retry
                    </button>
                  </div>
                </div>
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
              ) : cardPreviewUrl ? (
                <div className="w-full h-full flex items-center justify-center text-gray-500 text-sm">
                  Processing preview...
                </div>
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-500 text-sm">
                  {totalFilteredCards > 0 ? `Card ID ${currentCardId}` : 'No cards available'}
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
              {getAvailableCardIds('front', totalCards, pdfMode, activePages, cardsPerPage, extractionSettings).length} 
              {(() => {
                const totalFronts = countCardsByType('front', activePages, cardsPerPage, pdfMode, extractionSettings);
                const availableFronts = getAvailableCardIds('front', totalCards, pdfMode, activePages, cardsPerPage, extractionSettings).length;
                return totalFronts !== availableFronts ? ` (${totalFronts - availableFronts} skipped)` : '';
              })()}
            </p>
            <p>
              <span className="font-medium">Back cards:</span>{' '}
              {getAvailableCardIds('back', totalCards, pdfMode, activePages, cardsPerPage, extractionSettings).length}
              {(() => {
                const totalBacks = countCardsByType('back', activePages, cardsPerPage, pdfMode, extractionSettings);
                const availableBacks = getAvailableCardIds('back', totalCards, pdfMode, activePages, cardsPerPage, extractionSettings).length;
                return totalBacks !== availableBacks ? ` (${totalBacks - availableBacks} skipped)` : '';
              })()}
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
              <span className="font-medium">Position offset:</span>{' '}
              {outputSettings.offset.horizontal >= 0 ? '+' : ''}{outputSettings.offset.horizontal.toFixed(3)}", {outputSettings.offset.vertical >= 0 ? '+' : ''}{outputSettings.offset.vertical.toFixed(3)}"
            </p>
            <p>
              <span className="font-medium">Image sizing:</span>{' '}
              {outputSettings.cardImageSizingMode || DEFAULT_SETTINGS.outputSettings.cardImageSizingMode}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};