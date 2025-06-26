# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Running the Application
- `npm run dev` - Start development server (copies PDF.js worker first, then starts Vite)
- `npm start` - Alias for `npm run dev`
- `npm run build` - Build for production (copies worker, runs TypeScript check, then builds)
- `npm run preview` - Preview production build locally

### Code Quality
- `npm run lint` - Run ESLint on JavaScript/TypeScript files
- `tsc -b` - Run TypeScript compiler check (included in build process)

### Special Notes
- The `copy-worker` script must run before dev/build to copy PDF.js worker from node_modules to public/
- Always use `npm run dev` for development (not just `vite dev`) to ensure worker is copied

## Project Architecture

### Core Application Flow
This is a React-based card game file transformation tool with a 5-step wizard that supports both PDF and image files:

1. **Import Files** (`ImportStep.tsx`) - Upload PDF and/or image files, configure page settings and processing mode
2. **Extract Cards** (`ExtractStep.tsx`) - Set up grid layout and cropping parameters for card identification
3. **Color Calibration** (`ColorCalibrationStep.tsx`) - Apply color corrections and calibration adjustments
4. **Configure Layout** (`ConfigureStep.tsx`) - Adjust output format, sizing, and positioning for print
5. **Export** (`ExportStep.tsx`) - Generate final PDF for printing with processed cards

### Key State Management
- Main app state lives in `App.tsx` with step-by-step data flow
- Processing mode affects card extraction logic (simplex/duplex/gutter-fold) for both PDF and image files
- Multi-file import system (`useMultiFileImport`) manages mixed PDF/image workflows
- Settings can be saved/loaded via `SettingsManager.tsx`

### File Processing Architecture
The application supports both PDF and image files through a unified processing pipeline:

#### PDF File Processing
- **PDF.js Integration**: Uses `pdfjs-dist` for PDF parsing and rendering
- **Worker Setup**: PDF.js worker copied to public/ directory for browser compatibility
- **Coordinate System**: PDF coordinates (72 DPI) converted to extraction DPI (300 DPI)

#### Image File Processing  
- **Multi-Format Support**: Handles PNG, JPG, JPEG files through HTML5 Canvas API
- **ImageFileData**: Structured data format for consistent image handling
- **Coordinate System**: Native image pixels treated as extraction DPI (300 DPI)

#### Unified Processing Pipeline
- **Card Extraction**: Source-aware utility functions in `utils/cardUtils.ts` handle both PDF and image sources
- **DPI Standardization**: All measurements normalized to extraction DPI (300) for consistent calculations
- **Unified Rendering**: Shared `renderUtils.ts` ensures preview and export use identical calculations for both file types
- **Multi-File Import**: `useMultiFileImport` hook manages mixed PDF/image sessions with unified page ordering

### Rendering Architecture and Consistency
The application uses a unified rendering system to ensure perfect consistency between preview and final output:

#### Card Rendering Pipeline
1. **Dimension Calculation**: `calculateFinalCardRenderDimensions()` determines both card container size and image size
2. **Image Processing**: `processCardImageForRendering()` applies sizing, rotation, and clipping using canvas
3. **Positioning**: `calculateCardPositioning()` handles placement and rotation-aware dimensions
4. **Preview Scaling**: `calculatePreviewScaling()` converts to screen display format

#### Key Design Principles
- **Card vs Image Separation**: Card container defines clipping boundaries; image size handles scaling modes
- **Canvas-Based Processing**: All rotation and clipping applied via canvas for pixel-perfect control
- **Single Source of Truth**: Same functions used for both preview and export to prevent inconsistencies
- **DPI Consistency**: Proper scaling between extraction DPI (300), screen DPI (72/96), and final output

### Component Structure
- `components/` - Step components and shared utilities
  - `ImportStep.tsx` - Multi-file import with PDF and image support
  - `ExtractStep.tsx` - Source-aware card extraction with unified preview overlays
  - `ColorCalibrationStep.tsx` - Color correction and calibration adjustments
  - `ConfigureStep.tsx` - Layout configuration with multi-file support
  - `ExportStep.tsx` - Final PDF generation from mixed sources
- `utils/` - Business logic separated from UI
  - `cardUtils.ts` - Source-aware card identification and calculation logic
  - `renderUtils.ts` - Unified rendering functions for preview and export consistency
  - `calibrationUtils.ts` - Printer calibration utilities
  - `multiFileUtils.ts` - Multi-file import and management utilities
- `hooks/` - React hooks for state management
  - `useMultiFileImport.ts` - Multi-file session management
- `constants.ts` - Application-wide constants (DPI, file type support, preview constraints)
- `defaults.ts` - Default configuration values

### Processing Mode Handling
The application handles three layout types that apply to both PDF and image files:
- **Simplex**: Single-sided pages/images, each card appears once
- **Duplex**: Double-sided pages/images, cards have fronts and backs  
- **Gutter-fold**: Cards are arranged for gutter folding across page center

Card identification logic varies significantly between modes and is centralized in `cardUtils.ts`, with source-aware processing for both PDF and image inputs.

### Styling and UI
- **Tailwind CSS**: Primary styling framework
- **Lucide React**: Icon library
- **Responsive Design**: Uses CSS Grid and Flexbox for layouts
- **Preview System**: Real-time card preview with proper scaling calculations

## Development Guidelines

### TypeScript Configuration
- Strict mode enabled with comprehensive linting rules
- Uses React JSX transform
- Bundler module resolution for Vite compatibility

### Code Organization
- Business logic separated into utility files
- Component props properly typed with interfaces
- Constants centralized to avoid magic numbers
- PDF processing logic abstracted from UI components

### Testing and Quality
- ESLint configured for React and TypeScript
- No unused variables/parameters allowed
- Comprehensive TypeScript checking in build process

## Common Development Patterns and Pitfalls

### Rendering Consistency Issues
**Problem**: Preview and export showing different results
**Solution**: Always use unified rendering functions from `renderUtils.ts` rather than duplicating logic

**Problem**: Double rotation or incorrect rotation display
**Solution**: Apply rotation via canvas processing, not CSS transforms, to avoid conflicts

**Problem**: Images not properly clipped to card boundaries
**Solution**: Use card container dimensions for clipping; image dimensions for internal scaling

### DPI and Scaling Considerations
- Extraction always at 300 DPI (EXTRACTION_DPI)
- Screen display at 72-96 DPI (SCREEN_DPI) 
- Preview scaling must account for both DPI conversion and viewport constraints
- Always convert between DPI contexts when moving between extraction, processing, and display

### Canvas Processing Best Practices
- Use canvas for both rotation and clipping to maintain pixel-perfect control
- Apply transformations in correct order: center → rotate → draw
- Set canvas dimensions to final output size, not image size
- Handle rotation by swapping width/height for 90°/270° rotations

## Multi-File Architecture Considerations

### PDF vs Image File Handling
The application supports both PDF and image files (PNG, JPG) through a unified interface, but there are critical architectural considerations:

#### Coordinate System Consistency
**CRITICAL**: All coordinate calculations (crops, dimensions, positioning) must use the same coordinate system for both PDF and image files.

**Standard Approach**:
- **Extraction DPI (300)**: All measurements internally in extraction DPI pixels
- **PDF files**: Convert from PDF.js coordinates (72 DPI) to extraction DPI
- **Image files**: Treat native pixels as extraction DPI (assume 300 DPI)
- **UI inputs**: Crop values, dimensions are in extraction DPI pixels

**Implementation Pattern**:
```typescript
// ✅ CORRECT: Unified coordinate system
if (sourceType === 'image') {
  sourceWidth = pageDimensions.width; // Use native pixels as extraction DPI
} else {
  sourceWidth = (renderedData.width / previewScale) * extractionScale; // Convert PDF to extraction DPI
}

// ✅ CORRECT: Crop values always in extraction DPI
const croppedWidth = sourceWidth - cropLeft - cropRight;
```

**Anti-Patterns to Avoid**:
```typescript
// ❌ WRONG: Different coordinate systems
if (sourceType === 'image') {
  // Using native pixels directly
} else {
  // Using extraction DPI
}

// ❌ WRONG: Inconsistent scaling
const scale = pdfData ? extractionScale : 1.0; // Different behavior by type
```

#### Data Source Validation
When supporting multiple file types, always validate data sources properly:

```typescript
// ✅ CORRECT: Check for either data source
const hasValidDataSource = pdfData || (renderedPageData?.sourceType === 'image');
if (!hasValidDataSource || !otherRequiredData) return null;

// ❌ WRONG: Only checking one source type
if (!pdfData || !otherRequiredData) return null; // Fails for images
```

#### Preview and Extraction Consistency
**Critical Pattern**: Ensure preview calculations match extraction calculations exactly:

- **Preview overlays**: Use same scaling logic as actual extraction
- **Dimension display**: Calculate using same formulas as extraction
- **Coordinate conversion**: Apply same transformations in both paths

#### Common Pitfalls with Multi-File Support
1. **DPI Assumptions**: Don't assume all images are at extraction DPI
2. **Scaling Logic**: Avoid duplicating scaling calculations between preview and extraction
3. **Conditional Logic**: Be careful with `if (pdfData)` checks that exclude image files
4. **Settings Interpretation**: Ensure crop/grid values mean the same thing for all file types

### Debugging Multi-File Issues
When debugging PDF vs image discrepancies:

1. **Check coordinate systems**: Are measurements in the same units?
2. **Trace scaling calculations**: Do preview and extraction use same formulas?
3. **Validate data sources**: Are conditionals excluding valid image data?
4. **Compare end-to-end**: Do identical layouts produce identical results?

### Testing Multi-File Features
- Create identical content in both PDF and image formats
- Process with identical settings through both pipelines  
- Compare pixel-perfect results at each stage
- Verify preview matches final extraction for both file types