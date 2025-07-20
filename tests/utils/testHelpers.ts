/**
 * Shared Test Utilities for Comprehensive Test Suite
 * 
 * This module provides common utilities for CI-tolerant testing,
 * mathematical precision handling, and test environment detection.
 */

/**
 * Helper function for CI-tolerant precision values
 * Reduces precision requirements in CI environments while maintaining accuracy validation
 */
export const getPrecisionTolerance = (baselineDecimalPlaces: number) => ({
  coordinate: process.env.CI ? Math.max(0, baselineDecimalPlaces - 2) : baselineDecimalPlaces,
  dimension: process.env.CI ? Math.max(1, baselineDecimalPlaces - 1) : baselineDecimalPlaces,
  spacing: process.env.CI ? Math.max(0, baselineDecimalPlaces - 3) : baselineDecimalPlaces,
  conversion: process.env.CI ? Math.max(2, baselineDecimalPlaces - 1) : baselineDecimalPlaces
});

/**
 * Helper function for CI-tolerant screenshot options
 * Increases visual diff tolerance in CI environments
 */
export const getScreenshotOptions = () => ({
  threshold: process.env.CI ? 0.3 : 0.1,
  maxDiffPixels: process.env.CI ? 1000 : 100
});

/**
 * Helper function for CI-tolerant timeout and retry settings
 * Provides longer timeouts and more retries in CI environments
 */
export const getCIToleranceSettings = () => ({
  timeout: process.env.CI ? 30000 : 15000, // Longer timeout in CI
  retryDelay: process.env.CI ? 1000 : 500, // Longer delays in CI
  maxRetries: process.env.CI ? 3 : 1 // More retries in CI
});

/**
 * Utility to detect if running in CI environment
 */
export const isCI = () => !!process.env.CI;

/**
 * Utility to log CI-specific messages
 */
export const ciLog = (message: string) => {
  if (process.env.CI) {
    console.log(`🔧 [CI] ${message}`);
  }
};

/**
 * Mathematical constants for coordinate system validation
 */
export const COORDINATE_CONSTANTS = {
  EXTRACTION_DPI: 300,
  PDF_DPI: 72,
  SCREEN_DPI: 72,
  PREVIEW_SCALE_FACTOR: 300 / 72 // PDF to extraction DPI conversion
};

/**
 * Common test dimensions for validation
 */
export const TEST_DIMENSIONS = {
  // Standard US Letter size
  LETTER_PAGE: {
    PDF_POINTS: { width: 612, height: 792 }, // 72 DPI
    EXTRACTION_PIXELS: { width: 2550, height: 3300 } // 300 DPI
  },
  
  // Standard poker card with bleed
  POKER_CARD: {
    BASE_INCHES: { width: 2.5, height: 3.5 },
    WITH_BLEED_INCHES: { width: 2.75, height: 3.75 },
    EXTRACTION_PIXELS: { width: 825, height: 1125 } // 2.75" x 3.75" at 300 DPI
  }
};

/**
 * Validates mathematical consistency between PDF and image coordinate systems
 * Used for ensuring unified processing regardless of source file type
 */
export const validateCoordinateSystemConsistency = (
  pdfDimensions: { width: number; height: number },
  imageDimensions: { width: number; height: number },
  precision: ReturnType<typeof getPrecisionTolerance>
) => {
  // Convert PDF to extraction DPI
  const pdfInExtractionDPI = {
    width: pdfDimensions.width * COORDINATE_CONSTANTS.PREVIEW_SCALE_FACTOR,
    height: pdfDimensions.height * COORDINATE_CONSTANTS.PREVIEW_SCALE_FACTOR
  };
  
  return {
    widthMatch: Math.abs(pdfInExtractionDPI.width - imageDimensions.width) <= Math.pow(10, -precision.dimension),
    heightMatch: Math.abs(pdfInExtractionDPI.height - imageDimensions.height) <= Math.pow(10, -precision.dimension),
    pdfConverted: pdfInExtractionDPI,
    conversionFactor: COORDINATE_CONSTANTS.PREVIEW_SCALE_FACTOR
  };
};

/**
 * Standardized error handling validation for test consistency
 */
export const validateErrorHandling = (
  errors: string[],
  expectedErrorCount: number,
  expectedErrorSubstring: string,
  testContext: string
): { isValid: boolean; message: string } => {
  if (errors.length !== expectedErrorCount) {
    return {
      isValid: false,
      message: `${testContext}: Expected ${expectedErrorCount} errors, got ${errors.length}`
    };
  }
  
  if (expectedErrorCount > 0 && !errors[0].includes(expectedErrorSubstring)) {
    return {
      isValid: false,
      message: `${testContext}: Expected error containing "${expectedErrorSubstring}", got "${errors[0]}"`
    };
  }
  
  return {
    isValid: true,
    message: `${testContext}: Error validation passed`
  };
};

/**
 * Test environment setup utilities
 */
export const setupTestEnvironment = {
  /**
   * Disable animations for consistent testing
   */
  getAnimationDisableCSS: () => `
    *, *::before, *::after {
      animation-duration: 0s !important;
      animation-delay: 0s !important;
      transition-duration: 0s !important;
      transition-delay: 0s !important;
    }
  `,
  
  /**
   * Standard viewport for comprehensive tests
   */
  getStandardViewport: () => ({ width: 1400, height: 900 }),
  
  /**
   * Clear storage with retry mechanism
   */
  clearStorageWithRetry: async (page: any, maxRetries: number = 3) => {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const result = await page.evaluate(() => {
          try {
            localStorage.clear();
            sessionStorage.clear();
            return { success: true, message: 'Storage cleared successfully' };
          } catch (e) {
            return { success: false, message: e.message, error: e.toString() };
          }
        });
        
        if (result.success) {
          ciLog('Storage cleared successfully');
          return true;
        } else {
          ciLog(`Storage clear attempt ${attempt + 1} failed: ${result.message}`);
          await page.waitForTimeout(500);
        }
      } catch (error) {
        ciLog(`Storage clear attempt ${attempt + 1} error: ${error}`);
        await page.waitForTimeout(500);
      }
    }
    
    ciLog('Storage clearing failed after all attempts - continuing test');
    return false;
  }
};

/**
 * Test categorization for selective running
 */
export const TEST_CATEGORIES = {
  MATHEMATICAL: 'mathematical',
  VISUAL: 'visual',
  FUNCTIONAL: 'functional',
  INTEGRATION: 'integration',
  PERFORMANCE: 'performance'
} as const;

export type TestCategory = typeof TEST_CATEGORIES[keyof typeof TEST_CATEGORIES];

/**
 * Test reliability levels for monitoring
 */
export const RELIABILITY_LEVELS = {
  STABLE: 'stable',        // Should always pass
  FLAKY: 'flaky',         // May fail occasionally due to timing
  ENVIRONMENTAL: 'environmental' // Expected to vary between local and CI
} as const;

export type ReliabilityLevel = typeof RELIABILITY_LEVELS[keyof typeof RELIABILITY_LEVELS];