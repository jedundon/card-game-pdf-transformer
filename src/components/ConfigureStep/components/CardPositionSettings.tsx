import React from 'react';
import { MoveHorizontalIcon, MoveVerticalIcon } from 'lucide-react';
import type { OutputSettings } from '../../../types';

interface CardPositionSettingsProps {
  outputSettings: OutputSettings;
  onOffsetChange: (dimension: 'horizontal' | 'vertical', value: number) => void;
}

/**
 * Card position settings component for fine-tuning card placement
 * 
 * Provides controls for horizontal and vertical offset adjustments to help
 * with precise printer alignment and positioning on the output page.
 */
export const CardPositionSettings: React.FC<CardPositionSettingsProps> = ({
  outputSettings,
  onOffsetChange
}) => {
  return (
    <div>
      <h3 className="text-lg font-medium text-gray-800 mb-3">
        Card Position Offset
      </h3>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Horizontal (inches)
          </label>
          <div className="flex items-center">
            <MoveHorizontalIcon size={16} className="text-gray-400 mr-2" />
            <input 
              type="number" 
              step="0.001" 
              min="-2" 
              max="2" 
              value={outputSettings.offset.horizontal} 
              onChange={e => onOffsetChange('horizontal', parseFloat(e.target.value))} 
              className="w-full border border-gray-300 rounded-md px-3 py-2" 
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Vertical (inches)
          </label>
          <div className="flex items-center">
            <MoveVerticalIcon size={16} className="text-gray-400 mr-2" />
            <input 
              type="number" 
              step="0.001" 
              min="-2" 
              max="2" 
              value={outputSettings.offset.vertical} 
              onChange={e => onOffsetChange('vertical', parseFloat(e.target.value))} 
              className="w-full border border-gray-300 rounded-md px-3 py-2" 
            />
          </div>
        </div>
      </div>
    </div>
  );
};