/**
 * @fileoverview Group Selector Dropdown Component
 * 
 * A dedicated dropdown component for selecting page groups with clear visual
 * indicators, status information, and intuitive interaction patterns.
 * 
 * **Key Features:**
 * - Proper dropdown affordance (not cycling button)
 * - Group status indicators (configured, page count, processing mode)
 * - Visual group colors and clear hierarchy
 * - Keyboard navigation support
 * - Accessibility compliant
 * 
 * @author Card Game PDF Transformer
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  ChevronDown,
  CheckCircle,
  AlertCircle,
  Circle,
  Users,
  Settings
} from 'lucide-react';
import { PageGroup, PdfMode } from '../../../types';

// Constants for default group
const DEFAULT_GROUP_ID = 'default';

interface GroupOption {
  id: string | null;
  name: string;
  pageCount: number;
  color?: string;
  isConfigured: boolean;
  hasSettings: boolean;
  processingMode: PdfMode;
}

interface GroupSelectorProps {
  /** All available groups */
  groups: PageGroup[];
  /** Currently active group ID (null for default group) */
  activeGroupId: string | null;
  /** Group status information */
  groupOptions: GroupOption[];
  /** Callback when group selection changes */
  onGroupSelect: (groupId: string | null) => void;
  /** Whether the selector is disabled */
  disabled?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Format processing mode for display
 */
function formatProcessingMode(mode: PdfMode): string {
  const typeMap = {
    'simplex': 'Simplex',
    'duplex': 'Duplex',
    'gutter-fold': 'Gutter-fold'
  };
  
  let displayName = typeMap[mode.type] || mode.type;
  
  if (mode.type === 'duplex' && mode.flipEdge) {
    displayName += ` (${mode.flipEdge} edge)`;
  } else if (mode.type === 'gutter-fold' && mode.orientation) {
    displayName += ` (${mode.orientation})`;
  }
  
  return displayName;
}

/**
 * Get status icon for a group
 */
function getStatusIcon(option: GroupOption) {
  if (option.isConfigured) {
    return <CheckCircle className="w-4 h-4 text-green-500" />;
  } else if (option.hasSettings) {
    return <AlertCircle className="w-4 h-4 text-yellow-500" />;
  } else {
    return <Circle className="w-4 h-4 text-gray-400" />;
  }
}

/**
 * Group Selector Dropdown Component
 */
export const GroupSelector: React.FC<GroupSelectorProps> = ({
  groups,
  activeGroupId,
  groupOptions,
  onGroupSelect,
  disabled = false,
  className = ''
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Find current group
  const currentGroup = groupOptions.find(option => 
    (activeGroupId === null && option.id === DEFAULT_GROUP_ID) || 
    option.id === activeGroupId
  ) || groupOptions[0];

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // Handle keyboard navigation and shortcuts
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (disabled) return;

      // Global keyboard shortcuts for group switching (Ctrl+1, Ctrl+2, etc.)
      if (event.ctrlKey && !isOpen && !event.shiftKey && !event.altKey) {
        const num = parseInt(event.key);
        if (num >= 1 && num <= 9) {
          const targetGroup = groupOptions[num - 1];
          if (targetGroup) {
            event.preventDefault();
            const targetId = targetGroup.id === DEFAULT_GROUP_ID ? null : targetGroup.id;
            onGroupSelect(targetId);
            return;
          }
        }
      }

      // Dropdown-specific navigation
      if (!isOpen) return;

      switch (event.key) {
        case 'Escape':
          setIsOpen(false);
          buttonRef.current?.focus();
          break;
        case 'ArrowUp':
        case 'ArrowDown': {
          event.preventDefault();
          // Navigate through options with arrow keys
          const currentIndex = groupOptions.findIndex(option => 
            (activeGroupId === null && option.id === DEFAULT_GROUP_ID) || 
            option.id === activeGroupId
          );
          
          let newIndex;
          if (event.key === 'ArrowUp') {
            newIndex = currentIndex > 0 ? currentIndex - 1 : groupOptions.length - 1;
          } else {
            newIndex = currentIndex < groupOptions.length - 1 ? currentIndex + 1 : 0;
          }
          
          const newGroup = groupOptions[newIndex];
          if (newGroup) {
            const newId = newGroup.id === DEFAULT_GROUP_ID ? null : newGroup.id;
            onGroupSelect(newId);
          }
          break;
        }
        case 'Enter':
        case ' ':
          event.preventDefault();
          setIsOpen(false);
          buttonRef.current?.focus();
          break;
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, disabled, groupOptions, activeGroupId, onGroupSelect]);

  const handleToggle = () => {
    if (!disabled) {
      setIsOpen(!isOpen);
    }
  };

  const handleSelect = (groupId: string | null) => {
    onGroupSelect(groupId);
    setIsOpen(false);
    buttonRef.current?.focus();
  };

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {/* Dropdown Button */}
      <button
        ref={buttonRef}
        onClick={handleToggle}
        disabled={disabled}
        className={`
          flex items-center justify-between w-full min-w-[200px] px-3 py-2 
          border border-gray-300 rounded-md text-sm bg-white hover:bg-gray-50 
          focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500
          transition-colors
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
          ${isOpen ? 'ring-2 ring-indigo-500 border-indigo-500' : ''}
        `}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <div className="flex items-center space-x-2 min-w-0 flex-1">
          {/* Current group indicator */}
          {currentGroup.color && (
            <div
              className="w-3 h-3 rounded-full flex-shrink-0"
              style={{ backgroundColor: currentGroup.color }}
            />
          )}
          <Users className="w-4 h-4 text-gray-500 flex-shrink-0" />
          <span className="font-medium text-gray-900 truncate">
            {currentGroup.name}
          </span>
          <span className="text-gray-500 flex-shrink-0">
            ({currentGroup.pageCount})
          </span>
        </div>
        <ChevronDown 
          className={`w-4 h-4 text-gray-400 transition-transform ${
            isOpen ? 'transform rotate-180' : ''
          }`} 
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg">
          <div className="py-1 max-h-64 overflow-y-auto">
            {groupOptions.map((option) => {
              const isSelected = (activeGroupId === null && option.id === DEFAULT_GROUP_ID) || 
                                option.id === activeGroupId;
              const isDefault = option.id === DEFAULT_GROUP_ID;
              
              return (
                <button
                  key={option.id || 'default'}
                  onClick={() => handleSelect(option.id === DEFAULT_GROUP_ID ? null : option.id)}
                  className={`
                    w-full px-3 py-2 text-left hover:bg-gray-50 focus:bg-gray-50 
                    focus:outline-none transition-colors
                    ${isSelected ? 'bg-indigo-50 border-r-2 border-indigo-500' : ''}
                  `}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2 min-w-0 flex-1">
                      {/* Status icon */}
                      {getStatusIcon(option)}
                      
                      {/* Group color indicator */}
                      {option.color && (
                        <div
                          className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{ backgroundColor: option.color }}
                        />
                      )}
                      
                      {/* Group name */}
                      <span className={`text-sm truncate ${
                        isSelected ? 'font-medium text-indigo-900' : 'text-gray-900'
                      }`}>
                        {option.name}
                        {isDefault && (
                          <span className="text-xs text-gray-500 ml-1">(ungrouped)</span>
                        )}
                      </span>
                    </div>

                    <div className="flex items-center space-x-2 flex-shrink-0">
                      {/* Page count */}
                      <span className="text-xs text-gray-500">
                        {option.pageCount} pages
                      </span>
                      
                      {/* Processing mode indicator */}
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                        {formatProcessingMode(option.processingMode)}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
          
          {/* Separator and actions */}
          {groups.length > 0 && (
            <div className="border-t border-gray-100 py-1">
              <div className="px-3 py-2 text-xs text-gray-500 space-y-1">
                <div>
                  <Settings className="w-3 h-3 inline mr-1" />
                  Settings apply to selected group only
                </div>
                <div className="text-gray-400">
                  Tip: Use Ctrl+1, Ctrl+2, etc. for quick switching
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default GroupSelector;