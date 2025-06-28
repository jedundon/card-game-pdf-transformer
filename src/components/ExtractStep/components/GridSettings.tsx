import React from 'react';
import { LayoutGridIcon } from 'lucide-react';

interface GridSettingsProps {
  grid: {
    rows: number;
    columns: number;
  };
  onGridChange: (dimension: 'rows' | 'columns', value: number) => void;
}

/**
 * Grid configuration component for card extraction layout
 * 
 * Provides controls for setting the number of rows and columns in the card grid,
 * along with a visual indicator of total cards per page.
 */
export const GridSettings: React.FC<GridSettingsProps> = ({
  grid,
  onGridChange
}) => {
  const totalCards = grid.rows * grid.columns;

  return (
    <div>
      <h3 className="text-lg font-medium text-gray-800 mb-3">
        Card Grid
      </h3>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Rows
          </label>
          <input 
            type="number" 
            min="1" 
            max="10" 
            value={grid.rows} 
            onChange={e => onGridChange('rows', parseInt(e.target.value))} 
            className="w-full border border-gray-300 rounded-md px-3 py-2" 
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Columns
          </label>
          <input 
            type="number" 
            min="1" 
            max="10" 
            value={grid.columns} 
            onChange={e => onGridChange('columns', parseInt(e.target.value))} 
            className="w-full border border-gray-300 rounded-md px-3 py-2" 
          />
        </div>
      </div>

      {/* Cards per page indicator */}
      <div className="flex items-center p-3 bg-gray-50 rounded-md mt-4">
        <LayoutGridIcon size={16} className="text-gray-600 mr-2" />
        <span className="text-sm text-gray-600">
          {totalCards} cards per page
        </span>
      </div>
    </div>
  );
};