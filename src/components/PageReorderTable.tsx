/**
 * @fileoverview Page reordering table component with drag-and-drop functionality
 * 
 * This component provides an enhanced page management interface that allows users
 * to reorder pages through drag-and-drop interactions. It replaces the simple
 * page settings table in the ImportStep for multi-file workflows.
 * 
 * **Key Features:**
 * - Boundary-based drag detection: drag within table for reordering, drag outside for inter-group movement
 * - Real-time visual feedback with drop lines and group highlighting
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

import React, { useState, useCallback, useRef, useEffect, flushSync } from 'react';
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
  
  /** Current group ID (for group-specific tables) */
  currentGroupId?: string;
  /** Callback when a page should be moved to a different group */
  onPageGroupChange?: (pageIndex: number, targetGroupId: string | null) => void;
  
  /** Inter-group drag and drop props */
  onInterGroupDragStart?: (localIndex: number) => void;
  onInterGroupDragEnd?: () => void;
  isDraggingBetweenGroups?: boolean;
  draggedPageInfo?: { localIndex: number; globalIndex: number; sourceGroupId: string } | null;
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
  disabled = false,
  currentGroupId,
  onPageGroupChange,
  onInterGroupDragStart,
  onInterGroupDragEnd,
  isDraggingBetweenGroups = false,
  draggedPageInfo
}) => {
  // Drag and drop state
  const [dragState, setDragState] = useState<PageReorderState>(() => ({
    dragIndex: null,
    hoverIndex: null,
    isDragging: false,
    pageOrder: createInitialPageOrder(pages.length)
  }));

  // Thumbnail popup state
  const [hoveredThumbnail, setHoveredThumbnail] = useState<number | null>(null);
  
  // Ref for the table container
  const tableRef = useRef<HTMLTableSectionElement>(null);
  
  // Track when drag has exited table boundaries (for inter-group detection)
  const [hasExitedTableBounds, setHasExitedTableBounds] = useState<boolean>(false);
  
  // Row height for drop position calculations
  const ROW_HEIGHT = 64; // Approximate height of table rows in pixels

  // Page selection functionality
  const pageSelection = usePageSelection({
    pages,
    maxSelections: pages.length,
    persistSelection: false
  });

  // Operation history for undo/redo
  const operationHistory = useOperationHistory({
    maxHistorySize: 20
  });

  // Page grouping functionality
  const pageGrouping = usePageGrouping(pageGroups, {
    maxGroups: 50,
    defaultGroupColor: '#3b82f6',
    autoExpandNew: true
  });

  // Group creation modal state
  const [showGroupModal, setShowGroupModal] = useState(false);

  // Handlers for integrated functionality
  const handlePagesUpdate = useCallback((updatedPages: (PageSettings & PageSource)[]) => {
    operationHistory.recordOperation(
      'Update pages',
      pages,
      updatedPages,
      'modify'
    );
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
    // Use the new callback if available (group-specific tables)
    if (onPageGroupChange) {
      onPageGroupChange(pageIndex, groupId);
    } else {
      // Fallback: manage group assignments directly with props
      let updatedGroups = [...pageGroups];
      
      // Remove page from all current groups
      updatedGroups = updatedGroups.map(group => ({
        ...group,
        pageIndices: group.pageIndices.filter(idx => idx !== pageIndex),
        modifiedAt: Date.now()
      }));
      
      // Add page to target group (if not default/null)
      if (groupId && groupId !== 'default') {
        const targetGroupIndex = updatedGroups.findIndex(g => g.id === groupId);
        if (targetGroupIndex !== -1) {
          updatedGroups[targetGroupIndex] = {
            ...updatedGroups[targetGroupIndex],
            pageIndices: [...updatedGroups[targetGroupIndex].pageIndices, pageIndex],
            modifiedAt: Date.now()
          };
        }
      }
      
      onPageGroupsChange(updatedGroups);
    }
  }, [pageGroups, onPageGroupsChange, onPageGroupChange]);

  // Card numbers not available until extraction settings are configured
  // const cardsPerPage = gridSettings.rows * gridSettings.columns;
  // const cardNumbers = calculateCardNumbersForReorderedPages(
  //   pages,
  //   pdfMode,
  //   cardsPerPage
  // );

  // Update drag state when pages array changes
  useEffect(() => {
    setDragState(prev => {
      // Only update if the length actually changed
      if (prev.pageOrder.length !== pages.length) {
        return {
          ...prev,
          pageOrder: createInitialPageOrder(pages.length)
        };
      }
      return prev;
    });
  }, [pages.length]);

  // Drag state tracking is working correctly - debug logs removed

  // Throttled drag over handler with boundary detection
  const throttledDragOver = useCallback(
    throttleDragEvents((event: MouseEvent | TouchEvent) => {
      setDragState(currentDragState => {
        if (!tableRef.current || !currentDragState.isDragging) return currentDragState;
        
        // Check if mouse has moved outside table boundaries
        if (onInterGroupDragStart) {
          const clientX = 'touches' in event ? event.touches[0].clientX : event.clientX;
          const clientY = 'touches' in event ? event.touches[0].clientY : event.clientY;
          
          // Get the table container bounds (use the table element, not just tbody)
          const table = tableRef.current.closest('table');
          if (table) {
            const tableBounds = table.getBoundingClientRect();
            const isOutsideBounds = (
              clientX < tableBounds.left ||
              clientX > tableBounds.right ||
              clientY < tableBounds.top ||
              clientY > tableBounds.bottom
            );
            
            // If mouse moved outside table and we haven't detected this yet
            if (isOutsideBounds && !hasExitedTableBounds) {
              setHasExitedTableBounds(true);
              
              // Schedule inter-group mode trigger after render completes
              if (onInterGroupDragStart && currentDragState.dragIndex !== null) {
                setTimeout(() => {
                  onInterGroupDragStart(currentDragState.dragIndex);
                }, 0);
              }
              
              // CRITICAL FIX: Clear dragIndex to prevent wrong row from being gray
              // When entering inter-group mode, we must clear local visual state
              // to prevent stale dragIndex from affecting pages after array updates
              return {
                ...currentDragState,
                dragIndex: null,   // Clear local drag index to prevent gray row issues
                hoverIndex: null,  // Remove drop line
                isDragging: false  // Clear local dragging state since inter-group takes over
              };
            }
            
            // If back inside bounds, ensure we're in intra-group mode
            if (!isOutsideBounds && hasExitedTableBounds) {
              setHasExitedTableBounds(false);
            }
          }
        }
        
        // Continue with normal intra-group drag if we haven't exited bounds
        if (!hasExitedTableBounds) {
          const newState = handleDragOver(event, tableRef.current, ROW_HEIGHT, currentDragState, pages.length);
          return newState;
        }
        
        return currentDragState;
      });
    }, 16),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pages.length, onInterGroupDragStart, hasExitedTableBounds] // Added dependencies for boundary detection
  );

  // Handle start of drag operation for reordering within group
  const handleDragStartForPage = useCallback((pageIndex: number, event: React.MouseEvent | React.TouchEvent) => {
    event.preventDefault();
    
    // Reset boundary detection state for new drag
    setHasExitedTableBounds(false);
    
    setDragState(currentDragState => {
      const newState = handleDragStart(event.nativeEvent, pageIndex, currentDragState);
      return newState;
    });
  }, []);
  
  // Handle HTML5 drag start for inter-group operations
  const handleHTML5DragStart = useCallback((pageIndex: number, event: React.DragEvent) => {
    if (onInterGroupDragStart) {
      // Prevent mouse drag events from interfering
      event.stopPropagation();
      
      // Set comprehensive drag data for HTML5 drag and drop
      const page = pages[pageIndex];
      const dragData = {
        localIndex: pageIndex,
        page: page,
        sourceGroupId: currentGroupId || 'default',
        timestamp: Date.now()
      };
      
      // Set multiple data formats for compatibility
      event.dataTransfer.setData('text/plain', JSON.stringify(dragData));
      event.dataTransfer.setData('application/json', JSON.stringify(dragData));
      event.dataTransfer.setData('text/x-page-index', pageIndex.toString());
      event.dataTransfer.effectAllowed = 'move';
      
      // Create a custom drag image with page info
      if (page) {
        const dragPreview = document.createElement('div');
        dragPreview.className = 'bg-blue-100 border border-blue-300 rounded-md p-3 text-sm text-blue-800 shadow-lg max-w-xs';
        dragPreview.innerHTML = `
          <div class="flex items-center space-x-2">
            <div class="w-4 h-4 bg-blue-500 rounded-full flex-shrink-0"></div>
            <div class="flex-1 min-w-0">
              <div class="font-medium truncate">${page.fileName}</div>
              <div class="text-xs text-blue-600">Page ${page.originalPageIndex + 1} • ${page.fileType.toUpperCase()}</div>
            </div>
          </div>
        `;
        dragPreview.style.position = 'absolute';
        dragPreview.style.top = '-1000px';
        dragPreview.style.left = '-1000px';
        dragPreview.style.zIndex = '1000';
        dragPreview.style.pointerEvents = 'none';
        document.body.appendChild(dragPreview);
        
        try {
          event.dataTransfer.setDragImage(dragPreview, 80, 30);
        } catch (e) {
          console.warn('Failed to set drag image:', e);
        }
        
        // Clean up the drag preview after a short delay
        setTimeout(() => {
          if (document.body.contains(dragPreview)) {
            document.body.removeChild(dragPreview);
          }
        }, 150);
      }
      
      // Start inter-group drag tracking
      onInterGroupDragStart(pageIndex);
    }
  }, [onInterGroupDragStart, pages, currentGroupId]);
  
  // Handle HTML5 drag end for inter-group operations
  const handleHTML5DragEnd = useCallback(() => {
    if (onInterGroupDragEnd) {
      onInterGroupDragEnd();
    }
  }, [onInterGroupDragEnd]);

  // Handle end of drag operation for reordering within group
  const handleDragEndForTable = useCallback(() => {
    // ENHANCED FIX: Use flushSync to ensure local drag state is cleared immediately
    // This prevents any visual artifacts from stale local drag state
    flushSync(() => {
      setDragState(currentDragState => {
        const result = handleDragEnd(currentDragState);
        
        // Only perform reorder if we haven't exited table bounds (intra-group reordering)
        // If we exited bounds, the PageGroupsManager handles the inter-group transfer
        if (result.shouldReorder && result.fromIndex !== null && result.toIndex !== null && !hasExitedTableBounds) {
          // Use a ref to access current pages to avoid dependency issues
          const currentPages = pages;
          const reorderedPages = reorderPages(currentPages, result.fromIndex, result.toIndex);
          
          // Schedule the reorder callback to run after state update is complete
          setTimeout(() => {
            onPagesReorder(reorderedPages);
          }, 0);
        }
        
        return result.newState;
      });
    });
    
    // CRITICAL FIX: Always call inter-group drag end when we had exited table bounds
    // This ensures the parent PageGroupsManager cleans up its drag state even for canceled drags
    // At this point, local drag state is guaranteed to be cleared
    if (hasExitedTableBounds && onInterGroupDragEnd) {
      onInterGroupDragEnd();
    }
    
    // Reset boundary detection state after processing
    setHasExitedTableBounds(false);
  }, [hasExitedTableBounds, onInterGroupDragEnd, pages, onPagesReorder]); // Add missing dependencies

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

    // Handle escape key to cancel drag operations
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        handleDragEndForTable();
      }
    };

    // Handle mouse leaving the viewport to cancel inter-group drags
    const handleMouseLeave = (event: MouseEvent) => {
      // Only trigger on document/viewport leave, not individual element leave
      if (event.target === document.documentElement || event.target === document.body) {
        if (hasExitedTableBounds) {
          // If we were in inter-group drag mode and mouse left viewport, cancel the drag
          handleDragEndForTable();
        }
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('touchmove', handleTouchMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('touchend', handleTouchEnd);
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('touchend', handleTouchEnd);
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [dragState.isDragging, throttledDragOver, handleDragEndForTable, hasExitedTableBounds]);

  // Keyboard handlers for accessibility
  const createKeyboardHandlersForPage = useCallback((pageIndex: number) => {
    return createKeyboardHandlers(
      () => {
        // Move up
        if (pageIndex > 0) {
          const currentPages = pages;
          const reorderedPages = reorderPages(currentPages, pageIndex, pageIndex - 1);
          setTimeout(() => {
            onPagesReorder(reorderedPages);
          }, 0);
        }
      },
      () => {
        // Move down
        const currentPages = pages;
        if (pageIndex < currentPages.length - 1) {
          const reorderedPages = reorderPages(currentPages, pageIndex, pageIndex + 1);
          setTimeout(() => {
            onPagesReorder(reorderedPages);
          }, 0);
        }
      },
      () => {
        // Confirm position (no action needed for this implementation)
      }
    );
  }, []); // Remove dependencies to prevent infinite recreation

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
    <div className={currentGroupId ? "" : "mt-6"}>
      {/* Only show header when not in group-specific mode */}
      {!currentGroupId && (
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
      )}
      
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
                Group
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
              
              // DEFENSIVE: Ensure draggedPageInfo is valid for current pages array
              // This prevents stale drag info from affecting pages after successful moves
              const isValidDraggedPage = draggedPageInfo && 
                draggedPageInfo.localIndex === index &&
                draggedPageInfo.localIndex < pages.length &&
                isDraggingBetweenGroups && // Only show gray when actually dragging between groups
                dragState.isDragging; // AND only when local drag state is also active
              
              
              return (
                <tr 
                  key={`${page.fileName}-${page.originalPageIndex}-${index}`}
                  className={`
                    transition-opacity duration-200
                    ${
                      isDraggedItem || isValidDraggedPage
                        ? 'opacity-50' 
                        : 'opacity-100'
                    }
                    ${dragState.hoverIndex === index ? 'bg-blue-50' : 'hover:bg-gray-50'}
                  `}
                >
                  {/* Drag handle */}
                  <td className="px-3 py-4 whitespace-nowrap">
                    <div
                      className={`
                        cursor-grab active:cursor-grabbing transition-colors select-none
                        ${
                          onInterGroupDragStart
                            ? 'text-blue-500 hover:text-blue-700'
                            : 'text-gray-400 hover:text-gray-600'
                        }
                      `}
                      draggable={!!onInterGroupDragStart}
                      onMouseDown={(e) => {
                        // Always start with intra-group drag, boundary detection will handle switching
                        handleDragStartForPage(index, e);
                      }}
                      onTouchStart={(e) => {
                        // Touch events always work for intra-group reordering
                        handleDragStartForPage(index, e);
                      }}
                      onDragStart={(e) => {
                        // HTML5 drag only works when inter-group drag is enabled
                        if (onInterGroupDragStart) {
                          // Prevent mouse drag events from interfering with HTML5 drag
                          e.stopPropagation();
                          handleHTML5DragStart(index, e);
                        } else {
                          e.preventDefault(); // Prevent default HTML5 drag when not needed
                        }
                      }}
                      onDragEnd={handleHTML5DragEnd}
                      tabIndex={0}
                      onKeyDown={(e) => keyboardHandlers.handleKeyDown(e.nativeEvent)}
                      title={onInterGroupDragStart 
                        ? "Drag within table: reorder pages • Drag outside table: move to other groups • Arrow keys: precise positioning • Escape: cancel drag"
                        : "Drag to reorder pages, or use arrow keys • Escape: cancel drag"
                      }
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

                  {/* Group assignment */}
                  <td className="px-4 py-4 whitespace-nowrap text-sm">
                    <div className="flex items-center space-x-2">
                      <select
                        value={currentGroupId || pageGroups.find(g => g.pageIndices.includes(index))?.id || 'default'}
                        onChange={(e) => handleGroupAssignment(index, e.target.value === 'default' ? null : e.target.value)}
                        className="border border-gray-300 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        disabled={disabled}
                      >
                        <option value="default">Default Group</option>
                        {pageGroups.filter(g => g.id !== 'default').map((group) => (
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
          {onInterGroupDragStart 
            ? "Drag within table: reorder pages in this group. Drag outside table boundaries: move pages to other groups. Use arrow buttons for precise positioning. Press Escape to cancel drags."
            : "Drag pages to reorder them. Card numbering will be calculated during extraction. Press Escape to cancel drags."
          }
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