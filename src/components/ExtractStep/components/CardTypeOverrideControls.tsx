import React from 'react';
import { 
  toggleCardTypeOverride,
  setCardTypeOverride,
  clearAllCardTypeOverrides,
  getCardTypeOverrideStatus
} from '../../../utils/cardUtils';
import type { PdfMode, ExtractionSettings } from '../../../types';

interface CardTypeOverrideControlsProps {
  pdfMode: PdfMode;
  extractionSettings: ExtractionSettings;
  currentPage: number;
  currentCard: number;
  cardType: string;
  cardId: string;
  onSettingsChange: (settings: ExtractionSettings) => void;
}

/**
 * Card type override controls component for manual front/back assignment
 * 
 * Provides controls for overriding the automatic card type assignment from
 * processing mode, allowing users to manually designate specific cards as
 * front or back cards.
 */
export const CardTypeOverrideControls: React.FC<CardTypeOverrideControlsProps> = ({
  pdfMode,
  extractionSettings,
  currentPage,
  currentCard,
  cardType,
  cardId,
  onSettingsChange
}) => {
  const cardTypeOverrides = extractionSettings.cardTypeOverrides || [];
  const gridRow = Math.floor(currentCard / extractionSettings.grid.columns);
  const gridCol = currentCard % extractionSettings.grid.columns;
  
  const overrideStatus = getCardTypeOverrideStatus(
    currentPage,
    gridRow,
    gridCol,
    cardTypeOverrides
  );

  const handleSetCardType = (cardType: 'front' | 'back') => {
    const newOverrides = setCardTypeOverride(
      currentPage,
      gridRow,
      gridCol,
      cardType,
      cardTypeOverrides
    );
    onSettingsChange({
      ...extractionSettings,
      cardTypeOverrides: newOverrides
    });
  };

  const handleToggleOverride = () => {
    const newOverrides = toggleCardTypeOverride(
      currentPage,
      gridRow,
      gridCol,
      cardTypeOverrides
    );
    onSettingsChange({
      ...extractionSettings,
      cardTypeOverrides: newOverrides
    });
  };

  const handleClearAllOverrides = () => {
    onSettingsChange({
      ...extractionSettings,
      cardTypeOverrides: clearAllCardTypeOverrides()
    });
  };

  const overrideCount = cardTypeOverrides.length;

  return (
    <div>
      <h3 className="text-lg font-medium text-gray-800 mb-3">
        Card Type Override
      </h3>
      <p className="text-sm text-gray-600 mb-3">
        Manually override front/back card assignment for mixed layouts. 
        Click on the grid to select a card, then choose its type below.
      </p>
      
      {/* Override summary */}
      {overrideCount > 0 && (
        <div className="bg-purple-50 border border-purple-200 rounded-md p-3 mb-4">
          <div className="text-sm text-purple-800 mb-3">
            <strong>Manual Overrides:</strong> {overrideCount} card{overrideCount !== 1 ? 's' : ''} manually assigned
          </div>
          <button
            onClick={handleClearAllOverrides}
            className="px-3 py-1 bg-purple-600 text-white rounded-md text-sm hover:bg-purple-700"
          >
            Clear All Overrides
          </button>
        </div>
      )}
      
      {/* Current card override controls */}
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
            <div className="text-sm">
              {overrideStatus.hasOverride ? (
                <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded text-xs font-medium">
                  Override: {overrideStatus.overrideType === 'front' ? 'Front' : 'Back'}
                </span>
              ) : (
                <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs">
                  Auto: {cardType}
                </span>
              )}
            </div>
          </div>
          
          {/* Type selection buttons */}
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => handleSetCardType('front')}
              className={`px-3 py-2 text-sm font-medium rounded-md ${
                overrideStatus.hasOverride && overrideStatus.overrideType === 'front'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              Set Front
            </button>
            <button
              onClick={() => handleSetCardType('back')}
              className={`px-3 py-2 text-sm font-medium rounded-md ${
                overrideStatus.hasOverride && overrideStatus.overrideType === 'back'
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              Set Back
            </button>
            <button
              onClick={handleToggleOverride}
              className="px-3 py-2 text-sm font-medium rounded-md bg-gray-400 text-white hover:bg-gray-500"
            >
              {overrideStatus.hasOverride ? 'Clear' : 'Auto'}
            </button>
          </div>
          
          {/* Processing mode context */}
          <div className="mt-3 pt-3 border-t border-gray-200">
            <div className="text-xs text-gray-500">
              <strong>Processing Mode:</strong> {pdfMode.type}
              {pdfMode.orientation && ` (${pdfMode.orientation})`}
              {pdfMode.flipEdge && ` - ${pdfMode.flipEdge} edge flip`}
            </div>
            {overrideStatus.hasOverride && (
              <div className="text-xs text-purple-600 mt-1">
                💡 Manual override takes precedence over processing mode
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};