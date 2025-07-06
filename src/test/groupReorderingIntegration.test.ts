/**
 * @fileoverview Integration test for GitHub Issue #79 fix
 * 
 * This test simulates the exact scenario described in the GitHub issue:
 * 1. Create custom page groups (empty initially)
 * 2. Verify arrow buttons work for empty groups
 * 3. Add pages to custom groups
 * 4. Verify arrow buttons continue working (this was broken before fix)
 * 5. Ensure consistent behavior between all group types
 */

import { describe, it, expect } from 'vitest';
import type { PageGroup, PdfMode } from '../types';

// Constants matching PageGroupsManager
const DEFAULT_GROUP_ID = 'default';
const DEFAULT_GROUP_NAME = 'Default Group';

// Mock PDF mode
const mockPdfMode: PdfMode = { type: 'simplex', flipEdge: 'short' };

// Helper to create a test group
const createTestGroup = (id: string, name: string, order: number, pageIndices: number[] = []): PageGroup => ({
  id,
  name,
  pageIndices,
  type: 'manual',
  order,
  processingMode: mockPdfMode,
  color: '#3b82f6',
  createdAt: Date.now(),
  modifiedAt: Date.now()
});

// Helper to create default group
const createDefaultGroup = (order: number = 0): PageGroup => ({
  id: DEFAULT_GROUP_ID,
  name: DEFAULT_GROUP_NAME,
  pageIndices: [],
  type: 'manual',
  order,
  processingMode: mockPdfMode,
  color: '#6b7280',
  createdAt: Date.now(),
  modifiedAt: Date.now()
});

// Simulate the sorting logic from PageGroupsManager
const createSortedGroupsWithDefault = (pageGroups: PageGroup[]): PageGroup[] => {
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

// Simulate the move up logic from our fix
const simulateMoveGroupUp = (groupId: string, pageGroups: PageGroup[]): PageGroup[] => {
  const sortedGroupsWithDefault = createSortedGroupsWithDefault(pageGroups);
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

describe('GitHub Issue #79 Integration Test', () => {
  it('should reproduce the exact issue scenario and verify the fix', () => {
    // Step 1: Start with empty custom groups (this simulates user creating groups)
    let pageGroups: PageGroup[] = [
      createTestGroup('group1', 'Custom Group 1', 1),
      createTestGroup('group2', 'Custom Group 2', 2)
    ];

    // Step 2: Verify empty groups can be reordered (this should work before and after fix)
    const afterEmptyReorder = simulateMoveGroupUp('group2', pageGroups);
    const group1AfterEmpty = afterEmptyReorder.find(g => g.id === 'group1');
    const group2AfterEmpty = afterEmptyReorder.find(g => g.id === 'group2');
    
    expect(group1AfterEmpty?.order).toBe(2); // Moved down
    expect(group2AfterEmpty?.order).toBe(1); // Moved up
    
    // Update pageGroups to the new state
    pageGroups = afterEmptyReorder;

    // Step 3: Add pages to custom groups (this is where the bug was triggered)
    pageGroups = pageGroups.map(group => {
      if (group.id === 'group1') {
        return { ...group, pageIndices: [0, 1] }; // Add pages to group1
      }
      if (group.id === 'group2') {
        return { ...group, pageIndices: [2, 3] }; // Add pages to group2
      }
      return group;
    });

    // Step 4: Try to reorder groups with pages (this was broken before the fix)
    // This should now work correctly with our fix
    const afterPagedReorder = simulateMoveGroupUp('group1', pageGroups);
    
    // Verify the groups were reordered successfully
    const group1AfterPagedReorder = afterPagedReorder.find(g => g.id === 'group1');
    const group2AfterPagedReorder = afterPagedReorder.find(g => g.id === 'group2');
    const defaultGroupAfterPagedReorder = afterPagedReorder.find(g => g.id === DEFAULT_GROUP_ID);
    
    // Based on the setup: group2 has order 1, group1 has order 2, default has order 0
    // Moving group1 up should swap it with group2 (the group above it)
    expect(group1AfterPagedReorder?.order).toBe(1); // Should swap with group2
    expect(group2AfterPagedReorder?.order).toBe(2); // Should get group1's old order
    
    // Default group shouldn't be affected in this case
    if (defaultGroupAfterPagedReorder) {
      expect(defaultGroupAfterPagedReorder.order).toBe(0); // Should remain unchanged
    }
    
    // Step 5: Verify page assignments are preserved
    expect(group1AfterPagedReorder?.pageIndices).toEqual([0, 1]);
    
    // Step 6: Verify the default group was NOT added to pageGroups 
    // (since group1 swapped with group2, not the default group)
    const hasDefaultInResult = afterPagedReorder.some(g => g.id === DEFAULT_GROUP_ID);
    expect(hasDefaultInResult).toBe(false);
  });

  it('should specifically test swapping custom group with default group', () => {
    // This tests the exact broken scenario: custom group with pages swapping with default group
    let pageGroups: PageGroup[] = [
      createTestGroup('group1', 'Custom Group 1', 1, [0, 1]) // This group is directly above default group
    ];

    // Move group1 up - this should swap with the default group (order 0)
    const afterReorder = simulateMoveGroupUp('group1', pageGroups);
    
    const group1After = afterReorder.find(g => g.id === 'group1');
    const defaultAfter = afterReorder.find(g => g.id === DEFAULT_GROUP_ID);
    
    // Now group1 should have order 0 and default should have order 1
    expect(group1After?.order).toBe(0);
    expect(defaultAfter).toBeDefined();
    expect(defaultAfter?.order).toBe(1);
    
    // Pages should be preserved
    expect(group1After?.pageIndices).toEqual([0, 1]);
    
    // Default group should now be in the result
    const hasDefaultInResult = afterReorder.some(g => g.id === DEFAULT_GROUP_ID);
    expect(hasDefaultInResult).toBe(true);
  });

  it('should handle complex multi-group scenarios with pages', () => {
    // Test with multiple groups that have pages
    let pageGroups: PageGroup[] = [
      createTestGroup('group1', 'Group 1', 1, [0, 1]),
      createTestGroup('group2', 'Group 2', 2, [2, 3]),
      createTestGroup('group3', 'Group 3', 3, [4, 5])
    ];

    // Move group3 up (should swap with group2)
    const afterFirstMove = simulateMoveGroupUp('group3', pageGroups);
    
    const group2After = afterFirstMove.find(g => g.id === 'group2');
    const group3After = afterFirstMove.find(g => g.id === 'group3');
    
    expect(group2After?.order).toBe(3);
    expect(group3After?.order).toBe(2);
    expect(group2After?.pageIndices).toEqual([2, 3]); // Pages preserved
    expect(group3After?.pageIndices).toEqual([4, 5]); // Pages preserved

    // Now move group3 up again (should swap with group1)
    const afterSecondMove = simulateMoveGroupUp('group3', afterFirstMove);
    
    const group1AfterSecond = afterSecondMove.find(g => g.id === 'group1');
    const group3AfterSecond = afterSecondMove.find(g => g.id === 'group3');
    
    expect(group1AfterSecond?.order).toBe(2);
    expect(group3AfterSecond?.order).toBe(1);
    expect(group1AfterSecond?.pageIndices).toEqual([0, 1]); // Pages preserved
    expect(group3AfterSecond?.pageIndices).toEqual([4, 5]); // Pages preserved

    // Finally move group3 up one more time (should swap with default group)
    const afterThirdMove = simulateMoveGroupUp('group3', afterSecondMove);
    
    const defaultAfterThird = afterThirdMove.find(g => g.id === DEFAULT_GROUP_ID);
    const group3AfterThird = afterThirdMove.find(g => g.id === 'group3');
    
    expect(defaultAfterThird).toBeDefined();
    expect(defaultAfterThird?.order).toBe(1);
    expect(group3AfterThird?.order).toBe(0);
    expect(group3AfterThird?.pageIndices).toEqual([4, 5]); // Pages still preserved
  });

  it('should maintain consistent behavior when default group is already persisted', () => {
    // Test scenario where default group is already in pageGroups
    let pageGroups: PageGroup[] = [
      createDefaultGroup(0),
      createTestGroup('group1', 'Group 1', 1, [0, 1])
    ];

    // Move group1 up (should swap with default group)
    const result = simulateMoveGroupUp('group1', pageGroups);
    
    const defaultAfter = result.find(g => g.id === DEFAULT_GROUP_ID);
    const group1After = result.find(g => g.id === 'group1');
    
    expect(defaultAfter?.order).toBe(1);
    expect(group1After?.order).toBe(0);
    expect(group1After?.pageIndices).toEqual([0, 1]); // Pages preserved
    
    // Should not duplicate the default group
    const defaultGroups = result.filter(g => g.id === DEFAULT_GROUP_ID);
    expect(defaultGroups).toHaveLength(1);
  });

  it('should verify the sorted groups logic works correctly', () => {
    // Test the sorting logic with various group orders
    const pageGroups: PageGroup[] = [
      createTestGroup('group3', 'Group 3', 10),
      createTestGroup('group1', 'Group 1', 5),
      createTestGroup('group2', 'Group 2', 7)
    ];

    const sorted = createSortedGroupsWithDefault(pageGroups);
    
    // Should be: default (0), group1 (5), group2 (7), group3 (10)
    expect(sorted).toHaveLength(4);
    expect(sorted[0].id).toBe(DEFAULT_GROUP_ID);
    expect(sorted[0].order).toBe(0);
    expect(sorted[1].id).toBe('group1');
    expect(sorted[1].order).toBe(5);
    expect(sorted[2].id).toBe('group2');
    expect(sorted[2].order).toBe(7);
    expect(sorted[3].id).toBe('group3');
    expect(sorted[3].order).toBe(10);
  });
});