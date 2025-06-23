import React, { useState, useRef, useEffect, useCallback } from 'react';
import { getTransformationRange } from '../utils/colorUtils';

interface PrecisionSliderInputProps {
  /**
   * The current value of the slider
   */
  value: number;
  
  /**
   * The transformation type (e.g., 'brightness', 'contrast', etc.)
   * Used to determine min/max/step values and formatting
   */
  type: string;
  
  /**
   * Callback fired when the value changes
   */
  onChange: (value: number) => void;
  
  /**
   * Optional label text (defaults to capitalized type)
   */
  label?: string;
  
  /**
   * Optional CSS classes for styling
   */
  className?: string;
  
  /**
   * Optional custom label color class (e.g., 'text-red-600')
   */
  labelColorClass?: string;
  
  /**
   * Optional double-click handler for reset functionality
   */
  onDoubleClick?: () => void;
}

/**
 * A precision slider input component that displays a formatted value as clickable text,
 * and transforms into an inline input field when clicked for precise value entry.
 */
export const PrecisionSliderInput: React.FC<PrecisionSliderInputProps> = ({
  value,
  type,
  onChange,
  label,
  className = '',
  labelColorClass = 'text-gray-600',
  onDoubleClick
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  
  // Get transformation range for this type
  const range = getTransformationRange(type);
  
  // Format value for display based on transformation type
  const formatValue = useCallback((val: number): string => {
    switch (type) {
      case 'brightness':
      case 'saturation':
      case 'hue':
      case 'vibrance':
      case 'shadows':
      case 'highlights':
      case 'midtoneBalance': {
        // Show decimals if they exist, otherwise show integers
        const roundedVal = Math.round(val * 100) / 100;
        const displayVal = roundedVal % 1 === 0 ? Math.round(roundedVal) : roundedVal.toFixed(2);
        return `${roundedVal >= 0 ? '+' : ''}${displayVal}${range.unit}`;
      }
      case 'contrast':
      case 'gamma':
      case 'redMultiplier':
      case 'greenMultiplier':
      case 'blueMultiplier':
        // Always show 2 decimal places for multipliers
        return `${val.toFixed(2)}${range.unit}`;
      case 'blackPoint':
      case 'whitePoint':
      case 'outputBlack':
      case 'outputWhite': {
        // Show decimals if they exist, otherwise show integers  
        const roundedLevelVal = Math.round(val * 100) / 100;
        const displayLevelVal = roundedLevelVal % 1 === 0 ? Math.round(roundedLevelVal) : roundedLevelVal.toFixed(2);
        return `${displayLevelVal}${range.unit}`;
      }
      default:
        return `${val.toFixed(2)}${range.unit}`;
    }
  }, [type, range.unit]);
  
  // Parse input value back to number
  const parseValue = useCallback((input: string): number | null => {
    // Remove non-numeric characters except decimal point, minus sign, and plus sign
    const cleanInput = input.replace(/[^\d.+-]/g, '');
    const parsed = parseFloat(cleanInput);
    
    if (isNaN(parsed)) {
      return null;
    }
    
    return parsed;
  }, []);
  
  // Validate value against range constraints
  const validateValue = useCallback((val: number): string => {
    if (val < range.min) {
      return `Value must be at least ${range.min}${range.unit}`;
    }
    if (val > range.max) {
      return `Value must be at most ${range.max}${range.unit}`;
    }
    return '';
  }, [range.min, range.max, range.unit]);
  
  // Enter edit mode
  const startEditing = useCallback(() => {
    setIsEditing(true);
    setInputValue(value.toString());
    setError('');
  }, [value]);
  
  // Exit edit mode and save if valid
  const finishEditing = useCallback((save = true) => {
    if (save && inputValue.trim()) {
      const parsed = parseValue(inputValue);
      if (parsed !== null) {
        const validationError = validateValue(parsed);
        if (!validationError) {
          // Clamp value to range but allow higher precision than slider step
          const clampedValue = Math.max(range.min, Math.min(range.max, parsed));
          
          // For precise input, round to 2 decimal places instead of slider step
          // This allows fine-tuning beyond what the slider can provide
          const preciseValue = Math.round(clampedValue * 100) / 100;
          
          onChange(preciseValue);
        } else {
          setError(validationError);
          return; // Don't exit edit mode if there's an error
        }
      } else {
        setError('Invalid number format');
        return; // Don't exit edit mode if there's an error
      }
    }
    
    setIsEditing(false);
    setInputValue('');
    setError('');
  }, [inputValue, parseValue, validateValue, range.min, range.max, onChange]);
  
  // Handle key presses in edit mode
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      finishEditing(true);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      finishEditing(false);
    }
  }, [finishEditing]);
  
  // Handle input value changes
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
    setError(''); // Clear error when user starts typing
  }, []);
  
  // Handle input blur (focus lost)
  const handleInputBlur = useCallback(() => {
    finishEditing(true);
  }, [finishEditing]);
  
  // Handle label click to start editing
  const handleLabelClick = useCallback(() => {
    if (!isEditing) {
      startEditing();
    }
  }, [isEditing, startEditing]);
  
  // Handle double-click for reset functionality
  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    if (!isEditing && onDoubleClick) {
      e.preventDefault();
      onDoubleClick();
    }
  }, [isEditing, onDoubleClick]);
  
  // Focus input when entering edit mode
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);
  
  // Generate label text
  const labelText = label || type.charAt(0).toUpperCase() + type.slice(1);
  
  return (
    <div className={className}>
      <label className={`block text-xs font-medium ${labelColorClass} mb-1`}>
        {labelText}: {' '}
        {isEditing ? (
          <span className="relative inline-block">
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              onBlur={handleInputBlur}
              className={`inline-block min-w-[60px] px-1 py-0 border rounded text-xs font-normal ${
                error ? 'border-red-500 bg-red-50' : 'border-blue-500 bg-blue-50'
              }`}
              aria-label={`Enter precise value for ${labelText}`}
            />
            {error && (
              <div className="absolute top-full left-0 z-10 mt-1 p-1 text-xs text-red-700 bg-red-100 border border-red-300 rounded shadow-lg whitespace-nowrap">
                {error}
              </div>
            )}
          </span>
        ) : (
          <span
            onClick={handleLabelClick}
            onDoubleClick={handleDoubleClick}
            className="cursor-pointer hover:text-blue-600 hover:underline transition-colors"
            title="Click to enter precise value (up to 2 decimal places), double-click to reset"
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                startEditing();
              }
            }}
            aria-label={`${labelText} value: ${formatValue(value)}. Click to edit precisely.`}
          >
            {formatValue(value)}
          </span>
        )}
      </label>
    </div>
  );
};