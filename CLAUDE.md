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
Supports both PDF and image files through unified processing pipeline:

- **PDF Processing**: PDF.js integration, worker setup, 72 DPI → 300 DPI conversion
- **Image Processing**: PNG/JPG/JPEG via Canvas API, native pixels as 300 DPI
- **Unified Pipeline**: Source-aware utilities in `cardUtils.ts`, DPI standardization (300), shared `renderUtils.ts`
- **Multi-File Import**: `useMultiFileImport` hook manages mixed PDF/image sessions

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

- **Simplex**: Single-sided pages/images, each card appears once with sequential ID assignment

- **Duplex**: Double-sided pages/images with sophisticated front/back card relationships
  - **Physical Alignment**: Back cards must align with front cards during duplex printing
  - **Mirrored ID Assignment**: Back cards receive IDs based on their mirrored positions, not document order
  - **Orientation-Aware**: Mirroring direction depends on page orientation (portrait/landscape) and flip edge settings
  - **Example**: Landscape 2x2 grid with short edge flip → Back IDs [2,1,4,3] instead of [1,2,3,4]
  - **Flexible Pages**: Supports mixed front/back, all-back-page PDFs, and cross-file scenarios

- **Gutter-fold**: Cards are arranged for gutter folding across page center with position-based front/back assignment

Card identification logic varies significantly between modes and is centralized in `src/utils/card/cardIdentification.ts`, with source-aware processing for both PDF and image inputs. **Duplex mode requires special attention** due to its orientation-aware mirroring logic that ensures proper physical card alignment during printing.

*For complete duplex mode implementation details, see the [Duplex Mode: Complete Card ID Assignment and Mirroring Logic](#duplex-mode-complete-card-id-assignment-and-mirroring-logic) section below.*

### Styling and UI
- **Tailwind CSS**: Primary styling framework
- **Lucide React**: Icon library
- **Responsive Design**: Uses CSS Grid and Flexbox for layouts
- **Preview System**: Real-time card preview with proper scaling calculations

## Development Standards

### Code Organization & TypeScript
- **Strict TypeScript**: Comprehensive linting, React JSX transform, bundler resolution
- **Separation of Concerns**: Business logic in utility files, props properly typed
- **Constants**: Centralized to avoid magic numbers
- **Quality**: ESLint for React/TypeScript, no unused variables, comprehensive build checks

### Common Patterns and Pitfalls

**Rendering Consistency:**
- Use unified functions from `renderUtils.ts` (no duplicate logic)
- Apply rotation via canvas processing, not CSS transforms
- Use card container dimensions for clipping; image dimensions for scaling

**DPI and Scaling:**
- Extraction: 300 DPI, Screen: 72-96 DPI
- Always convert between DPI contexts properly
- Preview scaling accounts for both DPI conversion and viewport constraints

**Canvas Processing:**
- Use canvas for rotation and clipping (pixel-perfect control)
- Transform order: center → rotate → draw
- Set canvas to final output size, not image size
- Handle rotation by swapping width/height for 90°/270°

### Multi-File Architecture

**CRITICAL: Coordinate System Consistency**

All calculations must use same coordinate system for PDF and image files:
- **Extraction DPI (300)**: All measurements in extraction DPI pixels
- **PDF files**: Convert from 72 DPI to extraction DPI
- **Image files**: Treat native pixels as extraction DPI
- **UI inputs**: Crop values, dimensions in extraction DPI pixels

**Implementation Pattern:**
```typescript
// ✅ CORRECT: Unified coordinate system
if (sourceType === 'image') {
  sourceWidth = pageDimensions.width; // Native pixels as extraction DPI
} else {
  sourceWidth = (renderedData.width / previewScale) * extractionScale; // Convert PDF
}
```

**Data Source Validation:**
```typescript
// ✅ CORRECT: Check for either data source
const hasValidDataSource = pdfData || (renderedPageData?.sourceType === 'image');
```

**Common Pitfalls:**
1. Don't assume all images are at extraction DPI
2. Avoid duplicating scaling calculations between preview and extraction
3. Be careful with `if (pdfData)` checks that exclude image files
4. Ensure crop/grid values mean same thing for all file types

**Debugging Multi-File Issues:**
- Check coordinate systems use same units
- Verify preview and extraction use same formulas
- Validate conditionals don't exclude valid image data
- Compare end-to-end results for identical layouts

## Component Architecture and Refactoring Insights

### Component Architecture (Dec 2024 Refactoring)
Comprehensive decomposition transformed massive components into modular, maintainable architecture.

#### Refactoring Results (Dec 2024)
- **3 massive components** → **22 focused components**
- **~2,317 lines reduced** across ImportStep, ExtractStep, ConfigureStep

**Component Structure:**
```
src/components/
├── [StepName].tsx                    # Main coordinator (slim)
├── [StepName]/
│   ├── components/                   # Step-specific UI components
│   └── hooks/                       # Extracted business logic
```

#### TypeScript Interface Design
Create comprehensive prop interfaces with JSDoc documentation:
```typescript
interface ComponentProps {
  /** Primary data or state */
  data: DataType;
  onDataChange: (newData: DataType) => void;
  config?: ConfigType;
}
```

**Component Guidelines:**
1. Single responsibility (one logical UI concern)
2. 80-200 lines for optimal maintainability  
3. Pure props (avoid direct global state imports)
4. Clear event handler interfaces

### Critical Patterns

**Icon Imports**: Always use base names (`Printer`, not `PrinterIcon`) to avoid runtime errors

**Custom Hooks**: Extract when useState patterns become complex, useMemo dependencies grow large, or multiple components need similar logic

**Error Handling:**
- Specific error messages (timeouts, memory issues)
- Race conditions with timeouts for better UX
- Progressive enhancement with graceful degradation

### State Management Patterns

**Multi-File Complexity:**
1. Unified data models across file types
2. Source awareness (PDF vs image data)
3. Stable references with useMemo to prevent re-renders
4. Debounced settings (300ms delay for expensive operations)

### Performance Optimizations Discovered

#### Performance Optimizations
- **Canvas Processing**: Batch operations, minimize context switches
- **Image Caching**: Timestamp-based expiration with LRU eviction
- **Progressive Loading**: Load thumbnails in batches
- **Memory Management**: Bounded cache with automatic cleanup

### Development Best Practices

**Git Commit Strategy:**
- `Extract [ComponentName] component from [ParentComponent]`
- `Fix [specific issue] causing [error description]`
- `Add [feature] with [implementation detail]`

**Adding New Features:**
1. Start small, follow established patterns
2. TypeScript first - define interfaces before implementation
3. Test edge cases and multi-file scenarios
4. Use memoization and debouncing appropriately

**Maintenance:**
1. Keep components under 300 lines
2. Review useEffect dependencies regularly
3. Update TypeScript interfaces when adding features
4. Maintain JSDoc comments for complex logic

### State Management Debugging

**Common Issue: Partial State Clearing** (GitHub Issue #38)

Problem: "Start Over" only partially cleared state, leaving `pdfData` loaded while clearing other state.

**Solution Pattern:**
```typescript
// ✅ CORRECT: Complete state clearing
const handleResetToDefaults = () => {
  clearLocalStorageSettings();
  pdfDataManager.handleClearLastImportedFile();
  pdfDataManager.clearPdfData(); // Critical: clear ALL related state
  settingsManager.resetToDefaults();
  localStorageSync.clearAutoRestoredFlag();
};
```

**Debugging Methodology:**
1. **Trace Dependencies**: Map state variables affecting conditional logic
2. **Verify Reset Functions**: Ensure functions actually clear intended state
3. **Test State Transitions**: Verify each user action transitions state correctly
4. **Use Clear Naming**: Functions should indicate their exact scope

**Prevention Strategies:**
- Centralized state clearing with comprehensive reset functions
- State validation with runtime checks
- Clear, specific function names matching behavior
- Integration testing of complete user workflows

## Testing & Deployment

### Testing Architecture

Four-layer testing framework catching "hard to detect" issues:
1. **Unit Testing** - Mathematical functions and business logic
2. **Visual Regression** - Cross-browser UI consistency  
3. **Integration Testing** - Complete workflows and multi-file processing
4. **Build Validation** - Production asset integrity

### Test Commands
```bash
# Unit Testing
npm run test          # Watch mode development
npm run test:run      # Single run (CI/CD)
npm run test:coverage # Coverage report

# E2E Testing
npm run test:e2e         # All Playwright tests
npm run test:e2e:critical      # Deployment-blocking tests only
npm run test:e2e:comprehensive # Full test suite
npm run test:e2e:ui      # Interactive debugging
```

### Testing Guidelines

**Always Test:**
- Mathematical functions (DPI conversions, scaling, rotation)
- Core business logic (card positioning, grid calculations) 
- Critical workflows (file upload, extraction, export)
- Bug fixes (reproduce bug first)

**Test Structure:**
- Unit tests: `src/test/[sourceFile].test.ts`
- E2E tests: `tests/[feature].spec.ts`
- Use `toBeCloseTo(expected, precision)` for floating-point math
- Disable animations in visual tests for consistency

### Critical Test Areas

**Mathematical Functions**: DPI conversions (72↔300↔96), scaling accuracy, rotation dimension swapping, grid positioning

**Preview vs Export Consistency**: Same mathematical functions, identical coordinate systems, consistent DPI logic

**Multi-File Workflows**: Unified coordinate system, consistent pipeline, identical PDF/image results

### Tiered Testing Strategy

**Tier 1: Critical Tests (Deployment Blocking)**
- Unit tests (`npm run test:run`)
- Critical E2E tests (`npm run test:e2e:critical`)
  - App startup, navigation, PDF.js worker
  - Core functionality (file upload, mathematical calculations)
  - Essential preview consistency (DPI, dimensions, rotation)

**Tier 2: Comprehensive Tests (Informational)**
- Full E2E suite (`npm run test:e2e:comprehensive`)
  - Visual regression across browsers
  - Complex integration scenarios
  - Performance and memory stress tests

### Deployment Pipeline

```yaml
CI/CD Flow:
├── Unit Tests ❌→ BLOCK deployment
├── Critical E2E Tests ❌→ BLOCK deployment  
└── Comprehensive E2E Tests ❌→ CONTINUE (informational)

Deployment:
├── Production Build (if all critical tests pass)
└── GitHub Pages Deployment
```

### Test Debugging

**Common Issues:**
- Use `toBeCloseTo(value, precision)` for floating-point comparisons
- Wait for `page.waitForLoadState('networkidle')` in E2E tests
- Disable animations with CSS for visual consistency

**Update Visual Baselines:**
```bash
npm run test:e2e -- --update-snapshots  # After confirming changes
```

**Testing Philosophy:** Impact over coverage, mathematical accuracy, visual consistency, minimal maintenance


## Duplex Mode: Complete Card ID Assignment and Mirroring Logic

This section documents the comprehensive duplex mode functionality, including critical insights learned from resolving GitHub Issue #67 regression during refactoring, to help future development maintain correct duplex printing behavior.

### Understanding Duplex Mode

Duplex mode processes double-sided cards where **back cards must be positioned to align with their corresponding front cards when printed on the reverse side of the paper**. This involves two critical aspects:

1. **Physical Mirroring**: Determining which direction to mirror based on page orientation and flip edge
2. **Card ID Assignment**: Assigning back card IDs based on their mirrored positions for proper print alignment

### Card ID Assignment in Duplex Mode

**Key Principle**: Back cards receive IDs based on their **mirrored physical positions**, not their document order positions. This ensures that back card IDs correspond to where they will physically align with front cards during duplex printing.

#### Example: Landscape 2x2 Grid with Short Edge Flip

```
Normal Card Positions:     Back Card Mirrored Positions:     Assigned Back IDs:
┌─────┬─────┐              ┌─────┬─────┐                    ┌─────┬─────┐
│  0  │  1  │              │  1  │  0  │                    │  2  │  1  │
├─────┼─────┤      →       ├─────┼─────┤            →       ├─────┼─────┤
│  2  │  3  │              │  3  │  2  │                    │  4  │  3  │
└─────┴─────┘              └─────┴─────┘                    └─────┴─────┘
IDs: [1,2,3,4]             Mirrored: [2,1,4,3]             Back IDs: [2,1,4,3]
```

**Why This Matters**: When a user prints front cards on one side and back cards on the reverse, the physical alignment will be correct because back card IDs reflect their mirrored positions.

#### Mirroring Direction Logic

**Portrait Pages (height > width):**
- **Short Edge Flip**: Cards flip along the short (horizontal) edge → **Mirror rows** (vertical flip)
- **Long Edge Flip**: Cards flip along the long (vertical) edge → **Mirror columns** (horizontal flip)

**Landscape Pages (width > height):**
- **Short Edge Flip**: Cards flip along the short (vertical) edge → **Mirror columns** (horizontal flip)  
- **Long Edge Flip**: Cards flip along the long (horizontal) edge → **Mirror rows** (vertical flip)

#### Flexible Page Support

Duplex mirroring works with various page configurations:

- **Mixed Front/Back Pages**: Traditional front page → back page alternation
- **All-Back-Page PDFs**: 3 pages all marked as "back" pages (supports specialized workflows)
- **Cross-File Groups**: Back cards from different source files can be properly mirrored

### Implementation Architecture

#### Core Function: getCardInfo()

The `getCardInfo()` function in `src/utils/card/cardIdentification.ts` implements this logic:

```typescript
// CRITICAL: Always pass page dimensions for consistent duplex mirroring
getCardInfo(
  cardIndex, 
  activePages, 
  extractionSettings, 
  pdfMode, 
  cardsPerPage,
  extractionSettings.pageDimensions?.width,    // Required for duplex
  extractionSettings.pageDimensions?.height    // Required for duplex
)
```

#### Mirroring Algorithm

```typescript
// Orientation-aware mirroring direction
if (pageWidth && pageHeight && pageWidth > 0 && pageHeight > 0) {
  const isPortraitPage = pageHeight > pageWidth;
  if (isPortraitPage) {
    shouldFlipRows = (pdfMode.flipEdge === 'short'); 
  } else {
    shouldFlipRows = (pdfMode.flipEdge === 'long');  
  }
  
  // Apply mirroring to grid position
  if (shouldFlipRows) {
    mirroredRow = (grid.rows - 1) - originalRow;
  } else {
    mirroredCol = (grid.columns - 1) - originalCol;
  }
  
  // Assign ID based on mirrored position
  return calculateIdFromMirroredPosition(mirroredRow, mirroredCol);
}
```

#### Smart Override Handling

Duplex mirroring applies **only when the duplex pattern is maintained**:

- **✅ Applied**: When pages follow natural duplex pattern with no manual overrides
- **❌ Disabled**: When manual card type overrides significantly alter the expected duplex pattern
- **🔄 Fallback**: Falls back to sequential numbering when duplex pattern is broken

### Data Flow and Consistency Architecture

#### Page Dimension Propagation

To ensure consistent card ID calculation across all workflow steps, page dimensions must be available to all components that call `getCardInfo()`.

**Current Architecture (Post-Fix)**:

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

### Fallback Logic and Error Detection

When page dimensions are missing or invalid, the system includes robust fallback detection:

```typescript
if (pageWidth !== undefined && pageHeight !== undefined && pageWidth > 0 && pageHeight > 0) {
  // Use proper orientation-aware logic
} else {
  // Log warning and use fallback
  console.warn(
    'Duplex mirroring fallback logic triggered - page dimensions missing!',
    'This can cause inconsistent card IDs. Please ensure page dimensions are passed to getCardInfo().',
    { cardOnPage, flipEdge: pdfMode.flipEdge }
  );
  shouldFlipRows = (pdfMode.flipEdge === 'long'); // Legacy fallback
}
```

**Warning Indicators**: When fallback logic is used, console warnings help developers identify and fix dimension propagation issues before they cause user-facing problems.

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

## Performance Optimization Architecture (Issue #45 Implementation)

### Performance-First Design Principles

**Comprehensive Optimization Strategy**: The application implements a layered performance optimization approach addressing memory management, UI responsiveness, background processing, and user experience feedback.

**Key Performance Components**:
- **Memory Management**: LRU caching with intelligent eviction policies
- **Background Processing**: Web Worker architecture for CPU-intensive operations
- **UI Optimization**: Virtual scrolling and lazy loading for large datasets
- **User Feedback**: Comprehensive progress tracking and performance monitoring

### Memory Management System

**LRU Cache Architecture (`src/utils/cacheUtils.ts`)**:
- **Size-based limits**: Prevents memory bloat with configurable thresholds
- **Timestamp expiration**: Automatic cleanup of stale data (15-minute default)
- **Hit rate optimization**: Targeting 70%+ cache efficiency
- **Memory monitoring**: Real-time usage tracking with automatic alerts

**Cache Integration Pattern**:
```typescript
// ✅ CORRECT: Always check cache before expensive operations
const cacheKey = createCacheKey('operation', ...params);
const cached = cache.get(cacheKey);
if (cached) return cached;

const result = await expensiveOperation();
cache.set(cacheKey, result, estimateDataSize(result));
```

**Cache Strategy by Component**:
- **Thumbnail Cache**: 200 entries, 25MB limit (high frequency, medium size)
- **Image Cache**: 100 entries, 100MB limit (medium frequency, large size)
- **Render Cache**: 50 entries, 50MB limit (low frequency, variable size)

### Background Processing Architecture

**Web Worker Strategy**:
- **Thumbnail Worker**: PDF page and image thumbnail generation
- **Image Processing Worker**: Scaling, rotation, color adjustments
- **Worker Pool Management**: Automatic lifecycle, load balancing, error recovery

**Worker Integration Pattern**:
```typescript
// ✅ CORRECT: Use worker pools for CPU-intensive operations
const result = await workerPool.execute('thumbnail-generation', {
  pageData: data,
  maxWidth: 480,
  maxHeight: 600
}, {
  onProgress: (progress) => updateUI(progress),
  timeout: 30000
});
```

**Performance Benefits**:
- **Main thread responsiveness**: CPU-intensive operations don't block UI
- **Parallel processing**: Multiple workers handle concurrent operations
- **Automatic retry**: Built-in error recovery and retry mechanisms
- **Progress tracking**: Real-time feedback for long operations

### Virtual Scrolling Implementation

**Large Dataset Handling (`src/components/shared/VirtualScrollList.tsx`)**:
- **Windowing technique**: Only render visible items + small buffer
- **Dynamic sizing**: Automatic height calculation and adjustment
- **Smooth scrolling**: 60fps performance regardless of list size
- **Memory efficiency**: Constant memory usage for unlimited items

**Virtual Scrolling Pattern**:
```typescript
// ✅ CORRECT: Use virtual scrolling for large lists
<VirtualScrollList
  items={pages}
  height={600}
  itemHeight={120}
  renderItem={(page, index, isVisible) => (
    <PageThumbnail page={page} lazy={!isVisible} />
  )}
  onItemsVisible={(visiblePages) => {
    // Preload thumbnails for visible pages
    preloadThumbnails(visiblePages);
  }}
/>
```

### Lazy Loading Strategy

**Intersection Observer Implementation (`src/utils/lazyLoadingUtils.ts`)**:
- **Viewport awareness**: Load content only when needed
- **Concurrent limiting**: Prevent resource overload (3 concurrent loads default)
- **Retry mechanisms**: Automatic retry with exponential backoff
- **Memory cleanup**: Automatic observer cleanup and resource management

**Lazy Loading Integration**:
```typescript
// ✅ CORRECT: Implement lazy loading for expensive resources
const { observe } = useLazyLoading({
  rootMargin: '100px',
  maxConcurrentLoads: 5
});

observe(element, async () => {
  return await loadExpensiveContent();
}, onLoad, onError);
```

### Progress Tracking Architecture

**Hierarchical Progress System (`src/utils/progressManager.ts`)**:
- **Operation hierarchy**: Parent-child progress relationships
- **Cancellation support**: User-initiated operation termination
- **Time estimation**: ETA calculation based on progress patterns
- **Event-driven updates**: Real-time progress communication

**Progress Integration Pattern**:
```typescript
// ✅ CORRECT: Comprehensive progress tracking
const operationId = createOperation('file-processing', 'Processing Files');
startOperation(operationId, cancelCallback);

// Update progress with meaningful messages
updateProgress(operationId, 50, 'Processing page 25 of 50');

// Handle completion or errors
completeOperation(operationId, 'Successfully processed all files');
```

### Performance Monitoring System

**Real-time Performance Dashboard (`src/components/shared/PerformanceMonitoringPanel.tsx`)**:
- **Memory usage visualization**: Real-time memory consumption graphs
- **Cache performance metrics**: Hit rates, efficiency statistics
- **Operation tracking**: Active operation monitoring and management
- **Optimization recommendations**: AI-driven performance suggestions

**Performance Thresholds**:
- **Warning Level**: 75% memory usage → User notification
- **Critical Level**: 90% memory usage → Automatic cleanup triggers
- **Cache Efficiency**: Target 70%+ hit rate for optimal performance
- **UI Responsiveness**: Maintain 60fps during all operations

### Integration Guidelines

**Performance-Aware Component Design**:
1. **Always profile before optimizing**: Use performance monitoring to identify bottlenecks
2. **Implement caching strategically**: Cache expensive operations, not cheap ones
3. **Use virtual scrolling for large lists**: Any list with 50+ items should be virtualized
4. **Implement lazy loading for expensive resources**: Thumbnails, images, complex calculations
5. **Provide progress feedback**: Any operation taking >2 seconds needs progress indication

**Performance Testing Requirements**:
- **Memory usage tests**: Verify memory stays below thresholds during heavy operations
- **Cache performance tests**: Validate hit rates meet efficiency targets
- **Virtual scrolling tests**: Ensure smooth scrolling with large datasets
- **Background processing tests**: Verify main thread remains responsive
- **Progress tracking tests**: Confirm accurate progress reporting and cancellation

### Performance Optimization Best Practices

**Memory Management**:
- Monitor memory usage continuously during development
- Implement aggressive caching for repeated operations
- Use weak references where appropriate to prevent memory leaks
- Clean up resources promptly when components unmount

**UI Responsiveness**:
- Never block the main thread for more than 16ms (60fps target)
- Use `requestAnimationFrame` for smooth animations
- Implement debouncing for frequent user interactions
- Virtualize any list with more than 50 items

**Background Processing**:
- Move CPU-intensive operations to Web Workers
- Implement proper error handling and retry mechanisms
- Provide progress feedback for operations taking >2 seconds
- Support operation cancellation for better user control

**Cache Optimization**:
- Design cache keys to maximize hit rates
- Implement intelligent eviction policies based on usage patterns
- Monitor cache performance and adjust parameters accordingly
- Balance memory usage with cache effectiveness

### Performance Regression Prevention

**Continuous Performance Monitoring**:
- Integrate performance tests into CI/CD pipeline
- Monitor memory usage patterns in production
- Track cache hit rates and optimize accordingly
- Alert on performance degradation before users notice

**Performance Budgets**:
- **Memory Usage**: Maximum 500MB for typical workflows
- **Cache Hit Rate**: Minimum 70% efficiency for thumbnail cache
- **UI Responsiveness**: Maximum 100ms response time for user interactions
- **Background Processing**: Maximum 30 seconds for thumbnail generation

This performance optimization architecture ensures the application scales efficiently with large file sets while maintaining excellent user experience and system stability.