/**
 * @fileoverview Batch Operation Toolbar Component
 * 
 * This component provides a comprehensive toolbar for performing batch operations
 * on selected pages in the unified page management system. It supports rotation,
 * scaling, cropping, type changes, and deletion operations.
 * 
 * **Key Features:**
 * - Batch rotation (90°, 180°, 270°)
 * - Batch scaling and crop adjustments
 * - Batch page type changes
 * - Batch skip/include toggle
 * - Batch deletion with confirmation
 * - Operation history for undo/redo
 * 
 * @author Card Game PDF Transformer
 */

import React, { useState, useCallback } from 'react';
import { 
  RotateCw, 
  RotateCcw, 
  Flip, 
  ZoomIn, 
  ZoomOut, 
  Crop,
  Eye,
  EyeOff,
  Trash2,
  ChevronDown,
  Undo,
  Redo
} from 'lucide-react';
import { PageSettings, PageSource, PageTypeSettings } from '../../types';

interface BatchOperation {
  type: 'rotation' | 'scaling' | 'crop' | 'pageType' | 'skip' | 'delete';
  description: string;
  icon: React.ReactNode;
  action: () => void;
  destructive?: boolean;
  requiresConfirmation?: boolean;
}

interface BatchOperationToolbarProps {
  /** Currently selected pages */
  selectedPages: (PageSettings & PageSource)[];
  /** All available pages (for context) */
  allPages: (PageSettings & PageSource)[];
  /** Page type settings */
  pageTypeSettings: Record<string, PageTypeSettings>;
  /** Callback when pages are updated */
  onPagesUpdate: (pages: (PageSettings & PageSource)[]) => void;
  /** Callback when operation needs confirmation */
  onConfirmOperation?: (operation: string, callback: () => void) => void;
  /** Whether operations are disabled */
  disabled?: boolean;
  /** Available operation history */
  canUndo?: boolean;
  canRedo?: boolean;
  /** Undo/redo callbacks */
  onUndo?: () => void;
  onRedo?: () => void;
}

/**
 * Batch Operation Toolbar Component
 * 
 * Provides a comprehensive set of batch operations for page management.
 */
export const BatchOperationToolbar: React.FC<BatchOperationToolbarProps> = ({
  selectedPages,
  allPages,
  pageTypeSettings,
  onPagesUpdate,
  onConfirmOperation,
  disabled = false,
  canUndo = false,
  canRedo = false,
  onUndo,
  onRedo
}) => {
  const [showAdvancedMenu, setShowAdvancedMenu] = useState(false);
  const [showPageTypeMenu, setShowPageTypeMenu] = useState(false);

  /**
   * Apply operation to selected pages
   */
  const applyOperation = useCallback((operation: (page: PageSettings & PageSource) => PageSettings & PageSource) => {
    const selectedIndices = new Set(
      selectedPages.map(selectedPage => 
        allPages.findIndex(page => 
          page.fileName === selectedPage.fileName && 
          page.originalPageIndex === selectedPage.originalPageIndex
        )
      )
    );

    const updatedPages = allPages.map((page, index) => {
      if (selectedIndices.has(index)) {
        return operation(page);
      }
      return page;
    });

    onPagesUpdate(updatedPages);
  }, [selectedPages, allPages, onPagesUpdate]);

  /**
   * Rotation operations
   */
  const rotatePages = useCallback((degrees: number) => {
    applyOperation(page => ({
      ...page,
      // Store rotation information (will be handled by processing pipeline)
      rotation: ((page.rotation || 0) + degrees) % 360
    }));
  }, [applyOperation]);

  /**
   * Scaling operations
   */
  const scalePages = useCallback((scaleFactor: number) => {
    applyOperation(page => ({
      ...page,
      // Store scaling information (will be handled by processing pipeline)
      scale: ((page.scale || 1) * scaleFactor)
    }));
  }, [applyOperation]);

  /**
   * Page type operations
   */
  const setPageType = useCallback((pageType: 'card' | 'rule' | 'skip') => {
    applyOperation(page => ({
      ...page,
      pageType,
      skip: pageType === 'skip' ? true : false
    }));
    setShowPageTypeMenu(false);
  }, [applyOperation]);

  /**
   * Skip/Include toggle
   */
  const toggleSkip = useCallback(() => {
    applyOperation(page => ({
      ...page,
      skip: !page.skip
    }));
  }, [applyOperation]);

  /**
   * Delete pages operation
   */
  const deletePages = useCallback(() => {
    const deleteOperation = () => {
      const selectedSet = new Set(
        selectedPages.map(selectedPage => 
          `${selectedPage.fileName}-${selectedPage.originalPageIndex}`
        )
      );

      const remainingPages = allPages.filter(page => 
        !selectedSet.has(`${page.fileName}-${page.originalPageIndex}`)
      );

      onPagesUpdate(remainingPages);
    };

    if (onConfirmOperation) {
      onConfirmOperation(
        `Delete ${selectedPages.length} selected pages? This action cannot be undone.`,
        deleteOperation
      );
    } else {
      deleteOperation();
    }
  }, [selectedPages, allPages, onPagesUpdate, onConfirmOperation]);

  /**
   * Generate batch operations
   */
  const batchOperations: BatchOperation[] = [
    // Rotation operations
    {
      type: 'rotation',
      description: 'Rotate 90° clockwise',
      icon: <RotateCw className="w-4 h-4" />,
      action: () => rotatePages(90)
    },
    {
      type: 'rotation',
      description: 'Rotate 90° counter-clockwise',
      icon: <RotateCcw className="w-4 h-4" />,
      action: () => rotatePages(-90)
    },
    {
      type: 'rotation',
      description: 'Rotate 180°',
      icon: <Flip className="w-4 h-4" />,
      action: () => rotatePages(180)
    },
    // Scaling operations
    {
      type: 'scaling',
      description: 'Scale up (110%)',
      icon: <ZoomIn className="w-4 h-4" />,
      action: () => scalePages(1.1)
    },
    {
      type: 'scaling',
      description: 'Scale down (90%)',
      icon: <ZoomOut className="w-4 h-4" />,
      action: () => scalePages(0.9)
    },
    // Visibility operations
    {
      type: 'skip',
      description: 'Toggle skip/include',
      icon: selectedPages.some(p => p.skip) ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />,
      action: toggleSkip
    },
    // Delete operation
    {
      type: 'delete',
      description: 'Delete pages',
      icon: <Trash2 className="w-4 h-4" />,
      action: deletePages,
      destructive: true,
      requiresConfirmation: true
    }
  ];

  if (selectedPages.length === 0) {
    return null;
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <h3 className="text-sm font-medium text-gray-900">
            Batch Operations
          </h3>
          <span className="px-2 py-1 bg-indigo-100 text-indigo-800 text-xs rounded-md">
            {selectedPages.length} selected
          </span>
        </div>

        {/* Undo/Redo controls */}
        {(onUndo || onRedo) && (
          <div className="flex items-center space-x-1">
            <button
              onClick={onUndo}
              disabled={!canUndo || disabled}
              className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Undo last operation"
            >
              <Undo className="w-4 h-4" />
            </button>
            <button
              onClick={onRedo}
              disabled={!canRedo || disabled}
              className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Redo last operation"
            >
              <Redo className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Quick actions */}
      <div className="flex flex-wrap gap-2 mb-4">
        {batchOperations.slice(0, 4).map((operation, index) => (
          <button
            key={index}
            onClick={operation.action}
            disabled={disabled}
            className={`
              flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors
              ${operation.destructive
                ? 'text-red-700 bg-red-50 hover:bg-red-100 border border-red-200'
                : 'text-gray-700 bg-gray-50 hover:bg-gray-100 border border-gray-200'
              }
              disabled:opacity-50 disabled:cursor-not-allowed
            `}
            title={operation.description}
          >
            {operation.icon}
            <span className="hidden sm:inline">{operation.description}</span>
          </button>
        ))}

        {/* Page type selector */}
        <div className="relative">
          <button
            onClick={() => setShowPageTypeMenu(!showPageTypeMenu)}
            disabled={disabled}
            className="flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 border border-gray-200 disabled:opacity-50"
          >
            <Crop className="w-4 h-4" />
            <span className="hidden sm:inline">Set Type</span>
            <ChevronDown className="w-3 h-3" />
          </button>

          {showPageTypeMenu && (
            <div className="absolute top-full left-0 mt-1 w-48 bg-white rounded-md shadow-lg z-10 border border-gray-200">
              <div className="py-1">
                {Object.values(pageTypeSettings).map((typeSettings) => (
                  <button
                    key={typeSettings.pageType}
                    onClick={() => setPageType(typeSettings.pageType)}
                    className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    <span 
                      className="w-3 h-3 rounded-full mr-2"
                      style={{ backgroundColor: typeSettings.colorScheme.primary }}
                    />
                    {typeSettings.displayName}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Advanced operations */}
      <div className="border-t border-gray-200 pt-4">
        <button
          onClick={() => setShowAdvancedMenu(!showAdvancedMenu)}
          className="flex items-center space-x-2 text-sm text-gray-600 hover:text-gray-900"
        >
          <ChevronDown className={`w-4 h-4 transform transition-transform ${showAdvancedMenu ? 'rotate-180' : ''}`} />
          <span>Advanced Operations</span>
        </button>

        {showAdvancedMenu && (
          <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-2">
            {batchOperations.slice(4).map((operation, index) => (
              <button
                key={index}
                onClick={operation.action}
                disabled={disabled}
                className={`
                  flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors
                  ${operation.destructive
                    ? 'text-red-700 bg-red-50 hover:bg-red-100 border border-red-200'
                    : 'text-gray-700 bg-gray-50 hover:bg-gray-100 border border-gray-200'
                  }
                  disabled:opacity-50 disabled:cursor-not-allowed
                `}
                title={operation.description}
              >
                {operation.icon}
                <span>{operation.description}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Operation summary */}
      <div className="mt-4 p-3 bg-gray-50 rounded-md">
        <div className="text-xs text-gray-600">
          <div className="flex items-center justify-between">
            <span>Pages ready for processing: {selectedPages.filter(p => !p.skip).length}</span>
            <span>Skipped: {selectedPages.filter(p => p.skip).length}</span>
          </div>
          <div className="mt-1 flex items-center space-x-4">
            {Object.values(pageTypeSettings).map(typeSettings => {
              const count = selectedPages.filter(p => p.pageType === typeSettings.pageType).length;
              if (count === 0) return null;
              return (
                <span key={typeSettings.pageType} className="flex items-center space-x-1">
                  <span 
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: typeSettings.colorScheme.primary }}
                  />
                  <span>{typeSettings.displayName}: {count}</span>
                </span>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};