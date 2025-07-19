/**
 * @fileoverview Page Group Manager Component
 * 
 * This component provides comprehensive page grouping functionality for the
 * unified page management system. It allows users to create, manage, and
 * organize pages into logical groups for better workflow organization.
 * 
 * **Key Features:**
 * - Create and manage page groups
 * - Drag-and-drop page grouping
 * - Cross-file group support
 * - Auto-grouping by file/type/mode
 * - Group-based navigation and filtering
 * - Visual group indicators
 * 
 * @author Card Game PDF Transformer
 */

import React, { useState, useCallback, useMemo } from 'react';
import { 
  Plus, 
  Edit3, 
  Trash2, 
  Users, 
  Folder, 
  FolderOpen,
  Filter,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronRight,
  Shuffle
} from 'lucide-react';
import { PageSettings, PageSource, PageGroup, PageTypeSettings } from '../../types';

interface PageGroupManagerProps {
  /** Current page list */
  pages: (PageSettings & PageSource)[];
  /** Current page groups */
  groups: PageGroup[];
  /** Page type settings for auto-grouping */
  pageTypeSettings: Record<string, PageTypeSettings>;
  /** Callback when groups change */
  onGroupsChange: (groups: PageGroup[]) => void;
  /** Callback when pages change (for group assignments) */
  onPagesChange: (pages: (PageSettings & PageSource)[]) => void;
  /** Currently selected pages */
  selectedPages?: Set<number>;
  /** Whether grouping is disabled */
  disabled?: boolean;
}

interface CreateGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (name: string, color: string) => void;
  existingNames: string[];
}

const GROUP_COLORS = [
  '#3b82f6', // blue
  '#10b981', // emerald
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // violet
  '#06b6d4', // cyan
  '#84cc16', // lime
  '#f97316', // orange
  '#ec4899', // pink
  '#6b7280'  // gray
];

/**
 * Modal for creating new groups
 */
const CreateGroupModal: React.FC<CreateGroupModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  existingNames
}) => {
  const [name, setName] = useState('');
  const [color, setColor] = useState(GROUP_COLORS[0]);
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      setError('Group name is required');
      return;
    }
    
    if (existingNames.includes(name.trim())) {
      setError('Group name already exists');
      return;
    }
    
    onConfirm(name.trim(), color);
    setName('');
    setColor(GROUP_COLORS[0]);
    setError('');
  };

  const handleClose = () => {
    setName('');
    setColor(GROUP_COLORS[0]);
    setError('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Create New Group</h3>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Group Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError('');
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Enter group name..."
              maxLength={50}
            />
            {error && (
              <p className="mt-1 text-sm text-red-600">{error}</p>
            )}
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Group Color
            </label>
            <div className="flex flex-wrap gap-2">
              {GROUP_COLORS.map((groupColor) => (
                <button
                  key={groupColor}
                  type="button"
                  onClick={() => setColor(groupColor)}
                  className={`w-8 h-8 rounded-full border-2 ${
                    color === groupColor ? 'border-gray-800' : 'border-gray-300'
                  }`}
                  style={{ backgroundColor: groupColor }}
                />
              ))}
            </div>
          </div>
          
          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700"
            >
              Create Group
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

/**
 * Page Group Manager Component
 */
export const PageGroupManager: React.FC<PageGroupManagerProps> = ({
  pages,
  groups,
  pageTypeSettings,
  onGroupsChange,
  onPagesChange,
  selectedPages = new Set(),
  disabled = false
}) => {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [editingGroup, setEditingGroup] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'grouped' | 'ungrouped'>('all');

  /**
   * Generate unique group ID
   */
  const generateGroupId = useCallback((): string => {
    return `group_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }, []);

  /**
   * Get pages that belong to a specific group
   */
  const getGroupPages = useCallback((groupId: string): (PageSettings & PageSource)[] => {
    const group = groups.find(g => g.id === groupId);
    if (!group) return [];
    
    return group.pageIndices
      .map(index => pages[index])
      .filter(Boolean);
  }, [groups, pages]);

  /**
   * Get ungrouped pages
   */
  const ungroupedPages = useMemo(() => {
    const groupedIndices = new Set(
      groups.flatMap(group => group.pageIndices)
    );
    
    return pages
      .map((page, index) => ({ page, index }))
      .filter(({ index }) => !groupedIndices.has(index))
      .map(({ page }) => page);
  }, [pages, groups]);

  /**
   * Auto-group pages by file
   */
  const autoGroupByFile = useCallback(() => {
    const fileGroups = new Map<string, number[]>();
    
    pages.forEach((page, index) => {
      if (!fileGroups.has(page.fileName)) {
        fileGroups.set(page.fileName, []);
      }
      fileGroups.get(page.fileName)!.push(index);
    });

    const newGroups: PageGroup[] = [];
    let colorIndex = 0;

    fileGroups.forEach((pageIndices, fileName) => {
      if (pageIndices.length > 1) {
        newGroups.push({
          id: generateGroupId(),
          name: `File: ${fileName}`,
          pageIndices,
          type: 'auto',
          color: GROUP_COLORS[colorIndex % GROUP_COLORS.length],
          createdAt: Date.now(),
          modifiedAt: Date.now()
        });
        colorIndex++;
      }
    });

    onGroupsChange([...groups, ...newGroups]);
  }, [pages, groups, onGroupsChange, generateGroupId]);

  /**
   * Auto-group pages by type
   */
  const autoGroupByType = useCallback(() => {
    const typeGroups = new Map<string, number[]>();
    
    pages.forEach((page, index) => {
      const pageType = page.pageType || 'card';
      if (!typeGroups.has(pageType)) {
        typeGroups.set(pageType, []);
      }
      typeGroups.get(pageType)!.push(index);
    });

    const newGroups: PageGroup[] = [];

    typeGroups.forEach((pageIndices, pageType) => {
      if (pageIndices.length > 1) {
        const typeSettings = pageTypeSettings[pageType];
        newGroups.push({
          id: generateGroupId(),
          name: `${typeSettings?.displayName || pageType} Pages`,
          pageIndices,
          type: 'auto',
          color: typeSettings?.colorScheme.primary || GROUP_COLORS[0],
          createdAt: Date.now(),
          modifiedAt: Date.now()
        });
      }
    });

    onGroupsChange([...groups, ...newGroups]);
  }, [pages, groups, pageTypeSettings, onGroupsChange, generateGroupId]);

  /**
   * Create group from selected pages
   */
  const createGroupFromSelection = useCallback((name: string, color: string) => {
    if (selectedPages.size === 0) return;

    const newGroup: PageGroup = {
      id: generateGroupId(),
      name,
      pageIndices: Array.from(selectedPages),
      type: 'manual',
      order: groups.length,
      processingMode: { type: 'simplex', flipEdge: 'short' }, // Default processing mode
      color,
      createdAt: Date.now(),
      modifiedAt: Date.now()
    };

    onGroupsChange([...groups, newGroup]);
    setShowCreateModal(false);
  }, [selectedPages, groups, onGroupsChange, generateGroupId]);

  /**
   * Delete group
   */
  const deleteGroup = useCallback((groupId: string) => {
    if (window.confirm('Are you sure you want to delete this group? Pages will not be deleted.')) {
      onGroupsChange(groups.filter(g => g.id !== groupId));
    }
  }, [groups, onGroupsChange]);

  /**
   * Toggle group expansion
   */
  const toggleGroupExpansion = useCallback((groupId: string) => {
    setExpandedGroups(prev => {
      const newExpanded = new Set(prev);
      if (newExpanded.has(groupId)) {
        newExpanded.delete(groupId);
      } else {
        newExpanded.add(groupId);
      }
      return newExpanded;
    });
  }, []);

  /**
   * Start editing group name
   */
  const startEditingGroup = useCallback((groupId: string, currentName: string) => {
    setEditingGroup(groupId);
    setEditName(currentName);
  }, []);

  /**
   * Save group name edit
   */
  const saveGroupEdit = useCallback(() => {
    if (!editingGroup || !editName.trim()) {
      setEditingGroup(null);
      return;
    }

    const updatedGroups = groups.map(group => 
      group.id === editingGroup 
        ? { ...group, name: editName.trim(), modifiedAt: Date.now() }
        : group
    );

    onGroupsChange(updatedGroups);
    setEditingGroup(null);
    setEditName('');
  }, [editingGroup, editName, groups, onGroupsChange]);

  /**
   * Cancel group name edit
   */
  const cancelGroupEdit = useCallback(() => {
    setEditingGroup(null);
    setEditName('');
  }, []);

  /**
   * Filter pages based on current filter
   */
  // const filteredPages = useMemo(() => {
  //   switch (filterType) {
  //     case 'grouped':
  //       return pages.filter((_, index) => 
  //         groups.some(group => group.pageIndices.includes(index))
  //       );
  //     case 'ungrouped':
  //       return ungroupedPages;
  //     default:
  //       return pages;
  //   }
  // }, [pages, groups, ungroupedPages, filterType]);

  if (pages.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      {/* Header with controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Users className="w-5 h-5 text-gray-500" />
          <h3 className="text-lg font-medium text-gray-900">Page Groups</h3>
          <span className="text-sm text-gray-500">
            ({groups.length} groups)
          </span>
        </div>

        <div className="flex items-center space-x-2">
          {/* Filter toggle */}
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as any)}
            className="text-sm border border-gray-300 rounded-md px-2 py-1"
          >
            <option value="all">All Pages</option>
            <option value="grouped">Grouped Only</option>
            <option value="ungrouped">Ungrouped Only</option>
          </select>

          {/* Auto-group options */}
          <div className="relative">
            <button
              onClick={autoGroupByFile}
              disabled={disabled}
              className="text-sm px-3 py-1 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 disabled:opacity-50"
            >
              <Shuffle className="w-4 h-4 inline mr-1" />
              By File
            </button>
          </div>

          <button
            onClick={autoGroupByType}
            disabled={disabled}
            className="text-sm px-3 py-1 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 disabled:opacity-50"
          >
            <Shuffle className="w-4 h-4 inline mr-1" />
            By Type
          </button>

          {/* Create group from selection */}
          {selectedPages.size > 0 && (
            <button
              onClick={() => setShowCreateModal(true)}
              disabled={disabled}
              className="text-sm px-3 py-1 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
            >
              <Plus className="w-4 h-4 inline mr-1" />
              Group Selected
            </button>
          )}
        </div>
      </div>

      {/* Groups list */}
      <div className="space-y-3">
        {groups.map((group) => (
          <div key={group.id} className="border border-gray-200 rounded-lg">
            {/* Group header */}
            <div className="flex items-center justify-between p-3 bg-gray-50">
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => toggleGroupExpansion(group.id)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  {expandedGroups.has(group.id) ? (
                    <ChevronDown className="w-4 h-4" />
                  ) : (
                    <ChevronRight className="w-4 h-4" />
                  )}
                </button>

                <div 
                  className="w-4 h-4 rounded-full border border-gray-300"
                  style={{ backgroundColor: group.color }}
                />

                {editingGroup === group.id ? (
                  <div className="flex items-center space-x-2">
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveGroupEdit();
                        if (e.key === 'Escape') cancelGroupEdit();
                      }}
                      className="text-sm border border-gray-300 rounded px-2 py-1"
                      autoFocus
                    />
                    <button
                      onClick={saveGroupEdit}
                      className="text-green-600 hover:text-green-500"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <button
                      onClick={cancelGroupEdit}
                      className="text-red-600 hover:text-red-500"
                    >
                      <EyeOff className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <span className="font-medium text-gray-900">{group.name}</span>
                )}

                <span className="text-sm text-gray-500">
                  ({group.pageIndices.length} pages)
                </span>

                {group.type === 'auto' && (
                  <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-md">
                    Auto
                  </span>
                )}
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => startEditingGroup(group.id, group.name)}
                  disabled={disabled}
                  className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
                >
                  <Edit3 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => deleteGroup(group.id)}
                  disabled={disabled}
                  className="text-red-400 hover:text-red-600 disabled:opacity-50"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Group pages */}
            {expandedGroups.has(group.id) && (
              <div className="p-3 space-y-2">
                {getGroupPages(group.id).map((page, index) => (
                  <div
                    key={`${page.fileName}-${page.originalPageIndex}`}
                    className="flex items-center space-x-3 p-2 bg-white border border-gray-100 rounded-md"
                  >
                    <span className="text-sm font-medium text-gray-900">
                      Page {group.pageIndices[index] + 1}
                    </span>
                    <span className="text-sm text-gray-500">
                      ({page.fileName})
                    </span>
                    {page.pageType && (
                      <span className={`
                        px-2 py-1 rounded-md text-xs font-medium
                        ${page.pageType === 'card' ? 'bg-blue-100 text-blue-800' :
                          page.pageType === 'rule' ? 'bg-green-100 text-green-800' :
                          'bg-gray-100 text-gray-800'}
                      `}>
                        {page.pageType}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}

        {/* Ungrouped pages */}
        {ungroupedPages.length > 0 && filterType !== 'grouped' && (
          <div className="border border-gray-200 rounded-lg">
            <div className="flex items-center justify-between p-3 bg-gray-50">
              <div className="flex items-center space-x-3">
                <Folder className="w-4 h-4 text-gray-400" />
                <span className="font-medium text-gray-700">Ungrouped Pages</span>
                <span className="text-sm text-gray-500">
                  ({ungroupedPages.length} pages)
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Summary */}
      <div className="flex items-center justify-between pt-2 border-t border-gray-200 text-sm text-gray-500">
        <span>
          {groups.length} groups • {ungroupedPages.length} ungrouped pages
        </span>
        <span>
          Total: {pages.length} pages
        </span>
      </div>

      {/* Create group modal */}
      <CreateGroupModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onConfirm={createGroupFromSelection}
        existingNames={groups.map(g => g.name)}
      />
    </div>
  );
};