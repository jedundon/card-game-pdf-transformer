import React from 'react';
import { RotateCcw } from 'lucide-react';
import { DEFAULT_SETTINGS } from '../../../defaults';
import type { OutputSettings } from '../../../types';

interface CardSizeSettingsProps {
  outputSettings: OutputSettings;
  onCardImageSizingModeChange: (mode: string) => void;
  onCardSizeChange: (dimension: string, value: number) => void;
  onBleedMarginChange: (value: number) => void;
  onCardSizePreset: (preset: { widthInches: number; heightInches: number }) => void;
  onCardScalePercentChange: (value: number) => void;
  onRotationChange: (cardType: 'front' | 'back', value: number) => void;
  getRotationForCardType: (settings: OutputSettings, cardType: 'front' | 'back') => number;
}

/**
 * Card size settings component for configuring card dimensions and display options
 * 
 * Provides controls for card sizing mode, dimensions, bleed margins, scale adjustments,
 * and rotation settings. Includes preset buttons for common card sizes and scale values.
 */
export const CardSizeSettings: React.FC<CardSizeSettingsProps> = ({
  outputSettings,
  onCardImageSizingModeChange,
  onCardSizeChange,
  onBleedMarginChange,
  onCardSizePreset,
  onCardScalePercentChange,
  onRotationChange,
  getRotationForCardType
}) => {
  return (
    <>
      {/* Card Size Section */}
      <div>
        <h3 className="text-lg font-medium text-gray-800 mb-3">
          Card Image Size
        </h3>
        <p className="text-sm text-gray-600 mb-3">
          Set the target card dimensions. Bleed extends the print area beyond the card edges for better coverage.
        </p>
        
        {/* Card Image Sizing Mode */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Image Sizing Mode
          </label>
          <div className="flex space-x-2">
            <button
              onClick={() => onCardImageSizingModeChange('actual-size')}
              className={`flex-1 py-2 px-3 text-sm border rounded-md transition-colors ${
                (outputSettings.cardImageSizingMode || DEFAULT_SETTINGS.outputSettings.cardImageSizingMode) === 'actual-size'
                  ? 'bg-blue-50 border-blue-300 text-blue-700'
                  : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              Actual Size
            </button>
            <button
              onClick={() => onCardImageSizingModeChange('fit-to-card')}
              className={`flex-1 py-2 px-3 text-sm border rounded-md transition-colors ${
                (outputSettings.cardImageSizingMode || DEFAULT_SETTINGS.outputSettings.cardImageSizingMode) === 'fit-to-card'
                  ? 'bg-blue-50 border-blue-300 text-blue-700'
                  : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              Fit to Card
            </button>
            <button
              onClick={() => onCardImageSizingModeChange('fill-card')}
              className={`flex-1 py-2 px-3 text-sm border rounded-md transition-colors ${
                (outputSettings.cardImageSizingMode || DEFAULT_SETTINGS.outputSettings.cardImageSizingMode) === 'fill-card'
                  ? 'bg-blue-50 border-blue-300 text-blue-700'
                  : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              Fill Card
            </button>
          </div>
          <div className="mt-2 text-xs text-gray-500">
            {(() => {
              const mode = outputSettings.cardImageSizingMode || DEFAULT_SETTINGS.outputSettings.cardImageSizingMode;
              switch (mode) {
                case 'actual-size':
                  return 'Use the image at its original size without scaling';
                case 'fit-to-card':
                  return 'Scale the image to fit entirely within the card boundaries, maintaining aspect ratio';
                case 'fill-card':
                  return 'Scale the image to fill the entire card area, maintaining aspect ratio (may crop edges)';
                default:
                  return '';
              }
            })()}
          </div>
        </div>
        
        <div className="grid grid-cols-3 gap-4">
          {/* Width */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Width (inches)
            </label>
            <input 
              type="number" 
              step="0.1" 
              min="1" 
              max="12" 
              value={outputSettings.cardSize?.widthInches || DEFAULT_SETTINGS.outputSettings.cardSize.widthInches} 
              onChange={e => onCardSizeChange('widthInches', parseFloat(e.target.value))} 
              className="w-full border border-gray-300 rounded-md px-3 py-2" 
            />
          </div>
          
          {/* Height */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Height (inches)
            </label>
            <input 
              type="number" 
              step="0.1" 
              min="1" 
              max="12" 
              value={outputSettings.cardSize?.heightInches || DEFAULT_SETTINGS.outputSettings.cardSize.heightInches} 
              onChange={e => onCardSizeChange('heightInches', parseFloat(e.target.value))} 
              className="w-full border border-gray-300 rounded-md px-3 py-2" 
            />
          </div>
          
          {/* Bleed */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Bleed (inches)
            </label>
            <input 
              type="number" 
              step="0.01" 
              min="0" 
              max="0.5" 
              value={outputSettings.bleedMarginInches || DEFAULT_SETTINGS.outputSettings.bleedMarginInches} 
              onChange={e => onBleedMarginChange(parseFloat(e.target.value))} 
              className="w-full border border-gray-300 rounded-md px-3 py-2" 
            />
          </div>
        </div>
        
        {/* Card Size Presets and Bleed Presets Row */}
        <div className="grid grid-cols-3 gap-4 mt-3">
          {/* Card Size Presets - spans first two columns */}
          <div className="col-span-2">
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => onCardSizePreset({ widthInches: 2.5, heightInches: 3.5 })}
                className="px-3 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50"
              >
                Poker (2.5×3.5")
              </button>
              <button
                onClick={() => onCardSizePreset({ widthInches: 2.25, heightInches: 3.5 })}
                className="px-3 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50"
              >
                Bridge (2.25×3.5")
              </button>
              <button
                onClick={() => onCardSizePreset({ widthInches: 3.5, heightInches: 3.5 })}
                className="px-3 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50"
              >
                Square (3.5×3.5")
              </button>
            </div>
          </div>
          
          {/* Bleed Presets - third column */}
          <div>
            <div className="flex gap-1">
              <button
                onClick={() => onBleedMarginChange(0)}
                className="px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50 flex-1"
              >
                0
              </button>
              <button
                onClick={() => onBleedMarginChange(0.05)}
                className="px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50 flex-1"
              >
                0.05
              </button>
              <button
                onClick={() => onBleedMarginChange(0.1)}
                className="px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50 flex-1"
              >
                0.1
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Card Scale Section */}
      <div>
        <h3 className="text-lg font-medium text-gray-800 mb-3">
          Card Scale
        </h3>
        <p className="text-sm text-gray-600 mb-3">
          Adjust the scale to compensate for printer enlargement during borderless printing
        </p>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Scale (percent)
          </label>
          <input 
            type="number" 
            step="1" 
            min="50" 
            max="150" 
            value={outputSettings.cardScalePercent || DEFAULT_SETTINGS.outputSettings.cardScalePercent} 
            onChange={e => onCardScalePercentChange(parseFloat(e.target.value))} 
            className="w-full border border-gray-300 rounded-md px-3 py-2" 
          />
          <p className="text-xs text-gray-500 mt-1">
            100% = actual size, &lt;100% = smaller (compensate for printer enlargement)
          </p>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            onClick={() => onCardScalePercentChange(100)}
            className="px-3 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50"
          >
            100% (No scaling)
          </button>
          <button
            onClick={() => onCardScalePercentChange(95)}
            className="px-3 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50"
          >
            95% (Common adjustment)
          </button>
          <button
            onClick={() => onCardScalePercentChange(90)}
            className="px-3 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50"
          >
            90% (Strong adjustment)
          </button>
        </div>
      </div>

      {/* Card Rotation Section */}
      <div>
        <h3 className="text-lg font-medium text-gray-800 mb-3">
          Card Rotation
        </h3>
        <p className="text-sm text-gray-600 mb-3">
          Rotate the final card output for different orientations
        </p>
        
        {/* Front Card Rotation */}
        <div className="mb-4">
          <h4 className="text-sm font-medium text-gray-700 mb-2">
            Front Cards
          </h4>
          <div className="flex items-center space-x-4">
            <RotateCcw size={16} className="text-gray-500" />
            <div className="flex-1 flex space-x-2">
              {[0, 90, 180, 270].map(degree => 
                <button 
                  key={`front-${degree}`} 
                  onClick={() => onRotationChange('front', degree)} 
                  className={`flex-1 py-2 border ${
                    getRotationForCardType(outputSettings, 'front') === degree 
                      ? 'bg-blue-50 border-blue-300 text-blue-700' 
                      : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                  } rounded-md text-sm font-medium`}
                >
                  {degree}°
                </button>
              )}
            </div>
          </div>
        </div>
        
        {/* Back Card Rotation */}
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-2">
            Back Cards
          </h4>
          <div className="flex items-center space-x-4">
            <RotateCcw size={16} className="text-gray-500" />
            <div className="flex-1 flex space-x-2">
              {[0, 90, 180, 270].map(degree => 
                <button 
                  key={`back-${degree}`} 
                  onClick={() => onRotationChange('back', degree)} 
                  className={`flex-1 py-2 border ${
                    getRotationForCardType(outputSettings, 'back') === degree 
                      ? 'bg-blue-50 border-blue-300 text-blue-700' 
                      : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                  } rounded-md text-sm font-medium`}
                >
                  {degree}°
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};