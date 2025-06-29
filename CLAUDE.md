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

## Component Architecture and Refactoring Insights

### Major Refactoring (December 2024)
The codebase underwent a comprehensive component decomposition that transformed three massive components into a modular, maintainable architecture. This section documents key architectural insights and best practices discovered during this process.

#### Component Decomposition Results
- **ImportStep.tsx**: 874+ → 582 lines (-292 lines, -33%)
- **ExtractStep.tsx**: 1778+ → ~800 lines (-978 lines, -55%) 
- **ConfigureStep.tsx**: 1647+ → ~600 lines (-1047 lines, -64%)
- **Total**: ~2,317 lines reduced, 22 focused components created

### Architectural Patterns Established

#### Component Structure Standards
```
src/components/
├── [StepName].tsx                    # Main step component (slim coordinator)
├── [StepName]/
│   ├── components/                   # Step-specific UI components
│   │   ├── [FeatureSection].tsx     # Logical feature groupings
│   │   └── [UIElement].tsx          # Reusable UI elements
│   └── hooks/                       # Step-specific custom hooks
│       └── use[Feature].ts          # Extracted business logic
```

#### TypeScript Interface Design
**Best Practice**: Create comprehensive prop interfaces with JSDoc documentation:

```typescript
interface ComponentProps {
  /** Primary data or state */
  data: DataType;
  /** Event handlers with descriptive names */
  onDataChange: (newData: DataType) => void;
  /** Optional configuration */
  config?: ConfigType;
}

/**
 * Brief component description explaining its single responsibility
 * 
 * Detailed explanation of component purpose, key features, and usage context.
 * Include any important behavioral notes or dependencies.
 */
export const Component: React.FC<ComponentProps> = ({ ... }) => {
```

#### Component Responsibility Guidelines
1. **Single Responsibility**: Each component should handle one logical UI concern
2. **80-200 Lines**: Target component size for optimal maintainability
3. **Pure Props**: Avoid direct imports of global state when possible
4. **Event Boundaries**: Clear event handler interfaces between components

### Critical Icon Import Pattern
**IMPORTANT**: Lucide React icon imports changed naming convention. Always use base names:

```typescript
// ✅ CORRECT: Use base icon names
import { Printer, Upload, Ruler, RotateCcw } from 'lucide-react';

// ❌ WRONG: Old "Icon" suffix pattern (will cause runtime errors)
import { PrinterIcon, UploadIcon, RulerIcon, RotateCcwIcon } from 'lucide-react';
```

### Custom Hook Extraction Patterns

#### When to Extract Hooks
- **Complex State Logic**: When useState patterns become complex
- **Expensive Calculations**: When useMemo dependencies grow large
- **Reusable Patterns**: When multiple components need similar logic

#### Example: useCardDimensions Hook
```typescript
// ✅ GOOD: Extracted complex calculation with memoization
export const useCardDimensions = (
  extractionSettings: ExtractionSettings,
  outputSettings: OutputSettings
) => {
  return useMemo(() => {
    // Complex calculation logic here
    return { widthPx, heightPx, widthInches, heightInches };
  }, [extractionSettings.grid, outputSettings.cardSize]);
};
```

### Error Handling and User Experience

#### Progressive Enhancement Pattern
```typescript
// ✅ PATTERN: Graceful degradation with specific error messages
const [error, setError] = useState<string>('');

try {
  // Risky operation
} catch (error) {
  let errorMessage = 'Operation failed';
  
  if (error instanceof Error) {
    if (error.message.includes('timeout')) {
      errorMessage = 'Operation timed out. Please try again.';
    } else if (error.message.includes('memory')) {
      errorMessage = 'Not enough memory. Try refreshing the page.';
    }
  }
  
  setError(errorMessage);
}
```

#### Timeout and Performance Patterns
```typescript
// ✅ PATTERN: Race conditions with timeouts for better UX
const extractPromise = extractCardImage(cardIndex);
const timeoutPromise = new Promise<null>((_, reject) => 
  setTimeout(() => reject(new Error('Extraction timed out')), 10000)
);

const result = await Promise.race([extractPromise, timeoutPromise]);
```

### State Management Insights

#### Multi-File State Complexity
The multi-file import system revealed important patterns for complex state management:

1. **Unified Data Models**: Always use consistent data structures across file types
2. **Source Awareness**: Components should know whether they're handling PDF or image data
3. **Stable References**: Use useMemo for data maps to prevent unnecessary re-renders

```typescript
// ✅ PATTERN: Stable reference pattern for complex data
const imageDataMap = useMemo(() => {
  const map = new Map();
  pages.forEach(page => {
    if (page.fileType === 'image') {
      map.set(page.fileName, getImageData(page.fileName));
    }
  });
  return map;
}, [pages]); // Only recreate when pages change
```

#### Debounced Settings Pattern
```typescript
// ✅ PATTERN: Debounced settings for expensive operations
const debouncedSettingsChange = useCallback((newSettings: any) => {
  if (timeoutRef.current) clearTimeout(timeoutRef.current);
  
  pendingSettingsRef.current = newSettings;
  timeoutRef.current = setTimeout(() => {
    if (pendingSettingsRef.current) {
      onSettingsChange(pendingSettingsRef.current);
      pendingSettingsRef.current = null;
    }
  }, 300);
}, [onSettingsChange]);
```

### Performance Optimizations Discovered

#### Canvas Processing Efficiency
- **Batch Operations**: Group canvas operations to minimize context switches
- **Image Caching**: Cache processed images with timestamp-based expiration
- **Progressive Loading**: Load thumbnails in batches to avoid overwhelming the browser

#### Memory Management
```typescript
// ✅ PATTERN: Bounded cache with LRU eviction
if (cache.size > MAX_CACHE_SIZE) {
  const entries = Array.from(cache.entries());
  entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
  // Remove oldest entries
  for (let i = 0; i < EVICTION_COUNT; i++) {
    cache.delete(entries[i][0]);
  }
}
```

### Development Workflow Insights

#### Git Commit Strategy
Successful refactoring used structured commits with clear scope:
- `Extract [ComponentName] component from [ParentComponent]`
- `Fix [specific issue] causing [error description]`
- `Add [feature] with [implementation detail]`

#### Testing During Refactoring
1. **Incremental Validation**: Test functionality after each component extraction
2. **Cross-Browser Testing**: Verify icon imports and component rendering
3. **Error Boundary Testing**: Ensure error handling works in degraded states

### Future Development Guidelines

#### When Adding New Features
1. **Start Small**: Create focused components following established patterns
2. **TypeScript First**: Define interfaces before implementation
3. **Test Edge Cases**: Consider multi-file scenarios and error states
4. **Performance Conscious**: Use memoization and debouncing appropriately

#### Maintenance Best Practices
1. **Component Size Monitoring**: Keep components under 300 lines
2. **Dependency Auditing**: Regularly review useEffect dependencies
3. **Interface Evolution**: Update TypeScript interfaces when adding features
4. **Documentation**: Maintain JSDoc comments for complex business logic

This refactoring established a solid foundation for continued development while maintaining full functionality and improving developer experience significantly.

## Debugging Complex State Management Issues

### State Synchronization Anti-Patterns (Learned from GitHub Issue #38)

During implementation of clickable step navigation, we encountered a subtle but critical state management issue that provides important lessons for debugging complex React applications.

#### The Problem: Partial State Clearing
When implementing "Start Over" functionality, we discovered that `handleResetToDefaults` was only partially clearing application state:

```typescript
// ❌ PROBLEMATIC: Only partial state clearing
const handleResetToDefaults = () => {
  clearLocalStorageSettings();
  pdfDataManager.handleClearLastImportedFile(); // Only clears lastImportedFileInfo
  settingsManager.resetToDefaults();
  localStorageSync.clearAutoRestoredFlag();
  // Missing: pdfDataManager.clearPdfData() ← Critical omission
};
```

**Symptom**: Users could navigate to steps they shouldn't have access to after "Start Over"
**Root Cause**: `pdfData` remained loaded while other state was cleared
**Impact**: Conditional logic based on `isPdfLoaded` returned incorrect results

#### The Solution: Complete State Clearing
```typescript
// ✅ CORRECT: Complete state clearing
const handleResetToDefaults = () => {
  clearLocalStorageSettings();
  pdfDataManager.handleClearLastImportedFile();
  pdfDataManager.clearPdfData(); // ← Added missing state clearing
  settingsManager.resetToDefaults();
  localStorageSync.clearAutoRestoredFlag();
};
```

#### Debugging Methodology for State Issues

1. **Trace State Dependencies**: Map out all state variables that affect conditional logic
   ```typescript
   // Example: Step navigation depends on BOTH conditions
   const isPdfLoaded = !!pdfDataManager.pdfData || multiFileImport.multiFileState.pages.length > 0;
   ```

2. **Verify Reset Functions**: Ensure all reset/clear functions actually modify the intended state
   ```typescript
   // Check what each function actually does:
   // handleClearLastImportedFile() → only clears lastImportedFileInfo
   // clearPdfData() → sets pdfData to null (THIS was missing)
   ```

3. **Test State Transitions**: Verify each user action properly transitions state
   - Initial load → correct state
   - After file import → correct state  
   - After reset action → correct state ← **This failed initially**

4. **Use Consistent Naming**: Functions should clearly indicate their scope
   ```typescript
   // Good: Specific about what gets cleared
   clearPdfData()           // Only clears PDF data
   clearLastImportedFile()  // Only clears file tracking info
   resetToDefaults()        // Should clear ALL app state
   ```

#### Common State Management Pitfalls

1. **Assuming Function Names Match Behavior**: Just because a function is called "reset" doesn't mean it resets everything
2. **Partial State Updates**: Forgetting to clear all related state variables
3. **State Drift**: When multiple state managers exist, ensure they stay synchronized
4. **Testing Only Happy Path**: Always test edge cases like reset/clear operations

#### Prevention Strategies

1. **Centralized State Clearing**: Create comprehensive reset functions that handle all related state
2. **State Validation**: Add runtime checks for impossible state combinations
3. **Clear Function Names**: Use specific names that match actual behavior
4. **Documentation**: Document state dependencies and clearing requirements
5. **Integration Testing**: Test complete user workflows, not just individual functions

#### Debugging Tools and Techniques

1. **State Logging**: Add temporary logging to track state changes
   ```typescript
   console.log('State after reset:', { 
     pdfData: !!pdfDataManager.pdfData, 
     multiFilePages: multiFileImport.multiFileState.pages.length 
   });
   ```

2. **React DevTools**: Monitor state changes in real-time during user actions
3. **Conditional Breakpoints**: Set breakpoints that trigger only when state is unexpected
4. **State Snapshots**: Capture state before/after critical operations

This debugging experience reinforced the importance of thorough state management and complete testing of user workflows, especially reset/clear operations that are often edge cases.