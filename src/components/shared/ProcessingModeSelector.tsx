/**
 * @fileoverview Processing Mode Selector Component
 * 
 * This component provides a dropdown interface for selecting processing modes
 * (Simplex, Duplex, Gutter-fold) and their sub-settings (Flip Edge or Orientation).
 * It's designed to be used in group headers to allow per-group processing settings.
 * 
 * **Key Features:**
 * - Compact dropdown interface suitable for table headers
 * - Dynamic sub-settings based on processing mode type
 * - Real-time validation and feedback
 * - Accessible keyboard navigation
 * 
 * @author Card Game PDF Transformer
 */

import React, { useState, useCallback } from 'react';
import { ChevronDown, Settings } from 'lucide-react';
import type { PdfMode } from '../../types';

interface ProcessingModeSelectorProps {
  /** Current processing mode configuration */
  processingMode: PdfMode;
  /** Callback when processing mode changes */
  onChange: (mode: PdfMode) => void;
  /** Whether the selector is disabled */
  disabled?: boolean;
  /** Optional label for the selector */
  label?: string;
  /** Size variant for different contexts */
  size?: 'sm' | 'md';
}

/**
 * Processing Mode Selector - Compact mode selector for group headers
 * 
 * Provides a dropdown interface for selecting processing modes with dynamic
 * sub-settings. Designed to be compact enough for use in table headers while
 * maintaining full functionality.
 */
export const ProcessingModeSelector: React.FC<ProcessingModeSelectorProps> = ({
  processingMode,
  onChange,
  disabled = false,
  label,
  size = 'sm'
}) => {
  const [isOpen, setIsOpen] = useState(false);

  // Get display name for current mode
  const getModeDisplayName = useCallback((mode: PdfMode): string => {
    switch (mode.type) {
      case 'simplex':
        return 'Simplex';
      case 'duplex':
        return `Duplex (${mode.flipEdge === 'short' ? 'Short Edge' : 'Long Edge'})`;
      case 'gutter-fold':
        return `Gutter-fold (${mode.orientation === 'vertical' ? 'Vertical' : 'Horizontal'})`;
      default:
        return 'Unknown';
    }
  }, []);

  // Handle mode type change
  const handleModeTypeChange = useCallback((newType: 'simplex' | 'duplex' | 'gutter-fold') => {
    let newMode: PdfMode;
    
    switch (newType) {
      case 'simplex':
        newMode = { type: 'simplex' };
        break;
      case 'duplex':
        newMode = { 
          type: 'duplex', 
          flipEdge: processingMode.flipEdge || 'short' 
        };
        break;
      case 'gutter-fold':
        newMode = { 
          type: 'gutter-fold', 
          orientation: processingMode.orientation || 'vertical' 
        };
        break;
      default:
        return;
    }
    
    onChange(newMode);
  }, [processingMode, onChange]);

  // Handle sub-setting change
  const handleSubSettingChange = useCallback((key: string, value: string) => {
    const newMode = { ...processingMode, [key]: value };
    onChange(newMode);
  }, [processingMode, onChange]);

  // Close dropdown when clicking outside
  const handleBlur = useCallback((e: React.FocusEvent) => {
    // Check if the new focus target is within our dropdown
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsOpen(false);
    }
  }, []);

  const buttonClasses = size === 'sm' 
    ? 'text-xs px-2 py-1' 
    : 'text-sm px-3 py-2';

  const iconSize = size === 'sm' ? 12 : 16;

  return (
    <div className="relative inline-block" onBlur={handleBlur}>
      {label && (
        <label className="block text-xs font-medium text-gray-700 mb-1">
          {label}
        </label>
      )}
      
      {/* Mode selector button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled}
        className={`
          inline-flex items-center justify-between bg-white border border-gray-300 rounded-md
          hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
          disabled:opacity-50 disabled:cursor-not-allowed transition-colors
          ${buttonClasses}
          min-w-0
        `}
        title={`Processing Mode: ${getModeDisplayName(processingMode)}`}
      >
        <div className="flex items-center space-x-1 min-w-0">
          <Settings size={iconSize} className="text-gray-500 flex-shrink-0" />
          <span className="truncate font-medium text-gray-900">
            {getModeDisplayName(processingMode)}
          </span>
        </div>
        <ChevronDown 
          size={iconSize} 
          className={`ml-1 text-gray-400 transition-transform flex-shrink-0 ${
            isOpen ? 'rotate-180' : ''
          }`} 
        />
      </button>

      {/* Dropdown menu */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-64 bg-white border border-gray-200 rounded-md shadow-lg z-50">
          <div className="p-3 space-y-3">
            {/* Mode type selection */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Processing Mode
              </label>
              <select
                value={processingMode.type}
                onChange={(e) => handleModeTypeChange(e.target.value as any)}
                className="w-full border border-gray-300 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={disabled}
              >
                <option value="simplex">Simplex (Single-sided)</option>
                <option value="duplex">Duplex (Double-sided)</option>
                <option value="gutter-fold">Gutter-fold</option>
              </select>
            </div>

            {/* Sub-settings based on mode type */}
            {processingMode.type === 'duplex' && (
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Flip Edge
                </label>
                <select
                  value={processingMode.flipEdge || 'short'}
                  onChange={(e) => handleSubSettingChange('flipEdge', e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={disabled}
                >
                  <option value="short">Short Edge</option>
                  <option value="long">Long Edge</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  {processingMode.flipEdge === 'short' 
                    ? 'Pages flip along the short edge' 
                    : 'Pages flip along the long edge'
                  }
                </p>
              </div>
            )}

            {processingMode.type === 'gutter-fold' && (
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Orientation
                </label>
                <select
                  value={processingMode.orientation || 'vertical'}
                  onChange={(e) => handleSubSettingChange('orientation', e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={disabled}
                >
                  <option value="vertical">Vertical (Left/Right split)</option>
                  <option value="horizontal">Horizontal (Top/Bottom split)</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  {processingMode.orientation === 'vertical' 
                    ? 'Cards are split vertically down the center' 
                    : 'Cards are split horizontally across the center'
                  }
                </p>
              </div>
            )}

            {processingMode.type === 'simplex' && (
              <div>
                <p className="text-xs text-gray-500">
                  Single-sided pages, each card appears once.
                </p>
              </div>
            )}

            {/* Close button */}
            <div className="pt-2 border-t border-gray-200">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="w-full text-center text-xs text-gray-600 hover:text-gray-800 py-1"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};