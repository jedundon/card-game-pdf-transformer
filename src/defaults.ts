// Default configuration values for the application
// This is the single source of truth for all default settings

export const DEFAULT_SETTINGS = {
  pdfMode: {
    type: 'duplex' as const,
    orientation: 'vertical' as const,
    flipEdge: 'short' as const
  },
  pageSettings: [],
  extractionSettings: {
    crop: {
      top: 0,
      right: 0,
      bottom: 0,
      left: 0
    },
    grid: {
      rows: 2,
      columns: 3
    }
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

// Type definition for the settings structure
export type WorkflowSettings = {
  pdfMode: typeof DEFAULT_SETTINGS.pdfMode;
  pageSettings: any[];
  extractionSettings: typeof DEFAULT_SETTINGS.extractionSettings;
  outputSettings: typeof DEFAULT_SETTINGS.outputSettings;
  savedAt?: string;
  version?: string;
};
