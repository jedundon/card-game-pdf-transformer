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