/**
 * @fileoverview Page Grouping State Management Hook
 * 
 * This hook manages the state and operations for page grouping in the unified
 * page management system. It provides functionality for creating, managing,
 * and organizing pages into logical groups.
 * 
 * **Key Features:**
 * - Group creation and management
 * - Auto-grouping algorithms
 * - Group-based filtering and navigation
 * - Cross-file group support
 * - Group settings inheritance
 * 
 * @author Card Game PDF Transformer
 */

import { useState, useCallback } from 'react';
import { PageSettings, PageSource, PageGroup, PageTypeSettings } from '../types';

interface UsePageGroupingOptions {
  /** Maximum number of groups allowed */
  maxGroups?: number;
  /** Default group color */
  defaultGroupColor?: string;
  /** Whether to auto-expand newly created groups */
  autoExpandNew?: boolean;
  /** Callback when group limit is reached */
  onGroupLimitReached?: (limit: number) => void;
}

interface GroupingStats {
  /** Total number of groups */
  totalGroups: number;
  /** Number of grouped pages */
  groupedPages: number;
  /** Number of ungrouped pages */
  ungroupedPages: number;
  /** Groups by type */
  groupsByType: {
    auto: number;
    manual: number;
  };
  /** Average group size */
  averageGroupSize: number;
}

interface UsePageGroupingReturn {
  /** Current groups */
  groups: PageGroup[];
  /** Update groups */
  setGroups: (groups: PageGroup[]) => void;
  /** Create new group */
  createGroup: (
    name: string,
    pageIndices: number[],
    color?: string,
    type?: 'auto' | 'manual'
  ) => string | null;
  /** Delete group */
  deleteGroup: (groupId: string) => void;
  /** Update group */
  updateGroup: (groupId: string, updates: Partial<PageGroup>) => void;
  /** Add pages to group */
  addPagesToGroup: (groupId: string, pageIndices: number[]) => void;
  /** Remove pages from group */
  removePagesFromGroup: (groupId: string, pageIndices: number[]) => void;
  /** Move pages between groups */
  movePagesBetweenGroups: (fromGroupId: string, toGroupId: string, pageIndices: number[]) => void;
  /** Auto-group by file */
  autoGroupByFile: (pages: (PageSettings & PageSource)[]) => void;
  /** Auto-group by page type */
  autoGroupByType: (pages: (PageSettings & PageSource)[], pageTypeSettings: Record<string, PageTypeSettings>) => void;
  /** Auto-group by processing mode */
  autoGroupByProcessingMode: (pages: (PageSettings & PageSource)[]) => void;
  /** Get pages in a group */
  getGroupPages: (groupId: string, pages: (PageSettings & PageSource)[]) => (PageSettings & PageSource)[];
  /** Get ungrouped pages */
  getUngroupedPages: (pages: (PageSettings & PageSource)[]) => (PageSettings & PageSource)[];
  /** Get grouping statistics */
  getGroupingStats: (pages: (PageSettings & PageSource)[]) => GroupingStats;
  /** Check if page is grouped */
  isPageGrouped: (pageIndex: number) => boolean;
  /** Get page's group */
  getPageGroup: (pageIndex: number) => PageGroup | null;
  /** Validate group name */
  validateGroupName: (name: string, excludeGroupId?: string) => { valid: boolean; error?: string };
  /** Generate suggested group name */
  generateSuggestedGroupName: (pages: (PageSettings & PageSource)[], pageIndices: number[]) => string;
  /** Clear all groups */
  clearAllGroups: () => void;
}

const DEFAULT_GROUP_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#06b6d4', '#84cc16', '#f97316', '#ec4899', '#6b7280'
];

/**
 * Custom hook for managing page grouping
 */
export const usePageGrouping = (
  initialGroups: PageGroup[] = [],
  options: UsePageGroupingOptions = {}
): UsePageGroupingReturn => {
  const {
    maxGroups = 50,
    defaultGroupColor = DEFAULT_GROUP_COLORS[0],
    // autoExpandNew = true,
    onGroupLimitReached
  } = options;

  const [groups, setGroups] = useState<PageGroup[]>(initialGroups);

  /**
   * Generate unique group ID
   */
  const generateGroupId = useCallback((): string => {
    return `group_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }, []);

  /**
   * Get next available color
   */
  const getNextColor = useCallback((): string => {
    const usedColors = groups.map(g => g.color);
    const availableColor = DEFAULT_GROUP_COLORS.find(color => !usedColors.includes(color));
    return availableColor || defaultGroupColor;
  }, [groups, defaultGroupColor]);

  /**
   * Validate group name
   */
  const validateGroupName = useCallback((name: string, excludeGroupId?: string): { valid: boolean; error?: string } => {
    if (!name.trim()) {
      return { valid: false, error: 'Group name is required' };
    }

    if (name.trim().length > 50) {
      return { valid: false, error: 'Group name must be 50 characters or less' };
    }

    const existingGroup = groups.find(g => 
      g.name.toLowerCase() === name.trim().toLowerCase() && g.id !== excludeGroupId
    );

    if (existingGroup) {
      return { valid: false, error: 'Group name already exists' };
    }

    return { valid: true };
  }, [groups]);

  /**
   * Create new group
   */
  const createGroup = useCallback((
    name: string,
    pageIndices: number[],
    color?: string,
    type: 'auto' | 'manual' = 'manual'
  ): string | null => {
    if (groups.length >= maxGroups) {
      onGroupLimitReached?.(maxGroups);
      return null;
    }

    const validation = validateGroupName(name);
    if (!validation.valid) {
      console.warn(`Cannot create group: ${validation.error}`);
      return null;
    }

    const newGroup: PageGroup = {
      id: generateGroupId(),
      name: name.trim(),
      pageIndices: [...pageIndices],
      type,
      order: groups.length, // Add to end of current groups
      processingMode: { type: 'simplex' }, // Default processing mode
      color: color || getNextColor(),
      createdAt: Date.now(),
      modifiedAt: Date.now()
    };

    setGroups(prev => [...prev, newGroup]);
    return newGroup.id;
  }, [groups.length, maxGroups, onGroupLimitReached, validateGroupName, generateGroupId, getNextColor]);

  /**
   * Delete group
   */
  const deleteGroup = useCallback((groupId: string) => {
    setGroups(prev => prev.filter(g => g.id !== groupId));
  }, []);

  /**
   * Update group
   */
  const updateGroup = useCallback((groupId: string, updates: Partial<PageGroup>) => {
    setGroups(prev => prev.map(group => 
      group.id === groupId 
        ? { ...group, ...updates, modifiedAt: Date.now() }
        : group
    ));
  }, []);

  /**
   * Add pages to group
   */
  const addPagesToGroup = useCallback((groupId: string, pageIndices: number[]) => {
    setGroups(prev => prev.map(group => {
      if (group.id === groupId) {
        const newPageIndices = [...new Set([...group.pageIndices, ...pageIndices])];
        return { ...group, pageIndices: newPageIndices, modifiedAt: Date.now() };
      }
      return group;
    }));
  }, []);

  /**
   * Remove pages from group
   */
  const removePagesFromGroup = useCallback((groupId: string, pageIndices: number[]) => {
    const pageIndexSet = new Set(pageIndices);
    setGroups(prev => prev.map(group => {
      if (group.id === groupId) {
        const newPageIndices = group.pageIndices.filter(index => !pageIndexSet.has(index));
        return { ...group, pageIndices: newPageIndices, modifiedAt: Date.now() };
      }
      return group;
    }));
  }, []);

  /**
   * Move pages between groups
   */
  const movePagesBetweenGroups = useCallback((fromGroupId: string, toGroupId: string, pageIndices: number[]) => {
    removePagesFromGroup(fromGroupId, pageIndices);
    addPagesToGroup(toGroupId, pageIndices);
  }, [removePagesFromGroup, addPagesToGroup]);

  /**
   * Auto-group by file
   */
  const autoGroupByFile = useCallback((pages: (PageSettings & PageSource)[]) => {
    const fileGroups = new Map<string, number[]>();
    
    pages.forEach((page, index) => {
      if (!fileGroups.has(page.fileName)) {
        fileGroups.set(page.fileName, []);
      }
      fileGroups.get(page.fileName)!.push(index);
    });

    let colorIndex = 0;
    let orderIndex = groups.length;
    fileGroups.forEach((pageIndices, fileName) => {
      if (pageIndices.length > 1) {
        const groupId = createGroup(
          `File: ${fileName}`,
          pageIndices,
          DEFAULT_GROUP_COLORS[colorIndex % DEFAULT_GROUP_COLORS.length],
          'auto'
        );
        
        // Update the order for auto-created groups
        if (groupId) {
          setGroups(prev => prev.map(group => 
            group.id === groupId 
              ? { ...group, order: orderIndex }
              : group
          ));
          orderIndex++;
        }
        colorIndex++;
      }
    });
  }, [createGroup]);

  /**
   * Auto-group by page type
   */
  const autoGroupByType = useCallback((
    pages: (PageSettings & PageSource)[],
    pageTypeSettings: Record<string, PageTypeSettings>
  ) => {
    const typeGroups = new Map<string, number[]>();
    
    pages.forEach((page, index) => {
      const pageType = page.pageType || 'card';
      if (!typeGroups.has(pageType)) {
        typeGroups.set(pageType, []);
      }
      typeGroups.get(pageType)!.push(index);
    });

    let orderIndex = groups.length;
    typeGroups.forEach((pageIndices, pageType) => {
      if (pageIndices.length > 1) {
        const typeSettings = pageTypeSettings[pageType];
        const groupId = createGroup(
          `${typeSettings?.displayName || pageType} Pages`,
          pageIndices,
          typeSettings?.colorScheme.primary || DEFAULT_GROUP_COLORS[0],
          'auto'
        );
        
        // Update the order for auto-created groups
        if (groupId) {
          setGroups(prev => prev.map(group => 
            group.id === groupId 
              ? { ...group, order: orderIndex }
              : group
          ));
          orderIndex++;
        }
      }
    });
  }, [createGroup]);

  /**
   * Auto-group by processing mode
   */
  const autoGroupByProcessingMode = useCallback((pages: (PageSettings & PageSource)[]) => {
    const frontPages: number[] = [];
    const backPages: number[] = [];
    
    pages.forEach((page, index) => {
      if (page.type === 'front') {
        frontPages.push(index);
      } else if (page.type === 'back') {
        backPages.push(index);
      }
    });

    let orderIndex = groups.length;
    
    if (frontPages.length > 1) {
      const frontGroupId = createGroup('Front Pages', frontPages, '#3b82f6', 'auto');
      if (frontGroupId) {
        setGroups(prev => prev.map(group => 
          group.id === frontGroupId 
            ? { ...group, order: orderIndex }
            : group
        ));
        orderIndex++;
      }
    }
    
    if (backPages.length > 1) {
      const backGroupId = createGroup('Back Pages', backPages, '#10b981', 'auto');
      if (backGroupId) {
        setGroups(prev => prev.map(group => 
          group.id === backGroupId 
            ? { ...group, order: orderIndex }
            : group
        ));
      }
    }
  }, [createGroup]);

  /**
   * Get pages in a group
   */
  const getGroupPages = useCallback((groupId: string, pages: (PageSettings & PageSource)[]): (PageSettings & PageSource)[] => {
    const group = groups.find(g => g.id === groupId);
    if (!group) return [];
    
    return group.pageIndices
      .map(index => pages[index])
      .filter(Boolean);
  }, [groups]);

  /**
   * Get ungrouped pages
   */
  const getUngroupedPages = useCallback((pages: (PageSettings & PageSource)[]): (PageSettings & PageSource)[] => {
    const groupedIndices = new Set(
      groups.flatMap(group => group.pageIndices)
    );
    
    return pages.filter((_, index) => !groupedIndices.has(index));
  }, [groups]);

  /**
   * Get grouping statistics
   */
  const getGroupingStats = useCallback((pages: (PageSettings & PageSource)[]): GroupingStats => {
    const groupedIndices = new Set(groups.flatMap(group => group.pageIndices));
    const totalGroupedPages = groupedIndices.size;
    const totalUngroupedPages = pages.length - totalGroupedPages;
    
    const groupsByType = groups.reduce(
      (acc, group) => {
        acc[group.type]++;
        return acc;
      },
      { auto: 0, manual: 0 }
    );

    const averageGroupSize = groups.length > 0 
      ? totalGroupedPages / groups.length 
      : 0;

    return {
      totalGroups: groups.length,
      groupedPages: totalGroupedPages,
      ungroupedPages: totalUngroupedPages,
      groupsByType,
      averageGroupSize
    };
  }, [groups]);

  /**
   * Check if page is grouped
   */
  const isPageGrouped = useCallback((pageIndex: number): boolean => {
    return groups.some(group => group.pageIndices.includes(pageIndex));
  }, [groups]);

  /**
   * Get page's group
   */
  const getPageGroup = useCallback((pageIndex: number): PageGroup | null => {
    return groups.find(group => group.pageIndices.includes(pageIndex)) || null;
  }, [groups]);

  /**
   * Generate suggested group name
   */
  const generateSuggestedGroupName = useCallback((
    pages: (PageSettings & PageSource)[],
    pageIndices: number[]
  ): string => {
    if (pageIndices.length === 0) return 'New Group';

    const groupPages = pageIndices.map(i => pages[i]).filter(Boolean);
    
    // Check if all pages are from the same file
    const fileNames = [...new Set(groupPages.map(p => p.fileName))];
    if (fileNames.length === 1) {
      return `Pages from ${fileNames[0]}`;
    }

    // Check if all pages are the same type
    const pageTypes = [...new Set(groupPages.map(p => p.pageType))];
    if (pageTypes.length === 1 && pageTypes[0]) {
      return `${pageTypes[0]} Pages`;
    }

    // Check if all pages are the same card type
    const cardTypes = [...new Set(groupPages.map(p => p.type))];
    if (cardTypes.length === 1 && cardTypes[0]) {
      return `${cardTypes[0]} Cards`;
    }

    // Default
    return `Group of ${pageIndices.length} pages`;
  }, []);

  /**
   * Clear all groups
   */
  const clearAllGroups = useCallback(() => {
    setGroups([]);
  }, []);

  return {
    groups,
    setGroups,
    createGroup,
    deleteGroup,
    updateGroup,
    addPagesToGroup,
    removePagesFromGroup,
    movePagesBetweenGroups,
    autoGroupByFile,
    autoGroupByType,
    autoGroupByProcessingMode,
    getGroupPages,
    getUngroupedPages,
    getGroupingStats,
    isPageGrouped,
    getPageGroup,
    validateGroupName,
    generateSuggestedGroupName,
    clearAllGroups
  };
};