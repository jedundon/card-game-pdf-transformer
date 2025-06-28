import React from 'react';
import type { PdfMode } from '../../../types';

interface GutterSettingsProps {
  pdfMode: PdfMode;
  gutterWidth: number;
  onGutterWidthChange: (width: number) => void;
}

/**
 * Gutter configuration component for gutter-fold mode
 * 
 * Only displays when in gutter-fold mode. Provides controls for setting
 * the gutter width between front and back cards.
 */
export const GutterSettings: React.FC<GutterSettingsProps> = ({
  pdfMode,
  gutterWidth,
  onGutterWidthChange
}) => {
  // Only show for gutter-fold mode
  if (pdfMode.type !== 'gutter-fold') {
    return null;
  }

  return (
    <div>
      <h3 className="text-lg font-medium text-gray-800 mb-3">
        Gutter Settings
      </h3>
      <p className="text-sm text-gray-600 mb-3">
        Specify the width of the gutter area between front and back cards (in 300 DPI pixels)
      </p>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Gutter Width (px at 300 DPI)
        </label>
        <input 
          type="number" 
          min="0" 
          value={gutterWidth} 
          onChange={e => onGutterWidthChange(parseInt(e.target.value))} 
          className="w-full border border-gray-300 rounded-md px-3 py-2" 
        />
      </div>
      <p className="text-xs text-gray-500 mt-1">
        This area will be cropped out from the center of the page between front and back cards
      </p>
    </div>
  );
};