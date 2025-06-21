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
This is a React-based PDF transformation tool with a 4-step wizard:

1. **Import PDF** (`ImportStep.tsx`) - Upload PDF, configure page settings and PDF mode
2. **Extract Cards** (`ExtractStep.tsx`) - Set up grid layout and cropping parameters  
3. **Configure Layout** (`ConfigureStep.tsx`) - Adjust output format, sizing, and positioning
4. **Export** (`ExportStep.tsx`) - Generate final PDF for printing

### Key State Management
- Main app state lives in `App.tsx` with step-by-step data flow
- PDF mode affects card extraction logic (simplex/duplex/gutter-fold)
- Settings can be saved/loaded via `SettingsManager.tsx`

### PDF Processing Architecture
- **PDF.js Integration**: Uses `pdfjs-dist` for PDF parsing and rendering
- **Worker Setup**: PDF.js worker copied to public/ directory for browser compatibility
- **Card Extraction**: Utility functions in `utils/cardUtils.ts` handle complex card identification logic
- **DPI Handling**: Different DPI constants for extraction (300) vs screen display (72/96)
- **Unified Rendering**: Shared `renderUtils.ts` ensures preview and export use identical calculations

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
- `utils/` - Business logic separated from UI
  - `cardUtils.ts` - Card identification and calculation logic
  - `renderUtils.ts` - Unified rendering functions for preview and export consistency
  - `calibrationUtils.ts` - Printer calibration utilities
- `constants.ts` - Application-wide constants (DPI, preview constraints)
- `defaults.ts` - Default configuration values

### PDF Mode Handling
The application handles three PDF layouts:
- **Simplex**: Single-sided pages, each card appears once
- **Duplex**: Double-sided pages, cards have fronts and backs
- **Gutter-fold**: Cards are arranged for gutter folding

Card identification logic varies significantly between modes and is centralized in `cardUtils.ts`.

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