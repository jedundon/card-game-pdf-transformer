import React from 'react';
import { 
  calculateTotalCards, 
  isCardSkipped, 
  toggleCardSkipWithPairing,
  skipAllInRowWithPairing,
  skipAllInColumnWithPairing, 
  clearAllSkips 
} from '../../../utils/cardUtils';
import type { PdfMode, ExtractionSettings } from '../../../types';

interface CardSkipControlsProps {
  pdfMode: PdfMode;
  activePages: any[];
  extractionSettings: ExtractionSettings;
  currentPage: number;
  currentCard: number;
  cardsPerPage: number;
  cardType: string;
  cardId: string;
  onSettingsChange: (settings: ExtractionSettings) => void;
}

/**
 * Card skip controls component for managing which cards to exclude from extraction
 * 
 * Provides controls for skipping individual cards, entire rows, or columns,
 * along with export summary and clear all functionality.
 */
export const CardSkipControls: React.FC<CardSkipControlsProps> = ({
  pdfMode,
  activePages,
  extractionSettings,
  currentPage,
  currentCard,
  cardsPerPage,
  cardType,
  cardId,
  onSettingsChange
}) => {
  const skippedCards = extractionSettings.skippedCards || [];
  const totalCards = calculateTotalCards(pdfMode, activePages, cardsPerPage);
  const skippedCount = skippedCards.length;
  const gridRow = Math.floor(currentCard / extractionSettings.grid.columns);
  const gridCol = currentCard % extractionSettings.grid.columns;
  const isCurrentCardSkipped = isCardSkipped(currentPage, gridRow, gridCol, skippedCards, cardType.toLowerCase() as 'front' | 'back');

  const handleToggleCardSkip = () => {
    const newSkippedCards = toggleCardSkipWithPairing(
      currentPage, 
      gridRow, 
      gridCol, 
      cardType.toLowerCase() as 'front' | 'back',
      skippedCards,
      activePages,
      extractionSettings,
      pdfMode
    );
    onSettingsChange({
      ...extractionSettings,
      skippedCards: newSkippedCards
    });
  };

  const handleSkipAllInRow = () => {
    const newSkippedCards = skipAllInRowWithPairing(
      currentPage,
      gridRow,
      extractionSettings.grid.columns,
      cardType.toLowerCase() as 'front' | 'back',
      skippedCards,
      activePages,
      extractionSettings,
      pdfMode
    );
    onSettingsChange({
      ...extractionSettings,
      skippedCards: newSkippedCards
    });
  };

  const handleSkipAllInColumn = () => {
    const newSkippedCards = skipAllInColumnWithPairing(
      currentPage,
      gridCol,
      extractionSettings.grid.rows,
      cardType.toLowerCase() as 'front' | 'back',
      skippedCards,
      activePages,
      extractionSettings,
      pdfMode
    );
    onSettingsChange({
      ...extractionSettings,
      skippedCards: newSkippedCards
    });
  };

  const handleClearAllSkips = () => {
    onSettingsChange({
      ...extractionSettings,
      skippedCards: clearAllSkips()
    });
  };

  return (
    <div>
      <h3 className="text-lg font-medium text-gray-800 mb-3">
        Card Skip Controls
      </h3>
      <p className="text-sm text-gray-600 mb-3">
        Mark cards to exclude from extraction and export. Click on the grid to the right to select a card, then use the controls below.
        {pdfMode.type === 'gutter-fold' && (
          <span className="block mt-2 text-blue-600 font-medium">
            💡 In gutter-fold mode, skipping a front card will also skip its paired back card automatically.
          </span>
        )}
      </p>
      
      {/* Export summary */}
      <div className="bg-blue-50 border border-blue-200 rounded-md p-3 mb-4">
        <div className="text-sm text-blue-800 mb-3">
          <strong>Export Summary:</strong> {totalCards - skippedCount} of {totalCards} cards will be exported
          {skippedCount > 0 ? ` (${skippedCount} skipped)` : ''}
        </div>
        <button
          onClick={handleClearAllSkips}
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
                Row {gridRow + 1}, Column {gridCol + 1}
              </div>
            </div>
            <div className="text-sm text-gray-600">
              {isCurrentCardSkipped ? '🚫 Skipped' : '✓ Will export'}
            </div>
          </div>
          
          <button
            onClick={handleToggleCardSkip}
            className={`w-full px-3 py-2 text-white rounded-md text-sm font-medium ${
              isCurrentCardSkipped 
                ? 'bg-green-600 hover:bg-green-700' 
                : 'bg-red-600 hover:bg-red-700'
            }`}
          >
            {isCurrentCardSkipped ? 'Include This Card' : 'Skip This Card'}
          </button>
          
          {/* Row/Column skip buttons */}
          <div className="grid grid-cols-2 gap-2 mt-3">
            <button
              onClick={handleSkipAllInRow}
              className="px-2 py-1 bg-gray-600 text-white rounded text-xs hover:bg-gray-700"
            >
              Skip All in Row {gridRow + 1}
            </button>
            <button
              onClick={handleSkipAllInColumn}
              className="px-2 py-1 bg-gray-600 text-white rounded text-xs hover:bg-gray-700"
            >
              Skip All in Column {gridCol + 1}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};