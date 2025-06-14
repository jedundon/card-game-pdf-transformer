/**
 * Registry setup for pipeline steps
 * This allows the new steps to be used alongside existing components
 */

import { StepRegistry } from '../StepRegistry';
import { ExtractStep } from './ExtractStepMigration';
import { ConfigureStep } from './ConfigureStep';

// Create and register the extract step
const extractStep = new ExtractStep();

// Create and register the configure step
const configureStep = new ConfigureStep();

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

// Register the configure step with metadata
stepRegistry.register(configureStep, {
  name: 'Configure Layout',
  description: 'Configure layout settings, card dimensions, and grid configuration',
  category: 'configure',
  version: '1.0.0',
  tags: ['layout', 'configuration', 'dimensions', 'grid']
});

// Export for use in components
export { extractStep, stepRegistry };
export { ExtractStep } from './ExtractStepMigration';
