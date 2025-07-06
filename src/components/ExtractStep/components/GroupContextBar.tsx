/**
 * @fileoverview Group Context Bar Component for ExtractStep
 * 
 * This component provides group navigation and context information for the
 * extraction step in a unified page management workflow. It allows users to
 * switch between page groups and understand which group they're currently
 * configuring.
 * 
 * **Key Features:**
 * - Group selector with visual indicators
 * - Progress tracking for each group
 * - Clear visual feedback about current context
 * - Page count and group information display
 * 
 * @author Card Game PDF Transformer
 */

import React, { useMemo, useCallback } from 'react';
import { 
  ChevronDown, 
  Users, 
  CheckCircle, 
  AlertCircle, 
  Circle,
  FileText,
  Settings
} from 'lucide-react';
import { PageSettings, PageSource, PageGroup, ExtractionSettings } from '../../../types';
import { getActivePagesWithSource } from '../../../utils/cardUtils';

// Constants for default group (matching PageGroupsManager)
const DEFAULT_GROUP_ID = 'default';
const DEFAULT_GROUP_NAME = 'Default Group';

interface GroupContextBarProps {
  /** All available pages */
  pages: (PageSettings & PageSource)[];
  /** Current page groups */
  groups: PageGroup[];
  /** Currently active group ID (null for all pages) */
  activeGroupId: string | null;
  /** Current extraction settings */
  extractionSettings: ExtractionSettings;
  /** Callback when active group changes */
  onActiveGroupChange: (groupId: string | null) => void;
  /** Whether the component is disabled */
  disabled?: boolean;
}

interface GroupStatusInfo {
  id: string | null;
  name: string;
  pageCount: number;
  color?: string;
  isConfigured: boolean;
  hasSettings: boolean;
}

/**
 * Group Context Bar Component
 */
export const GroupContextBar: React.FC<GroupContextBarProps> = ({
  pages,
  groups,
  activeGroupId,
  extractionSettings,
  onActiveGroupChange,
  disabled = false
}) => {
  /**
   * Get only active pages (exclude removed/skipped pages)
   */
  const activePages = useMemo(() => {
    return getActivePagesWithSource(pages);
  }, [pages]);

  /**
   * Get the currently active group
   */
  const activeGroup = useMemo(() => {
    return activeGroupId ? groups.find(g => g.id === activeGroupId) : null;
  }, [activeGroupId, groups]);

  /**
   * Get pages for the current group
   */
  const currentGroupPages = useMemo(() => {
    if (!activeGroup) {
      // No active group, show default group (ungrouped active pages)
      const groupedPageIndices = new Set(
        groups
          .filter(g => g.id !== DEFAULT_GROUP_ID)
          .flatMap(g => g.pageIndices)
      );
      
      // Filter active pages to exclude those in custom groups
      return activePages.filter((page, originalIndex) => {
        // Find the original index in the pages array
        const pageOriginalIndex = pages.findIndex(p => p === page);
        return !groupedPageIndices.has(pageOriginalIndex);
      });
    }
    
    // For custom groups, get the active pages that belong to this group
    const groupPages = activeGroup.pageIndices
      .map(index => pages[index])
      .filter(Boolean);
    
    return getActivePagesWithSource(groupPages);
  }, [activeGroup, activePages, pages, groups]);

  /**
   * Calculate group status information
   */
  const groupStatusInfo = useMemo((): GroupStatusInfo[] => {
    const statusList: GroupStatusInfo[] = [];

    // Ensure we have a default group and calculate ungrouped pages
    const allGroups = [...groups];
    const hasDefaultGroup = allGroups.some(group => group.id === DEFAULT_GROUP_ID);
    
    if (!hasDefaultGroup) {
      // Create virtual default group
      const defaultGroup: PageGroup = {
        id: DEFAULT_GROUP_ID,
        name: DEFAULT_GROUP_NAME,
        pageIndices: [],
        type: 'manual',
        order: 0,
        processingMode: { type: 'simplex' }, // Default processing mode
        color: '#6b7280',
        createdAt: Date.now(),
        modifiedAt: Date.now()
      };
      allGroups.unshift(defaultGroup);
    }

    // Calculate ungrouped active pages (default group)
    const groupedPageIndices = new Set(
      groups
        .filter(g => g.id !== DEFAULT_GROUP_ID)
        .flatMap(g => g.pageIndices)
    );
    
    // Get active pages that are not in any custom group
    const ungroupedActivePages = activePages.filter(page => {
      const pageOriginalIndex = pages.findIndex(p => p === page);
      return !groupedPageIndices.has(pageOriginalIndex);
    });

    // Add default group
    const defaultGroup = allGroups.find(g => g.id === DEFAULT_GROUP_ID);
    if (defaultGroup) {
      statusList.push({
        id: DEFAULT_GROUP_ID,
        name: DEFAULT_GROUP_NAME,
        pageCount: ungroupedActivePages.length,
        color: '#6b7280',
        isConfigured: true, // Default group uses global settings
        hasSettings: Boolean(extractionSettings)
      });
    }

    // Add custom groups
    groups
      .filter(group => group.id !== DEFAULT_GROUP_ID)
      .sort((a, b) => a.order - b.order)
      .forEach(group => {
        const groupPages = group.pageIndices
          .map(index => pages[index])
          .filter(Boolean);
        
        // Count only active pages in this group
        const activeGroupPages = getActivePagesWithSource(groupPages);
        
        statusList.push({
          id: group.id,
          name: group.name,
          pageCount: activeGroupPages.length,
          color: group.color,
          isConfigured: Boolean(group.settings?.extraction),
          hasSettings: Boolean(group.settings?.extraction)
        });
      });

    return statusList;
  }, [activePages, pages, groups, extractionSettings]);

  /**
   * Get current group status
   */
  const currentGroupStatus = useMemo(() => {
    // If no active group, default to Default Group (first in list)
    const targetGroupId = activeGroupId !== null ? activeGroupId : DEFAULT_GROUP_ID;
    return groupStatusInfo.find(status => status.id === targetGroupId) || groupStatusInfo[0];
  }, [groupStatusInfo, activeGroupId]);

  /**
   * Handle group selection
   */
  const handleGroupSelect = useCallback((groupId: string | null) => {
    if (!disabled) {
      onActiveGroupChange(groupId);
    }
  }, [disabled, onActiveGroupChange]);

  /**
   * Get status icon for a group
   */
  const getStatusIcon = useCallback((status: GroupStatusInfo) => {
    if (status.isConfigured) {
      return <CheckCircle className="w-4 h-4 text-green-500" />;
    } else if (status.hasSettings) {
      return <AlertCircle className="w-4 h-4 text-yellow-500" />;
    } else {
      return <Circle className="w-4 h-4 text-gray-400" />;
    }
  }, []);


  if (groups.length === 0 && !activeGroupId) {
    // No groups exist, don't show the component
    return null;
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
      <div className="flex items-center justify-between">
        {/* Left side: Current group info */}
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <Users className="w-5 h-5 text-gray-500" />
            <span className="text-sm font-medium text-gray-700">Configuring Group:</span>
          </div>
          
          {/* Current group indicator */}
          <div className="flex items-center space-x-2">
            {currentGroupStatus.color && (
              <div 
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: currentGroupStatus.color }}
              />
            )}
            <span className="font-semibold text-gray-900">
              {currentGroupStatus.name}
            </span>
            <span className="text-sm text-gray-500">
              ({currentGroupStatus.pageCount} pages)
            </span>
          </div>

        </div>

        {/* Right side: Group selector */}
        <div className="relative">
          <button
            onClick={() => {
              // Simple click handler - cycle through groups
              const currentIndex = groupStatusInfo.findIndex(g => g.id === (activeGroupId || DEFAULT_GROUP_ID));
              const nextIndex = (currentIndex + 1) % groupStatusInfo.length;
              const nextGroup = groupStatusInfo[nextIndex];
              handleGroupSelect(nextGroup.id === DEFAULT_GROUP_ID ? null : nextGroup.id);
            }}
            disabled={disabled}
            className="flex items-center space-x-2 px-3 py-2 border border-gray-300 rounded-md text-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Settings className="w-4 h-4" />
            <span>Switch Group</span>
            <ChevronDown className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Settings context message */}
      <div className="mt-3 pt-3 border-t border-gray-100">
        <div className="flex items-center space-x-2 text-sm text-blue-700 bg-blue-50 px-3 py-2 rounded-md">
          <FileText className="w-4 h-4" />
          <span>
            Extraction settings on this page apply to <strong>{currentGroupStatus.name}</strong> only.
            {currentGroupStatus.pageCount > 1 && ` Changes will affect all ${currentGroupStatus.pageCount} pages in this group.`}
          </span>
        </div>
      </div>

      {/* Group status overview */}
      {groupStatusInfo.length > 1 && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <div className="flex items-center space-x-4">
            <span className="text-sm font-medium text-gray-700">All Groups:</span>
            <div className="flex items-center space-x-3">
              {groupStatusInfo.map(status => (
                <button
                  key={status.id}
                  onClick={() => handleGroupSelect(status.id === DEFAULT_GROUP_ID ? null : status.id)}
                  disabled={disabled}
                  className={`
                    flex items-center space-x-2 px-2 py-1 rounded-md text-xs transition-colors
                    ${(activeGroupId === null && status.id === DEFAULT_GROUP_ID) || status.id === activeGroupId 
                      ? 'bg-indigo-100 text-indigo-800 border border-indigo-200' 
                      : 'hover:bg-gray-100 text-gray-600'
                    }
                  `}
                >
                  {getStatusIcon(status)}
                  {status.color && (
                    <div 
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: status.color }}
                    />
                  )}
                  <span>{status.name}</span>
                  <span className="text-gray-500">({status.pageCount})</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};