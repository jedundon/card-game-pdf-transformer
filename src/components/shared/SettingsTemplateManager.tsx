/**
 * @fileoverview Settings Template Manager Component
 * 
 * This component provides template management functionality for the unified
 * page management system. It allows users to save, load, and manage reusable
 * settings configurations for different workflow types.
 * 
 * **Key Features:**
 * - Template creation from current settings
 * - Template library with search and filtering
 * - Template application to groups/selections
 * - Template sharing and import/export
 * - Predefined template gallery
 * 
 * @author Card Game PDF Transformer
 */

import React, { useState, useCallback, useMemo } from 'react';
import { 
  Save, 
  Search, 
  Star,
  Tag,
  Trash2,
  X,
  Plus,
  Package
} from 'lucide-react';
import { 
  ExtractionSettings, 
  OutputSettings, 
  ColorSettings,
  PageGroup
} from '../../types';

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
  modifiedAt: number;
  tags: string[];
  isBuiltIn: boolean;
  author?: string;
  version?: string;
  usageCount: number;
}

interface SettingsTemplateManagerProps {
  /** Current settings for template creation */
  currentExtractionSettings: ExtractionSettings;
  currentOutputSettings: OutputSettings;
  currentColorSettings: ColorSettings;
  /** Available templates */
  templates: SettingsTemplate[];
  /** Callback when templates change */
  onTemplatesChange: (templates: SettingsTemplate[]) => void;
  /** Callback when template is applied */
  onTemplateApply: (
    template: SettingsTemplate,
    target: 'global' | 'group' | 'selection',
    targetId?: string
  ) => void;
  /** Whether template management is disabled */
  disabled?: boolean;
  /** Available groups for template application */
  availableGroups?: PageGroup[];
}

interface CreateTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (template: Omit<SettingsTemplate, 'id' | 'createdAt' | 'modifiedAt' | 'usageCount'>) => void;
  currentSettings: {
    extraction: ExtractionSettings;
    output: OutputSettings;
    color: ColorSettings;
  };
  existingNames: string[];
}

const BUILT_IN_TEMPLATES: SettingsTemplate[] = [
  {
    id: 'template_card_standard',
    name: 'Standard Cards',
    description: 'Standard playing card configuration with 3x3 grid',
    settings: {
      extraction: {
        grid: { rows: 3, columns: 3 },
        crop: { left: 10, right: 10, top: 10, bottom: 10 }
      },
      output: {
        cardSize: { widthInches: 2.5, heightInches: 3.5 },
        cardScalePercent: 100,
        bleedMarginInches: 0.125
      }
    },
    createdAt: Date.now(),
    modifiedAt: Date.now(),
    tags: ['cards', 'standard', 'poker'],
    isBuiltIn: true,
    author: 'Card Game PDF Transformer',
    version: '1.0',
    usageCount: 0
  },
  {
    id: 'template_tarot_cards',
    name: 'Tarot Cards',
    description: 'Tarot card configuration with larger dimensions',
    settings: {
      extraction: {
        grid: { rows: 2, columns: 3 },
        crop: { left: 15, right: 15, top: 15, bottom: 15 }
      },
      output: {
        cardSize: { widthInches: 2.75, heightInches: 4.75 },
        cardScalePercent: 100,
        bleedMarginInches: 0.25
      }
    },
    createdAt: Date.now(),
    modifiedAt: Date.now(),
    tags: ['tarot', 'large', 'divination'],
    isBuiltIn: true,
    author: 'Card Game PDF Transformer',
    version: '1.0',
    usageCount: 0
  },
  {
    id: 'template_business_cards',
    name: 'Business Cards',
    description: 'Standard business card layout configuration',
    settings: {
      extraction: {
        grid: { rows: 2, columns: 5 },
        crop: { left: 5, right: 5, top: 5, bottom: 5 }
      },
      output: {
        cardSize: { widthInches: 3.5, heightInches: 2.0 },
        cardScalePercent: 100,
        bleedMarginInches: 0.125
      }
    },
    createdAt: Date.now(),
    modifiedAt: Date.now(),
    tags: ['business', 'professional', 'cards'],
    isBuiltIn: true,
    author: 'Card Game PDF Transformer',
    version: '1.0',
    usageCount: 0
  }
];

/**
 * Modal for creating new templates
 */
const CreateTemplateModal: React.FC<CreateTemplateModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  currentSettings,
  existingNames
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState('');
  const [includeExtraction, setIncludeExtraction] = useState(true);
  const [includeOutput, setIncludeOutput] = useState(true);
  const [includeColor, setIncludeColor] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      setError('Template name is required');
      return;
    }
    
    if (existingNames.includes(name.trim())) {
      setError('Template name already exists');
      return;
    }

    const templateSettings: any = {};
    if (includeExtraction) templateSettings.extraction = currentSettings.extraction;
    if (includeOutput) templateSettings.output = currentSettings.output;
    if (includeColor) templateSettings.color = currentSettings.color;

    onConfirm({
      name: name.trim(),
      description: description.trim(),
      settings: templateSettings,
      tags,
      isBuiltIn: false,
      author: 'User'
    });

    // Reset form
    setName('');
    setDescription('');
    setTags([]);
    setNewTag('');
    setIncludeExtraction(true);
    setIncludeOutput(true);
    setIncludeColor(false);
    setError('');
  };

  const addTag = () => {
    if (newTag.trim() && !tags.includes(newTag.trim())) {
      setTags([...tags, newTag.trim()]);
      setNewTag('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-lg max-h-96 overflow-y-auto">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Create Settings Template</h3>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Template Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError('');
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Enter template name..."
              maxLength={50}
            />
            {error && (
              <p className="mt-1 text-sm text-red-600">{error}</p>
            )}
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Describe what this template is for..."
              rows={3}
              maxLength={200}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Include Settings
            </label>
            <div className="space-y-2">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={includeExtraction}
                  onChange={(e) => setIncludeExtraction(e.target.checked)}
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="ml-2 text-sm">Extraction Settings</span>
              </label>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={includeOutput}
                  onChange={(e) => setIncludeOutput(e.target.checked)}
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="ml-2 text-sm">Output Settings</span>
              </label>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={includeColor}
                  onChange={(e) => setIncludeColor(e.target.checked)}
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="ml-2 text-sm">Color Settings</span>
              </label>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tags
            </label>
            <div className="flex items-center space-x-2 mb-2">
              <input
                type="text"
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addTag();
                  }
                }}
                className="flex-1 px-3 py-1 border border-gray-300 rounded-md text-sm"
                placeholder="Add tag..."
                maxLength={20}
              />
              <button
                type="button"
                onClick={addTag}
                className="px-3 py-1 bg-gray-100 text-gray-700 rounded-md text-sm hover:bg-gray-200"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center px-2 py-1 bg-indigo-100 text-indigo-800 text-xs rounded-md"
                >
                  {tag}
                  <button
                    type="button"
                    onClick={() => removeTag(tag)}
                    className="ml-1 text-indigo-600 hover:text-indigo-500"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          </div>
          
          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700"
            >
              Create Template
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

/**
 * Settings Template Manager Component
 */
export const SettingsTemplateManager: React.FC<SettingsTemplateManagerProps> = ({
  currentExtractionSettings,
  currentOutputSettings,
  currentColorSettings,
  templates,
  onTemplatesChange,
  onTemplateApply,
  disabled = false,
  availableGroups = []
}) => {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<'name' | 'created' | 'usage'>('name');
  const [showBuiltIn, setShowBuiltIn] = useState(true);
  const [showCustom, setShowCustom] = useState(true);

  /**
   * Combine built-in and custom templates
   */
  const allTemplates = useMemo(() => {
    const builtInWithUsage = BUILT_IN_TEMPLATES.map(template => {
      const existingTemplate = templates.find(t => t.id === template.id);
      return existingTemplate || template;
    });
    
    const customTemplates = templates.filter(t => !t.isBuiltIn);
    
    return [...builtInWithUsage, ...customTemplates];
  }, [templates]);

  /**
   * Get all available tags
   */
  const availableTags = useMemo(() => {
    const tagSet = new Set<string>();
    allTemplates.forEach(template => {
      template.tags.forEach(tag => tagSet.add(tag));
    });
    return Array.from(tagSet).sort();
  }, [allTemplates]);

  /**
   * Filter and sort templates
   */
  const filteredTemplates = useMemo(() => {
    let filtered = allTemplates.filter(template => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesName = template.name.toLowerCase().includes(query);
        const matchesDescription = template.description.toLowerCase().includes(query);
        const matchesTags = template.tags.some(tag => tag.toLowerCase().includes(query));
        
        if (!matchesName && !matchesDescription && !matchesTags) {
          return false;
        }
      }

      // Tag filter
      if (selectedTags.length > 0) {
        const hasSelectedTag = selectedTags.some(tag => template.tags.includes(tag));
        if (!hasSelectedTag) {
          return false;
        }
      }

      // Type filter
      if (!showBuiltIn && template.isBuiltIn) return false;
      if (!showCustom && !template.isBuiltIn) return false;

      return true;
    });

    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'created':
          return b.createdAt - a.createdAt;
        case 'usage':
          return b.usageCount - a.usageCount;
        default:
          return a.name.localeCompare(b.name);
      }
    });

    return filtered;
  }, [allTemplates, searchQuery, selectedTags, showBuiltIn, showCustom, sortBy]);

  /**
   * Create new template
   */
  const handleCreateTemplate = useCallback((templateData: Omit<SettingsTemplate, 'id' | 'createdAt' | 'modifiedAt' | 'usageCount'>) => {
    const newTemplate: SettingsTemplate = {
      ...templateData,
      id: `template_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: Date.now(),
      modifiedAt: Date.now(),
      usageCount: 0
    };

    onTemplatesChange([...templates, newTemplate]);
    setShowCreateModal(false);
  }, [templates, onTemplatesChange]);

  /**
   * Delete template
   */
  const handleDeleteTemplate = useCallback((templateId: string) => {
    const template = allTemplates.find(t => t.id === templateId);
    if (template?.isBuiltIn) {
      alert('Built-in templates cannot be deleted');
      return;
    }

    if (window.confirm('Are you sure you want to delete this template?')) {
      onTemplatesChange(templates.filter(t => t.id !== templateId));
    }
  }, [allTemplates, templates, onTemplatesChange]);

  /**
   * Apply template
   */
  const handleApplyTemplate = useCallback((template: SettingsTemplate, target: 'global' | 'group' | 'selection', targetId?: string) => {
    // Increment usage count
    const updatedTemplate = { ...template, usageCount: template.usageCount + 1, modifiedAt: Date.now() };
    const updatedTemplates = allTemplates.map(t => t.id === template.id ? updatedTemplate : t);
    onTemplatesChange(updatedTemplates.filter(t => !t.isBuiltIn || templates.some(existing => existing.id === t.id)));

    onTemplateApply(updatedTemplate, target, targetId);
  }, [allTemplates, templates, onTemplatesChange, onTemplateApply]);

  /**
   * Toggle tag selection
   */
  const toggleTagSelection = useCallback((tag: string) => {
    setSelectedTags(prev => 
      prev.includes(tag) 
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    );
  }, []);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Package className="w-5 h-5 text-gray-500" />
          <h3 className="text-lg font-medium text-gray-900">Settings Templates</h3>
          <span className="text-sm text-gray-500">
            ({filteredTemplates.length} templates)
          </span>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          disabled={disabled}
          className="flex items-center space-x-2 px-3 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          <span>Save Current</span>
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4 p-4 bg-gray-50 rounded-lg">
        {/* Search */}
        <div className="flex-1 min-w-64">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search templates..."
              className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md text-sm"
            />
          </div>
        </div>

        {/* Sort */}
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as any)}
          className="px-3 py-2 border border-gray-300 rounded-md text-sm"
        >
          <option value="name">Sort by Name</option>
          <option value="created">Sort by Date</option>
          <option value="usage">Sort by Usage</option>
        </select>

        {/* Type filters */}
        <div className="flex items-center space-x-2">
          <label className="flex items-center text-sm">
            <input
              type="checkbox"
              checked={showBuiltIn}
              onChange={(e) => setShowBuiltIn(e.target.checked)}
              className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            <span className="ml-1">Built-in</span>
          </label>
          <label className="flex items-center text-sm">
            <input
              type="checkbox"
              checked={showCustom}
              onChange={(e) => setShowCustom(e.target.checked)}
              className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            <span className="ml-1">Custom</span>
          </label>
        </div>
      </div>

      {/* Tag filters */}
      {availableTags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {availableTags.map((tag) => (
            <button
              key={tag}
              onClick={() => toggleTagSelection(tag)}
              className={`
                px-3 py-1 rounded-full text-sm transition-colors
                ${selectedTags.includes(tag)
                  ? 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                  : 'bg-gray-100 text-gray-700 border border-gray-200 hover:bg-gray-200'
                }
              `}
            >
              <Tag className="w-3 h-3 inline mr-1" />
              {tag}
            </button>
          ))}
        </div>
      )}

      {/* Templates grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredTemplates.map((template) => (
          <div
            key={template.id}
            className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <h4 className="font-medium text-gray-900">{template.name}</h4>
                <p className="text-sm text-gray-600 mt-1">{template.description}</p>
              </div>
              
              <div className="flex items-center space-x-1 ml-2">
                {template.isBuiltIn && (
                  <Star className="w-4 h-4 text-yellow-500" />
                )}
                {!template.isBuiltIn && (
                  <button
                    onClick={() => handleDeleteTemplate(template.id)}
                    disabled={disabled}
                    className="text-red-400 hover:text-red-600 disabled:opacity-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Template tags */}
            <div className="flex flex-wrap gap-1 mb-3">
              {template.tags.map((tag) => (
                <span
                  key={tag}
                  className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-md"
                >
                  {tag}
                </span>
              ))}
            </div>

            {/* Template info */}
            <div className="flex items-center justify-between text-xs text-gray-500 mb-3">
              <span>{template.author}</span>
              <span>Used {template.usageCount} times</span>
            </div>

            {/* Apply buttons */}
            <div className="space-y-2">
              <button
                onClick={() => handleApplyTemplate(template, 'global')}
                disabled={disabled}
                className="w-full px-3 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 text-sm"
              >
                Apply Globally
              </button>
              
              {availableGroups.length > 0 && (
                <div className="relative">
                  <select
                    onChange={(e) => {
                      if (e.target.value) {
                        handleApplyTemplate(template, 'group', e.target.value);
                        e.target.value = '';
                      }
                    }}
                    disabled={disabled}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm disabled:opacity-50"
                  >
                    <option value="">Apply to Group...</option>
                    {availableGroups.map((group) => (
                      <option key={group.id} value={group.id}>
                        {group.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {filteredTemplates.length === 0 && (
        <div className="text-center text-gray-500 py-8">
          <Package className="w-8 h-8 mx-auto mb-2" />
          <p>No templates found matching your filters</p>
        </div>
      )}

      {/* Create template modal */}
      <CreateTemplateModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onConfirm={handleCreateTemplate}
        currentSettings={{
          extraction: currentExtractionSettings,
          output: currentOutputSettings,
          color: currentColorSettings
        }}
        existingNames={allTemplates.map(t => t.name)}
      />
    </div>
  );
};