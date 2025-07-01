/**
 * @fileoverview Card processing utilities for PDF card game extraction (REFACTORED)
 * 
 * This module has been refactored from a monolithic 2000+ line file into specialized
 * modules for better maintainability. All functions are re-exported here to maintain
 * backward compatibility with existing imports.
 * 
 * **New Module Structure:**
 * - `cardValidation.ts` - Page/card validation logic
 * - `cardCalculations.ts` - Mathematical calculations and DPI conversions
 * - `cardIdentification.ts` - Core card ID and info logic
 * - `cardExtraction.ts` - Image extraction functionality
 * - `cardSkipping.ts` - Skip/pairing management
 * - `cardRendering.ts` - Thumbnail and rendering
 * - `cardMultiFile.ts` - Multi-file workflow support
 * 
 * **Key Responsibilities:**
 * - Card identification logic for different PDF modes (simplex/duplex/gutter-fold)
 * - High-resolution image extraction from PDF pages at 300 DPI
 * - Complex card ID mapping and front/back relationships
 * - Grid-based card positioning and cropping calculations
 * - Skip card management and filtering
 * - DPI conversion and scaling operations
 * 
 * **PDF Mode Support:**
 * - **Simplex**: Each page contains unique cards
 * - **Duplex**: Alternating front/back pages with flip edge logic
 * - **Gutter-fold**: Pages split into front/back halves with mirroring
 * 
 * **Shared Components:**
 * Used by ExtractStep, ConfigureStep, and ExportStep components for consistent
 * card processing across the application workflow.
 * 
 * @author Card Game PDF Transformer
 */

// Re-export all functions from specialized modules to maintain API compatibility
export * from './card/index';