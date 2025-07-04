/**
 * @fileoverview Settings Hierarchy Component
 * 
 * This component provides a comprehensive interface for managing hierarchical
 * settings in the unified page management system. It handles Global → Group → Page
 * precedence with visual feedback and conflict resolution.
 * 
 * **Key Features:**
 * - Hierarchical settings display (Global → Group → Page)
 * - Visual inheritance indicators
 * - Override capability with clear precedence
 * - Conflict resolution interface
 * - Settings templates management
 * - Real-time inheritance preview
 * 
 * @author Card Game PDF Transformer
 */

import React, { useState, useCallback, useMemo } from 'react';
import { 
  Settings, 
  ChevronDown, 
  ChevronRight, 
  AlertTriangle, 
  Check, 
  X, 
  Copy,
  Download,
  Upload,
  Eye,
  EyeOff,
  Layers
} from 'lucide-react';
import { 
  PageSettings, 
  PageSource, 
  PageGroup, 
  ExtractionSettings, 
  OutputSettings, 
  ColorSettings,
  PageTypeSettings
} from '../../types';

interface SettingsLevel {
  level: 'global' | 'group' | 'page';
  name: string;
  settings: any;
  isActive: boolean;
  hasOverrides: boolean;
  source: string;
}

interface SettingsConflict {
  key: string;
  globalValue: any;
  groupValue?: any;
  pageValue?: any;
  resolvedValue: any;
  hasConflict: boolean;
}

interface SettingsHierarchyProps {
  /** Current page */
  currentPage?: (PageSettings & PageSource);
  /** Current page's group */
  currentGroup?: PageGroup;
  /** Global settings */
  globalExtractionSettings: ExtractionSettings;
  globalOutputSettings: OutputSettings;
  globalColorSettings: ColorSettings;
  /** Page type settings */
  pageTypeSettings: Record<string, PageTypeSettings>;
  /** Callback when settings change */
  onSettingsChange: (
    level: 'global' | 'group' | 'page',
    type: 'extraction' | 'output' | 'color',
    settings: any
  ) => void;
  /** Whether settings are disabled */
  disabled?: boolean;
  /** Whether to show advanced options */
  showAdvanced?: boolean;
}

interface SettingsTemplate {
  id: string;
  name: string;
  description: string;
  settings: {
    extraction?: Partial<ExtractionSettings>;
    output?: Partial<OutputSettings>;
    color?: Partial<ColorSettings>;
  };
  createdAt: number;
  tags: string[];
}

/**
 * Settings Hierarchy Component
 */
export const SettingsHierarchy: React.FC<SettingsHierarchyProps> = ({
  currentPage,
  currentGroup,
  globalExtractionSettings,
  globalOutputSettings,
  globalColorSettings,
  pageTypeSettings,
  onSettingsChange,
  disabled = false,
  showAdvanced = false
}) => {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['global']));
  const [showConflicts, setShowConflicts] = useState(false);
  const [activeTab, setActiveTab] = useState<'extraction' | 'output' | 'color'>('extraction');
  const [showTemplates, setShowTemplates] = useState(false);

  /**
   * Calculate settings hierarchy and conflicts
   */
  const settingsHierarchy = useMemo(() => {
    const hierarchy: SettingsLevel[] = [
      {
        level: 'global',
        name: 'Global Settings',
        settings: {
          extraction: globalExtractionSettings,
          output: globalOutputSettings,
          color: globalColorSettings
        },
        isActive: true,
        hasOverrides: false,
        source: 'Application defaults'
      }
    ];

    // Add page type settings if available
    if (currentPage?.pageType && pageTypeSettings[currentPage.pageType]) {
      const typeSettings = pageTypeSettings[currentPage.pageType];
      hierarchy.push({
        level: 'group',
        name: `${typeSettings.displayName} Type Settings`,
        settings: {
          extraction: typeSettings.defaultExtractionSettings,
          output: typeSettings.defaultOutputSettings,
          color: typeSettings.defaultColorSettings
        },
        isActive: true,
        hasOverrides: !!typeSettings.defaultExtractionSettings || 
                      !!typeSettings.defaultOutputSettings || 
                      !!typeSettings.defaultColorSettings,
        source: `Page type: ${typeSettings.displayName}`
      });
    }

    // Add group settings if available
    if (currentGroup?.settings) {
      hierarchy.push({
        level: 'group',
        name: `Group: ${currentGroup.name}`,
        settings: {
          extraction: currentGroup.settings.extraction,
          output: currentGroup.settings.output,
          color: currentGroup.settings.color
        },
        isActive: true,
        hasOverrides: !!currentGroup.settings.extraction || 
                      !!currentGroup.settings.output || 
                      !!currentGroup.settings.color,
        source: `Group: ${currentGroup.name}`
      });
    }

    // Add page-specific settings if available
    if (currentPage && (currentPage.rotation || currentPage.scale || currentPage.customCrop)) {
      hierarchy.push({
        level: 'page',
        name: 'Page Overrides',
        settings: {
          extraction: {
            rotation: currentPage.rotation,
            scale: currentPage.scale,
            customCrop: currentPage.customCrop
          }
        },
        isActive: true,
        hasOverrides: true,
        source: `Page ${currentPage.displayOrder + 1}`
      });
    }

    return hierarchy;
  }, [
    currentPage,
    currentGroup,
    globalExtractionSettings,
    globalOutputSettings,
    globalColorSettings,
    pageTypeSettings
  ]);

  /**
   * Calculate conflicts between settings levels
   */
  const settingsConflicts = useMemo((): SettingsConflict[] => {
    const conflicts: SettingsConflict[] = [];
    
    // For each settings type, check for conflicts
    const settingsTypes = ['extraction', 'output', 'color'] as const;
    
    settingsTypes.forEach(type => {
      const allSettings = settingsHierarchy.map(level => level.settings[type]).filter(Boolean);
      
      if (allSettings.length > 1) {
        // Find conflicting keys
        const allKeys = new Set<string>();
        allSettings.forEach(settings => {
          if (settings) {
            Object.keys(settings).forEach(key => allKeys.add(key));
          }
        });

        allKeys.forEach(key => {
          const values = allSettings.map(settings => settings?.[key]).filter(v => v !== undefined);
          
          if (values.length > 1) {
            const uniqueValues = [...new Set(values.map(v => JSON.stringify(v)))];
            
            if (uniqueValues.length > 1) {
              conflicts.push({
                key: `${type}.${key}`,
                globalValue: settingsHierarchy[0]?.settings[type]?.[key],
                groupValue: settingsHierarchy[1]?.settings[type]?.[key],
                pageValue: settingsHierarchy[2]?.settings[type]?.[key],
                resolvedValue: values[values.length - 1], // Last wins
                hasConflict: true
              });
            }
          }
        });
      }
    });

    return conflicts;
  }, [settingsHierarchy]);

  /**
   * Toggle section expansion
   */
  const toggleSection = useCallback((sectionId: string) => {
    setExpandedSections(prev => {
      const newExpanded = new Set(prev);
      if (newExpanded.has(sectionId)) {
        newExpanded.delete(sectionId);
      } else {
        newExpanded.add(sectionId);
      }
      return newExpanded;
    });
  }, []);

  /**
   * Handle settings override
   */
  const handleSettingsOverride = useCallback((
    level: 'global' | 'group' | 'page',
    type: 'extraction' | 'output' | 'color',
    key: string,
    value: any
  ) => {
    if (disabled) return;

    // Get current settings for this level and type
    const currentSettings = settingsHierarchy.find(h => h.level === level)?.settings[type] || {};
    
    // Create updated settings
    const updatedSettings = {
      ...currentSettings,
      [key]: value
    };

    onSettingsChange(level, type, updatedSettings);
  }, [disabled, settingsHierarchy, onSettingsChange]);

  /**
   * Render settings value with inheritance indicator
   */
  const renderSettingsValue = useCallback((
    level: SettingsLevel,
    type: 'extraction' | 'output' | 'color',
    key: string,
    value: any
  ) => {
    const isInherited = level.level !== 'global' && !level.settings[type]?.[key];
    const conflict = settingsConflicts.find(c => c.key === `${type}.${key}`);

    return (
      <div className="flex items-center space-x-2">
        <div className={`
          px-2 py-1 rounded-md text-sm font-mono
          ${isInherited 
            ? 'bg-gray-100 text-gray-600 italic' 
            : 'bg-blue-100 text-blue-800'}
          ${conflict?.hasConflict ? 'border border-orange-200' : ''}
        `}>
          {isInherited ? '(inherited)' : JSON.stringify(value)}
        </div>
        
        {conflict?.hasConflict && (
          <AlertTriangle className="w-4 h-4 text-orange-500" title="Setting conflict detected" />
        )}
        
        {isInherited && (
          <button
            onClick={() => handleSettingsOverride(level.level, type, key, value)}
            disabled={disabled}
            className="text-indigo-600 hover:text-indigo-500 text-sm disabled:opacity-50"
          >
            Override
          </button>
        )}
      </div>
    );
  }, [settingsConflicts, handleSettingsOverride, disabled]);

  /**
   * Render settings section
   */
  const renderSettingsSection = useCallback((level: SettingsLevel) => {
    const isExpanded = expandedSections.has(level.level);
    const currentSettings = level.settings[activeTab];
    
    if (!currentSettings && !level.hasOverrides) {
      return null;
    }

    return (
      <div key={level.level} className="border border-gray-200 rounded-lg">
        <div 
          className={`
            flex items-center justify-between p-3 cursor-pointer
            ${level.level === 'global' ? 'bg-blue-50' :
              level.level === 'group' ? 'bg-green-50' : 'bg-orange-50'}
          `}
          onClick={() => toggleSection(level.level)}
        >
          <div className="flex items-center space-x-3">
            {isExpanded ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
            
            <div className="flex items-center space-x-2">
              <Layers className="w-4 h-4" />
              <span className="font-medium">{level.name}</span>
              {level.hasOverrides && (
                <span className="px-2 py-1 bg-indigo-100 text-indigo-800 text-xs rounded-md">
                  Overrides
                </span>
              )}
            </div>
          </div>
          
          <div className="flex items-center space-x-2 text-sm text-gray-600">
            <span>{level.source}</span>
            {level.isActive ? (
              <Check className="w-4 h-4 text-green-600" />
            ) : (
              <X className="w-4 h-4 text-gray-400" />
            )}
          </div>
        </div>

        {isExpanded && currentSettings && (
          <div className="p-3 border-t border-gray-200 bg-white">
            <div className="space-y-3">
              {Object.entries(currentSettings).map(([key, value]) => (
                <div key={key} className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">{key}</span>
                  {renderSettingsValue(level, activeTab, key, value)}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }, [expandedSections, activeTab, toggleSection, renderSettingsValue]);

  if (!currentPage && !currentGroup) {
    return (
      <div className="text-center text-gray-500 py-8">
        <Settings className="w-8 h-8 mx-auto mb-2" />
        <p>Select a page or group to view settings hierarchy</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Settings className="w-5 h-5 text-gray-500" />
          <h3 className="text-lg font-medium text-gray-900">Settings Hierarchy</h3>
          {settingsConflicts.length > 0 && (
            <span className="px-2 py-1 bg-orange-100 text-orange-800 text-xs rounded-md">
              {settingsConflicts.length} conflicts
            </span>
          )}
        </div>

        <div className="flex items-center space-x-2">
          {/* Conflicts toggle */}
          {settingsConflicts.length > 0 && (
            <button
              onClick={() => setShowConflicts(!showConflicts)}
              className="text-sm px-3 py-1 bg-orange-100 text-orange-800 rounded-md hover:bg-orange-200"
            >
              {showConflicts ? <EyeOff className="w-4 h-4 inline mr-1" /> : <Eye className="w-4 h-4 inline mr-1" />}
              {showConflicts ? 'Hide' : 'Show'} Conflicts
            </button>
          )}

          {/* Templates */}
          <button
            onClick={() => setShowTemplates(!showTemplates)}
            className="text-sm px-3 py-1 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
          >
            <Copy className="w-4 h-4 inline mr-1" />
            Templates
          </button>
        </div>
      </div>

      {/* Settings type tabs */}
      <div className="flex space-x-1 bg-gray-100 rounded-lg p-1">
        {(['extraction', 'output', 'color'] as const).map((type) => (
          <button
            key={type}
            onClick={() => setActiveTab(type)}
            className={`
              flex-1 px-3 py-2 rounded-md text-sm font-medium transition-colors
              ${activeTab === type 
                ? 'bg-white text-gray-900 shadow-sm' 
                : 'text-gray-600 hover:text-gray-900'}
            `}
          >
            {type.charAt(0).toUpperCase() + type.slice(1)}
          </button>
        ))}
      </div>

      {/* Conflicts panel */}
      {showConflicts && settingsConflicts.length > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
          <h4 className="font-medium text-orange-900 mb-3">Settings Conflicts</h4>
          <div className="space-y-2">
            {settingsConflicts.map((conflict, index) => (
              <div key={index} className="flex items-center justify-between p-2 bg-white rounded-md">
                <div className="flex items-center space-x-2">
                  <AlertTriangle className="w-4 h-4 text-orange-500" />
                  <span className="text-sm font-medium">{conflict.key}</span>
                </div>
                <div className="flex items-center space-x-2 text-sm">
                  <span className="text-gray-600">Resolved to:</span>
                  <span className="font-mono bg-gray-100 px-2 py-1 rounded">
                    {JSON.stringify(conflict.resolvedValue)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Settings hierarchy */}
      <div className="space-y-3">
        {settingsHierarchy.map(renderSettingsSection)}
      </div>

      {/* Summary */}
      <div className="flex items-center justify-between pt-3 border-t border-gray-200 text-sm text-gray-600">
        <div className="flex items-center space-x-4">
          <span>{settingsHierarchy.length} levels active</span>
          <span>{settingsConflicts.length} conflicts</span>
        </div>
        <span>Precedence: Page → Group → Type → Global</span>
      </div>
    </div>
  );
};