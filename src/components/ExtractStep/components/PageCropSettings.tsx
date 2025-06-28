import React from 'react';
import { MoveIcon } from 'lucide-react';
import type { PdfMode } from '../../../types';

interface CropSettings {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

interface PageCropSettingsProps {
  crop: CropSettings;
  pdfMode: PdfMode;
  gutterWidth?: number;
  onCropChange: (edge: string, value: number) => void;
}

/**
 * Page cropping configuration component
 * 
 * Provides controls for setting page margins to crop from each edge,
 * with a total crop indicator that includes gutter width for gutter-fold mode.
 */
export const PageCropSettings: React.FC<PageCropSettingsProps> = ({
  crop,
  pdfMode,
  gutterWidth = 0,
  onCropChange
}) => {
  const totalCrop = crop.top + crop.right + crop.bottom + crop.left;
  const hasGutter = pdfMode.type === 'gutter-fold' && gutterWidth > 0;

  return (
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
          <input 
            type="number" 
            value={crop.top} 
            onChange={e => onCropChange('top', parseInt(e.target.value))} 
            className="w-full border border-gray-300 rounded-md px-3 py-2" 
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Right Margin
          </label>
          <input 
            type="number" 
            value={crop.right} 
            onChange={e => onCropChange('right', parseInt(e.target.value))} 
            className="w-full border border-gray-300 rounded-md px-3 py-2" 
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Bottom Margin
          </label>
          <input 
            type="number" 
            value={crop.bottom} 
            onChange={e => onCropChange('bottom', parseInt(e.target.value))} 
            className="w-full border border-gray-300 rounded-md px-3 py-2" 
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Left Margin
          </label>
          <input 
            type="number" 
            value={crop.left} 
            onChange={e => onCropChange('left', parseInt(e.target.value))} 
            className="w-full border border-gray-300 rounded-md px-3 py-2" 
          />
        </div>
      </div>

      {/* Total crop indicator */}
      <div className="flex items-center justify-between p-3 bg-gray-50 rounded-md mt-4">
        <div className="flex items-center">
          <MoveIcon size={16} className="text-gray-600 mr-2" />
          <span className="text-sm text-gray-600">
            Total crop applied: {totalCrop}px (300 DPI)
            {hasGutter && (
              <>
                {' + '}
                {gutterWidth}px gutter
              </>
            )}
          </span>
        </div>
      </div>
    </div>
  );
};