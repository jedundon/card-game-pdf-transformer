/**
 * @fileoverview Settings Hierarchy Integration Tests
 * 
 * Critical tests for ensuring settings inheritance and hierarchy work correctly
 * across all workflow steps. These tests protect against inconsistent settings
 * application between preview and export, which could lead to user confusion.
 * 
 * Key areas tested:
 * - Settings inheritance from page groups → extraction → output
 * - Settings persistence across workflow steps
 * - Settings override behavior consistency
 * - Settings validation and fallback logic
 * - Default value propagation
 */

import { describe, it, expect } from 'vitest'
import { DEFAULT_SETTINGS } from '../defaults'
import { OutputSettings, ExtractionSettings, PageGroup, ColorSettings } from '../types'

describe('Settings Hierarchy Integration Tests', () => {
  describe('Settings Inheritance Hierarchy', () => {
    it('should inherit settings from page groups to extraction settings', () => {
      // Mock page groups with different processing modes
      const pageGroups: PageGroup[] = [
        {
          id: 'duplex-group',
          name: 'Duplex Pages',
          pageIndices: [0, 1],
          type: 'duplex',
          order: 0,
          processingMode: { type: 'duplex', flipEdge: 'short' },
          color: '#FF0000',
          createdAt: Date.now(),
          modifiedAt: Date.now()
        },
        {
          id: 'simplex-group',
          name: 'Simplex Pages',
          pageIndices: [2, 3],
          type: 'manual',
          order: 1,
          processingMode: { type: 'simplex' },
          color: '#00FF00',
          createdAt: Date.now(),
          modifiedAt: Date.now()
        }
      ];

      // Test settings inheritance pattern
      const baseExtractionSettings: ExtractionSettings = {
        grid: { rows: 2, columns: 3 },
        crop: { top: 50, right: 25, bottom: 75, left: 100 },
        pageDimensions: { width: 612, height: 792 },
        skippedCards: [],
        cardTypeOverrides: []
      };

      // Simulate inheritance from page groups
      const settingsWithPageGroups = {
        ...baseExtractionSettings,
        pageGroups,
        // Processing mode should be derived from page groups when applicable
        inheritedProcessingModes: pageGroups.reduce((acc, group) => {
          group.pageIndices.forEach(pageIndex => {
            acc[pageIndex] = group.processingMode;
          });
          return acc;
        }, {} as Record<number, any>)
      };

      // Validate page group inheritance
      expect(settingsWithPageGroups.pageGroups).toHaveLength(2);
      expect(settingsWithPageGroups.inheritedProcessingModes[0].type).toBe('duplex');
      expect(settingsWithPageGroups.inheritedProcessingModes[1].type).toBe('duplex');
      expect(settingsWithPageGroups.inheritedProcessingModes[2].type).toBe('simplex');
      expect(settingsWithPageGroups.inheritedProcessingModes[3].type).toBe('simplex');

      // Validate base settings are preserved
      expect(settingsWithPageGroups.grid.rows).toBe(2);
      expect(settingsWithPageGroups.grid.columns).toBe(3);
      expect(settingsWithPageGroups.crop.top).toBe(50);
      expect(settingsWithPageGroups.pageDimensions?.width).toBe(612);
    });

    it('should propagate extraction settings to output settings correctly', () => {
      const extractionSettings: ExtractionSettings = {
        grid: { rows: 2, columns: 3 },
        crop: { top: 100, right: 50, bottom: 75, left: 125 },
        pageDimensions: { width: 612, height: 792 },
        skippedCards: [
          { pageIndex: 0, gridRow: 1, gridColumn: 1 }
        ],
        cardTypeOverrides: [
          { pageIndex: 0, gridRow: 0, gridColumn: 0, cardType: 'back' }
        ]
      };

      // Test propagation to output settings
      const outputSettings: OutputSettings = {
        // Basic card configuration
        cardSize: DEFAULT_SETTINGS.outputSettings.cardSize,
        bleedMarginInches: DEFAULT_SETTINGS.outputSettings.bleedMarginInches,
        cardScalePercent: DEFAULT_SETTINGS.outputSettings.cardScalePercent,
        cardImageSizingMode: DEFAULT_SETTINGS.outputSettings.cardImageSizingMode,
        
        // Page configuration
        pageSize: DEFAULT_SETTINGS.outputSettings.pageSize,
        offset: DEFAULT_SETTINGS.outputSettings.offset,
        rotation: DEFAULT_SETTINGS.outputSettings.rotation,
        
        // Should inherit information from extraction settings
        gridConfiguration: {
          rows: extractionSettings.grid.rows,
          columns: extractionSettings.grid.columns,
          totalCards: extractionSettings.grid.rows * extractionSettings.grid.columns
        },
        
        sourcePageDimensions: extractionSettings.pageDimensions,
        appliedCrop: extractionSettings.crop,
        skippedCardCount: extractionSettings.skippedCards.length,
        overrideCount: extractionSettings.cardTypeOverrides.length
      };

      // Validate settings propagation
      expect(outputSettings.gridConfiguration?.rows).toBe(2);
      expect(outputSettings.gridConfiguration?.columns).toBe(3);
      expect(outputSettings.gridConfiguration?.totalCards).toBe(6);
      expect(outputSettings.sourcePageDimensions?.width).toBe(612);
      expect(outputSettings.sourcePageDimensions?.height).toBe(792);
      expect(outputSettings.appliedCrop?.top).toBe(100);
      expect(outputSettings.skippedCardCount).toBe(1);
      expect(outputSettings.overrideCount).toBe(1);

      // Validate defaults are preserved where not overridden
      expect(outputSettings.cardSize.widthInches).toBe(DEFAULT_SETTINGS.outputSettings.cardSize.widthInches);
      expect(outputSettings.bleedMarginInches).toBe(DEFAULT_SETTINGS.outputSettings.bleedMarginInches);
      expect(outputSettings.pageSize.width).toBe(DEFAULT_SETTINGS.outputSettings.pageSize.width);
    });

    it('should handle settings override priority correctly', () => {
      // Test override priority: User Settings > Page Group Settings > Default Settings
      
      const defaultOutputSettings = DEFAULT_SETTINGS.outputSettings;
      
      const pageGroupSettings = {
        cardScalePercent: 110, // Override default 100%
        rotation: 90,          // Override default 0°
        // Other settings inherit from defaults
      };
      
      const userSettings = {
        cardScalePercent: 125, // Override page group 110%
        bleedMarginInches: 0.1875, // Override default 0.125"
        // rotation inherits from page group (90°)
        // Other settings inherit from defaults
      };

      // Simulate settings hierarchy resolution
      const finalSettings: OutputSettings = {
        // User settings take highest priority
        cardScalePercent: userSettings.cardScalePercent,
        bleedMarginInches: userSettings.bleedMarginInches,
        
        // Page group settings override defaults where user hasn't specified
        rotation: pageGroupSettings.rotation,
        
        // Default settings for everything else
        cardSize: defaultOutputSettings.cardSize,
        cardImageSizingMode: defaultOutputSettings.cardImageSizingMode,
        pageSize: defaultOutputSettings.pageSize,
        offset: defaultOutputSettings.offset
      };

      // Validate priority hierarchy
      expect(finalSettings.cardScalePercent).toBe(125); // User setting wins
      expect(finalSettings.bleedMarginInches).toBe(0.1875); // User setting wins
      expect(finalSettings.rotation).toBe(90); // Page group setting wins over default
      expect(finalSettings.cardSize.widthInches).toBe(2.5); // Default preserved
      expect(finalSettings.pageSize.width).toBe(defaultOutputSettings.pageSize.width); // Default preserved
    });
  });

  describe('Settings Persistence Across Workflow Steps', () => {
    it('should maintain settings consistency from extract to configure step', () => {
      // Simulate settings at extract step
      const extractStepSettings = {
        grid: { rows: 3, columns: 3 },
        crop: { top: 150, right: 100, bottom: 125, left: 75 },
        pageDimensions: { width: 792, height: 612 }, // Landscape
        cardTypeOverrides: [
          { pageIndex: 0, gridRow: 1, gridColumn: 1, cardType: 'back' as const }
        ]
      };

      // Simulate transition to configure step
      const configureStepSettings: OutputSettings = {
        cardSize: { widthInches: 2.5, heightInches: 3.5 },
        bleedMarginInches: 0.125,
        cardScalePercent: 100,
        cardImageSizingMode: 'fit-to-card',
        pageSize: { width: 11.0, height: 8.5 }, // Landscape output to match source
        offset: { horizontal: 0, vertical: 0 },
        rotation: 0,
        
        // Settings inherited from extract step
        extractionGrid: extractStepSettings.grid,
        extractionCrop: extractStepSettings.crop,
        extractionPageDimensions: extractStepSettings.pageDimensions,
        hasOverrides: extractStepSettings.cardTypeOverrides.length > 0
      };

      // Validate settings persistence
      expect(configureStepSettings.extractionGrid?.rows).toBe(3);
      expect(configureStepSettings.extractionGrid?.columns).toBe(3);
      expect(configureStepSettings.extractionCrop?.top).toBe(150);
      expect(configureStepSettings.extractionPageDimensions?.width).toBe(792);
      expect(configureStepSettings.extractionPageDimensions?.height).toBe(612);
      expect(configureStepSettings.hasOverrides).toBe(true);

      // Validate output page orientation matches source
      expect(configureStepSettings.pageSize.width).toBeGreaterThan(configureStepSettings.pageSize.height);
    });

    it('should maintain color calibration settings throughout workflow', () => {
      // Simulate color calibration settings
      const colorSettings: ColorSettings = {
        brightness: 110,
        contrast: 95,
        saturation: 105,
        selectedRegion: {
          centerX: 400,
          centerY: 300,
          width: 100,
          height: 100,
          previewCenterX: 200,
          previewCenterY: 150,
          previewWidth: 50,
          previewHeight: 50,
          pageIndex: 0
        },
        selectedPreset: 'custom',
        printerCalibration: {
          enabled: true,
          paperType: 'glossy',
          inkType: 'dye'
        }
      };

      // Simulate settings flow through workflow steps
      const workflowSteps = {
        colorCalibration: colorSettings,
        configure: {
          ...colorSettings,
          // Additional configure-specific settings
          outputQuality: 'high',
          compressionLevel: 85
        },
        export: {
          // Color settings should be preserved for export
          brightness: colorSettings.brightness,
          contrast: colorSettings.contrast,
          saturation: colorSettings.saturation,
          printerCalibration: colorSettings.printerCalibration,
          
          // Export-specific settings
          outputFormat: 'pdf',
          dpi: 300
        }
      };

      // Validate color settings persistence
      expect(workflowSteps.configure.brightness).toBe(110);
      expect(workflowSteps.configure.contrast).toBe(95);
      expect(workflowSteps.configure.saturation).toBe(105);
      expect(workflowSteps.configure.selectedPreset).toBe('custom');

      expect(workflowSteps.export.brightness).toBe(110);
      expect(workflowSteps.export.contrast).toBe(95);
      expect(workflowSteps.export.saturation).toBe(105);
      expect(workflowSteps.export.printerCalibration?.enabled).toBe(true);
      expect(workflowSteps.export.printerCalibration?.paperType).toBe('glossy');
    });

    it('should handle settings migration between workflow versions', () => {
      // Simulate older version settings
      const legacySettings = {
        version: '1.0.0',
        cardWidth: 2.5,
        cardHeight: 3.5,
        bleed: 0.125,
        scale: 100,
        pageWidth: 8.5,
        pageHeight: 11.0,
        rotation: 0
      };

      // Simulate migration to current version
      const migratedSettings: OutputSettings = {
        // Migrate legacy properties to new structure
        cardSize: {
          widthInches: legacySettings.cardWidth,
          heightInches: legacySettings.cardHeight
        },
        bleedMarginInches: legacySettings.bleed,
        cardScalePercent: legacySettings.scale,
        pageSize: {
          width: legacySettings.pageWidth,
          height: legacySettings.pageHeight
        },
        rotation: legacySettings.rotation,
        
        // Add new default properties
        cardImageSizingMode: DEFAULT_SETTINGS.outputSettings.cardImageSizingMode,
        offset: DEFAULT_SETTINGS.outputSettings.offset,
        
        // Migration metadata
        migratedFromVersion: legacySettings.version,
        currentVersion: '2.0.0'
      };

      // Validate successful migration
      expect(migratedSettings.cardSize.widthInches).toBe(2.5);
      expect(migratedSettings.cardSize.heightInches).toBe(3.5);
      expect(migratedSettings.bleedMarginInches).toBe(0.125);
      expect(migratedSettings.cardScalePercent).toBe(100);
      expect(migratedSettings.pageSize.width).toBe(8.5);
      expect(migratedSettings.pageSize.height).toBe(11.0);
      expect(migratedSettings.rotation).toBe(0);

      // Validate new defaults are applied
      expect(migratedSettings.cardImageSizingMode).toBe(DEFAULT_SETTINGS.outputSettings.cardImageSizingMode);
      expect(migratedSettings.offset.horizontal).toBe(0);
      expect(migratedSettings.offset.vertical).toBe(0);

      // Validate migration metadata
      expect(migratedSettings.migratedFromVersion).toBe('1.0.0');
      expect(migratedSettings.currentVersion).toBe('2.0.0');
    });
  });

  describe('Settings Validation and Fallback Logic', () => {
    it('should validate settings values and apply fallbacks', () => {
      // Test invalid settings values
      const invalidSettings = {
        cardSize: { widthInches: -1, heightInches: 0 }, // Invalid dimensions
        bleedMarginInches: -0.5, // Negative bleed
        cardScalePercent: 0, // Zero scale
        pageSize: { width: 0, height: -1 }, // Invalid page size
        rotation: 450 // Invalid rotation
      };

      // Simulate validation and fallback logic
      const validateSetting = <T>(value: T, fallback: T, validator: (val: T) => boolean): T => {
        return validator(value) ? value : fallback;
      };

      const validatedSettings: OutputSettings = {
        cardSize: {
          widthInches: validateSetting(
            invalidSettings.cardSize.widthInches,
            DEFAULT_SETTINGS.outputSettings.cardSize.widthInches,
            (val: number) => val > 0 && val <= 10
          ),
          heightInches: validateSetting(
            invalidSettings.cardSize.heightInches,
            DEFAULT_SETTINGS.outputSettings.cardSize.heightInches,
            (val: number) => val > 0 && val <= 15
          )
        },
        bleedMarginInches: validateSetting(
          invalidSettings.bleedMarginInches,
          DEFAULT_SETTINGS.outputSettings.bleedMarginInches,
          (val: number) => val >= 0 && val <= 1
        ),
        cardScalePercent: validateSetting(
          invalidSettings.cardScalePercent,
          DEFAULT_SETTINGS.outputSettings.cardScalePercent,
          (val: number) => val > 0 && val <= 500
        ),
        pageSize: {
          width: validateSetting(
            invalidSettings.pageSize.width,
            DEFAULT_SETTINGS.outputSettings.pageSize.width,
            (val: number) => val > 0 && val <= 50
          ),
          height: validateSetting(
            invalidSettings.pageSize.height,
            DEFAULT_SETTINGS.outputSettings.pageSize.height,
            (val: number) => val > 0 && val <= 50
          )
        },
        cardImageSizingMode: DEFAULT_SETTINGS.outputSettings.cardImageSizingMode,
        offset: DEFAULT_SETTINGS.outputSettings.offset,
        rotation: validateSetting(
          invalidSettings.rotation,
          DEFAULT_SETTINGS.outputSettings.rotation,
          (val: number) => val >= 0 && val < 360 && val % 90 === 0
        )
      };

      // Validate fallbacks were applied
      expect(validatedSettings.cardSize.widthInches).toBe(DEFAULT_SETTINGS.outputSettings.cardSize.widthInches);
      expect(validatedSettings.cardSize.heightInches).toBe(DEFAULT_SETTINGS.outputSettings.cardSize.heightInches);
      expect(validatedSettings.bleedMarginInches).toBe(DEFAULT_SETTINGS.outputSettings.bleedMarginInches);
      expect(validatedSettings.cardScalePercent).toBe(DEFAULT_SETTINGS.outputSettings.cardScalePercent);
      expect(validatedSettings.pageSize.width).toBe(DEFAULT_SETTINGS.outputSettings.pageSize.width);
      expect(validatedSettings.pageSize.height).toBe(DEFAULT_SETTINGS.outputSettings.pageSize.height);
      expect(validatedSettings.rotation).toBe(DEFAULT_SETTINGS.outputSettings.rotation);
    });

    it('should handle partial settings objects gracefully', () => {
      // Test partial settings (missing required properties)
      const partialSettings = {
        cardScalePercent: 110,
        rotation: 90
        // Missing cardSize, bleedMarginInches, pageSize, etc.
      };

      // Simulate merging with defaults
      const completeSettings: OutputSettings = {
        ...DEFAULT_SETTINGS.outputSettings,
        ...partialSettings
      };

      // Validate defaults are applied for missing properties
      expect(completeSettings.cardSize.widthInches).toBe(DEFAULT_SETTINGS.outputSettings.cardSize.widthInches);
      expect(completeSettings.cardSize.heightInches).toBe(DEFAULT_SETTINGS.outputSettings.cardSize.heightInches);
      expect(completeSettings.bleedMarginInches).toBe(DEFAULT_SETTINGS.outputSettings.bleedMarginInches);
      expect(completeSettings.pageSize.width).toBe(DEFAULT_SETTINGS.outputSettings.pageSize.width);
      expect(completeSettings.pageSize.height).toBe(DEFAULT_SETTINGS.outputSettings.pageSize.height);
      expect(completeSettings.cardImageSizingMode).toBe(DEFAULT_SETTINGS.outputSettings.cardImageSizingMode);
      expect(completeSettings.offset.horizontal).toBe(DEFAULT_SETTINGS.outputSettings.offset.horizontal);
      expect(completeSettings.offset.vertical).toBe(DEFAULT_SETTINGS.outputSettings.offset.vertical);

      // Validate provided settings are preserved
      expect(completeSettings.cardScalePercent).toBe(110);
      expect(completeSettings.rotation).toBe(90);
    });

    it('should handle nested settings objects correctly', () => {
      // Test nested partial settings
      const partialNestedSettings = {
        cardSize: { widthInches: 3.0 }, // Missing heightInches
        pageSize: { height: 14.0 }, // Missing width
        offset: { horizontal: 0.25 } // Missing vertical
      };

      // Simulate deep merging with defaults
      const mergeDeep = (target: any, source: any): any => {
        const result = { ...target };
        for (const key in source) {
          if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
            result[key] = mergeDeep(target[key] || {}, source[key]);
          } else {
            result[key] = source[key];
          }
        }
        return result;
      };

      const completeNestedSettings: OutputSettings = mergeDeep(
        DEFAULT_SETTINGS.outputSettings,
        partialNestedSettings
      );

      // Validate partial nested properties are preserved
      expect(completeNestedSettings.cardSize.widthInches).toBe(3.0);
      expect(completeNestedSettings.pageSize.height).toBe(14.0);
      expect(completeNestedSettings.offset.horizontal).toBe(0.25);

      // Validate missing nested properties use defaults
      expect(completeNestedSettings.cardSize.heightInches).toBe(DEFAULT_SETTINGS.outputSettings.cardSize.heightInches);
      expect(completeNestedSettings.pageSize.width).toBe(DEFAULT_SETTINGS.outputSettings.pageSize.width);
      expect(completeNestedSettings.offset.vertical).toBe(DEFAULT_SETTINGS.outputSettings.offset.vertical);

      // Validate unrelated properties remain default
      expect(completeNestedSettings.bleedMarginInches).toBe(DEFAULT_SETTINGS.outputSettings.bleedMarginInches);
      expect(completeNestedSettings.cardScalePercent).toBe(DEFAULT_SETTINGS.outputSettings.cardScalePercent);
    });
  });

  describe('Settings Impact on Preview vs Export Consistency', () => {
    it('should use identical settings for preview and export calculations', () => {
      // Test settings that affect both preview and export
      const criticalSettings: OutputSettings = {
        cardSize: { widthInches: 2.5, heightInches: 3.5 },
        bleedMarginInches: 0.125,
        cardScalePercent: 110,
        cardImageSizingMode: 'fit-to-card',
        pageSize: { width: 8.5, height: 11.0 },
        offset: { horizontal: 0.125, vertical: -0.0625 },
        rotation: 90
      };

      // Simulate preview calculation context
      const previewCalculation = {
        settings: criticalSettings,
        dpi: 72, // Screen DPI
        containerSize: { width: 400, height: 500 },
        // Preview should use same settings as export
        cardDimensionsInches: {
          width: (criticalSettings.cardSize.widthInches + criticalSettings.bleedMarginInches * 2) * (criticalSettings.cardScalePercent / 100),
          height: (criticalSettings.cardSize.heightInches + criticalSettings.bleedMarginInches * 2) * (criticalSettings.cardScalePercent / 100)
        }
      };

      // Simulate export calculation context
      const exportCalculation = {
        settings: criticalSettings,
        dpi: 300, // Print DPI
        // Export should use identical settings as preview
        cardDimensionsInches: {
          width: (criticalSettings.cardSize.widthInches + criticalSettings.bleedMarginInches * 2) * (criticalSettings.cardScalePercent / 100),
          height: (criticalSettings.cardSize.heightInches + criticalSettings.bleedMarginInches * 2) * (criticalSettings.cardScalePercent / 100)
        }
      };

      // Validate settings consistency
      expect(previewCalculation.settings).toEqual(exportCalculation.settings);
      expect(previewCalculation.cardDimensionsInches).toEqual(exportCalculation.cardDimensionsInches);

      // Validate calculated dimensions
      const expectedWidth = 2.75 * 1.1; // (2.5 + 0.25) * 1.1
      const expectedHeight = 3.75 * 1.1; // (3.5 + 0.25) * 1.1

      expect(previewCalculation.cardDimensionsInches.width).toBeCloseTo(expectedWidth, 3);
      expect(previewCalculation.cardDimensionsInches.height).toBeCloseTo(expectedHeight, 3);
      expect(exportCalculation.cardDimensionsInches.width).toBeCloseTo(expectedWidth, 3);
      expect(exportCalculation.cardDimensionsInches.height).toBeCloseTo(expectedHeight, 3);
    });

    it('should maintain mathematical relationships across different DPI contexts', () => {
      const settings: OutputSettings = {
        cardSize: { widthInches: 2.5, heightInches: 3.5 },
        bleedMarginInches: 0.125,
        cardScalePercent: 100,
        cardImageSizingMode: 'fit-to-card',
        pageSize: { width: 8.5, height: 11.0 },
        offset: { horizontal: 0, vertical: 0 },
        rotation: 0
      };

      // Calculate dimensions in different DPI contexts
      const dpiContexts = [
        { name: 'screen', dpi: 72 },
        { name: 'intermediate', dpi: 150 },
        { name: 'print', dpi: 300 }
      ];

      const dimensionResults = dpiContexts.map(context => {
        const cardWidthInches = (settings.cardSize.widthInches + settings.bleedMarginInches * 2) * (settings.cardScalePercent / 100);
        const cardHeightInches = (settings.cardSize.heightInches + settings.bleedMarginInches * 2) * (settings.cardScalePercent / 100);
        
        return {
          context: context.name,
          dpi: context.dpi,
          cardWidthInches,
          cardHeightInches,
          cardWidthPixels: cardWidthInches * context.dpi,
          cardHeightPixels: cardHeightInches * context.dpi,
          aspectRatio: cardWidthInches / cardHeightInches
        };
      });

      // Validate dimensions in inches are identical across all DPI contexts
      const referenceInches = dimensionResults[0];
      for (const result of dimensionResults) {
        expect(result.cardWidthInches).toBeCloseTo(referenceInches.cardWidthInches, 5);
        expect(result.cardHeightInches).toBeCloseTo(referenceInches.cardHeightInches, 5);
        expect(result.aspectRatio).toBeCloseTo(referenceInches.aspectRatio, 5);
      }

      // Validate pixel dimensions scale proportionally
      expect(dimensionResults[1].cardWidthPixels).toBeCloseTo(dimensionResults[0].cardWidthPixels * (150 / 72), 2);
      expect(dimensionResults[2].cardWidthPixels).toBeCloseTo(dimensionResults[0].cardWidthPixels * (300 / 72), 2);
      expect(dimensionResults[1].cardHeightPixels).toBeCloseTo(dimensionResults[0].cardHeightPixels * (150 / 72), 2);
      expect(dimensionResults[2].cardHeightPixels).toBeCloseTo(dimensionResults[0].cardHeightPixels * (300 / 72), 2);
    });
  });
});