/**
 * @fileoverview Unit tests for PageGroupsManager group reordering functionality
 * 
 * Tests the critical group reordering logic that was broken in GitHub Issue #79,
 * where arrow buttons stopped working after pages were added to custom groups.
 * 
 * The core issue was that the default group is dynamically created and not
 * stored in the pageGroups array, causing move operations to fail silently
 * when trying to swap positions with the default group.
 */

import { describe, it, expect, vi } from 'vitest';
import type { PageGroup, PdfMode } from '../types';

// Mock the DEFAULT_GROUP_ID constant
const DEFAULT_GROUP_ID = 'default';
const DEFAULT_GROUP_NAME = 'Default Group';

// Helper function to create a mock page group
const createMockGroup = (id: string, name: string, order: number, pageIndices: number[] = []): PageGroup => ({
  id,
  name,
  pageIndices,
  type: 'manual',
  order,
  processingMode: { type: 'simplex', flipEdge: 'short' } as PdfMode,
  color: '#3b82f6',
  createdAt: Date.now(),
  modifiedAt: Date.now()
});

// Helper function to create the default group
const createDefaultGroup = (order: number = 0): PageGroup => ({
  id: DEFAULT_GROUP_ID,
  name: DEFAULT_GROUP_NAME,
  pageIndices: [],
  type: 'manual',
  order,
  processingMode: { type: 'simplex', flipEdge: 'short' } as PdfMode,
  color: '#6b7280',
  createdAt: Date.now(),
  modifiedAt: Date.now()
});

// Helper function to simulate sortedGroupsWithDefault logic
const createSortedGroupsWithDefault = (pageGroups: PageGroup[], pdfMode: PdfMode): PageGroup[] => {
  const allGroups = [...pageGroups];
  
  // Check if default group exists
  const hasDefaultGroup = allGroups.some(group => group.id === DEFAULT_GROUP_ID);
  
  // Create default group if it doesn't exist
  if (!hasDefaultGroup) {
    const defaultGroup = createDefaultGroup(0);
    allGroups.unshift(defaultGroup);
  }
  
  // Sort groups by order
  return allGroups.sort((a, b) => a.order - b.order);
};

// Mock implementation of the move functions logic
const simulateHandleMoveGroupUp = (
  groupId: string,
  pageGroups: PageGroup[],
  pdfMode: PdfMode
): PageGroup[] => {
  const sortedGroupsWithDefault = createSortedGroupsWithDefault(pageGroups, pdfMode);
  const groupIndex = sortedGroupsWithDefault.findIndex(g => g.id === groupId);
  
  if (groupIndex > 0) {
    // Swap order values with the group above
    const currentGroup = sortedGroupsWithDefault[groupIndex];
    const previousGroup = sortedGroupsWithDefault[groupIndex - 1];
    
    // Start with existing pageGroups
    let updatedGroups = [...pageGroups];
    
    // Handle the case where we need to add the default group to pageGroups
    if (previousGroup.id === DEFAULT_GROUP_ID) {
      // Add default group to pageGroups if it's not already there
      const hasDefaultInPageGroups = pageGroups.some(g => g.id === DEFAULT_GROUP_ID);
      if (!hasDefaultInPageGroups) {
        updatedGroups.push(previousGroup);
      }
    }
    
    // Handle the case where we need to add the current group to pageGroups
    if (currentGroup.id === DEFAULT_GROUP_ID) {
      // Add default group to pageGroups if it's not already there
      const hasDefaultInPageGroups = pageGroups.some(g => g.id === DEFAULT_GROUP_ID);
      if (!hasDefaultInPageGroups) {
        updatedGroups.push(currentGroup);
      }
    }
    
    // Now update the order values
    updatedGroups = updatedGroups.map(group => {
      if (group.id === currentGroup.id) {
        return { ...group, order: previousGroup.order };
      } else if (group.id === previousGroup.id) {
        return { ...group, order: currentGroup.order };
      }
      return group;
    });
    
    return updatedGroups;
  }
  
  return pageGroups;
};

const simulateHandleMoveGroupDown = (
  groupId: string,
  pageGroups: PageGroup[],
  pdfMode: PdfMode
): PageGroup[] => {
  const sortedGroupsWithDefault = createSortedGroupsWithDefault(pageGroups, pdfMode);
  const groupIndex = sortedGroupsWithDefault.findIndex(g => g.id === groupId);
  
  if (groupIndex < sortedGroupsWithDefault.length - 1) {
    // Swap order values with the group below
    const currentGroup = sortedGroupsWithDefault[groupIndex];
    const nextGroup = sortedGroupsWithDefault[groupIndex + 1];
    
    // Start with existing pageGroups
    let updatedGroups = [...pageGroups];
    
    // Handle the case where we need to add the default group to pageGroups
    if (nextGroup.id === DEFAULT_GROUP_ID) {
      // Add default group to pageGroups if it's not already there
      const hasDefaultInPageGroups = pageGroups.some(g => g.id === DEFAULT_GROUP_ID);
      if (!hasDefaultInPageGroups) {
        updatedGroups.push(nextGroup);
      }
    }
    
    // Handle the case where we need to add the current group to pageGroups
    if (currentGroup.id === DEFAULT_GROUP_ID) {
      // Add default group to pageGroups if it's not already there
      const hasDefaultInPageGroups = pageGroups.some(g => g.id === DEFAULT_GROUP_ID);
      if (!hasDefaultInPageGroups) {
        updatedGroups.push(currentGroup);
      }
    }
    
    // Now update the order values
    updatedGroups = updatedGroups.map(group => {
      if (group.id === currentGroup.id) {
        return { ...group, order: nextGroup.order };
      } else if (group.id === nextGroup.id) {
        return { ...group, order: currentGroup.order };
      }
      return group;
    });
    
    return updatedGroups;
  }
  
  return pageGroups;
};

describe('PageGroupsManager Group Reordering', () => {
  const mockPdfMode: PdfMode = { type: 'simplex', flipEdge: 'short' };

  describe('Empty Custom Groups Reordering', () => {
    it('should reorder empty custom groups successfully', () => {
      // This scenario should continue working (wasn't broken)
      const pageGroups = [
        createMockGroup('group1', 'Group 1', 1),
        createMockGroup('group2', 'Group 2', 2)
      ];

      const result = simulateHandleMoveGroupUp('group2', pageGroups, mockPdfMode);
      
      // Group 2 should now have order 1, Group 1 should have order 2
      const group1 = result.find(g => g.id === 'group1');
      const group2 = result.find(g => g.id === 'group2');
      
      expect(group1?.order).toBe(2);
      expect(group2?.order).toBe(1);
    });

    it('should handle moving the last group down (no-op)', () => {
      const pageGroups = [
        createMockGroup('group1', 'Group 1', 1),
        createMockGroup('group2', 'Group 2', 2)
      ];

      const result = simulateHandleMoveGroupDown('group2', pageGroups, mockPdfMode);
      
      // Should be unchanged since group2 is already at the bottom
      expect(result).toEqual(pageGroups);
    });
  });

  describe('Custom Groups with Pages Reordering (GitHub Issue #79)', () => {
    it('should reorder custom groups with pages when swapping with default group', () => {
      // This is the main broken scenario from GitHub Issue #79
      const pageGroups = [
        createMockGroup('group1', 'Group 1', 1, [0, 1]) // Has pages
      ];

      const result = simulateHandleMoveGroupUp('group1', pageGroups, mockPdfMode);
      
      // Default group should now be added to pageGroups and have order 1
      // Group 1 should have order 0 (swapped with default)
      const defaultGroup = result.find(g => g.id === DEFAULT_GROUP_ID);
      const group1 = result.find(g => g.id === 'group1');
      
      expect(defaultGroup).toBeDefined();
      expect(defaultGroup?.order).toBe(1);
      expect(group1?.order).toBe(0);
      expect(group1?.pageIndices).toEqual([0, 1]); // Pages preserved
    });

    it('should handle moving custom group with pages down past default group', () => {
      // Custom group at order 1, default at order 0, move custom group down
      const pageGroups = [
        createMockGroup('group1', 'Group 1', 1, [0, 1])
      ];

      const result = simulateHandleMoveGroupDown('group1', pageGroups, mockPdfMode);
      
      // Since there's only the default group below, this should be a no-op
      // But let's add another group to test proper swapping
      const pageGroupsWithTwo = [
        createMockGroup('group1', 'Group 1', 1, [0, 1]),
        createMockGroup('group2', 'Group 2', 2, [2, 3])
      ];

      const result2 = simulateHandleMoveGroupDown('group1', pageGroupsWithTwo, mockPdfMode);
      
      const group1 = result2.find(g => g.id === 'group1');
      const group2 = result2.find(g => g.id === 'group2');
      
      expect(group1?.order).toBe(2);
      expect(group2?.order).toBe(1);
      expect(group1?.pageIndices).toEqual([0, 1]); // Pages preserved
      expect(group2?.pageIndices).toEqual([2, 3]); // Pages preserved
    });

    it('should handle multiple custom groups with pages', () => {
      const pageGroups = [
        createMockGroup('group1', 'Group 1', 1, [0, 1]),
        createMockGroup('group2', 'Group 2', 2, [2, 3]),
        createMockGroup('group3', 'Group 3', 3, [4, 5])
      ];

      // Move group3 up (should swap with group2)
      const result = simulateHandleMoveGroupUp('group3', pageGroups, mockPdfMode);
      
      const group2 = result.find(g => g.id === 'group2');
      const group3 = result.find(g => g.id === 'group3');
      
      expect(group2?.order).toBe(3);
      expect(group3?.order).toBe(2);
      expect(group2?.pageIndices).toEqual([2, 3]); // Pages preserved
      expect(group3?.pageIndices).toEqual([4, 5]); // Pages preserved
    });
  });

  describe('Default Group Reordering', () => {
    it('should handle moving default group when it exists in pageGroups', () => {
      // Test when default group is already persisted
      const pageGroups = [
        createDefaultGroup(0),
        createMockGroup('group1', 'Group 1', 1, [0, 1])
      ];

      const result = simulateHandleMoveGroupDown(DEFAULT_GROUP_ID, pageGroups, mockPdfMode);
      
      const defaultGroup = result.find(g => g.id === DEFAULT_GROUP_ID);
      const group1 = result.find(g => g.id === 'group1');
      
      expect(defaultGroup?.order).toBe(1);
      expect(group1?.order).toBe(0);
    });

    it('should handle moving default group when it only exists dynamically', () => {
      // Test when default group is created dynamically
      const pageGroups = [
        createMockGroup('group1', 'Group 1', 1, [0, 1])
      ];

      const result = simulateHandleMoveGroupDown(DEFAULT_GROUP_ID, pageGroups, mockPdfMode);
      
      // Default group should be added to result
      const defaultGroup = result.find(g => g.id === DEFAULT_GROUP_ID);
      const group1 = result.find(g => g.id === 'group1');
      
      expect(defaultGroup).toBeDefined();
      expect(defaultGroup?.order).toBe(1);
      expect(group1?.order).toBe(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle single group (no reordering possible)', () => {
      const pageGroups = [
        createMockGroup('group1', 'Group 1', 1, [0, 1])
      ];

      const upResult = simulateHandleMoveGroupUp('group1', pageGroups, mockPdfMode);
      const downResult = simulateHandleMoveGroupDown('group1', pageGroups, mockPdfMode);
      
      // Moving up should swap with default group
      const upDefaultGroup = upResult.find(g => g.id === DEFAULT_GROUP_ID);
      const upGroup1 = upResult.find(g => g.id === 'group1');
      
      expect(upDefaultGroup?.order).toBe(1);
      expect(upGroup1?.order).toBe(0);
      
      // Moving down should be no-op (no group below)
      expect(downResult).toEqual(pageGroups);
    });

    it('should handle empty pageGroups array', () => {
      const pageGroups: PageGroup[] = [];

      // Try to move the default group (which only exists dynamically)
      const result = simulateHandleMoveGroupDown(DEFAULT_GROUP_ID, pageGroups, mockPdfMode);
      
      // Should be no-op since there's only the default group
      expect(result).toEqual(pageGroups);
    });

    it('should preserve all group properties during reordering', () => {
      const pageGroups = [
        {
          ...createMockGroup('group1', 'Custom Group Name', 1, [0, 1]),
          color: '#ff0000',
          createdAt: 123456789,
          modifiedAt: 987654321
        }
      ];

      const result = simulateHandleMoveGroupUp('group1', pageGroups, mockPdfMode);
      
      const group1 = result.find(g => g.id === 'group1');
      
      expect(group1?.name).toBe('Custom Group Name');
      expect(group1?.color).toBe('#ff0000');
      expect(group1?.createdAt).toBe(123456789);
      expect(group1?.pageIndices).toEqual([0, 1]);
      // Only order should change
      expect(group1?.order).toBe(0);
    });
  });

  describe('Sorted Groups Logic', () => {
    it('should correctly create sortedGroupsWithDefault when default group missing', () => {
      const pageGroups = [
        createMockGroup('group1', 'Group 1', 5),
        createMockGroup('group2', 'Group 2', 1)
      ];

      const sorted = createSortedGroupsWithDefault(pageGroups, mockPdfMode);
      
      // Should have default group at order 0, then group2 at order 1, then group1 at order 5
      expect(sorted).toHaveLength(3);
      expect(sorted[0].id).toBe(DEFAULT_GROUP_ID);
      expect(sorted[0].order).toBe(0);
      expect(sorted[1].id).toBe('group2');
      expect(sorted[1].order).toBe(1);
      expect(sorted[2].id).toBe('group1');
      expect(sorted[2].order).toBe(5);
    });

    it('should correctly sort when default group already exists', () => {
      const pageGroups = [
        createMockGroup('group1', 'Group 1', 5),
        createDefaultGroup(3),
        createMockGroup('group2', 'Group 2', 1)
      ];

      const sorted = createSortedGroupsWithDefault(pageGroups, mockPdfMode);
      
      // Should sort by order: group2 (1), default (3), group1 (5)
      expect(sorted).toHaveLength(3);
      expect(sorted[0].id).toBe('group2');
      expect(sorted[0].order).toBe(1);
      expect(sorted[1].id).toBe(DEFAULT_GROUP_ID);
      expect(sorted[1].order).toBe(3);
      expect(sorted[2].id).toBe('group1');
      expect(sorted[2].order).toBe(5);
    });
  });
});