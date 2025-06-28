import React from 'react';
import { DEFAULT_SETTINGS } from '../../../defaults';
import type { OutputSettings } from '../../../types';

interface CalibrationWizardModalProps {
  isOpen: boolean;
  outputSettings: OutputSettings;
  calibrationMeasurements: {
    rightDistance: string;
    topDistance: string;
    crosshairLength: string;
  };
  onClose: () => void;
  onApplyCalibration: () => void;
  onMeasurementChange: (field: string, value: string) => void;
}

/**
 * Calibration wizard modal for entering printer measurement data
 * 
 * Provides a guided interface for entering measurement data from printed
 * calibration cards to calculate and apply printer corrections.
 */
export const CalibrationWizardModal: React.FC<CalibrationWizardModalProps> = ({
  isOpen,
  outputSettings,
  calibrationMeasurements,
  onClose,
  onApplyCalibration,
  onMeasurementChange
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
      <div className="bg-white rounded-lg shadow-lg p-6 max-w-md w-full mx-4">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">
          Calibration Measurements
        </h3>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
          <h4 className="text-sm font-medium text-blue-800 mb-2">Simple 3-Measurement Guide</h4>
          <p className="text-sm text-blue-700 mb-2">
            Measure with a ruler from the <strong>center dot</strong> to the <strong>card edges</strong> and the <strong>crosshair end</strong>:
          </p>
          <div className="text-xs text-blue-600 space-y-1">
            <p>• <strong>Right edge:</strong> Distance from center dot to right edge of card</p>
            <p>• <strong>Top edge:</strong> Distance from center dot to top edge of card</p>
            <p>• <strong>Crosshair length:</strong> Length of crosshair arm (from center to end)</p>
          </div>
        </div>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Distance to Right Edge (inches)
            </label>
            <input
              type="number"
              step="0.01"
              value={calibrationMeasurements.rightDistance}
              onChange={(e) => onMeasurementChange('rightDistance', e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              placeholder="1.25"
            />
            <p className="text-xs text-gray-500 mt-1">
              Distance from center dot to right edge of card (expect ~{(outputSettings.cardSize?.widthInches || DEFAULT_SETTINGS.outputSettings.cardSize.widthInches) / 2}")
            </p>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Distance to Top Edge (inches)
            </label>
            <input
              type="number"
              step="0.01"
              value={calibrationMeasurements.topDistance}
              onChange={(e) => onMeasurementChange('topDistance', e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              placeholder="1.75"
            />
            <p className="text-xs text-gray-500 mt-1">
              Distance from center dot to top edge of card (expect ~{(outputSettings.cardSize?.heightInches || DEFAULT_SETTINGS.outputSettings.cardSize.heightInches) / 2}")
            </p>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Crosshair Arm Length (inches)
            </label>
            <input
              type="number"
              step="0.001"
              value={calibrationMeasurements.crosshairLength}
              onChange={(e) => onMeasurementChange('crosshairLength', e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              placeholder="1.000"
            />
            <p className="text-xs text-gray-500 mt-1">
              Actual printed length of crosshair arm from center to end (expect ~1.0")
            </p>
          </div>
        </div>
        
        <div className="flex justify-end space-x-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
          >
            Cancel
          </button>
          <button
            onClick={onApplyCalibration}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Apply Adjustments
          </button>
        </div>
      </div>
    </div>
  );
};