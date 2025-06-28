import React from 'react';
import { getDefaultGrid } from '../../defaults';
import type { PdfMode } from '../../types';

interface ProcessingModeSelectorProps {
  pdfMode: PdfMode;
  onModeSelect: (mode: PdfMode) => void;
  hasFiles: boolean;
}

/**
 * Processing mode selector component for PDF import configuration
 * 
 * Provides controls for selecting processing mode (duplex/gutter-fold), flip edge,
 * and orientation settings. Displays grid information for the selected mode.
 */
export const ProcessingModeSelector: React.FC<ProcessingModeSelectorProps> = ({
  pdfMode,
  onModeSelect,
  hasFiles
}) => {
  const handleModeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const type = e.target.value as 'duplex' | 'gutter-fold';
    onModeSelect({
      ...pdfMode,
      type
    });
  };

  const handleOrientationChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const orientation = e.target.value as 'vertical' | 'horizontal';
    onModeSelect({
      ...pdfMode,
      orientation
    });
  };

  const handleFlipEdgeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const flipEdge = e.target.value as 'short' | 'long';
    onModeSelect({
      ...pdfMode,
      flipEdge
    });
  };

  if (!hasFiles) return null;

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Processing Mode
          </label>
          <select 
            value={pdfMode.type} 
            onChange={handleModeChange} 
            className="w-full border border-gray-300 rounded-md px-3 py-2"
          >
            <option value="duplex">
              Duplex (fronts and backs on alternate pages)
            </option>
            <option value="gutter-fold">
              Gutter-fold (fronts and backs on same page)
            </option>
          </select>
        </div>
        {pdfMode.type === 'duplex' ? (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Flip Edge
            </label>
            <select 
              value={pdfMode.flipEdge} 
              onChange={handleFlipEdgeChange} 
              className="w-full border border-gray-300 rounded-md px-3 py-2"
            >
              <option value="short">Short Edge</option>
              <option value="long">Long Edge</option>
            </select>
          </div>
        ) : (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Orientation
            </label>
            <select 
              value={pdfMode.orientation} 
              onChange={handleOrientationChange} 
              className="w-full border border-gray-300 rounded-md px-3 py-2"
            >
              <option value="vertical">Vertical</option>
              <option value="horizontal">Horizontal</option>
            </select>
          </div>
        )}
      </div>
      
      {/* Grid Information */}
      <div className="p-4 bg-blue-50 rounded-md">
        <h4 className="text-sm font-medium text-blue-800 mb-2">
          Default Card Grid for Selected Mode
        </h4>
        <div className="text-sm text-blue-700">
          {(() => {
            const grid = getDefaultGrid(pdfMode);
            return `${grid.rows} rows × ${grid.columns} columns (${grid.rows * grid.columns} cards per page)`;
          })()}
        </div>
        <p className="text-xs text-blue-600 mt-1">
          You can adjust these settings in the next step if needed.
        </p>
      </div>
    </>
  );
};