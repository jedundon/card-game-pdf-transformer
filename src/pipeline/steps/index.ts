/**
 * Registry setup for the new ExtractStep migration
 * This allows the new step to be used alongside existing components
 */

import { StepRegistry } from '../StepRegistry';
import { ExtractStep } from './ExtractStepMigration';

// Create and register the extract step
const extractStep = new ExtractStep();

// Create a shared registry instance
const stepRegistry = new StepRegistry();

// Register the extract step with metadata
stepRegistry.register(extractStep, {
  name: 'Extract Cards',
  description: 'Extract individual cards from PDF pages with preview capabilities',
  category: 'extract',
  version: '1.0.0',
  tags: ['pdf', 'extraction', 'cards', 'preview']
});

// Export for use in components
export { extractStep, stepRegistry };
export { ExtractStep } from './ExtractStepMigration';
