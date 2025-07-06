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
  Info
} from 'lucide-react';
import { PageSettings, PageSource, PageGroup, ExtractionSettings, PdfMode } from '../../../types';
import { getActivePagesWithSource } from '../../../utils/cardUtils';
import { GroupSelector } from './GroupSelector';

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
  /** Global PDF mode (used for default group) */
  globalPdfMode: PdfMode;
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
  processingMode: PdfMode;
}

/**
 * Group Context Bar Component
 */
export const GroupContextBar: React.FC<GroupContextBarProps> = ({
  pages,
  groups,
  activeGroupId,
  extractionSettings,
  globalPdfMode,
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
        hasSettings: Boolean(extractionSettings),
        processingMode: globalPdfMode
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
          hasSettings: Boolean(group.settings?.extraction),
          processingMode: group.processingMode || globalPdfMode
        });
      });

    return statusList;
  }, [activePages, pages, groups, extractionSettings, globalPdfMode]);

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


  if (groups.length === 0 && !activeGroupId) {
    // No groups exist, don't show the component
    return null;
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
      {/* Main group selection area */}
      <div className="flex items-center justify-between">
        {/* Left side: Context label */}
        <div className="flex items-center space-x-2">
          <span className="text-sm font-medium text-gray-700">Configuring Group:</span>
        </div>

        {/* Right side: Group selector dropdown */}
        <GroupSelector
          groups={groups}
          activeGroupId={activeGroupId}
          groupOptions={groupStatusInfo}
          globalPdfMode={globalPdfMode}
          onGroupSelect={handleGroupSelect}
          disabled={disabled}
          className="min-w-[250px]"
        />
      </div>

      {/* Settings context message */}
      <div className="mt-4 pt-3 border-t border-gray-100">
        <div className="flex items-start space-x-2 text-sm text-blue-700 bg-blue-50 px-3 py-2 rounded-md">
          <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-medium">Group-Specific Settings</p>
            <p className="mt-1 text-blue-600">
              Extraction settings on this page apply to <strong>{currentGroupStatus.name}</strong> only.
              {currentGroupStatus.pageCount > 1 && ` Changes will affect all ${currentGroupStatus.pageCount} pages in this group.`}
            </p>
          </div>
        </div>
      </div>

      {/* Quick group overview for multi-group workflows */}
      {groupStatusInfo.length > 1 && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">
              {groupStatusInfo.length} groups total • {groupStatusInfo.reduce((sum, g) => sum + g.pageCount, 0)} pages
            </span>
            <span className="text-gray-500">
              Use dropdown above to switch between groups
            </span>
          </div>
        </div>
      )}
    </div>
  );
};