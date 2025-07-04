/**
 * @fileoverview Page Group Navigator Component
 * 
 * This component provides navigation and filtering capabilities based on page groups
 * in the unified page management system. It allows users to quickly navigate between
 * groups and filter pages based on group membership.
 * 
 * **Key Features:**
 * - Group-based navigation
 * - Filter by group
 * - Quick group switching
 * - Group overview with statistics
 * - Breadcrumb navigation
 * 
 * @author Card Game PDF Transformer
 */

import React, { useState, useCallback, useMemo } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  Filter, 
  Home, 
  Users, 
  Eye,
  BarChart3,
  Layers
} from 'lucide-react';
import { PageSettings, PageSource, PageGroup, PageTypeSettings } from '../../types';

interface PageGroupNavigatorProps {
  /** Current page list */
  pages: (PageSettings & PageSource)[];
  /** Current page groups */
  groups: PageGroup[];
  /** Page type settings */
  pageTypeSettings: Record<string, PageTypeSettings>;
  /** Currently active group ID (null for all pages) */
  activeGroupId: string | null;
  /** Current page index within the active view */
  currentPageIndex: number;
  /** Callback when active group changes */
  onActiveGroupChange: (groupId: string | null) => void;
  /** Callback when page navigation changes */
  onPageNavigation: (pageIndex: number) => void;
  /** Whether navigation is disabled */
  disabled?: boolean;
  /** Whether to show statistics */
  showStats?: boolean;
}

interface GroupStats {
  totalPages: number;
  pageTypes: Record<string, number>;
  cardTypes: Record<string, number>;
}

/**
 * Page Group Navigator Component
 */
export const PageGroupNavigator: React.FC<PageGroupNavigatorProps> = ({
  pages,
  groups,
  pageTypeSettings,
  activeGroupId,
  currentPageIndex,
  onActiveGroupChange,
  onPageNavigation,
  disabled = false,
  showStats = true
}) => {
  const [showGroupList, setShowGroupList] = useState(false);

  /**
   * Get the currently active group
   */
  const activeGroup = useMemo(() => {
    return activeGroupId ? groups.find(g => g.id === activeGroupId) : null;
  }, [activeGroupId, groups]);

  /**
   * Get pages for the current view (all pages or group pages)
   */
  const currentViewPages = useMemo(() => {
    if (!activeGroup) {
      return pages;
    }
    
    return activeGroup.pageIndices
      .map(index => pages[index])
      .filter(Boolean);
  }, [activeGroup, pages]);

  /**
   * Calculate statistics for current view
   */
  const currentViewStats = useMemo((): GroupStats => {
    const stats: GroupStats = {
      totalPages: currentViewPages.length,
      pageTypes: {},
      cardTypes: {}
    };

    currentViewPages.forEach(page => {
      // Count page types
      const pageType = page.pageType || 'card';
      stats.pageTypes[pageType] = (stats.pageTypes[pageType] || 0) + 1;

      // Count card types
      const cardType = page.type || 'front';
      stats.cardTypes[cardType] = (stats.cardTypes[cardType] || 0) + 1;
    });

    return stats;
  }, [currentViewPages]);

  /**
   * Get navigation info
   */
  const navigationInfo = useMemo(() => {
    const totalPages = currentViewPages.length;
    const currentIndex = Math.max(0, Math.min(currentPageIndex, totalPages - 1));
    const hasNext = currentIndex < totalPages - 1;
    const hasPrevious = currentIndex > 0;

    return {
      currentIndex,
      totalPages,
      hasNext,
      hasPrevious,
      currentPage: currentViewPages[currentIndex]
    };
  }, [currentViewPages, currentPageIndex]);

  /**
   * Handle group selection
   */
  const handleGroupSelect = useCallback((groupId: string | null) => {
    onActiveGroupChange(groupId);
    onPageNavigation(0); // Reset to first page
    setShowGroupList(false);
  }, [onActiveGroupChange, onPageNavigation]);

  /**
   * Handle navigation
   */
  const handlePrevious = useCallback(() => {
    if (navigationInfo.hasPrevious) {
      onPageNavigation(navigationInfo.currentIndex - 1);
    }
  }, [navigationInfo.hasPrevious, navigationInfo.currentIndex, onPageNavigation]);

  const handleNext = useCallback(() => {
    if (navigationInfo.hasNext) {
      onPageNavigation(navigationInfo.currentIndex + 1);
    }
  }, [navigationInfo.hasNext, navigationInfo.currentIndex, onPageNavigation]);

  /**
   * Handle direct page navigation
   */
  const handleDirectNavigation = useCallback((targetIndex: number) => {
    const clampedIndex = Math.max(0, Math.min(targetIndex, navigationInfo.totalPages - 1));
    onPageNavigation(clampedIndex);
  }, [navigationInfo.totalPages, onPageNavigation]);

  if (pages.length === 0) {
    return null;
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      {/* Header with breadcrumb */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <Layers className="w-5 h-5 text-gray-500" />
          
          {/* Breadcrumb */}
          <div className="flex items-center space-x-2 text-sm">
            <button
              onClick={() => handleGroupSelect(null)}
              className={`
                flex items-center space-x-1 px-2 py-1 rounded-md transition-colors
                ${!activeGroupId 
                  ? 'bg-indigo-100 text-indigo-800' 
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }
              `}
              disabled={disabled}
            >
              <Home className="w-4 h-4" />
              <span>All Pages</span>
            </button>
            
            {activeGroup && (
              <>
                <ChevronRight className="w-4 h-4 text-gray-400" />
                <div className="flex items-center space-x-2 px-2 py-1 bg-indigo-100 text-indigo-800 rounded-md">
                  <div 
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: activeGroup.color }}
                  />
                  <span className="font-medium">{activeGroup.name}</span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Group selector */}
        <div className="relative">
          <button
            onClick={() => setShowGroupList(!showGroupList)}
            disabled={disabled}
            className="flex items-center space-x-2 px-3 py-1 border border-gray-300 rounded-md text-sm hover:bg-gray-50 disabled:opacity-50"
          >
            <Filter className="w-4 h-4" />
            <span>Filter</span>
          </button>

          {showGroupList && (
            <div className="absolute right-0 top-full mt-1 w-64 bg-white border border-gray-200 rounded-md shadow-lg z-10 max-h-64 overflow-y-auto">
              <div className="p-2">
                {/* All pages option */}
                <button
                  onClick={() => handleGroupSelect(null)}
                  className={`
                    w-full text-left px-3 py-2 rounded-md text-sm transition-colors
                    ${!activeGroupId 
                      ? 'bg-indigo-100 text-indigo-800' 
                      : 'hover:bg-gray-100'
                    }
                  `}
                >
                  <div className="flex items-center space-x-2">
                    <Home className="w-4 h-4" />
                    <span>All Pages ({pages.length})</span>
                  </div>
                </button>

                {/* Group options */}
                {groups.map(group => (
                  <button
                    key={group.id}
                    onClick={() => handleGroupSelect(group.id)}
                    className={`
                      w-full text-left px-3 py-2 rounded-md text-sm transition-colors
                      ${activeGroupId === group.id 
                        ? 'bg-indigo-100 text-indigo-800' 
                        : 'hover:bg-gray-100'
                      }
                    `}
                  >
                    <div className="flex items-center space-x-2">
                      <div 
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: group.color }}
                      />
                      <span>{group.name} ({group.pageIndices.length})</span>
                      {group.type === 'auto' && (
                        <span className="px-1 py-0.5 bg-blue-100 text-blue-800 text-xs rounded">
                          Auto
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Navigation controls */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <button
            onClick={handlePrevious}
            disabled={disabled || !navigationInfo.hasPrevious}
            className="p-2 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-600">Page</span>
            <input
              type="number"
              min="1"
              max={navigationInfo.totalPages}
              value={navigationInfo.currentIndex + 1}
              onChange={(e) => {
                const value = parseInt(e.target.value) - 1;
                if (!isNaN(value)) {
                  handleDirectNavigation(value);
                }
              }}
              disabled={disabled}
              className="w-16 px-2 py-1 text-sm border border-gray-300 rounded-md text-center"
            />
            <span className="text-sm text-gray-600">of {navigationInfo.totalPages}</span>
          </div>

          <button
            onClick={handleNext}
            disabled={disabled || !navigationInfo.hasNext}
            className="p-2 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Current page info */}
        {navigationInfo.currentPage && (
          <div className="flex items-center space-x-3 text-sm">
            <span className="text-gray-600">
              {navigationInfo.currentPage.fileName}
            </span>
            {navigationInfo.currentPage.pageType && (
              <span className={`
                px-2 py-1 rounded-md text-xs font-medium
                ${navigationInfo.currentPage.pageType === 'card' ? 'bg-blue-100 text-blue-800' :
                  navigationInfo.currentPage.pageType === 'rule' ? 'bg-green-100 text-green-800' :
                  'bg-gray-100 text-gray-800'}
              `}>
                {navigationInfo.currentPage.pageType}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Statistics */}
      {showStats && (
        <div className="flex items-center justify-between pt-3 border-t border-gray-200">
          <div className="flex items-center space-x-4 text-sm text-gray-600">
            <div className="flex items-center space-x-1">
              <BarChart3 className="w-4 h-4" />
              <span>Statistics</span>
            </div>
            
            <div className="flex items-center space-x-3">
              <span>{currentViewStats.totalPages} pages</span>
              
              {Object.entries(currentViewStats.pageTypes).map(([type, count]) => (
                <span key={type} className="flex items-center space-x-1">
                  <div 
                    className="w-2 h-2 rounded-full"
                    style={{ 
                      backgroundColor: pageTypeSettings[type]?.colorScheme.primary || '#6b7280' 
                    }}
                  />
                  <span>{pageTypeSettings[type]?.displayName || type}: {count}</span>
                </span>
              ))}
            </div>
          </div>
          
          <div className="text-sm text-gray-500">
            {activeGroup ? `Group: ${activeGroup.name}` : 'All Pages View'}
          </div>
        </div>
      )}
    </div>
  );
};