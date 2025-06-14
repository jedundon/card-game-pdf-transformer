# PnP Card Utility - Transformation Pipeline Refactor

## Overview
This document outlines the incremental refactor of the PnP Card Utility to implement a centralized transformation pipeline. The current architecture has duplicate transformation logic across multiple steps, scattered state management, and inconsistent preview generation.

## Goals
- **Single Source of Truth**: Centralized transformation logic and state management
- **Consistent Previews**: Unified preview generation across all workflow steps
- **Maintainability**: Easier to add new features and fix bugs
- **Performance**: Optimized preview caching and delta updates
- **Testability**: Isolated, testable transformation components

## Current Architecture Issues
- Multiple transformation implementations in ImportStep, ConfigureStep, ExtractStep, ExportStep
- State scattered across App.tsx with prop drilling
- Inconsistent preview generation logic
- Tight coupling between transformation logic and UI components
- Difficult to maintain consistency when adding new features

---

## Phase 1: Foundation (No Breaking Changes)
*Estimated Duration: 1-2 sprints*

### Task 1.0: Setup Testing Infrastructure
**Assignee:** [TBD]  
**Priority:** High  
**Files to Create:**
- `jest.config.js` (if not exists)
- `src/setupTests.ts`
- `src/pipeline/__tests__/setup.ts`
- `.github/workflows/test.yml` (CI/CD)
- `playwright.config.ts` (for visual testing)
- `eslint.config.js` (enhanced linting rules)
- `tsconfig.strict.json` (strict TypeScript config)
- `.editorconfig` (consistent code formatting)
- `commitlint.config.js` (conventional commits)

**Description:**
Establish comprehensive testing infrastructure and development tooling before beginning the refactor to ensure quality and consistency throughout the process.

**Implementation Details:**
- Configure Jest for unit and integration testing
- Setup @testing-library/react for component testing
- Configure Playwright for visual regression testing
- Setup fast-check for property-based testing
- Add test coverage reporting with lcov
- Configure CI/CD pipeline for automated testing
- Setup strict TypeScript configuration
- Configure ESLint with TypeScript and React rules
- Setup Prettier for code formatting
- Configure Husky for git hooks
- Setup commitlint for conventional commits
- Configure bundle analyzer for performance monitoring

**Recommended Tooling Setup:**
```json
// package.json additions
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "test:visual": "playwright test",
    "lint": "eslint src --ext .ts,.tsx",
    "lint:fix": "eslint src --ext .ts,.tsx --fix",
    "type-check": "tsc --noEmit",
    "analyze": "npm run build && npx webpack-bundle-analyzer build/static/js/*.js"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.0.0",
    "@testing-library/react": "^14.0.0",
    "@testing-library/user-event": "^14.0.0",
    "@playwright/test": "^1.40.0",
    "fast-check": "^3.15.0",
    "eslint-config-typescript": "^latest",
    "prettier": "^3.0.0",
    "husky": "^8.0.0",
    "lint-staged": "^15.0.0",
    "@commitlint/cli": "^18.0.0",
    "@commitlint/config-conventional": "^18.0.0"
  }
}
```

**Quality Gates:**
- All tests must pass before merge
- 90%+ test coverage for new code
- No TypeScript errors in strict mode
- ESLint passes with zero warnings
- Prettier formatting enforced
- Conventional commit messages required

**Testing Standards:**
- 90%+ coverage target for new code
- Visual regression testing for all previews
- Performance benchmarks for critical paths
- Property-based testing for transformation algorithms

**Acceptance Criteria:**
- [x] Jest configured with TypeScript support
- [x] Testing utilities and helpers setup
- [x] Visual regression testing infrastructure ready
- [x] CI/CD pipeline runs tests automatically
- [x] Coverage reporting configured and working
- [x] Performance benchmarking tools ready
- [x] Strict TypeScript configuration enforced
- [x] ESLint and Prettier configured and working
- [x] Git hooks setup for quality enforcement
- [x] Conventional commits enforced
- [x] Bundle analysis tools configured
- [x] Documentation for testing standards and practices

### Task 1.1: Create Core Pipeline Infrastructure
**Assignee:** [TBD]  
**Priority:** High  
**Files to Create:**
- `src/pipeline/TransformationPipeline.ts`
- `src/pipeline/types.ts`
- `src/pipeline/events.ts`

**Description:**
Create the foundation classes without connecting to existing UI. This allows parallel development while maintaining comprehensive test coverage.

**Implementation Details:**
```typescript
// Core interfaces to implement
interface TransformationStep {
  id: string;
  name: string;
  execute(input: CardData[], settings: any): Promise<CardData[]>;
  generatePreview(input: CardData[], settings: any): Promise<PreviewData>;
  validate(settings: any): ValidationResult;
}

interface PipelineState {
  cards: CardData[];
  settings: WorkflowSettings;
  metadata: ProcessingMetadata;
  stepResults: Map<string, StepResult>;
}
```

**Testing Requirements:**
- Unit tests for all new pipeline classes
- Test coverage target: 90%+ for new code
- Integration tests for event system
- Performance benchmarks for state management

**Acceptance Criteria:**
- [x] TransformationPipeline class with basic state management
- [x] Event system for change notifications
- [x] Type definitions for all pipeline interfaces
- [x] **Unit tests for core pipeline functionality (90%+ coverage)**
- [x] **Integration tests for pipeline state changes**
- [x] **Performance benchmarks established**
- [x] Documentation for pipeline architecture

### Task 1.2: Extract Common Transformation Utilities
**Assignee:** [TBD]  
**Priority:** Medium  
**Files to Modify:**
- Move shared logic from components to `src/pipeline/transformations/`

**Description:**
Identify and extract shared transformation functions without breaking existing code.

**Implementation Details:**
- Create utility modules for:
  - PDF processing (`pdfUtils.ts`)
  - Card extraction (`extractionUtils.ts`)
  - Layout calculations (`layoutUtils.ts`)
  - Image processing (`imageUtils.ts`)
- Keep existing code working by maintaining imports

**Testing Requirements:**
- Unit tests for all extracted utilities
- Test coverage target: 90%+ for new utility code
- Regression tests to ensure existing functionality unchanged
- Performance tests for shared transformations

**Acceptance Criteria:**
- [x] Shared transformation logic extracted to utilities
- [x] Existing components continue to work unchanged
- [x] **Unit tests for extracted utilities (90%+ coverage)**
- [x] **Regression test suite passes 100%**
- [x] **Performance tests show no degradation**
- [x] No regression in existing functionality

### Task 1.3: Create Step Registry System
**Assignee:** [TBD]  
**Priority:** Medium  
**Files to Create:**
- `src/pipeline/StepRegistry.ts`
- `src/pipeline/steps/BaseStep.ts`

**Description:**
Plugin-like system for transformation steps that can be registered, configured, and executed.

**Testing Requirements:**
- Unit tests for step registration and execution
- Integration tests for step configuration
- Mock implementations for testing
- Validation test coverage for all step types

**Acceptance Criteria:**
- [x] Step registration and discovery system
- [x] Base step class with common functionality
- [x] Step validation and error handling
- [x] Configuration schema for each step type
- [x] **Unit tests for step registry (90%+ coverage)**
- [x] **Integration tests for step execution**
- [x] **Mock step implementations for testing**

---

## Phase 2: Step-by-Step Migration
*Estimated Duration: 3-4 sprints*

### Task 2.1: Migrate Extract Step
**Assignee:** [TBD]  
**Priority:** High  
**Files to Modify:**
- `src/components/ExtractStep.tsx`
- Create: `src/pipeline/steps/ExtractStep.ts`

**Description:**
Start with Extract step migration to establish the pattern and enable easier validation. This is the most complex step but also the most critical for user experience.

**Implementation Details:**
- Create ExtractStep class implementing TransformationStep
- Move card extraction algorithms to pipeline
- Implement real-time preview updates through pipeline
- Add selection state management to pipeline
- Maintain existing UI behavior exactly

**Migration Steps:**
1. Create pipeline ExtractStep class alongside existing component
2. Move extraction logic incrementally to pipeline step
3. Connect preview generation to pipeline
4. Update component to use pipeline step for all operations
5. Test extraction accuracy and preview performance thoroughly

**Critical Considerations:**
- This step has the most complex transformation logic
- Preview performance is crucial for user experience
- Selection state needs careful handling
- Calibration and fine-tuning must work identically
- User validation will be immediately visible here

**Testing Strategy:**
- **Unit Tests**: Test card extraction algorithms in isolation
- **Visual Regression Tests**: Screenshot comparison for preview accuracy
- **Performance Tests**: Benchmark extraction speed and memory usage
- **Integration Tests**: End-to-end extraction workflow
- **Property-Based Tests**: Test extraction with various card configurations

**Acceptance Criteria:**
- [x] Card extraction works through pipeline with identical results
- [x] Real-time previews maintain performance (< 100ms updates)
- [x] Selection and calibration tools functional
- [x] All extraction settings properly applied
- [x] Preview accuracy matches current implementation
- [x] No regression in extraction quality
- [x] **Unit tests for extraction algorithms (95%+ coverage)**
- [x] **Visual regression test suite for previews**
- [x] **Performance benchmarks meet or exceed current implementation**
- [x] **Integration tests for complete extraction workflow**

### Task 2.2: Add Preview System Foundation ✅ COMPLETED
**Assignee:** AI Assistant  
**Priority:** High  
**Status:** ✅ **COMPLETED** - Preview System Foundation implemented successfully
**Files Created:**
- `src/pipeline/PreviewGenerator.ts`
- `src/pipeline/PreviewCache.ts`
- `src/pipeline/__tests__/PreviewGenerator.test.ts`
- `src/pipeline/__tests__/PreviewCache.test.ts`
**Files Modified:**
- `src/pipeline/types.ts` (extended PreviewData metadata)

**Description:**
Build on the Extract step migration by implementing comprehensive preview generation system with caching.

**Implementation Details:**
- On-demand preview generation for extract step and future steps
- LRU cache for rendered previews
- Delta update system when settings change
- Background rendering for better UX
- Optimized for the complex extract step previews

**Testing Strategy:**
- **Unit Tests**: Test preview generation and caching logic
- **Performance Tests**: Benchmark cache hit rates and render times
- **Integration Tests**: Test preview updates with Extract step
- **Memory Tests**: Ensure cache doesn't cause memory leaks

**Acceptance Criteria:**
- [x] Preview generation for migrated ExtractStep performs well
- [x] Caching system reduces redundant renders
- [x] Preview updates smoothly when extraction settings change
- [x] Performance metrics show improvement over current implementation
- [x] **Unit tests for preview generation (90%+ coverage)**
- [x] **Performance tests show cache effectiveness**
- [x] **Memory leak tests pass**
- [x] **Integration tests with Extract step**

### Task 2.3: Migrate Configure Step ✅ COMPLETED
**Assignee:** AI Assistant  
**Priority:** High  
**Status:** ✅ **COMPLETED** - Configure Step successfully migrated to pipeline
**Files Created:**
- `src/pipeline/steps/ConfigureStep.ts`
- `src/pipeline/__tests__/ConfigureStep.test.ts`
**Files Modified:**
- `src/pipeline/steps/index.ts` (added ConfigureStep registration)

**Description:**
Migrate the configure/layout step to use the pipeline system, building on lessons learned from Extract step.

**Implementation Details:**
- Move grid configuration logic to pipeline
- Implement card dimension calculations in pipeline
- Add layout previews through pipeline
- Maintain existing UI controls
- Ensure configuration feeds correctly into Extract step

**Validation Strategy:**
- Changes in Configure step should immediately reflect in Extract step previews
- Grid settings must translate correctly to extraction parameters
- Layout calculations should be identical to current implementation

**Testing Strategy:**
- **Unit Tests**: Test grid calculations and layout logic
- **Integration Tests**: Validate data flow to Extract step
- **Regression Tests**: Ensure identical behavior to current implementation
- **Cross-Step Tests**: Verify Configure changes reflect in Extract previews

**Acceptance Criteria:**
- [ ] Configure step works through pipeline
- [ ] Grid settings properly applied and visible in Extract step
- [ ] Layout previews accurate
- [ ] No regression in functionality
- [ ] Seamless data flow to Extract step
- [ ] **Unit tests for configuration logic (90%+ coverage)**
- [ ] **Integration tests with Extract step validation**
- [ ] **Regression test suite passes 100%**

### Task 2.4: Migrate Import Step
**Assignee:** [TBD]  
**Priority:** High  
**Files to Modify:**
- `src/components/ImportStep.tsx`
- Create: `src/pipeline/steps/ImportStep.ts`

**Description:**
Migrate import step to complete the core workflow pipeline, ensuring PDF data flows correctly to downstream steps.

**Implementation Details:**
- Create ImportStep class implementing TransformationStep
- Maintain existing UI behavior exactly
- Connect to pipeline state for PDF data
- Add preview generation for imported PDF pages
- Ensure PDF data properly feeds Configure and Extract steps

**Validation Strategy:**
- Imported PDF should immediately be available in Configure step
- Page settings should properly influence Configure and Extract steps
- PDF mode changes should cascade correctly through pipeline

**Testing Strategy:**
- **Unit Tests**: Test PDF loading and page configuration logic
- **Integration Tests**: Validate data flow through entire pipeline
- **File Format Tests**: Test various PDF formats and configurations
- **End-to-End Tests**: Complete workflow from import to extract

**Acceptance Criteria:**
- [ ] ImportStep works through pipeline
- [ ] No change in user experience
- [ ] PDF loading and page settings work identically
- [ ] Preview generation functional
- [ ] Data flows correctly to Configure and Extract steps
- [ ] **Unit tests for import logic (90%+ coverage)**
- [ ] **Integration tests for complete workflow**
- [ ] **File format compatibility tests**
- [ ] **End-to-end test suite passes**

### Task 2.5: Migrate Export Step
**Assignee:** [TBD]  
**Priority:** Medium  
**Files to Modify:**
- `src/components/ExportStep.tsx`
- Create: `src/pipeline/steps/ExportStep.ts`

**Description:**
Final step migration - move export logic to pipeline, completing the end-to-end workflow.

**Implementation Details:**
- Move output generation to pipeline
- Add export previews
- Handle various output formats
- Maintain download functionality
- Ensure exported cards match Extract step previews exactly

**Validation Strategy:**
- Exported cards should be pixel-perfect matches to Extract step previews
- All output formats should work identically
- Export settings should be properly applied

**Testing Strategy:**
- **Unit Tests**: Test export generation and format handling
- **Visual Tests**: Ensure exports match Extract step previews pixel-perfect
- **Format Tests**: Validate all supported export formats
- **Quality Tests**: Verify no quality loss in export process

**Acceptance Criteria:**
- [ ] Export generation works through pipeline
- [ ] All output formats supported
- [ ] Preview shows final output accurately matching Extract step
- [ ] Download functionality unchanged
- [ ] No quality loss in export process
- [ ] **Unit tests for export logic (90%+ coverage)**
- [ ] **Visual comparison tests (Extract vs Export)**
- [ ] **Format validation tests for all output types**
- [ ] **Quality assurance tests pass**

---

## Phase 3: State Consolidation & Optimization
*Estimated Duration: 2-3 sprints*

### Task 3.1: Centralize State Management
**Assignee:** [TBD]  
**Priority:** High  
**Files to Modify:**
- `src/App.tsx`
- All component files

**Description:**
Replace scattered state in App.tsx with centralized pipeline state management.

**Implementation Details:**
- Remove state from App.tsx gradually
- Update components to use pipeline state
- Implement reactive state updates
- Add state persistence for undo/redo

**Migration Strategy:**
1. Identify all state currently in App.tsx
2. Map state to pipeline equivalents
3. Update one component at a time
4. Remove old state management code

**Acceptance Criteria:**
- [ ] All state managed by pipeline
- [ ] Components react to pipeline state changes
- [ ] No prop drilling between components
- [ ] State persistence works correctly

### Task 3.2: Remove Duplicate Logic
**Assignee:** [TBD]  
**Priority:** Medium  
**Files to Clean:**
- All component files with old transformation logic

**Description:**
Clean up old transformation code after successful migration.

**Implementation Details:**
- Remove old transformation functions from components
- Consolidate duplicate utility functions
- Update imports and dependencies
- Clean up unused code

**Safety Measures:**
- Keep old code in version control
- Thorough testing before deletion
- Feature flags for rollback if needed

**Acceptance Criteria:**
- [ ] No duplicate transformation logic
- [ ] Clean component code focused on UI
- [ ] Reduced bundle size
- [ ] All functionality maintained

### Task 3.3: Optimize Preview Performance
**Assignee:** [TBD]  
**Priority:** Medium  
**Files to Optimize:**
- `src/pipeline/PreviewGenerator.ts`
- `src/pipeline/PreviewCache.ts`

**Description:**
Optimize preview generation for better user experience.

**Implementation Details:**
- Implement progressive rendering
- Add background worker for heavy processing
- Optimize cache strategies
- Add performance monitoring

**Performance Targets:**
- Preview updates < 100ms for setting changes
- Initial preview generation < 500ms
- Memory usage optimization
- Smooth 60fps interactions

**Acceptance Criteria:**
- [ ] Preview performance meets targets
- [ ] Smooth user interactions
- [ ] Efficient memory usage
- [ ] Performance monitoring in place

---

## Phase 4: Enhanced Features & Polish
*Estimated Duration: 1-2 sprints*

### Task 4.1: Settings Persistence System
**Assignee:** [TBD]  
**Priority:** High  
**Reference:** Development notes requirement

**Description:**
Implement save/load settings functionality as requested in development notes.

**Implementation Details:**
- Save complete workflow settings
- Auto-name settings files based on PDF name
- Load settings to apply to current PDF
- Exclude PDF filename from saved settings

**Acceptance Criteria:**
- [ ] Settings save/load functionality
- [ ] Auto-naming based on PDF file
- [ ] Settings apply correctly to different PDFs
- [ ] Settings manager UI integration

### Task 4.2: Enhanced UI Features
**Assignee:** [TBD]  
**Priority:** Medium  
**Reference:** Development notes requirements

**Description:**
Implement UI improvements identified in development notes.

**Features to Implement:**
- Grey background behind card previews
- Selection visualization in page preview
- Margin indication in extract view
- Page thumbnails
- Drag and drop import

**Acceptance Criteria:**
- [ ] Card previews have grey backgrounds
- [ ] Selection clearly visible in page preview
- [ ] Margin areas properly indicated
- [ ] Page thumbnails functional
- [ ] Drag and drop import works

### Task 4.3: Advanced Preview Features
**Assignee:** [TBD]  
**Priority:** Low  

**Description:**
Add advanced preview capabilities enabled by the new pipeline.

**Features:**
- Real-time preview updates as user drags settings
- Preview comparison mode (before/after)
- Preview export for sharing
- Preview zoom and pan
- Preview grid overlay

**Acceptance Criteria:**
- [ ] Real-time preview updates
- [ ] Comparison mode functional
- [ ] Preview export works
- [ ] Zoom and pan controls
- [ ] Grid overlay toggle

---

## Implementation Guidelines

### Code Standards
- **TypeScript**: Strict typing for all pipeline code
- **Testing**: Unit tests for all transformation logic
- **Documentation**: JSDoc comments for all public APIs
- **Error Handling**: Comprehensive error boundaries and user feedback
- **Performance**: Benchmark critical paths before and after changes

### Testing Strategy
- **Test-Driven Development**: Write tests as part of each migration task
- **No Legacy Testing**: Focus testing efforts only on new pipeline code
- **High Coverage Target**: 90%+ coverage for all new pipeline components
- **Visual Regression**: Screenshot testing for preview accuracy
- **Performance Testing**: Automated performance regression testing
- **Integration Testing**: End-to-end workflow validation
- **Property-Based Testing**: Test with various input configurations

**Test Structure:**
```
src/
  pipeline/
    __tests__/
      TransformationPipeline.test.ts
      PreviewGenerator.test.ts
      steps/
        ExtractStep.test.ts
        ConfigureStep.test.ts
        ImportStep.test.ts
        ExportStep.test.ts
    utils/
      __tests__/
        extractionUtils.test.ts
        layoutUtils.test.ts
        pdfUtils.test.ts
```

**Testing Tools:**
- **Jest**: Unit and integration testing
- **@testing-library/react**: Component testing
- **Playwright**: Visual regression testing
- **fast-check**: Property-based testing
- **@storybook/test-runner**: Component story testing

### Risk Mitigation
- **Feature Flags**: Toggle between old and new implementations
- **Gradual Rollout**: Migrate one step at a time
- **Rollback Plan**: Keep old code until migration is proven stable
- **Monitoring**: Add metrics to track migration success
- **Communication**: Regular updates on migration progress

### Success Criteria
- [ ] Single transformation pipeline handles all steps
- [ ] Consistent preview generation across workflow
- [ ] Improved performance (faster previews, lower memory)
- [ ] Easier to add new features
- [ ] **90%+ test coverage for all new pipeline code**
- [ ] **Visual regression test suite prevents preview bugs**
- [ ] **Performance benchmarks show improvement over legacy code**
- [ ] **Zero critical bugs in production after migration**
- [ ] Positive user feedback on reliability

---

## Notes for Developers

### Current State Analysis
The app currently has transformation logic spread across:
- `ImportStep.tsx`: PDF loading and page configuration
- `ConfigureStep.tsx`: Grid setup and card dimensions  
- `ExtractStep.tsx`: Card extraction and calibration
- `ExportStep.tsx`: Output generation

Each step maintains its own transformation state and preview logic, leading to:
- Inconsistent behavior when settings change
- Difficult debugging due to scattered logic
- Performance issues from redundant processing
- Hard to maintain feature parity across steps

### Key Architecture Decisions
1. **Extract-First Migration**: Start with Extract step to enable immediate validation
2. **Immutable State**: Pipeline state is immutable to enable easy undo/redo
3. **Event-Driven**: Components listen to pipeline events for updates
4. **Lazy Loading**: Previews generated on-demand and cached
5. **Step Isolation**: Each step is independent and testable
6. **Progressive Enhancement**: New features can be added without breaking existing code
7. **Validation-Driven**: Each step migration validates against the user-visible Extract step

### Common Pitfalls to Avoid
- Don't migrate everything at once - incremental changes are safer
- Don't break existing functionality during migration
- Don't optimize prematurely - get it working first
- Don't forget to update tests alongside code changes
- Don't ignore performance implications of state changes

### Resources
- [Current codebase documentation](./development-notes.txt)
- [TypeScript best practices](https://typescript-eslint.io/rules/)
- [React performance patterns](https://react.dev/learn/render-and-commit)
- [PDF.js documentation](https://mozilla.github.io/pdf.js/)

---

*Last Updated: June 14, 2025*  
*Document Version: 1.0*  
*Next Review: After Phase 1 completion*

---

## Development Best Practices

### Code Quality & Standards

#### TypeScript Excellence
- **Strict Mode**: Enable strict TypeScript configuration
- **No `any` Types**: Use proper typing throughout pipeline code
- **Generic Constraints**: Use bounded generics for transformation functions
- **Branded Types**: Use branded types for IDs and measurements (e.g., `CardId`, `PixelValue`)
- **Utility Types**: Leverage TypeScript utility types (`Pick`, `Omit`, `Partial`)

#### Code Organization
```typescript
// Example of proper type organization
export interface CardData {
  readonly id: CardId;
  readonly bounds: Readonly<Rectangle>;
  readonly source: Readonly<PageReference>;
}

export type TransformationResult<T> = 
  | { success: true; data: T; metadata: ProcessingMetadata }
  | { success: false; error: TransformationError; context: ErrorContext };
```

#### Error Handling Standards
- **Result Types**: Use Result/Either pattern instead of throwing exceptions
- **Error Boundaries**: Implement React error boundaries for UI resilience
- **Graceful Degradation**: Always provide fallback behavior
- **User-Friendly Messages**: Transform technical errors into actionable user guidance
- **Error Tracking**: Log errors with sufficient context for debugging

### Documentation Standards

#### Code Documentation
- **JSDoc for Public APIs**: Complete JSDoc for all public interfaces
- **Inline Comments**: Explain "why" not "what" in complex algorithms
- **README Updates**: Keep README current with architecture changes
- **Decision Records**: Document architectural decisions (ADRs)

#### API Documentation
```typescript
/**
 * Extracts cards from a PDF page using the configured grid settings.
 * 
 * @param page - The PDF page to extract from
 * @param settings - Grid configuration and extraction parameters
 * @param calibration - Optional calibration adjustments
 * @returns Promise resolving to extracted card data with metadata
 * 
 * @throws {ExtractionError} When PDF page is invalid or grid settings are malformed
 * 
 * @example
 * ```typescript
 * const cards = await extractCards(page, {
 *   grid: { rows: 3, cols: 3 },
 *   margins: { top: 10, left: 10, bottom: 10, right: 10 }
 * });
 * ```
 */
export async function extractCards(
  page: PDFPage,
  settings: ExtractionSettings,
  calibration?: CalibrationData
): Promise<TransformationResult<CardData[]>>
```

### Performance Best Practices

#### Memory Management
- **Weak References**: Use WeakMap/WeakSet for caches that should be garbage collected
- **Disposal Patterns**: Implement explicit disposal for heavy resources (canvases, workers)
- **Memory Profiling**: Regular memory leak testing during development
- **Lazy Loading**: Load heavy resources only when needed

#### Rendering Optimization
- **Canvas Pooling**: Reuse canvas elements for preview generation
- **Web Workers**: Offload heavy processing to web workers
- **Request Animation Frame**: Use RAF for smooth UI updates
- **Debounced Updates**: Debounce rapid setting changes
- **Virtual Scrolling**: For large lists of cards or pages

### Security & Reliability

#### Input Validation
- **Schema Validation**: Use libraries like Zod for runtime type checking
- **Sanitization**: Sanitize all user inputs and file contents
- **Bounds Checking**: Validate all numeric inputs and array indices
- **File Type Validation**: Verify PDF file headers, not just extensions

#### Data Integrity
- **Immutable Updates**: Use immer or similar for safe state updates
- **Data Validation**: Validate data at pipeline boundaries
- **Backup Strategies**: Auto-save user progress
- **Version Compatibility**: Handle settings file version changes gracefully

### Development Workflow

#### Git Practices
- **Conventional Commits**: Use conventional commit messages
- **Feature Branches**: One feature per branch, small focused PRs
- **Protected Main**: Require PR reviews and passing tests
- **Semantic Versioning**: Use semver for releases

#### Code Reviews
- **Review Checklist**: Standardized checklist for PR reviews
- **Performance Review**: Check for performance implications
- **Test Coverage**: Ensure adequate test coverage for changes
- **Documentation Review**: Verify documentation updates

#### Continuous Integration
```yaml
# Example GitHub Actions workflow
name: CI
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm run lint
      - run: npm run type-check
      - run: npm run test:coverage
      - run: npm run test:visual
      - run: npm run build
```

### Monitoring & Observability

#### Performance Monitoring
- **Core Web Vitals**: Monitor LCP, FID, CLS for user experience
- **Custom Metrics**: Track transformation times, memory usage
- **Error Tracking**: Use Sentry or similar for production error tracking
- **User Analytics**: Track feature usage and pain points

#### Development Metrics
- **Bundle Analysis**: Regular bundle size analysis
- **Test Coverage Reports**: Maintain coverage dashboards
- **Performance Benchmarks**: Automated performance regression testing
- **Code Quality Metrics**: Track complexity, maintainability scores

### Accessibility & UX

#### Accessibility Standards
- **WCAG 2.1 AA**: Meet accessibility guidelines
- **Keyboard Navigation**: Full keyboard accessibility
- **Screen Reader Support**: Proper ARIA labels and roles
- **Color Contrast**: Ensure sufficient contrast ratios
- **Focus Management**: Proper focus handling in preview interactions

#### User Experience
- **Loading States**: Clear loading indicators for all async operations
- **Progress Feedback**: Show progress for long-running operations
- **Error Recovery**: Provide clear paths to recover from errors
- **Undo/Redo**: Implement undo/redo for destructive actions
- **Keyboard Shortcuts**: Power user keyboard shortcuts

### Dependency Management

#### Dependency Strategy
- **Minimal Dependencies**: Prefer standard library when possible
- **Security Audits**: Regular `npm audit` and dependency updates
- **License Compliance**: Track and approve all dependency licenses
- **Bundle Impact**: Evaluate bundle size impact of new dependencies

#### Version Management
- **Lock Files**: Commit lock files for reproducible builds
- **Update Strategy**: Regular dependency updates with testing
- **Breaking Changes**: Careful evaluation of major version updates
- **Alternative Libraries**: Evaluate alternatives for large dependencies

### Deployment & Operations

#### Build Optimization
- **Tree Shaking**: Ensure proper tree shaking for production builds
- **Code Splitting**: Split code by routes and features
- **Asset Optimization**: Optimize images, fonts, and other assets
- **CDN Strategy**: Use CDN for static assets

#### Environment Management
- **Configuration**: Environment-specific configurations
- **Feature Flags**: Runtime feature toggles for gradual rollouts
- **Error Boundaries**: Graceful handling of runtime errors
- **Fallback Strategies**: Fallback behavior for failed operations

---

## Refactor-Specific Guidelines

### Migration Safety
- **Feature Flags**: Use feature flags to toggle between old and new implementations
- **A/B Testing**: Test new pipeline with subset of users initially
- **Rollback Plan**: Always have a plan to rollback changes quickly
- **Canary Releases**: Gradual rollout of new functionality

### Data Migration
- **Settings Migration**: Handle migration of existing user settings
- **Backward Compatibility**: Support old settings file formats during transition
- **Data Validation**: Validate migrated data thoroughly
- **Migration Testing**: Test migration with real user data

### Team Coordination
- **Clear Ownership**: Assign clear ownership for each refactor task
- **Communication**: Regular standups focused on refactor progress
- **Shared Understanding**: Ensure all team members understand the new architecture
- **Knowledge Transfer**: Document learnings and gotchas for the team
