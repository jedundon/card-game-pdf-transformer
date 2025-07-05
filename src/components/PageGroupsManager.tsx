/**
 * @fileoverview Page Groups Manager Component
 * 
 * This component manages multiple page groups, each displayed as its own table.
 * It provides functionality for creating, reordering, and managing groups,
 * while supporting drag-and-drop operations between groups.
 * 
 * **Key Features:**
 * - Multi-group table layout with individual group tables
 * - "Default" group for ungrouped pages
 * - Group creation and management
 * - Group reordering with arrow controls
 * - Inter-group drag-and-drop support
 * - Editable group names
 * 
 * @author Card Game PDF Transformer
 */

import React, { useState, useCallback, useMemo, useRef, flushSync } from 'react';
import { Plus, ArrowUp, ArrowDown, Edit2, Trash2 } from 'lucide-react';
import { PageReorderTable } from './PageReorderTable';
import { ProcessingModeSelector } from './shared/ProcessingModeSelector';
import { usePageGrouping } from '../hooks/usePageGrouping';
import { useOperationHistory } from '../hooks/useOperationHistory';
import type { 
  PageSettings, 
  PageSource, 
  PdfMode, 
  PageGroup, 
  PageTypeSettings 
} from '../types';

interface PageGroupsManagerProps {
  /** Combined pages from all imported files with source tracking */
  pages: (PageSettings & PageSource)[];
  /** Current PDF processing mode affecting card numbering */
  pdfMode: PdfMode;
  /** Callback when pages are reordered within or between groups */
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
  /** Callback when the global PDF mode should be updated (for Default group) */
  onGlobalPdfModeChange?: (mode: PdfMode) => void;
}

/**
 * Page Groups Manager - Orchestrates multiple group tables
 * 
 * Manages the display and interaction of multiple page groups, each with
 * its own table. Provides group management capabilities and ensures there's
 * always a "Default" group for ungrouped pages.
 */
export const PageGroupsManager: React.FC<PageGroupsManagerProps> = ({
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
  onGlobalPdfModeChange
}) => {
  // Group name editing state
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editingGroupName, setEditingGroupName] = useState<string>('');
  
  // Drag and drop state for inter-group operations
  const [dragOverGroupId, setDragOverGroupId] = useState<string | null>(null);
  const [isDraggingBetweenGroups, setIsDraggingBetweenGroups] = useState<boolean>(false);
  const [draggedPageInfo, setDraggedPageInfo] = useState<{ localIndex: number; globalIndex: number; sourceGroupId: string } | null>(null);
  
  // Refs for drop zone detection
  const groupRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Page grouping functionality (for utility functions only)
  const pageGrouping = usePageGrouping(pageGroups, {
    maxGroups: 50,
    defaultGroupColor: '#3b82f6',
    autoExpandNew: true
  });

  // Operation history for undo/redo
  const operationHistory = useOperationHistory({
    maxHistorySize: 20
  });

  // Constants for default group
  const DEFAULT_GROUP_ID = 'default';
  const DEFAULT_GROUP_NAME = 'Default Group';

  // Ensure we always have a "Default" group and groups are sorted by order
  const sortedGroupsWithDefault = useMemo(() => {
    const allGroups = [...pageGroups];
    
    // Check if default group exists
    const hasDefaultGroup = allGroups.some(group => group.id === DEFAULT_GROUP_ID);
    
    // Create default group if it doesn't exist
    if (!hasDefaultGroup) {
      const defaultGroup: PageGroup = {
        id: DEFAULT_GROUP_ID,
        name: DEFAULT_GROUP_NAME,
        pageIndices: [],
        type: 'manual',
        order: 0,
        processingMode: pdfMode, // Inherit current global processing mode
        color: '#6b7280',
        createdAt: Date.now(),
        modifiedAt: Date.now()
      };
      allGroups.unshift(defaultGroup);
    }
    
    // Sort groups by order
    return allGroups.sort((a, b) => a.order - b.order);
  }, [pageGroups, pdfMode]);

  // Get pages for a specific group with global index mapping
  const getPagesForGroup = useCallback((group: PageGroup): { pages: (PageSettings & PageSource)[]; globalIndices: number[] } => {
    if (group.id === DEFAULT_GROUP_ID) {
      // Default group contains pages not assigned to any other group
      const groupedPageIndices = new Set(
        pageGroups
          .filter(g => g.id !== DEFAULT_GROUP_ID)
          .flatMap(g => g.pageIndices)
      );
      
      const defaultPages: (PageSettings & PageSource)[] = [];
      const defaultGlobalIndices: number[] = [];
      
      pages.forEach((page, index) => {
        if (!groupedPageIndices.has(index)) {
          defaultPages.push(page);
          defaultGlobalIndices.push(index);
        }
      });
      
      return { pages: defaultPages, globalIndices: defaultGlobalIndices };
    } else {
      // Regular group contains only its assigned pages
      const groupPages = group.pageIndices
        .map(index => pages[index])
        .filter(Boolean); // Remove any undefined pages
      
      return { pages: groupPages, globalIndices: group.pageIndices };
    }
  }, [pages, pageGroups]);

  // Generate unique group ID
  const generateGroupId = useCallback((): string => {
    return `group_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }, []);

  // Generate unique group name
  const generateUniqueGroupName = useCallback((): string => {
    const existingNames = new Set(sortedGroupsWithDefault.map(g => g.name.toLowerCase()));
    let counter = 1;
    let candidateName = `Group ${counter}`;
    
    while (existingNames.has(candidateName.toLowerCase())) {
      counter++;
      candidateName = `Group ${counter}`;
    }
    
    return candidateName;
  }, [sortedGroupsWithDefault]);

  // Create a new group
  const handleCreateGroup = useCallback(() => {
    const newGroupName = generateUniqueGroupName();
    const maxOrder = Math.max(...sortedGroupsWithDefault.map(g => g.order), 0);
    
    // Create new group object directly
    const newGroup: PageGroup = {
      id: generateGroupId(),
      name: newGroupName,
      pageIndices: [], // Start with no pages
      type: 'manual',
      order: maxOrder + 1,
      processingMode: pdfMode, // Inherit current global processing mode
      color: '#3b82f6', // Default blue color
      createdAt: Date.now(),
      modifiedAt: Date.now()
    };

    // Add to existing groups and update immediately
    const updatedGroups = [...pageGroups, newGroup];
    onPageGroupsChange(updatedGroups);
  }, [generateUniqueGroupName, generateGroupId, sortedGroupsWithDefault, pageGroups, onPageGroupsChange]);

  // Move group up in order
  const handleMoveGroupUp = useCallback((groupId: string) => {
    const currentGroups = [...sortedGroupsWithDefault];
    const groupIndex = currentGroups.findIndex(g => g.id === groupId);
    
    if (groupIndex > 0) {
      // Swap order values with the group above
      const currentGroup = currentGroups[groupIndex];
      const previousGroup = currentGroups[groupIndex - 1];
      
      const updatedGroups = pageGroups.map(group => {
        if (group.id === currentGroup.id) {
          return { ...group, order: previousGroup.order };
        } else if (group.id === previousGroup.id) {
          return { ...group, order: currentGroup.order };
        }
        return group;
      });
      
      onPageGroupsChange(updatedGroups);
    }
  }, [sortedGroupsWithDefault, pageGroups, onPageGroupsChange]);

  // Move group down in order
  const handleMoveGroupDown = useCallback((groupId: string) => {
    const currentGroups = [...sortedGroupsWithDefault];
    const groupIndex = currentGroups.findIndex(g => g.id === groupId);
    
    if (groupIndex < currentGroups.length - 1) {
      // Swap order values with the group below
      const currentGroup = currentGroups[groupIndex];
      const nextGroup = currentGroups[groupIndex + 1];
      
      const updatedGroups = pageGroups.map(group => {
        if (group.id === currentGroup.id) {
          return { ...group, order: nextGroup.order };
        } else if (group.id === nextGroup.id) {
          return { ...group, order: currentGroup.order };
        }
        return group;
      });
      
      onPageGroupsChange(updatedGroups);
    }
  }, [sortedGroupsWithDefault, pageGroups, onPageGroupsChange]);

  // Start editing group name
  const handleStartEditingGroup = useCallback((group: PageGroup) => {
    if (group.id === DEFAULT_GROUP_ID) return; // Don't allow editing default group name
    
    setEditingGroupId(group.id);
    setEditingGroupName(group.name);
  }, []);

  // Save edited group name
  const handleSaveGroupName = useCallback(() => {
    if (!editingGroupId || !editingGroupName.trim()) return;
    
    const updatedGroups = pageGroups.map(group =>
      group.id === editingGroupId
        ? { ...group, name: editingGroupName.trim(), modifiedAt: Date.now() }
        : group
    );
    
    onPageGroupsChange(updatedGroups);
    setEditingGroupId(null);
    setEditingGroupName('');
  }, [editingGroupId, editingGroupName, pageGroups, onPageGroupsChange]);

  // Cancel editing group name
  const handleCancelEditingGroup = useCallback(() => {
    setEditingGroupId(null);
    setEditingGroupName('');
  }, []);

  // Delete a group (pages move to default group)
  const handleDeleteGroup = useCallback((groupId: string) => {
    if (groupId === DEFAULT_GROUP_ID) return; // Can't delete default group
    
    const updatedGroups = pageGroups.filter(group => group.id !== groupId);
    onPageGroupsChange(updatedGroups);
  }, [pageGroups, onPageGroupsChange]);

  // Update group processing mode
  const handleGroupProcessingModeChange = useCallback((groupId: string, processingMode: PdfMode) => {
    // If this is the Default group, also update the global PDF mode
    if (groupId === DEFAULT_GROUP_ID && onGlobalPdfModeChange) {
      onGlobalPdfModeChange(processingMode);
    }
    
    const updatedGroups = pageGroups.map(group =>
      group.id === groupId
        ? { ...group, processingMode, modifiedAt: Date.now() }
        : group
    );
    onPageGroupsChange(updatedGroups);
  }, [pageGroups, onPageGroupsChange, onGlobalPdfModeChange]);

  // Handle page moves between groups (with global index mapping)
  const handlePageGroupChange = useCallback((localPageIndex: number, targetGroupId: string | null, sourceGroupId: string) => {
    // Get the global index for this local page index
    const sourceGroup = sortedGroupsWithDefault.find(g => g.id === sourceGroupId);
    if (!sourceGroup) return;
    
    const { globalIndices } = getPagesForGroup(sourceGroup);
    const globalPageIndex = globalIndices[localPageIndex];
    
    if (globalPageIndex === undefined) return;
    
    // Remove page from all current groups
    const updatedGroups = pageGroups.map(group => ({
      ...group,
      pageIndices: group.pageIndices.filter(idx => idx !== globalPageIndex),
      modifiedAt: Date.now()
    }));

    // Add page to target group (if not default/null)
    if (targetGroupId && targetGroupId !== DEFAULT_GROUP_ID) {
      const targetGroupIndex = updatedGroups.findIndex(g => g.id === targetGroupId);
      if (targetGroupIndex !== -1) {
        updatedGroups[targetGroupIndex] = {
          ...updatedGroups[targetGroupIndex],
          pageIndices: [...updatedGroups[targetGroupIndex].pageIndices, globalPageIndex],
          modifiedAt: Date.now()
        };
      }
    }

    onPageGroupsChange(updatedGroups);
  }, [pageGroups, onPageGroupsChange, sortedGroupsWithDefault, getPagesForGroup]);

  // Handle page reordering within a group (with proper index mapping)
  const handleGroupPageReorder = useCallback((reorderedGroupPages: (PageSettings & PageSource)[], groupId: string) => {
    // Find the group being reordered
    const sourceGroup = sortedGroupsWithDefault.find(g => g.id === groupId);
    if (!sourceGroup) return;
    
    // Get the global indices for this group
    const { globalIndices } = getPagesForGroup(sourceGroup);
    
    // Create a mapping of old local position to new local position
    const originalGroupPages = pages.filter((_, index) => globalIndices.includes(index));
    
    // Build the complete global page array with reordered group pages
    const newGlobalPages = [...pages];
    
    // Update the pages at the global indices with the reordered group pages
    reorderedGroupPages.forEach((reorderedPage, newLocalIndex) => {
      // Find which global index this reordered page should go to
      const globalIndex = globalIndices[newLocalIndex];
      if (globalIndex !== undefined) {
        newGlobalPages[globalIndex] = reorderedPage;
      }
    });
    
    // Call the parent's onPagesReorder with the complete global page array
    onPagesReorder(newGlobalPages);
  }, [pages, sortedGroupsWithDefault, getPagesForGroup, onPagesReorder]);
  
  // Handle drag start for inter-group operations
  const handleInterGroupDragStart = useCallback((localPageIndex: number, sourceGroupId: string) => {
    const sourceGroup = sortedGroupsWithDefault.find(g => g.id === sourceGroupId);
    if (!sourceGroup) return;
    
    const { globalIndices } = getPagesForGroup(sourceGroup);
    const globalPageIndex = globalIndices[localPageIndex];
    
    if (globalPageIndex === undefined) return;
    
    setDraggedPageInfo({
      localIndex: localPageIndex,
      globalIndex: globalPageIndex,
      sourceGroupId
    });
    setIsDraggingBetweenGroups(true);
  }, [sortedGroupsWithDefault, getPagesForGroup]);
  
  // Handle drag end for inter-group operations
  const handleInterGroupDragEnd = useCallback(() => {
    // CRITICAL FIX: Save drag info before clearing state to prevent race condition
    // When page is successfully moved, clearing drag state after handlePageGroupChange
    // causes the re-render to show wrong page as grayed out
    const currentDraggedPageInfo = draggedPageInfo;
    const currentDragOverGroupId = dragOverGroupId;
    
    // Force immediate synchronous clearing of drag state to prevent stale state
    // flushSync ensures this state update happens in its own render cycle
    // BEFORE handlePageGroupChange triggers page array updates
    console.log(`🧹 BEFORE clearing drag state:`, {
      draggedPageInfo: currentDraggedPageInfo,
      isDraggingBetweenGroups,
      dragOverGroupId: currentDragOverGroupId
    });
    
    flushSync(() => {
      setDraggedPageInfo(null);
      setIsDraggingBetweenGroups(false);
      setDragOverGroupId(null);
    });
    
    console.log(`✅ AFTER clearing drag state - about to call handlePageGroupChange`);
    
    // Then perform the page move operation with saved values
    // At this point, all PageReorderTable components have received draggedPageInfo: null
    if (currentDraggedPageInfo && currentDragOverGroupId && currentDragOverGroupId !== currentDraggedPageInfo.sourceGroupId) {
      // Move the page to the target group
      handlePageGroupChange(currentDraggedPageInfo.localIndex, currentDragOverGroupId, currentDraggedPageInfo.sourceGroupId);
    }
  }, [draggedPageInfo, dragOverGroupId, handlePageGroupChange]);
  
  // Handle drag over group
  const handleGroupDragOver = useCallback((e: React.DragEvent, groupId: string) => {
    // Always prevent default to allow drop
    e.preventDefault();
    e.stopPropagation();
    
    // Set appropriate drop effect
    e.dataTransfer.dropEffect = 'move';
    
    // Check if we have either state-based or HTML5-based drag info
    const hasActiveDrag = isDraggingBetweenGroups || e.dataTransfer.types.includes('text/x-page-index');
    
    
    if (!hasActiveDrag) return;
    
    // Determine source group ID
    let sourceGroupId = null;
    if (draggedPageInfo) {
      sourceGroupId = draggedPageInfo.sourceGroupId;
    } else {
      // Try to extract from HTML5 drag data
      try {
        const jsonData = e.dataTransfer.getData('application/json') || e.dataTransfer.getData('text/plain');
        if (jsonData) {
          const dragData = JSON.parse(jsonData);
          sourceGroupId = dragData.sourceGroupId;
        }
      } catch (e) {
        // Ignore parsing errors
      }
    }
    
    // Only highlight if dropping would move to a different group
    if (sourceGroupId && groupId !== sourceGroupId) {
      setDragOverGroupId(groupId);
    } else {
      setDragOverGroupId(null);
    }
  }, [isDraggingBetweenGroups, draggedPageInfo]);
  
  // Handle drag leave group
  const handleGroupDragLeave = useCallback((e: React.DragEvent, groupId: string) => {
    // Only process if we have an active drag operation
    const hasActiveDrag = isDraggingBetweenGroups || e.dataTransfer.types.includes('text/x-page-index');
    if (!hasActiveDrag) return;
    
    // Capture the current target element before the timeout
    const currentTarget = e.currentTarget as HTMLElement;
    const clientX = e.clientX;
    const clientY = e.clientY;
    
    // Use a small delay to prevent flicker when moving between child elements
    setTimeout(() => {
      // Check if the element still exists and is valid
      if (!currentTarget || !document.contains(currentTarget)) {
        // Element was removed, just clear the drag over state
        if (dragOverGroupId === groupId) {
          setDragOverGroupId(null);
        }
        return;
      }
      
      // Only clear drag over if we're actually leaving the group container
      try {
        const rect = currentTarget.getBoundingClientRect();
        const isStillInside = (
          clientX >= rect.left &&
          clientX <= rect.right &&
          clientY >= rect.top &&
          clientY <= rect.bottom
        );
        
        if (!isStillInside && dragOverGroupId === groupId) {
          setDragOverGroupId(null);
        }
      } catch (error) {
        // If getBoundingClientRect fails, just clear the drag over state
        console.warn('Error checking drag leave bounds:', error);
        if (dragOverGroupId === groupId) {
          setDragOverGroupId(null);
        }
      }
    }, 10);
  }, [isDraggingBetweenGroups, dragOverGroupId]);
  
  // Handle drop on group
  const handleGroupDrop = useCallback((e: React.DragEvent, groupId: string) => {
    e.preventDefault();
    e.stopPropagation();
    
    try {
      // Try to get drag data from different formats
      let dragData = null;
      
      // Try JSON format first
      try {
        const jsonData = e.dataTransfer.getData('application/json') || e.dataTransfer.getData('text/plain');
        if (jsonData) {
          dragData = JSON.parse(jsonData);
        }
      } catch (jsonError) {
        // Fallback to simple page index format
        const pageIndexStr = e.dataTransfer.getData('text/x-page-index');
        if (pageIndexStr) {
          const localIndex = parseInt(pageIndexStr, 10);
          if (!isNaN(localIndex) && draggedPageInfo) {
            dragData = {
              localIndex,
              sourceGroupId: draggedPageInfo.sourceGroupId
            };
          }
        }
      }
      
      // Process the drop if we have valid data
      if (dragData && dragData.sourceGroupId && dragData.sourceGroupId !== groupId) {
        handlePageGroupChange(dragData.localIndex, groupId, dragData.sourceGroupId);
      } else if (draggedPageInfo && draggedPageInfo.sourceGroupId !== groupId) {
        // Fallback to existing drag state if HTML5 data is not available
        handlePageGroupChange(draggedPageInfo.localIndex, groupId, draggedPageInfo.sourceGroupId);
      }
    } catch (error) {
      console.error('Error processing drop:', error);
    }
    
    // Always reset drag state after drop
    setDraggedPageInfo(null);
    setIsDraggingBetweenGroups(false);
    setDragOverGroupId(null);
  }, [draggedPageInfo, handlePageGroupChange]);

  return (
    <div className="space-y-6">
      {/* Header with create group button */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-gray-800">
          Page Management & Reordering
        </h3>
        <button
          onClick={handleCreateGroup}
          disabled={disabled}
          className="inline-flex items-center px-3 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          title="Create new group"
        >
          <Plus size={16} className="mr-2" />
          Create Group
        </button>
      </div>

      {/* Global reset button */}
      {onResetToImportOrder && pages.length > 1 && isPagesReordered && (
        <div className="flex justify-end">
          <button
            onClick={onResetToImportOrder}
            className="inline-flex items-center px-3 py-1 text-xs bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 border border-gray-300 transition-colors"
            title="Reset page order to original import order"
          >
            Reset to Import Order
          </button>
        </div>
      )}

      {/* Group tables */}
      <div className="space-y-6">
        {sortedGroupsWithDefault.map((group, groupIndex) => {
          const { pages: groupPages, globalIndices } = getPagesForGroup(group);
          const isDefaultGroup = group.id === DEFAULT_GROUP_ID;
          const canMoveUp = groupIndex > 0;
          const canMoveDown = groupIndex < sortedGroupsWithDefault.length - 1;
          
          return (
            <div 
              key={group.id} 
              ref={(el) => { groupRefs.current[group.id] = el; }}
              className={`
                border rounded-lg overflow-hidden transition-all duration-200
                ${
                  dragOverGroupId === group.id
                    ? 'border-blue-500 bg-blue-50 border-2 shadow-lg ring-2 ring-blue-200 ring-opacity-50'
                    : isDraggingBetweenGroups && group.id !== draggedPageInfo?.sourceGroupId
                    ? 'border-gray-300 bg-gray-50 border-dashed'
                    : 'border-gray-200'
                }
              `}
              onDragOver={(e) => handleGroupDragOver(e, group.id)}
              onDragLeave={(e) => handleGroupDragLeave(e, group.id)}
              onDrop={(e) => handleGroupDrop(e, group.id)}
              onMouseEnter={(e) => {
                // Handle mouse-based inter-group drag (when not using HTML5 drag)
                if (isDraggingBetweenGroups && draggedPageInfo && group.id !== draggedPageInfo.sourceGroupId) {
                  setDragOverGroupId(group.id);
                }
              }}
              onMouseLeave={(e) => {
                // Handle mouse-based inter-group drag leave
                if (isDraggingBetweenGroups && dragOverGroupId === group.id) {
                  setDragOverGroupId(null);
                }
              }}
              onMouseUp={(e) => {
                // Handle mouse-based drop (when not using HTML5 drag)
                if (isDraggingBetweenGroups && draggedPageInfo && group.id !== draggedPageInfo.sourceGroupId && dragOverGroupId === group.id) {
                  e.preventDefault();
                  e.stopPropagation();
                  handlePageGroupChange(draggedPageInfo.localIndex, group.id, draggedPageInfo.sourceGroupId);
                  // Reset drag state
                  setDraggedPageInfo(null);
                  setIsDraggingBetweenGroups(false);
                  setDragOverGroupId(null);
                }
              }}
            >
              {/* Group Header */}
              <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                {/* First row: Group name and controls */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-3">
                    {/* Group name or editing input */}
                    {editingGroupId === group.id ? (
                      <div className="flex items-center space-x-2">
                        <input
                          type="text"
                          value={editingGroupName}
                          onChange={(e) => setEditingGroupName(e.target.value)}
                          onBlur={handleSaveGroupName}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveGroupName();
                            if (e.key === 'Escape') handleCancelEditingGroup();
                          }}
                          className="text-base font-medium bg-white border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          autoFocus
                        />
                      </div>
                    ) : (
                      <div className="flex items-center space-x-2">
                        <h4 className="text-base font-medium text-gray-800">
                          📋 {group.name}
                        </h4>
                        <span className="text-sm text-gray-500">
                          ({groupPages.length} pages)
                        </span>
                        {!isDefaultGroup && (
                          <button
                            onClick={() => handleStartEditingGroup(group)}
                            disabled={disabled}
                            className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-50"
                            title="Edit group name"
                          >
                            <Edit2 size={14} />
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Group controls */}
                  <div className="flex items-center space-x-1">
                    {/* Group reordering controls */}
                    <button
                      onClick={() => handleMoveGroupUp(group.id)}
                      disabled={!canMoveUp || disabled}
                      className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-50"
                      title="Move group up"
                    >
                      <ArrowUp size={16} />
                    </button>
                    <button
                      onClick={() => handleMoveGroupDown(group.id)}
                      disabled={!canMoveDown || disabled}
                      className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-50"
                      title="Move group down"
                    >
                      <ArrowDown size={16} />
                    </button>
                    
                    {/* Delete group button (not for default group) */}
                    {!isDefaultGroup && (
                      <button
                        onClick={() => handleDeleteGroup(group.id)}
                        disabled={disabled}
                        className="p-1 text-red-400 hover:text-red-600 disabled:opacity-50 ml-2"
                        title="Delete group (pages will move to Default group)"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Second row: Processing mode selector */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <ProcessingModeSelector
                      processingMode={group.processingMode}
                      onChange={(mode) => handleGroupProcessingModeChange(group.id, mode)}
                      disabled={disabled}
                      label="Processing Mode"
                      size="sm"
                    />
                  </div>
                  <div className="text-xs text-gray-500">
                    Processing settings for this group
                  </div>
                </div>
              </div>


              {/* Group table */}
              {groupPages.length > 0 ? (
                <PageReorderTable
                  pages={groupPages}
                  pdfMode={pdfMode}
                  onPagesReorder={(reorderedPages) => handleGroupPageReorder(reorderedPages, group.id)}
                  onPageSettingsChange={(localIndex, settings) => {
                    // Map local index to global index
                    const globalIndex = globalIndices[localIndex];
                    if (globalIndex !== undefined) {
                      onPageSettingsChange(globalIndex, settings);
                    }
                  }}
                  onPageRemove={(localIndex) => {
                    // Map local index to global index
                    const globalIndex = globalIndices[localIndex];
                    if (globalIndex !== undefined) {
                      onPageRemove(globalIndex);
                    }
                  }}
                  thumbnails={thumbnails}
                  thumbnailLoading={thumbnailLoading}
                  thumbnailErrors={thumbnailErrors}
                  onThumbnailLoad={(localIndex) => {
                    // Map local index to global index
                    const globalIndex = globalIndices[localIndex];
                    if (globalIndex !== undefined) {
                      onThumbnailLoad(globalIndex);
                    }
                  }}
                  pageTypeSettings={pageTypeSettings}
                  pageGroups={sortedGroupsWithDefault}
                  onPageGroupsChange={onPageGroupsChange}
                  onPagesUpdate={onPagesUpdate}
                  disabled={disabled}
                  // Group-specific props
                  currentGroupId={group.id}
                  onPageGroupChange={(localIndex, targetGroupId) => 
                    handlePageGroupChange(localIndex, targetGroupId, group.id)
                  }
                  // Inter-group drag and drop props
                  onInterGroupDragStart={(localIndex) => handleInterGroupDragStart(localIndex, group.id)}
                  onInterGroupDragEnd={handleInterGroupDragEnd}
                  isDraggingBetweenGroups={isDraggingBetweenGroups}
                  draggedPageInfo={draggedPageInfo && draggedPageInfo.sourceGroupId === group.id ? draggedPageInfo : null}
                />
              ) : (
                <div 
                  className={`
                    p-8 text-center transition-all duration-200 min-h-24 flex flex-col justify-center
                    ${
                      dragOverGroupId === group.id
                        ? 'text-blue-600 bg-blue-50 border-2 border-blue-300 border-dashed m-2 rounded-md'
                        : isDraggingBetweenGroups && group.id !== draggedPageInfo?.sourceGroupId
                        ? 'text-gray-600 bg-gray-50 border-2 border-gray-300 border-dashed m-2 rounded-md'
                        : 'text-gray-500'
                    }
                  `}
                >
                  <p className={`text-sm font-medium ${
                    dragOverGroupId === group.id ? 'text-blue-700' : ''
                  }`}>
                    {dragOverGroupId === group.id
                      ? "🎯 Drop page here to add to group"
                      : isDraggingBetweenGroups && group.id !== draggedPageInfo?.sourceGroupId
                      ? "📁 Drop zone - drag page here"
                      : "No pages in this group"
                    }
                  </p>
                  <p className={`text-xs mt-1 ${
                    dragOverGroupId === group.id ? 'text-blue-600' : ''
                  }`}>
                    {dragOverGroupId === group.id
                      ? "Release mouse to move the page to this group"
                      : isDraggingBetweenGroups && group.id !== draggedPageInfo?.sourceGroupId
                      ? "Available drop target"
                      : isDefaultGroup 
                        ? "Pages not assigned to other groups will appear here"
                        : "Drag pages here or use the group dropdown to add pages"
                    }
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Summary information */}
      <div className="mt-4 text-sm text-gray-600">
        <p>
          {pages.length} pages total • 
          {' '}{pages.filter(p => !p.skip).length} active • 
          {' '}{pages.filter(p => p.skip).length} skipped •
          {' '}{sortedGroupsWithDefault.length} groups
        </p>
        <p className="text-xs text-gray-500 mt-1">
          Create groups to organize your pages. Hold and drag the grip handle to move pages between groups, or use dropdown menus.
        </p>
        {isDraggingBetweenGroups && draggedPageInfo && (
          <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-md">
            <p className="text-xs text-blue-700 font-medium flex items-center gap-2">
              <span className="text-sm">🔄</span>
              Moving page {draggedPageInfo.globalIndex + 1} from {
                sortedGroupsWithDefault.find(g => g.id === draggedPageInfo.sourceGroupId)?.name || 'Unknown Group'
              }
            </p>
            <p className="text-xs text-blue-600 mt-1">
              Drop on any other group to move the page there
            </p>
          </div>
        )}
      </div>
    </div>
  );
};