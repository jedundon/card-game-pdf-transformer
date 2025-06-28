import React from 'react';
import type { ExtractionSettings } from '../../../types';
import type { CardDimensions } from '../hooks/useCardDimensions';

interface IndividualCardSettingsProps {
  extractionSettings: ExtractionSettings;
  cardDimensions: CardDimensions | null;
  onSettingsChange: (settings: ExtractionSettings) => void;
}

/**
 * Individual card settings component for card-specific adjustments
 * 
 * Provides controls for image rotation and card cropping that apply to
 * individual cards after grid extraction, along with dimension display.
 */
export const IndividualCardSettings: React.FC<IndividualCardSettingsProps> = ({
  extractionSettings,
  cardDimensions,
  onSettingsChange
}) => {
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

  const handleResetAll = () => {
    const newSettings = {
      ...extractionSettings,
      cardCrop: { top: 0, right: 0, bottom: 0, left: 0 },
      imageRotation: { front: 0, back: 0 }
    };
    onSettingsChange(newSettings);
  };

  const hasCropActive = extractionSettings.cardCrop && (
    (extractionSettings.cardCrop.top > 0 || extractionSettings.cardCrop.right > 0 || 
     extractionSettings.cardCrop.bottom > 0 || extractionSettings.cardCrop.left > 0)
  );

  const totalCrop = hasCropActive ? 
    (extractionSettings.cardCrop.top || 0) + (extractionSettings.cardCrop.right || 0) + 
    (extractionSettings.cardCrop.bottom || 0) + (extractionSettings.cardCrop.left || 0) : 0;

  return (
    <>
      {/* Individual Card Settings */}
      <div className="border border-gray-200 rounded-lg p-4">
        <div className="flex justify-between items-center mb-3">
          <h4 className="text-sm font-medium text-gray-700">
            Individual Card Settings
          </h4>
          <button
            onClick={handleResetAll}
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
      {hasCropActive && (
        <div className="p-3 bg-orange-50 rounded-md">
          <div className="flex items-center">
            <span className="text-sm font-medium text-orange-800">
              Individual card cropping active
            </span>
          </div>
          <p className="text-xs text-orange-600 mt-1">
            {totalCrop} px total crop applied to each card.
          </p>
        </div>
      )}
    </>
  );
};