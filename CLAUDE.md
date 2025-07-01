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

## Comprehensive Testing Framework

The application includes a comprehensive testing framework that catches "hard to detect" issues before they reach users. This testing infrastructure implements GitHub Issue #63 requirements and provides automated validation across all critical application areas.

### Testing Architecture Overview

The testing framework consists of four complementary layers:

1. **Unit Testing** - Mathematical functions and business logic validation
2. **Visual Regression Testing** - UI consistency across browsers and updates  
3. **Integration Testing** - Complete workflow and multi-file processing
4. **Build Validation** - Production asset integrity and performance

### Test Files Structure

```
tests/                           # Playwright E2E and visual regression tests
├── visual-regression.spec.ts    # All 5 wizard steps visual testing
├── preview-consistency.spec.ts  # Mathematical consistency validation
├── pdf-image-parity.spec.ts     # PDF vs image workflow parity
├── workflow-integration.spec.ts # End-to-end workflow testing
├── async-processing.spec.ts     # Real async processing validation
├── build-validation.spec.ts     # Production build integrity
└── basic-smoke.spec.ts         # Basic application startup tests

src/test/                       # Unit tests for business logic
├── renderUtils.test.ts         # Render utility mathematical functions
├── cardUtils.test.ts          # Card positioning and grid logic
├── previewConsistency.test.ts # Preview vs export consistency
└── setup.ts                   # Test environment configuration
```

### Available Test Commands

```bash
# Unit Testing (Vitest)
npm run test          # Run tests in watch mode during development
npm run test:run      # Run tests once (used in CI/CD)
npm run test:coverage # Run with coverage report

# Visual Regression Testing (Playwright)
npm run test:e2e      # Run all Playwright tests
npm run test:e2e:ui   # Run with interactive UI for debugging

# Combined Testing
npm run build         # Includes TypeScript check and build validation
```

### Developer Testing Guidelines

#### When to Write Tests

**Always Write Tests For:**
- Mathematical functions (DPI conversions, scaling, rotation)
- Core business logic (card positioning, grid calculations)
- Critical user workflows (file upload, extraction, export)
- Bug fixes (add test that reproduces the bug first)

**Consider Tests For:**
- Complex UI components with business logic
- Error handling and recovery scenarios
- Performance-critical operations

#### Unit Testing Best Practices

**Location**: Place unit tests in `src/test/` directory alongside source code

**Naming Convention**: `[sourceFile].test.ts` (e.g., `renderUtils.test.ts`)

**Test Structure**:
```typescript
import { describe, it, expect } from 'vitest'
import { functionToTest } from '../utils/targetFile'

describe('Module Name', () => {
  describe('specific function or feature', () => {
    it('should describe expected behavior in specific scenario', () => {
      // Arrange
      const input = { /* test data */ }
      
      // Act
      const result = functionToTest(input)
      
      // Assert
      expect(result).toBe(expectedValue)
      expect(result.property).toBeCloseTo(expectedFloat, precision)
    })
  })
})
```

**Mathematical Testing Guidelines**:
- Use `toBeCloseTo(expected, precision)` for floating-point comparisons
- Test edge cases: zero values, extreme scales, boundary conditions
- Validate both input/output values and intermediate calculations
- Test mathematical relationships (e.g., area preservation during rotation)

#### Visual Regression Testing Guidelines

**Location**: Place visual tests in `tests/` directory

**When to Add Visual Tests**:
- New UI components or wizard steps
- Changes to layout or styling systems
- Cross-browser compatibility requirements

**Visual Test Structure**:
```typescript
import { test, expect } from '@playwright/test'

test.describe('Feature Name', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 900 })
    // Disable animations for consistent testing
    await page.addStyleTag({
      content: `*, *::before, *::after { 
        animation-duration: 0s !important; 
        transition-duration: 0s !important; 
      }`
    })
  })

  test('should render component correctly', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    
    // Interact with component if needed
    await page.click('[data-testid="button"]')
    
    // Take screenshot for comparison
    await expect(page).toHaveScreenshot('feature-state.png')
  })
})
```

#### Integration Testing Guidelines

**Focus Areas**:
- Complete user workflows (upload → extract → configure → export)
- Multi-file processing with mixed PDF/image files
- Error recovery and state management
- Settings persistence and loading

**Integration Test Pattern**:
```typescript
test('complete workflow should maintain data consistency', async ({ page }) => {
  // Test entire user journey
  await page.goto('/')
  
  // Simulate file upload
  const uploadData = await page.evaluate(() => {
    // Mock file processing logic
    return { /* simulated results */ }
  })
  
  // Validate each step maintains data integrity
  expect(uploadData.property).toBe(expectedValue)
})
```

### Testing Critical Areas

#### Mathematical Functions
**Why Critical**: Errors in DPI conversions, scaling, or positioning directly impact user output

**Test Requirements**:
- Validate all DPI conversions (72 ↔ 300 ↔ 96 DPI)
- Test scaling accuracy at various percentages
- Verify rotation dimension swapping (90°, 270°)
- Check grid positioning calculations
- Validate aspect ratio preservation

**Example**:
```typescript
it('should convert DPI accurately', () => {
  const inches = 2.5
  const extractionPixels = inches * 300  // 750
  const screenPixels = inches * 72       // 180
  
  const converted = extractionPixels * (72 / 300)
  expect(converted).toBe(screenPixels)
})
```

#### Preview vs Export Consistency
**Why Critical**: Users rely on preview accuracy for print planning

**Test Requirements**:
- Same mathematical functions used in preview and export
- Identical coordinate system handling
- Consistent DPI conversion logic
- Matching rotation and scaling calculations

#### Multi-File Workflows
**Why Critical**: PDF and image files must produce identical results

**Test Requirements**:
- Unified coordinate system validation
- Consistent processing pipeline
- Identical output for same content
- Cross-file-type compatibility

### CI/CD Integration

The testing framework automatically runs in GitHub Actions on:
- Every pull request
- Every push to main branch
- Manual workflow triggers

**CI/CD Test Sequence**:
1. **Setup** - Install dependencies and browsers
2. **Unit Tests** - Run all mathematical and logic validation
3. **Build** - Verify TypeScript compilation and asset integrity
4. **Visual Regression** - Cross-browser UI consistency testing
5. **Integration** - Complete workflow validation

**Failure Handling**:
- Unit test failures block PR merging
- Visual regression changes require manual review
- Build failures prevent deployment
- Test artifacts saved for debugging

### Debugging Test Failures

#### Unit Test Failures
```bash
# Run specific test file
npm run test -- renderUtils.test.ts

# Run with verbose output
npm run test -- --reporter=verbose

# Run in watch mode for iterative debugging
npm run test
```

#### Visual Regression Failures
```bash
# Run with UI for interactive debugging
npm run test:e2e:ui

# Update visual baselines (after confirming changes are intentional)
npm run test:e2e -- --update-snapshots

# Run specific test file
npm run test:e2e -- tests/visual-regression.spec.ts
```

#### Common Test Issues

**Floating Point Precision**:
```typescript
// ❌ WRONG: Exact equality for floating point
expect(result).toBe(2.33333333)

// ✅ CORRECT: Use precision tolerance
expect(result).toBeCloseTo(2.333, 3)
```

**Async Operations**:
```typescript
// ✅ CORRECT: Wait for operations to complete
await page.waitForLoadState('networkidle')
await page.waitForSelector('[data-testid="result"]')
```

**Animation Interference**:
```typescript
// ✅ CORRECT: Disable animations for consistent testing
await page.addStyleTag({
  content: `*, *::before, *::after { 
    animation-duration: 0s !important; 
    transition-duration: 0s !important; 
  }`
})
```

### Test Maintenance

#### Updating Tests for New Features

1. **Add unit tests** for new mathematical functions
2. **Update visual regression tests** for UI changes
3. **Extend integration tests** for new workflows
4. **Update test documentation** in CLAUDE.md

#### When Visual Baselines Need Updates

**Legitimate Updates**:
- Intentional UI/UX improvements
- New feature additions
- Cross-browser rendering updates

**Process**:
1. Review visual diff in test report
2. Confirm changes are intentional
3. Run `npm run test:e2e -- --update-snapshots`
4. Commit updated baseline images

#### Performance Considerations

- Unit tests should complete in < 2 seconds
- Visual regression tests should complete in < 5 minutes
- Use `test.setTimeout()` for longer operations
- Mock expensive operations when possible

### Testing Philosophy

The testing framework prioritizes:

1. **Impact over Coverage** - Focus on critical user-affecting functionality
2. **Mathematical Accuracy** - Validate all calculations that affect output
3. **Visual Consistency** - Ensure UI remains stable across updates
4. **Developer Productivity** - Catch issues early in development cycle
5. **Minimal Maintenance** - Automated testing with clear failure diagnostics

This comprehensive testing approach ensures the card game PDF transformer maintains high quality and reliability as it evolves, catching the "hard to detect" issues that could significantly impact users while providing developers with confidence to make improvements.

## Deployment and Testing Strategy

### Test-Driven Deployment Philosophy

The application uses a **tiered testing strategy** that prioritizes customer deployments while maintaining comprehensive test coverage. This approach was implemented to ensure customer-facing updates are never blocked by non-critical test edge cases.

#### Testing Tiers

**Tier 1: Critical Tests (Deployment Blocking)**
- Unit tests (`npm run test:run`)
- Critical E2E tests (`npm run test:e2e:critical`)
  - Application smoke tests (app loads, navigation works)
  - Core functionality (PDF.js worker, file upload, mathematical calculations)
  - Essential preview consistency (basic DPI conversions, card dimensions)

**Tier 2: Comprehensive Tests (Informational)**
- Comprehensive E2E tests (`npm run test:e2e:comprehensive`)
  - Visual regression tests across browsers
  - Complex workflow integration scenarios
  - Performance and memory stress tests
  - Advanced edge cases and error recovery

#### Test File Organization

```
tests/
├── critical/                           # DEPLOYMENT BLOCKING
│   ├── critical-smoke.spec.ts         # App loads, navigation, React mounting
│   ├── critical-core.spec.ts          # PDF.js worker, file types, canvas, storage
│   └── critical-preview.spec.ts       # Basic DPI, dimensions, rotation, grid math
├── comprehensive/                      # INFORMATIONAL ONLY
│   ├── visual-regression.spec.ts      # UI consistency across browsers
│   ├── preview-consistency.spec.ts    # Advanced mathematical validation
│   ├── pdf-image-parity.spec.ts       # Cross-format workflow parity
│   ├── workflow-integration.spec.ts   # End-to-end user journeys
│   ├── async-processing.spec.ts       # Performance and memory testing
│   └── build-validation.spec.ts       # Production asset integrity
src/test/                              # DEPLOYMENT BLOCKING
├── renderUtils.test.ts                # Mathematical unit tests
├── cardUtils.test.ts                  # Grid and positioning logic
└── previewConsistency.test.ts         # Preview calculation validation
```

#### Deployment Pipeline

```yaml
Test Job (All Critical Tests Must Pass):
├── Unit Tests ❌→ BLOCK deployment
├── Critical E2E Tests ❌→ BLOCK deployment
│   ├── Application smoke tests
│   ├── Core functionality validation  
│   └── Essential mathematical accuracy
└── Comprehensive E2E Tests ❌→ CONTINUE (informational)
    ├── Visual regression testing
    ├── Complex integration scenarios
    └── Performance validation

Build Job (Runs if ALL Critical Tests Pass):
├── Production Build
└── Asset Generation

Deploy Job (Runs if Build Succeeds):
└── GitHub Pages Deployment
```

#### GitHub Actions Configuration

The deployment workflow implements the hybrid tiered strategy:

```yaml
# Unit tests - must pass for deployment
- name: Run unit tests
  run: npm run test:run
  continue-on-error: false

# Critical E2E tests - must pass for deployment
- name: Run Critical E2E tests (DEPLOYMENT BLOCKING)
  run: npm run test:e2e:critical
  continue-on-error: false
  
# Comprehensive E2E tests - informational only
- name: Run Comprehensive E2E tests (INFORMATIONAL)
  run: npm run test:e2e:comprehensive
  continue-on-error: true

# Always upload test reports for visibility
- name: Upload Playwright report
  if: always()
  uses: actions/upload-artifact@v4
```

#### Benefits of This Approach

1. **Customer Priority**: User-facing deployments are never blocked by non-critical test edge cases
2. **Quality Protection**: Critical functionality is protected by blocking tests that catch "hard to detect" issues
3. **Test Visibility**: All test results remain visible through artifacts and reporting
4. **Balanced Strategy**: Core quality gates + deployment velocity
5. **Clear Categorization**: Teams understand which tests are deployment-critical vs informational

#### Development Workflow

**For Developers:**
- Run all tests locally: `npm run test && npm run test:e2e`
- Run only critical tests: `npm run test:run && npm run test:e2e:critical`
- Both unit and critical e2e test failures should be addressed immediately
- Comprehensive test failures should be investigated but don't block PRs

**For CI/CD:**
- Unit test failures block deployment (mathematical accuracy)
- Critical E2E test failures block deployment (core functionality)
- Comprehensive E2E test failures are reported but don't block deployment
- Test artifacts provide debugging information for all test types

**For Production Monitoring:**
- Real user monitoring supplements test coverage
- Production alerts catch issues that tests might miss
- Balance between test coverage and deployment velocity

#### When to Update This Strategy

**Add to Critical Tests (Tier 1 - Blocking)** when:
- Test covers critical user-facing functionality that would break the app for ALL users
- Test is highly stable and rarely produces false positives in CI environments
- Test failure always indicates a real problem that customers would encounter
- Test executes quickly (< 30 seconds) and is suitable for fast feedback

**Keep in Comprehensive Tests (Tier 2 - Informational)** when:
- Test covers edge cases, advanced scenarios, or browser-specific behavior
- Test might be sensitive to CI environment differences or timing issues
- Test failure needs investigation but represents scenarios most users won't encounter
- Test involves complex visual regression or performance validation

**Examples of Critical vs Comprehensive:**
- **Critical**: PDF.js worker loading, basic file upload, core DPI calculations
- **Comprehensive**: Advanced visual regression, complex multi-file workflows, performance stress tests

This hybrid deployment strategy reconciles the original GitHub Issue #63 requirements (preventing "hard to detect" issues impactful to users) with practical deployment velocity needs, ensuring both quality protection and customer priority.

## Duplex Mirroring Logic and Card ID Consistency

This section documents critical insights about duplex mode card processing, learned from resolving GitHub Issue #67, to help future development avoid similar consistency bugs.

### Understanding Duplex Mirroring

Duplex mode processes double-sided cards where back cards must be positioned to align with their corresponding front cards when printed on the reverse side of the paper. The key insight is that **the correct mirroring direction depends on both flip edge setting AND page orientation**.

#### Page Orientation Impact

**Portrait Pages (height > width):**
- **Short Edge Flip**: Cards flip along the short (horizontal) edge → Mirror rows (vertical flip)
- **Long Edge Flip**: Cards flip along the long (vertical) edge → Mirror columns (horizontal flip)

**Landscape Pages (width > height):**
- **Short Edge Flip**: Cards flip along the short (vertical) edge → Mirror columns (horizontal flip)  
- **Long Edge Flip**: Cards flip along the long (horizontal) edge → Mirror rows (vertical flip)

#### Critical Implementation Details

The `getCardInfo()` function in `cardUtils.ts` implements this logic:

```typescript
// CORRECT: Orientation-aware logic
if (pageWidth && pageHeight) {
  const isPortraitPage = pageHeight > pageWidth;
  if (isPortraitPage) {
    shouldFlipRows = (pdfMode.flipEdge === 'short'); 
  } else {
    shouldFlipRows = (pdfMode.flipEdge === 'long');  
  }
} else {
  // DANGEROUS: Legacy fallback - can cause inconsistent IDs
  shouldFlipRows = (pdfMode.flipEdge === 'long');
}
```

### Architecture for Page Dimension Propagation

To ensure consistent card ID calculation across all workflow steps, page dimensions must be available to all components that call `getCardInfo()`.

#### Current Architecture (Post-Fix)

1. **ExtractStep** captures page dimensions from PDF/image rendering
2. **Page dimensions stored in `extractionSettings.pageDimensions`** for propagation
3. **All workflow steps** use `extractionSettings.pageDimensions` in `getCardInfo()` calls

#### Critical Pattern for getCardInfo Calls

**✅ CORRECT - Always pass page dimensions:**
```typescript
getCardInfo(
  cardIndex, 
  activePages, 
  extractionSettings, 
  pdfMode, 
  cardsPerPage,
  extractionSettings.pageDimensions?.width,    // ✅ Pass width
  extractionSettings.pageDimensions?.height    // ✅ Pass height
)
```

**❌ DANGEROUS - Never use undefined dimensions:**
```typescript
getCardInfo(
  cardIndex, 
  activePages, 
  extractionSettings, 
  pdfMode, 
  cardsPerPage,
  undefined,    // ❌ Triggers inconsistent fallback logic
  undefined     // ❌ Will break card ID consistency
)
```

### Development Guidelines

#### When Adding New Components That Use getCardInfo

1. **Always pass page dimensions** from `extractionSettings.pageDimensions`
2. **Add page dimensions to useCallback dependencies** if using in callbacks
3. **Test with both portrait and landscape PDFs** to verify ID consistency
4. **Verify all duplex flip edge combinations** work correctly

#### When Modifying Existing getCardInfo Calls

1. **Never remove page dimension parameters** without understanding the impact
2. **Ensure extractionSettings.pageDimensions is populated** before the call
3. **Test card ID consistency** across Extract → Configure → Export workflow
4. **Watch for console warnings** about fallback logic usage

#### When Refactoring Page Dimension Handling

1. **Maintain the `extractionSettings.pageDimensions` pattern** for centralized storage
2. **Update ExtractStep's useEffect** if changing how dimensions are captured
3. **Verify all workflow steps** receive updated dimensions consistently
4. **Add integration tests** to prevent regression

### Common Pitfalls and Debugging

#### Symptom: Inconsistent Card IDs Between Steps
**Root Cause**: Missing or inconsistent page dimensions in `getCardInfo()` calls
**Fix**: Ensure all components use `extractionSettings.pageDimensions?.width, extractionSettings.pageDimensions?.height`

#### Symptom: Console Warnings About Fallback Logic
**Root Cause**: Page dimensions not available when `getCardInfo()` is called
**Investigation Steps**:
1. Check if ExtractStep has properly set `extractionSettings.pageDimensions`
2. Verify the component is receiving updated `extractionSettings`
3. Ensure page rendering has completed before calling `getCardInfo()`

#### Symptom: Wrong Back Card Positioning in Final Export
**Root Cause**: Export step using different mirroring logic than preview
**Fix**: Verify ExportStep uses same `getCardInfo()` parameters as other steps

### Testing Card ID Consistency

When testing duplex functionality, always verify:

1. **Cross-Step Consistency**: Same card ID in Extract, Configure, ColorCalibration, and Export
2. **Orientation Testing**: Test both portrait and landscape PDFs
3. **Flip Edge Testing**: Test both short edge and long edge flip settings
4. **Multi-File Testing**: Verify consistency with mixed PDF/image sources

### Legacy Fallback Logic

The fallback logic `shouldFlipRows = (pdfMode.flipEdge === 'long')` exists for backward compatibility but **should never be relied upon** in normal operation. When this fallback is used:

- Console warnings are logged with diagnostic information
- Card IDs may be inconsistent between workflow steps
- Users may experience incorrect printing results

**If fallback logic is triggered frequently**, investigate why page dimensions are not being properly captured and propagated.

### Future Development Considerations

1. **Consider making page dimensions required** in `getCardInfo()` signature to prevent accidental omission
2. **Add TypeScript strict checks** to catch undefined dimension parameters at compile time
3. **Implement runtime assertions** in development mode to detect inconsistent card ID calculations
4. **Extend automated tests** to cover all duplex mirroring scenarios comprehensively

This duplex mirroring system is **critical for user satisfaction** - incorrect card positioning wastes physical printing materials and breaks user trust in the application's accuracy.