/**
 * @fileoverview Page type default settings and utilities
 * 
 * This module provides default configurations for different page types
 * and utilities for managing page type-specific settings. It supports
 * the unified page management system by providing sensible defaults
 * for card pages, rule pages, and skip pages.
 * 
 * **Key Features:**
 * - Default settings for each page type
 * - Color schemes for UI indicators
 * - Settings inheritance and override logic
 * - Page type detection utilities
 * 
 * @author Card Game PDF Transformer
 */

import { PageTypeSettings, ExtractionSettings, OutputSettings, ColorSettings } from '../types';

/**
 * Default page type configurations
 * 
 * These provide the base settings and visual styling for each page type.
 * Settings can be overridden per project or per page group.
 */
export const DEFAULT_PAGE_TYPE_SETTINGS: Record<string, PageTypeSettings> = {
  card: {
    pageType: 'card',
    displayName: 'Card',
    isProcessed: true,
    colorScheme: {
      primary: '#3b82f6', // blue-500
      background: '#dbeafe', // blue-100
      text: '#1e40af' // blue-800
    },
    defaultExtractionSettings: {
      // Cards typically use standard grid settings
      grid: { rows: 3, columns: 3 },
      crop: { left: 0, right: 0, top: 0, bottom: 0 },
      cardCrop: { top: 0, right: 0, bottom: 0, left: 0 }
    },
    defaultOutputSettings: {
      // Cards use standard card dimensions
      cardSize: { widthInches: 2.5, heightInches: 3.5 },
      cardScalePercent: 100,
      bleedMarginInches: 0.125,
      cardImageSizingMode: 'fit-to-card',
      cardAlignment: 'center',
      includeColorCalibration: false
    }
  },
  
  rule: {
    pageType: 'rule',
    displayName: 'Rule',
    isProcessed: true,
    colorScheme: {
      primary: '#10b981', // emerald-500
      background: '#d1fae5', // emerald-100
      text: '#047857' // emerald-700
    },
    defaultExtractionSettings: {
      // Rules might use different grid layout
      grid: { rows: 1, columns: 1 },
      crop: { left: 0, right: 0, top: 0, bottom: 0 },
      cardCrop: { top: 0, right: 0, bottom: 0, left: 0 }
    },
    defaultOutputSettings: {
      // Rules might use different dimensions or full page
      cardSize: { widthInches: 8.5, heightInches: 11 },
      cardScalePercent: 95,
      bleedMarginInches: 0.25,
      cardImageSizingMode: 'fit-to-card',
      cardAlignment: 'center',
      includeColorCalibration: false
    }
  },
  
  skip: {
    pageType: 'skip',
    displayName: 'Skip',
    isProcessed: false,
    colorScheme: {
      primary: '#6b7280', // gray-500
      background: '#f3f4f6', // gray-100
      text: '#374151' // gray-700
    }
    // Skip pages don't need default settings since they're not processed
  }
};

/**
 * Get page type settings with fallback to defaults
 * 
 * @param pageType - The page type to get settings for
 * @param customSettings - Optional custom settings that override defaults
 * @returns Complete page type settings
 */
export function getPageTypeSettings(
  pageType: 'card' | 'rule' | 'skip',
  customSettings?: Partial<PageTypeSettings>
): PageTypeSettings {
  const defaultSettings = DEFAULT_PAGE_TYPE_SETTINGS[pageType];
  
  if (!defaultSettings) {
    throw new Error(`Unknown page type: ${pageType}`);
  }
  
  return {
    ...defaultSettings,
    ...customSettings,
    // Ensure colorScheme is properly merged
    colorScheme: {
      ...defaultSettings.colorScheme,
      ...(customSettings?.colorScheme || {})
    }
  };
}

/**
 * Get extraction settings for a page type
 * 
 * @param pageType - The page type
 * @param baseSettings - Base extraction settings to merge with
 * @param customSettings - Custom page type settings
 * @returns Merged extraction settings
 */
export function getPageTypeExtractionSettings(
  pageType: 'card' | 'rule' | 'skip',
  baseSettings: ExtractionSettings,
  customSettings?: Record<string, PageTypeSettings>
): ExtractionSettings {
  const pageTypeSettings = customSettings?.[pageType] || DEFAULT_PAGE_TYPE_SETTINGS[pageType];
  
  if (!pageTypeSettings?.defaultExtractionSettings) {
    return baseSettings;
  }
  
  return {
    ...baseSettings,
    ...pageTypeSettings.defaultExtractionSettings
  };
}

/**
 * Get output settings for a page type
 * 
 * @param pageType - The page type
 * @param baseSettings - Base output settings to merge with
 * @param customSettings - Custom page type settings
 * @returns Merged output settings
 */
export function getPageTypeOutputSettings(
  pageType: 'card' | 'rule' | 'skip',
  baseSettings: OutputSettings,
  customSettings?: Record<string, PageTypeSettings>
): OutputSettings {
  const pageTypeSettings = customSettings?.[pageType] || DEFAULT_PAGE_TYPE_SETTINGS[pageType];
  
  if (!pageTypeSettings?.defaultOutputSettings) {
    return baseSettings;
  }
  
  return {
    ...baseSettings,
    ...pageTypeSettings.defaultOutputSettings
  };
}

/**
 * Get color settings for a page type
 * 
 * @param pageType - The page type
 * @param baseSettings - Base color settings to merge with
 * @param customSettings - Custom page type settings
 * @returns Merged color settings
 */
export function getPageTypeColorSettings(
  pageType: 'card' | 'rule' | 'skip',
  baseSettings: ColorSettings,
  customSettings?: Record<string, PageTypeSettings>
): ColorSettings {
  const pageTypeSettings = customSettings?.[pageType] || DEFAULT_PAGE_TYPE_SETTINGS[pageType];
  
  if (!pageTypeSettings?.defaultColorSettings) {
    return baseSettings;
  }
  
  return {
    ...baseSettings,
    ...pageTypeSettings.defaultColorSettings
  };
}

/**
 * Detect likely page type based on content or position
 * 
 * @param pageIndex - Page index in the document
 * @param totalPages - Total number of pages
 * @param fileName - Optional file name for pattern detection
 * @returns Suggested page type
 */
export function detectPageType(
  pageIndex: number,
  totalPages: number,
  fileName?: string
): 'card' | 'rule' | 'skip' {
  // Simple heuristics for page type detection
  // This can be enhanced with more sophisticated logic
  
  // Check file name patterns
  if (fileName) {
    const lowerFileName = fileName.toLowerCase();
    if (lowerFileName.includes('rule') || lowerFileName.includes('instruction')) {
      return 'rule';
    }
    if (lowerFileName.includes('card') || lowerFileName.includes('game')) {
      return 'card';
    }
  }
  
  // For small documents, assume rule pages
  if (totalPages <= 2) {
    return 'rule';
  }
  
  // For larger documents, assume first few pages are rules
  if (pageIndex < 2) {
    return 'rule';
  }
  
  // Default to card pages
  return 'card';
}

/**
 * Get page type badge styling
 * 
 * @param pageType - The page type
 * @param customSettings - Custom page type settings
 * @returns CSS classes and inline styles for badges
 */
export function getPageTypeBadgeStyle(
  pageType: 'card' | 'rule' | 'skip',
  customSettings?: Record<string, PageTypeSettings>
) {
  const settings = customSettings?.[pageType] || DEFAULT_PAGE_TYPE_SETTINGS[pageType];
  
  return {
    className: 'px-2 py-1 rounded-md text-xs font-medium',
    style: {
      backgroundColor: settings.colorScheme.background,
      color: settings.colorScheme.text,
      borderColor: settings.colorScheme.primary
    }
  };
}

/**
 * Initialize default page type settings for multi-file import
 * 
 * @returns Complete page type settings record
 */
export function initializePageTypeSettings(): Record<string, PageTypeSettings> {
  return { ...DEFAULT_PAGE_TYPE_SETTINGS };
}

/**
 * Apply page type to a page setting
 * 
 * @param pageSettings - Current page settings
 * @param pageType - Page type to apply
 * @returns Updated page settings
 */
export function applyPageType(
  pageSettings: any,
  pageType: 'card' | 'rule' | 'skip'
): any {
  return {
    ...pageSettings,
    pageType,
    // Auto-skip pages marked as 'skip' type
    skip: pageType === 'skip' ? true : (pageSettings.skip || false)
  };
}