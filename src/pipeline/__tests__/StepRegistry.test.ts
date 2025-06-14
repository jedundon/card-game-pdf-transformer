/**
 * Unit tests for StepRegistry
 */

import { StepRegistry } from '../StepRegistry';
import { createMockPipelineStep } from './setup';
import type { StepMetadata } from '../StepRegistry';

describe('StepRegistry', () => {
  let registry: StepRegistry;

  beforeEach(() => {
    registry = new StepRegistry();
  });

  describe('step registration', () => {
    it('should register a step successfully', () => {
      const step = createMockPipelineStep('test-step');
      const metadata: Omit<StepMetadata, 'id'> = {
        name: 'Test Step',
        description: 'A test step',
        category: 'transform',
        version: '1.0.0',
      };

      registry.register(step, metadata);

      expect(registry.hasStep('test-step')).toBe(true);
      expect(registry.getStep('test-step')).toBe(step);
    });

    it('should throw error when registering duplicate step ID', () => {
      const step1 = createMockPipelineStep('duplicate');
      const step2 = createMockPipelineStep('duplicate');
      const metadata: Omit<StepMetadata, 'id'> = {
        name: 'Test Step',
        description: 'A test step',
        category: 'transform',
        version: '1.0.0',
      };

      registry.register(step1, metadata);

      expect(() => registry.register(step2, metadata)).toThrow(
        "Step with ID 'duplicate' is already registered"
      );
    });

    it('should store complete metadata', () => {
      const step = createMockPipelineStep('metadata-test');
      const metadata: Omit<StepMetadata, 'id'> = {
        name: 'Metadata Test',
        description: 'Test metadata storage',
        category: 'input',
        version: '2.1.0',
        dependencies: ['dep1', 'dep2'],
        tags: ['test', 'metadata'],
      };

      registry.register(step, metadata);

      const storedMetadata = registry.getMetadata('metadata-test');
      expect(storedMetadata).toMatchObject({
        id: 'metadata-test',
        name: 'Metadata Test',
        description: 'Test metadata storage',
        category: 'input',
        version: '2.1.0',
        dependencies: ['dep1', 'dep2'],
        tags: ['test', 'metadata'],
      });
    });
  });

  describe('step unregistration', () => {
    it('should unregister a step successfully', () => {
      const step = createMockPipelineStep('unregister-test');
      const metadata: Omit<StepMetadata, 'id'> = {
        name: 'Unregister Test',
        description: 'Test unregistration',
        category: 'output',
        version: '1.0.0',
      };

      registry.register(step, metadata);
      expect(registry.hasStep('unregister-test')).toBe(true);

      const result = registry.unregister('unregister-test');
      expect(result).toBe(true);
      expect(registry.hasStep('unregister-test')).toBe(false);
    });

    it('should return false when unregistering non-existent step', () => {
      const result = registry.unregister('non-existent');
      expect(result).toBe(false);
    });

    it('should remove step from category index', () => {
      const step = createMockPipelineStep('category-test');
      const metadata: Omit<StepMetadata, 'id'> = {
        name: 'Category Test',
        description: 'Test category removal',
        category: 'extract',
        version: '1.0.0',
      };

      registry.register(step, metadata);
      expect(registry.getStepsByCategory('extract')).toHaveLength(1);

      registry.unregister('category-test');
      expect(registry.getStepsByCategory('extract')).toHaveLength(0);
    });
  });

  describe('step retrieval', () => {
    beforeEach(() => {
      const steps = [
        { id: 'input-1', category: 'input' as const, name: 'Input Step 1' },
        { id: 'input-2', category: 'input' as const, name: 'Input Step 2' },
        { id: 'transform-1', category: 'transform' as const, name: 'Transform Step' },
        { id: 'output-1', category: 'output' as const, name: 'Output Step' },
      ];

      steps.forEach(({ id, category, name }) => {
        const step = createMockPipelineStep(id);
        registry.register(step, {
          name,
          description: `Description for ${name}`,
          category,
          version: '1.0.0',
          tags: [category, 'test'],
        });
      });
    });

    it('should get all steps', () => {
      const allSteps = registry.getAllSteps();
      expect(allSteps).toHaveLength(4);
    });

    it('should get steps by category', () => {
      const inputSteps = registry.getStepsByCategory('input');
      expect(inputSteps).toHaveLength(2);

      const transformSteps = registry.getStepsByCategory('transform');
      expect(transformSteps).toHaveLength(1);

      const nonExistentSteps = registry.getStepsByCategory('non-existent');
      expect(nonExistentSteps).toHaveLength(0);
    });

    it('should get steps by tag', () => {
      const testSteps = registry.getStepsByTag('test');
      expect(testSteps).toHaveLength(4);

      const inputSteps = registry.getStepsByTag('input');
      expect(inputSteps).toHaveLength(2);

      const nonExistentSteps = registry.getStepsByTag('non-existent');
      expect(nonExistentSteps).toHaveLength(0);
    });

    it('should search steps by name and description', () => {
      const inputResults = registry.searchSteps('Input');
      expect(inputResults).toHaveLength(2);

      const transformResults = registry.searchSteps('Transform');
      expect(transformResults).toHaveLength(1);

      const descriptionResults = registry.searchSteps('Description');
      expect(descriptionResults).toHaveLength(4);

      const noResults = registry.searchSteps('non-existent');
      expect(noResults).toHaveLength(0);
    });

    it('should get categories and tags', () => {
      const categories = registry.getCategories();
      expect(categories).toContain('input');
      expect(categories).toContain('transform');
      expect(categories).toContain('output');

      const tags = registry.getTags();
      expect(tags).toContain('test');
      expect(tags).toContain('input');
      expect(tags).toContain('transform');
      expect(tags).toContain('output');
    });

    it('should get step count', () => {
      expect(registry.getStepCount()).toBe(4);
    });
  });

  describe('dependencies', () => {
    beforeEach(() => {
      const stepA = createMockPipelineStep('step-a');
      const stepB = createMockPipelineStep('step-b');
      const stepC = createMockPipelineStep('step-c');

      registry.register(stepA, {
        name: 'Step A',
        description: 'Independent step',
        category: 'input',
        version: '1.0.0',
      });

      registry.register(stepB, {
        name: 'Step B',
        description: 'Depends on A',
        category: 'transform',
        version: '1.0.0',
        dependencies: ['step-a'],
      });

      registry.register(stepC, {
        name: 'Step C',
        description: 'Depends on A and B',
        category: 'output',
        version: '1.0.0',
        dependencies: ['step-a', 'step-b'],
      });
    });

    it('should validate dependencies correctly', () => {
      const validationA = registry.validateDependencies('step-a');
      expect(validationA.valid).toBe(true);
      expect(validationA.missingDependencies).toHaveLength(0);

      const validationB = registry.validateDependencies('step-b');
      expect(validationB.valid).toBe(true);
      expect(validationB.missingDependencies).toHaveLength(0);

      const validationC = registry.validateDependencies('step-c');
      expect(validationC.valid).toBe(true);
      expect(validationC.missingDependencies).toHaveLength(0);
    });

    it('should detect missing dependencies', () => {
      const stepD = createMockPipelineStep('step-d');
      registry.register(stepD, {
        name: 'Step D',
        description: 'Depends on missing step',
        category: 'transform',
        version: '1.0.0',
        dependencies: ['missing-step'],
      });

      const validation = registry.validateDependencies('step-d');
      expect(validation.valid).toBe(false);
      expect(validation.missingDependencies).toContain('missing-step');
    });

    it('should determine execution order', () => {
      const order = registry.getExecutionOrder(['step-c', 'step-a', 'step-b']);
      
      // step-a should come before step-b, and both before step-c
      const indexA = order.indexOf('step-a');
      const indexB = order.indexOf('step-b');
      const indexC = order.indexOf('step-c');

      expect(indexA).toBeLessThan(indexB);
      expect(indexA).toBeLessThan(indexC);
      expect(indexB).toBeLessThan(indexC);
    });

    it('should detect circular dependencies', () => {
      const stepD = createMockPipelineStep('step-d');
      const stepE = createMockPipelineStep('step-e');

      registry.register(stepD, {
        name: 'Step D',
        description: 'Depends on E',
        category: 'transform',
        version: '1.0.0',
        dependencies: ['step-e'],
      });

      registry.register(stepE, {
        name: 'Step E',
        description: 'Depends on D',
        category: 'transform',
        version: '1.0.0',
        dependencies: ['step-d'],
      });

      expect(() => registry.getExecutionOrder(['step-d', 'step-e']))
        .toThrow(/Circular dependency detected/);
    });
  });

  describe('pipeline configuration', () => {
    beforeEach(() => {
      ['step-1', 'step-2', 'step-3'].forEach(id => {
        const step = createMockPipelineStep(id);
        registry.register(step, {
          name: `Step ${id}`,
          description: `Description for ${id}`,
          category: 'transform',
          version: '1.0.0',
        });
      });
    });

    it('should create pipeline configuration with existing steps', () => {
      const config = registry.createPipelineConfig(['step-1', 'step-2']);
      
      expect(config.steps).toHaveLength(2);
      expect(config.cacheEnabled).toBe(true);
      expect(config.errorHandling).toBe('strict');
    });

    it('should throw error for missing steps in pipeline config', () => {
      expect(() => registry.createPipelineConfig(['step-1', 'missing-step']))
        .toThrow('Steps not found: missing-step');
    });
  });

  describe('utility methods', () => {
    it('should clear all steps', () => {
      const step = createMockPipelineStep('clear-test');
      registry.register(step, {
        name: 'Clear Test',
        description: 'Test clearing',
        category: 'input',
        version: '1.0.0',
      });

      expect(registry.getStepCount()).toBe(1);

      registry.clear();

      expect(registry.getStepCount()).toBe(0);
      expect(registry.getCategories()).toHaveLength(0);
    });

    it('should export registry state', () => {
      const step = createMockPipelineStep('export-test');
      registry.register(step, {
        name: 'Export Test',
        description: 'Test export',
        category: 'output',
        version: '1.0.0',
        tags: ['test'],
      });

      const state = registry.exportState();

      expect(state.steps).toHaveLength(1);
      expect(state.steps[0]).toMatchObject({
        id: 'export-test',
        metadata: expect.objectContaining({
          name: 'Export Test',
          category: 'output',
        }),
      });
      expect(state.categories).toHaveProperty('output');
    });
  });
});
