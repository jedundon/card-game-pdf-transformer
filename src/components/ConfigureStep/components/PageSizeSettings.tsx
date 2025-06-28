import React from 'react';
import type { OutputSettings } from '../../../types';

interface PageSizeSettingsProps {
  outputSettings: OutputSettings;
  onPageSizeChange: (dimension: string, value: number | { width: number; height: number }) => void;
}

/**
 * Page size settings component for output format configuration
 * 
 * Provides controls for setting custom page dimensions and quick preset buttons
 * for common page sizes like Letter, A4, and square formats.
 */
export const PageSizeSettings: React.FC<PageSizeSettingsProps> = ({
  outputSettings,
  onPageSizeChange
}) => {
  return (
    <div>
      <h3 className="text-lg font-medium text-gray-800 mb-3">
        Output Page Size
      </h3>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Width (inches)
          </label>
          <input 
            type="number" 
            step="0.1" 
            min="1" 
            max="12" 
            value={outputSettings.pageSize.width} 
            onChange={e => onPageSizeChange('width', parseFloat(e.target.value))} 
            className="w-full border border-gray-300 rounded-md px-3 py-2" 
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Height (inches)
          </label>
          <input 
            type="number" 
            step="0.1" 
            min="1" 
            max="12" 
            value={outputSettings.pageSize.height} 
            onChange={e => onPageSizeChange('height', parseFloat(e.target.value))} 
            className="w-full border border-gray-300 rounded-md px-3 py-2" 
          />
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          onClick={() => onPageSizeChange('preset', { width: 3.5, height: 3.5 })}
          className="px-3 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50"
        >
          Square (3.5×3.5")
        </button>
        <button
          onClick={() => onPageSizeChange('preset', { width: 8.5, height: 11 })}
          className="px-3 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50"
        >
          Letter (8.5×11")
        </button>
        <button
          onClick={() => onPageSizeChange('preset', { width: 8.27, height: 11.69 })}
          className="px-3 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50"
        >
          A4 (8.27×11.69")
        </button>
      </div>
    </div>
  );
};