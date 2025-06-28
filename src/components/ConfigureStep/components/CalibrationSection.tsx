import React from 'react';
import { Printer, Ruler } from 'lucide-react';
import { DEFAULT_SETTINGS } from '../../../defaults';
import type { OutputSettings } from '../../../types';

interface CalibrationSectionProps {
  outputSettings: OutputSettings;
  viewMode: 'front' | 'back';
  onPrintCalibration: () => void;
  onShowCalibrationWizard: () => void;
  getRotationForCardType: (settings: OutputSettings, mode: 'front' | 'back') => number;
}

/**
 * Calibration section component for printer accuracy testing
 * 
 * Provides calibration workflow with test card generation and measurement
 * entry to iteratively improve printer accuracy and card positioning.
 */
export const CalibrationSection: React.FC<CalibrationSectionProps> = ({
  outputSettings,
  viewMode,
  onPrintCalibration,
  onShowCalibrationWizard,
  getRotationForCardType
}) => {
  return (
    <div>
      <h3 className="text-lg font-medium text-gray-800 mb-3">
        Printer Calibration
      </h3>
      <p className="text-sm text-gray-600 mb-2">
        Print a test card using your current settings to determine your printer's exact offset and scale. This creates a feedback loop to iteratively improve your settings.
      </p>
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 mb-4">
        <p className="text-xs text-gray-600">
          <span className="font-medium">Current calibration target:</span>{' '}
          {(() => {
            const cardWidthInches = outputSettings.cardSize?.widthInches || DEFAULT_SETTINGS.outputSettings.cardSize.widthInches;
            const cardHeightInches = outputSettings.cardSize?.heightInches || DEFAULT_SETTINGS.outputSettings.cardSize.heightInches;
            const scalePercent = outputSettings.cardScalePercent || DEFAULT_SETTINGS.outputSettings.cardScalePercent;
            const horizontalOffset = outputSettings.offset.horizontal || 0;
            const verticalOffset = outputSettings.offset.vertical || 0;
            const rotation = getRotationForCardType(outputSettings, viewMode);
            const sizingMode = outputSettings.cardImageSizingMode || DEFAULT_SETTINGS.outputSettings.cardImageSizingMode;
            
            const sizingModeText = sizingMode === 'actual-size' ? 'actual size' : 
                                 sizingMode === 'fit-to-card' ? 'fit to card' : 
                                 'fill card';
            
            return `${cardWidthInches.toFixed(2)}" × ${cardHeightInches.toFixed(2)}" card at ${scalePercent}% scale with ${horizontalOffset >= 0 ? '+' : ''}${horizontalOffset.toFixed(3)}", ${verticalOffset >= 0 ? '+' : ''}${verticalOffset.toFixed(3)}" offset, ${rotation}° rotation, ${sizingModeText} sizing (${viewMode} cards)`;
          })()}
        </p>
      </div>
      
      <div className="space-y-4">
        {/* Step 1: Print Calibration Card */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="text-sm font-medium text-blue-800 mb-2 flex items-center">
            <Printer size={16} className="mr-2" />
            Step 1: Print Current Settings Test Card
          </h4>
          <p className="text-sm text-blue-700 mb-3">
            Download and print a calibration card using your current settings. Use borderless mode and place poker card stock in the center of the media.
          </p>
          <button
            onClick={onPrintCalibration}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
          >
            Download Calibration PDF
          </button>
        </div>

        {/* Step 2: Measure and Enter Values */}
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <h4 className="text-sm font-medium text-green-800 mb-2 flex items-center">
            <Ruler size={16} className="mr-2" />
            Step 2: Measure and Refine Settings
          </h4>
          <p className="text-sm text-green-700 mb-3">
            Measure the printed card with a ruler and enter the values. The app will adjust your settings to improve alignment. Repeat until satisfied.
          </p>
          
          <button
            onClick={onShowCalibrationWizard}
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm"
          >
            Enter Measurements
          </button>
        </div>
      </div>
    </div>
  );
};