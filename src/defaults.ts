// Default configuration values for the application
// This is the single source of truth for all default settings

// Grid defaults based on PDF mode
export const getDefaultGrid = (pdfMode: { type: string; orientation: string; flipEdge: string }) => {
  if (pdfMode.type === 'duplex') {
    // Both long and short edge duplex use same grid
    return { rows: 2, columns: 3 };
  } else if (pdfMode.type === 'gutter-fold') {
    if (pdfMode.orientation === 'vertical') {
      return { rows: 4, columns: 2 };
    } else if (pdfMode.orientation === 'horizontal') {
      return { rows: 2, columns: 4 };
    }
  }
  // Fallback default
  return { rows: 2, columns: 3 };
};

export const DEFAULT_SETTINGS = {
  pdfMode: {
    type: 'duplex' as const,
    orientation: 'vertical' as const,
    flipEdge: 'short' as const
  },
  pageSettings: [],  extractionSettings: {
    crop: {
      top: 0,
      right: 0,
      bottom: 0,
      left: 0
    },
    grid: {
      rows: 2,
      columns: 3
    },
    gutterWidth: 0
  },
  outputSettings: {
    pageSize: {
      width: 3.5,
      height: 3.5
    },
    offset: {
      horizontal: 0,
      vertical: 0
    },
    crop: {
      top: 0,
      right: 0,
      bottom: 0,
      left: 0
    },
    rotation: 0
  }
} as const;

// Helper function to get default settings with mode-specific grid
export const getDefaultSettingsForMode = (pdfMode: { type: string; orientation: string; flipEdge: string }) => {
  return {
    ...DEFAULT_SETTINGS,
    pdfMode,
    extractionSettings: {
      ...DEFAULT_SETTINGS.extractionSettings,
      grid: getDefaultGrid(pdfMode)
    }
  };
};

// Type definition for the settings structure
export type WorkflowSettings = {
  pdfMode: typeof DEFAULT_SETTINGS.pdfMode;
  pageSettings: any[];
  extractionSettings: typeof DEFAULT_SETTINGS.extractionSettings;
  outputSettings: typeof DEFAULT_SETTINGS.outputSettings;
  savedAt?: string;
  version?: string;
};
