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

// Rotation defaults based on PDF mode
export const getDefaultRotation = (pdfMode: { type: string; orientation: string; flipEdge: string }) => {
  // Front cards always default to 0 degrees
  const front = 0;
  
  // Back cards default based on mode:
  // - 0 degrees for: Duplex short edge, Gutter-fold vertical
  // - 180 degrees for: Duplex long edge, Gutter-fold horizontal
  let back = 0;
  
  if (pdfMode.type === 'duplex') {
    back = pdfMode.flipEdge === 'long' ? 180 : 0;
  } else if (pdfMode.type === 'gutter-fold') {
    back = pdfMode.orientation === 'horizontal' ? 180 : 0;
  }
  
  return { front, back };
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
    gutterWidth: 0,
    cardCrop: {
      top: 0,
      right: 0,
      bottom: 0,
      left: 0
    }
  },  outputSettings: {
    pageSize: {
      width: 3.5,
      height: 3.5
    },
    offset: {
      horizontal: 0,
      vertical: 0
    },
    // Card size settings (poker card default)
    cardSize: {
      widthInches: 2.5,
      heightInches: 3.5
    },
    // Card scale setting (percentage)
    cardScalePercent: 100,
    // Bleed margin setting (inches)
    bleedMarginInches: 0,    // Card rotation settings
    rotation: {
      front: 0,
      back: 0
    },
    // Card image sizing mode
    cardImageSizingMode: 'actual-size' as 'actual-size' | 'fit-to-card' | 'fill-card'
  }
};

// Helper function to get default settings with mode-specific grid and rotation
export const getDefaultSettingsForMode = (pdfMode: { type: string; orientation: string; flipEdge: string }) => {
  return {
    ...DEFAULT_SETTINGS,
    pdfMode,
    extractionSettings: {
      ...DEFAULT_SETTINGS.extractionSettings,
      grid: getDefaultGrid(pdfMode)
    },
    outputSettings: {
      ...DEFAULT_SETTINGS.outputSettings,
      rotation: getDefaultRotation(pdfMode)
    }
  };
};

// Type definition for the settings structure
export type WorkflowSettings = {
  pdfMode: {
    type: string;
    orientation: string;
    flipEdge: string;
  };
  pageSettings: any[];
  extractionSettings: {
    crop: {
      top: number;
      right: number;
      bottom: number;
      left: number;
    };
    grid: {
      rows: number;
      columns: number;
    };
    gutterWidth: number;
    cardCrop: {
      top: number;
      right: number;
      bottom: number;
      left: number;
    };
  };  outputSettings: {
    pageSize: {
      width: number;
      height: number;
    };
    offset: {
      horizontal: number;
      vertical: number;
    };
    cardSize: {
      widthInches: number;
      heightInches: number;
    };
    cardScalePercent: number;
    bleedMarginInches: number;    rotation: {
      front: number;
      back: number;
    };
    cardImageSizingMode: 'actual-size' | 'fit-to-card' | 'fill-card';
  };
  colorSettings: {
    selectedRegion: any;
    gridConfig: { columns: number; rows: number };
    transformations: {
      horizontal: { type: string; min: number; max: number };
      vertical: { type: string; min: number; max: number };
    };
    selectedPreset: any;
    finalAdjustments: {
      brightness: number;
      contrast: number;
      saturation: number;
      hue: number;
      gamma: number;
      vibrance: number;
      redMultiplier: number;
      greenMultiplier: number;
      blueMultiplier: number;
      shadows: number;
      highlights: number;
      midtoneBalance: number;
      blackPoint: number;
      whitePoint: number;
      outputBlack: number;
      outputWhite: number;
    };
  };
  savedAt?: string;
  version?: string;
};
