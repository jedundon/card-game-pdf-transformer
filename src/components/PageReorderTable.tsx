/**
 * @fileoverview Page reordering table component with drag-and-drop functionality
 * 
 * This component provides an enhanced page management interface that allows users
 * to reorder pages through drag-and-drop interactions. It replaces the simple
 * page settings table in the ImportStep for multi-file workflows.
 * 
 * **Key Features:**
 * - Drag-and-drop page reordering with visual feedback
 * - Real-time card numbering updates during reordering
 * - File source tracking and display
 * - Enhanced thumbnails with hover previews
 * - Keyboard accessibility for reordering operations
 * - Bulk selection and operations
 * 
 * **Design Principles:**
 * - Card numbers update dynamically as pages are reordered
 * - Visual feedback during drag operations
 * - Maintains source file information during reordering
 * - Accessible via keyboard shortcuts
 * - Mobile-friendly touch support
 * 
 * @author Card Game PDF Transformer
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { GripVertical, FileIcon, ImageIcon, XIcon, ChevronUpIcon, ChevronDownIcon, RotateCcwIcon, Plus, Users, Tag } from 'lucide-react';
import { 
  PageSettings, 
  PageSource, 
  PdfMode, 
  PageReorderState,
  PageGroup,
  PageTypeSettings
} from '../types';
import { 
  // calculateCardNumbersForReorderedPages // Removed - card numbers not available until extraction settings
} from '../utils/cardUtils';
import { 
  reorderPages,
  createInitialPageOrder 
} from '../utils/pageReorderUtils';
import {
  handleDragStart,
  handleDragOver,
  handleDragEnd,
  createKeyboardHandlers,
  throttleDragEvents
} from '../utils/dragDropUtils';
import { usePageSelection } from '../hooks/usePageSelection';
import { useOperationHistory } from '../hooks/useOperationHistory';
import { usePageGrouping } from '../hooks/usePageGrouping';
import { BatchOperationToolbar } from './shared/BatchOperationToolbar';

interface PageReorderTableProps {
  /** Combined pages from all imported files with source tracking */
  pages: (PageSettings & PageSource)[];
  /** Current PDF processing mode affecting card numbering */
  pdfMode: PdfMode;
  /** Callback when pages are reordered */
  onPagesReorder: (newPages: (PageSettings & PageSource)[]) => void;
  /** Callback when a page's settings are changed */
  onPageSettingsChange: (pageIndex: number, settings: Partial<PageSettings>) => void;
  /** Callback when a page is removed */
  onPageRemove: (pageIndex: number) => void;
  /** Callback to reset page order to original import order */
  onResetToImportOrder?: () => void;
  /** Whether pages have been reordered from original import order */
  isPagesReordered?: boolean;
  /** Map of page thumbnails (page index -> data URL) */
  thumbnails: Record<number, string>;
  /** Map of thumbnail loading states */
  thumbnailLoading: Record<number, boolean>;
  /** Map of thumbnail error states */
  thumbnailErrors: Record<number, boolean>;
  /** Callback to load a thumbnail for a specific page */
  onThumbnailLoad: (pageIndex: number) => void;
  
  /** Page type settings for dropdowns and auto-detection */
  pageTypeSettings: Record<string, PageTypeSettings>;
  /** Page groups for group assignment */
  pageGroups: PageGroup[];
  /** Callback when page groups change */
  onPageGroupsChange: (groups: PageGroup[]) => void;
  /** Callback when multiple pages are updated (for batch operations) */
  onPagesUpdate: (updatedPages: (PageSettings & PageSource)[]) => void;
  /** Whether the component is disabled */
  disabled?: boolean;
}

/**
 * Enhanced page management table with drag-and-drop reordering
 * 
 * Provides a comprehensive interface for managing pages from multiple files
 * with real-time card numbering and visual reordering capabilities.
 */
export const PageReorderTable: React.FC<PageReorderTableProps> = ({
  pages,
  pdfMode,
  onPagesReorder,
  onPageSettingsChange,
  onPageRemove,
  onResetToImportOrder,
  isPagesReordered = false,
  thumbnails,
  thumbnailLoading,
  thumbnailErrors,
  onThumbnailLoad,
  pageTypeSettings,
  pageGroups,
  onPageGroupsChange,
  onPagesUpdate,
  disabled = false
}) => {
  // Drag and drop state
  const [dragState, setDragState] = useState<PageReorderState>({
    dragIndex: null,
    hoverIndex: null,
    isDragging: false,
    pageOrder: createInitialPageOrder(pages.length)
  });

  // Thumbnail popup state
  const [hoveredThumbnail, setHoveredThumbnail] = useState<number | null>(null);
  
  // Ref for the table container
  const tableRef = useRef<HTMLTableSectionElement>(null);
  
  // Row height for drop position calculations
  const ROW_HEIGHT = 64; // Approximate height of table rows in pixels

  // Page selection functionality
  const pageSelection = usePageSelection({
    pages,
    maxSelections: pages.length,
    persistSelection: false
  });

  // Operation history for undo/redo
  const operationHistory = useOperationHistory<(PageSettings & PageSource)[]>({
    initialState: pages,
    maxHistorySize: 20
  });

  // Page grouping functionality
  const pageGrouping = usePageGrouping({
    pages,
    initialGroups: pageGroups,
    onGroupsChange: onPageGroupsChange
  });

  // Group creation modal state
  const [showGroupModal, setShowGroupModal] = useState(false);

  // Handlers for integrated functionality
  const handlePagesUpdate = useCallback((updatedPages: (PageSettings & PageSource)[]) => {
    operationHistory.saveState(pages);
    onPagesUpdate(updatedPages);
  }, [pages, operationHistory, onPagesUpdate]);

  const handleGroupsChange = useCallback((groups: PageGroup[]) => {
    onPageGroupsChange(groups);
  }, [onPageGroupsChange]);

  const handleConfirmOperation = useCallback((operation: string, details: any) => {
    console.log(`Confirmed operation: ${operation}`, details);
  }, []);

  const handleUndo = useCallback(() => {
    const previousState = operationHistory.undo();
    if (previousState) {
      onPagesUpdate(previousState);
    }
  }, [operationHistory, onPagesUpdate]);

  const handleRedo = useCallback(() => {
    const nextState = operationHistory.redo();
    if (nextState) {
      onPagesUpdate(nextState);
    }
  }, [operationHistory, onPagesUpdate]);

  // Handle page type change
  const handlePageTypeChange = useCallback((pageIndex: number, pageType: string) => {
    const updatedPages = pages.map((page, index) =>
      index === pageIndex ? { ...page, pageType } : page
    );
    handlePagesUpdate(updatedPages);
  }, [pages, handlePagesUpdate]);

  // Handle group assignment
  const handleGroupAssignment = useCallback((pageIndex: number, groupId: string | null) => {
    const updatedGroups = pageGrouping.assignPagesToGroup([pageIndex], groupId);
    onPageGroupsChange(updatedGroups);
  }, [pageGrouping, onPageGroupsChange]);

  // Card numbers not available until extraction settings are configured
  // const cardsPerPage = gridSettings.rows * gridSettings.columns;
  // const cardNumbers = calculateCardNumbersForReorderedPages(
  //   pages,
  //   pdfMode,
  //   cardsPerPage
  // );

  // Update drag state when pages array changes
  useEffect(() => {
    setDragState(prev => ({
      ...prev,
      pageOrder: createInitialPageOrder(pages.length)
    }));
  }, [pages.length]);

  // Drag state tracking is working correctly - debug logs removed

  // Throttled drag over handler for performance
  const throttledDragOver = useCallback(
    throttleDragEvents((event: MouseEvent | TouchEvent) => {
      setDragState(currentDragState => {
        if (!tableRef.current || !currentDragState.isDragging) return currentDragState;
        
        const newState = handleDragOver(event, tableRef.current, ROW_HEIGHT, currentDragState, pages.length);
        // Drag over tracking is working correctly
        return newState;
      });
    }, 16),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pages.length] // pages.length dependency is correctly included; throttleDragEvents dependencies are handled internally
  );

  // Handle start of drag operation
  const handleDragStartForPage = useCallback((pageIndex: number, event: React.MouseEvent | React.TouchEvent) => {
    event.preventDefault();
    setDragState(currentDragState => {
      const newState = handleDragStart(event.nativeEvent, pageIndex, currentDragState);
      return newState;
    });
  }, []); // No dependencies - use functional state update

  // Handle end of drag operation
  const handleDragEndForTable = useCallback(() => {
    setDragState(currentDragState => {
      const result = handleDragEnd(currentDragState);
      
      if (result.shouldReorder && result.fromIndex !== null && result.toIndex !== null) {
        const reorderedPages = reorderPages(pages, result.fromIndex, result.toIndex);
        onPagesReorder(reorderedPages);
      }
      
      return result.newState;
    });
  }, [pages, onPagesReorder]); // Keep pages and onPagesReorder as dependencies

  // Set up global mouse/touch event listeners during drag
  useEffect(() => {
    if (!dragState.isDragging) return;

    const handleMouseMove = (event: MouseEvent) => {
      throttledDragOver(event);
    };

    const handleTouchMove = (event: TouchEvent) => {
      throttledDragOver(event);
    };

    const handleMouseUp = () => {
      handleDragEndForTable();
    };

    const handleTouchEnd = () => {
      handleDragEndForTable();
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('touchmove', handleTouchMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('touchend', handleTouchEnd);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [dragState.isDragging, throttledDragOver, handleDragEndForTable]);

  // Keyboard handlers for accessibility
  const createKeyboardHandlersForPage = useCallback((pageIndex: number) => {
    return createKeyboardHandlers(
      () => {
        // Move up
        if (pageIndex > 0) {
          const reorderedPages = reorderPages(pages, pageIndex, pageIndex - 1);
          onPagesReorder(reorderedPages);
        }
      },
      () => {
        // Move down
        if (pageIndex < pages.length - 1) {
          const reorderedPages = reorderPages(pages, pageIndex, pageIndex + 1);
          onPagesReorder(reorderedPages);
        }
      },
      () => {
        // Confirm position (no action needed for this implementation)
      }
    );
  }, [pages, onPagesReorder]);

  // Handle card type change (front/back)
  const handleCardTypeChange = useCallback((pageIndex: number, type: string) => {
    onPageSettingsChange(pageIndex, { type: type as 'front' | 'back' });
  }, [onPageSettingsChange]);

  // Handle page skip change
  const handlePageSkipChange = useCallback((pageIndex: number, skip: boolean) => {
    onPageSettingsChange(pageIndex, { skip });
  }, [onPageSettingsChange]);

  // Load thumbnail on row render
  const handleThumbnailRequest = useCallback((pageIndex: number) => {
    if (!thumbnails[pageIndex] && !thumbnailLoading[pageIndex] && !thumbnailErrors[pageIndex]) {
      onThumbnailLoad(pageIndex);
    }
  }, [thumbnails, thumbnailLoading, thumbnailErrors, onThumbnailLoad]);

  // Effect to load visible thumbnails
  useEffect(() => {
    pages.forEach((_, index) => {
      handleThumbnailRequest(index);
    });
  }, [pages, handleThumbnailRequest]);

  // Render file type icon
  const renderFileTypeIcon = (fileType: 'pdf' | 'image') => {
    if (fileType === 'pdf') {
      return <FileIcon size={16} className="text-red-600" />;
    } else {
      return <ImageIcon size={16} className="text-green-600" />;
    }
  };

  // Card numbers removed - not available until extraction settings are configured
  // const renderCardNumbers = (pageIndex: number) => {
  //   const pageCardNumbers = cardNumbers.get(pageIndex) || [];
  //   if (pageCardNumbers.length === 0) {
  //     return <span className="text-gray-400 italic">Skipped</span>;
  //   }
  //   
  //   if (pageCardNumbers.length === 1) {
  //     return <span className="text-gray-900 font-medium">Card {pageCardNumbers[0]}</span>;
  //   }
  //   
  //   const first = pageCardNumbers[0];
  //   const last = pageCardNumbers[pageCardNumbers.length - 1];
  //   return <span className="text-gray-900 font-medium">Cards {first}-{last}</span>;
  // };

  // Render thumbnail cell
  const renderThumbnail = (pageIndex: number) => {
    if (thumbnailLoading[pageIndex]) {
      return (
        <div className="w-12 h-16 bg-gray-100 border border-gray-200 rounded flex items-center justify-center">
          <div className="animate-spin w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full"></div>
        </div>
      );
    }
    
    if (thumbnailErrors[pageIndex]) {
      return (
        <div className="w-12 h-16 bg-gray-100 border border-gray-200 rounded flex items-center justify-center">
          <span className="text-xs text-gray-400">Error</span>
        </div>
      );
    }
    
    if (thumbnails[pageIndex]) {
      return (
        <img
          src={thumbnails[pageIndex]}
          alt={`Page ${pageIndex + 1} preview`}
          className="w-12 h-16 border border-gray-200 rounded cursor-pointer hover:border-blue-300 transition-colors"
          onClick={() => setHoveredThumbnail(pageIndex)}
          title={`Click to view larger preview of page ${pageIndex + 1}`}
        />
      );
    }
    
    return (
      <div className="w-12 h-16 bg-gray-50 border border-gray-200 rounded flex items-center justify-center">
        <span className="text-xs text-gray-400">...</span>
      </div>
    );
  };

  // Calculate drop line position
  const getDropLineStyle = () => {
    if (!dragState.isDragging || dragState.hoverIndex === null || !tableRef.current) {
      return { display: 'none' };
    }
    
    // Get the container and table elements for positioning
    const tableContainer = tableRef.current.closest('.relative') as HTMLElement;
    const table = tableRef.current.closest('table') as HTMLTableElement;
    
    if (!tableContainer || !table) {
      return { display: 'none' };
    }
    
    const containerRect = tableContainer.getBoundingClientRect();
    const tbodyRect = tableRef.current.getBoundingClientRect();
    
    // Get the table header height
    const thead = table.querySelector('thead');
    const theadHeight = thead ? thead.getBoundingClientRect().height : 0;
    
    // Calculate position based on hover index using actual row positions
    let topPosition: number;
    
    // Check if container is positioned at tbody level (common case)
    const containerAtTbodyLevel = Math.abs(containerRect.top - tbodyRect.top) < 1;
    const headerOffset = containerAtTbodyLevel ? theadHeight : 0;
    
    if (dragState.hoverIndex === 0) {
      // Drop at the beginning - position at the top of the first row
      topPosition = headerOffset;
    } else if (dragState.hoverIndex >= pages.length) {
      // Drop at the end - position at the bottom of the last row
      const rows = tableRef.current.querySelectorAll('tr');
      if (rows.length > 0) {
        const lastRowRect = rows[rows.length - 1].getBoundingClientRect();
        topPosition = (lastRowRect.bottom - containerRect.top) + headerOffset;
      } else {
        topPosition = (tbodyRect.bottom - containerRect.top) + headerOffset;
      }
    } else {
      // Drop between rows - position above the target row using actual row positions
      const rows = tableRef.current.querySelectorAll('tr');
      if (rows[dragState.hoverIndex]) {
        const targetRowRect = rows[dragState.hoverIndex].getBoundingClientRect();
        // Position the line at the top of the target row
        topPosition = (targetRowRect.top - containerRect.top) + headerOffset;
      } else {
        // Fallback: use the previous row's bottom position
        const prevRowIndex = Math.min(dragState.hoverIndex - 1, rows.length - 1);
        if (rows[prevRowIndex]) {
          const prevRowRect = rows[prevRowIndex].getBoundingClientRect();
          topPosition = (prevRowRect.bottom - containerRect.top) + headerOffset;
        } else {
          // Final fallback: position at the end
          topPosition = (tbodyRect.bottom - containerRect.top) + headerOffset;
        }
      }
    }
    
    return {
      position: 'absolute' as const,
      top: topPosition,
      left: 0,
      right: 0,
      height: '2px',
      backgroundColor: '#3b82f6',
      zIndex: 1000,
      pointerEvents: 'none' as const
    };
  };

  if (pages.length === 0) {
    return (
      <div className="text-center text-gray-500 py-8">
        No pages to display. Import some files to get started.
      </div>
    );
  }

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-medium text-gray-800">
          Page Management & Reordering
        </h3>
        {onResetToImportOrder && pages.length > 1 && isPagesReordered && (
          <button
            onClick={onResetToImportOrder}
            className="inline-flex items-center px-3 py-1 text-xs bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 border border-gray-300 transition-colors"
            title="Reset page order to original import order"
          >
            <RotateCcwIcon size={12} className="mr-1" />
            Reset to Import Order
          </button>
        )}
      </div>
      
      {/* Batch Operations Toolbar */}
      {pageSelection.selectionState.hasSelection && (
        <div className="mb-4">
          <BatchOperationToolbar
            selectedPages={pageSelection.getSelectedPages()}
            allPages={pages}
            pageTypeSettings={pageTypeSettings}
            onPagesUpdate={handlePagesUpdate}
            onConfirmOperation={handleConfirmOperation}
            canUndo={operationHistory.canUndo}
            canRedo={operationHistory.canRedo}
            onUndo={handleUndo}
            onRedo={handleRedo}
          />
        </div>
      )}

      <div className="border border-gray-200 rounded-md overflow-hidden relative">
        {/* Drop line indicator */}
        <div style={getDropLineStyle()} />
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-8">
                {/* Drag handle column */}
              </th>
              <th className="px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-10">
                <input
                  type="checkbox"
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  checked={pageSelection.selectionState.isAllSelected}
                  onChange={(e) => {
                    if (e.target.checked) {
                      pageSelection.selectAll();
                    } else {
                      pageSelection.clearSelection();
                    }
                  }}
                  disabled={disabled}
                />
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Page
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Preview
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Source
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Page Type
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Group
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Type
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Skip
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-16">
                Actions
              </th>
            </tr>
          </thead>
          <tbody ref={tableRef} className="bg-white divide-y divide-gray-200 relative">
            
            {pages.map((page, index) => {
              const keyboardHandlers = createKeyboardHandlersForPage(index);
              const isDraggedItem = dragState.dragIndex === index;
              
              return (
                <tr 
                  key={`${page.fileName}-${page.originalPageIndex}-${index}`}
                  className={`
                    transition-opacity duration-200
                    ${isDraggedItem ? 'opacity-50' : 'opacity-100'}
                    ${dragState.hoverIndex === index ? 'bg-blue-50' : 'hover:bg-gray-50'}
                  `}
                >
                  {/* Drag handle */}
                  <td className="px-3 py-4 whitespace-nowrap">
                    <div
                      className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 transition-colors"
                      onMouseDown={(e) => handleDragStartForPage(index, e)}
                      onTouchStart={(e) => handleDragStartForPage(index, e)}
                      tabIndex={0}
                      onKeyDown={(e) => keyboardHandlers.handleKeyDown(e.nativeEvent)}
                      title="Drag to reorder pages, or use arrow keys"
                    >
                      <GripVertical size={16} />
                    </div>
                  </td>

                  {/* Selection checkbox */}
                  <td className="px-2 py-4 whitespace-nowrap text-center">
                    <input
                      type="checkbox"
                      className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      checked={pageSelection.selectionState.selectedPages.has(index)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          pageSelection.togglePageSelection(index, true);
                        } else {
                          pageSelection.togglePageSelection(index, false);
                        }
                      }}
                      disabled={disabled}
                    />
                  </td>

                  {/* Page number */}
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                    {index + 1}
                  </td>

                  {/* Preview thumbnail */}
                  <td className="px-2 py-2 whitespace-nowrap">
                    <div className="relative inline-block">
                      {renderThumbnail(index)}
                    </div>
                  </td>

                  {/* Source file information */}
                  <td className="px-4 py-4 whitespace-nowrap text-sm">
                    <div className="flex items-center space-x-2">
                      {renderFileTypeIcon(page.fileType)}
                      <div className="min-w-0">
                        <div className="text-gray-900 font-medium truncate max-w-48" title={`${page.fileName} - Page ${page.originalPageIndex + 1}`}>
                          {/* Show abbreviated filename for multi-file clarity */}
                          {page.fileName.length > 20 
                            ? `${page.fileName.substring(0, 15)}...${page.fileName.slice(-4)}`
                            : page.fileName
                          }
                        </div>
                        <div className="text-gray-500 text-xs">
                          Page {page.originalPageIndex + 1}
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Page Type dropdown (card/rule/skip) */}
                  <td className="px-4 py-4 whitespace-nowrap text-sm">
                    <select
                      value={page.pageType || 'card'}
                      onChange={(e) => handlePageTypeChange(index, e.target.value)}
                      className="border border-gray-300 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      disabled={disabled}
                    >
                      {Object.entries(pageTypeSettings).map(([type, settings]) => (
                        <option key={type} value={type}>
                          {settings.displayName}
                        </option>
                      ))}
                    </select>
                  </td>

                  {/* Group assignment */}
                  <td className="px-4 py-4 whitespace-nowrap text-sm">
                    <div className="flex items-center space-x-2">
                      <select
                        value={pageGrouping.getPageGroup(index)?.id || ''}
                        onChange={(e) => handleGroupAssignment(index, e.target.value || null)}
                        className="border border-gray-300 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        disabled={disabled}
                      >
                        <option value="">No Group</option>
                        {pageGroups.map((group) => (
                          <option key={group.id} value={group.id}>
                            {group.name}
                          </option>
                        ))}
                      </select>
                      {pageGroups.length === 0 && (
                        <button
                          onClick={() => setShowGroupModal(true)}
                          className="p-1 text-gray-400 hover:text-indigo-600"
                          title="Create new group"
                          disabled={disabled}
                        >
                          <Plus size={14} />
                        </button>
                      )}
                    </div>
                  </td>

                  {/* Page type (front/back) */}
                  <td className="px-4 py-4 whitespace-nowrap text-sm">
                    {pdfMode.type === 'duplex' && !page?.skip ? (
                      <select 
                        value={page?.type || 'front'} 
                        onChange={e => handleCardTypeChange(index, e.target.value)} 
                        className="border border-gray-300 rounded px-2 py-1 text-sm"
                      >
                        <option value="front">Front</option>
                        <option value="back">Back</option>
                      </select>
                    ) : pdfMode.type === 'gutter-fold' && !page?.skip ? (
                      <span className="text-gray-600">Front & Back</span>
                    ) : page?.skip ? (
                      <span className="text-gray-400 italic">Skipped</span>
                    ) : (
                      <span className="text-gray-600">Front</span>
                    )}
                  </td>

                  {/* Skip checkbox */}
                  <td className="px-4 py-4 whitespace-nowrap text-sm">
                    <input 
                      type="checkbox" 
                      checked={page?.skip || false} 
                      onChange={e => handlePageSkipChange(index, e.target.checked)} 
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" 
                    />
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-4 whitespace-nowrap text-sm">
                    <div className="flex items-center space-x-1">
                      <button
                        onClick={() => {
                          if (index > 0) {
                            const reorderedPages = reorderPages(pages, index, index - 1);
                            onPagesReorder(reorderedPages);
                          }
                        }}
                        disabled={index === 0}
                        className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-50"
                        title="Move up"
                      >
                        <ChevronUpIcon size={14} />
                      </button>
                      <button
                        onClick={() => {
                          if (index < pages.length - 1) {
                            const reorderedPages = reorderPages(pages, index, index + 1);
                            onPagesReorder(reorderedPages);
                          }
                        }}
                        disabled={index === pages.length - 1}
                        className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-50"
                        title="Move down"
                      >
                        <ChevronDownIcon size={14} />
                      </button>
                      <button
                        onClick={() => onPageRemove(index)}
                        className="p-1 text-red-400 hover:text-red-600"
                        title="Remove page"
                      >
                        <XIcon size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Summary information */}
      <div className="mt-4 text-sm text-gray-600">
        <p>
          {pages.length} pages total • 
          {' '}{pages.filter(p => !p.skip).length} active • 
          {' '}{pages.filter(p => p.skip).length} skipped
        </p>
        <p className="text-xs text-gray-500 mt-1">
          Drag pages to reorder them. Card numbering will be calculated during extraction.
        </p>
      </div>

      {/* Thumbnail Popup */}
      {hoveredThumbnail !== null && thumbnails[hoveredThumbnail] && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.3)' }}
          onClick={() => setHoveredThumbnail(null)}
        >
          <div 
            className="bg-white border border-gray-300 rounded-lg shadow-xl p-4 max-w-[95vw] max-h-[95vh] overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-medium text-gray-800">
                Page {hoveredThumbnail + 1} Preview
                {pages[hoveredThumbnail] && (
                  <span className="ml-2 text-gray-600">
                    ({pages[hoveredThumbnail].fileName})
                  </span>
                )}
              </h4>
              <button
                onClick={() => setHoveredThumbnail(null)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <XIcon size={16} />
              </button>
            </div>
            <img
              src={thumbnails[hoveredThumbnail]}
              alt={`Page ${hoveredThumbnail + 1} preview`}
              className="w-auto h-auto border border-gray-200 rounded"
              style={{
                maxWidth: 'min(600px, 90vw)',
                maxHeight: 'min(600px, 90vh)'
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};