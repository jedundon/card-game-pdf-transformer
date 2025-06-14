/**
 * Step registry system for transformation steps
 */

import type { TransformationStep } from './types';

export interface StepMetadata {
  id: string;
  name: string;
  description: string;
  category: 'input' | 'transform' | 'configure' | 'extract' | 'output';
  version: string;
  dependencies?: string[];
  tags?: string[];
}

export interface RegisteredStep {
  step: TransformationStep;
  metadata: StepMetadata;
  registeredAt: Date;
}

export class StepRegistry {
  private steps: Map<string, RegisteredStep> = new Map();
  private categories: Map<string, string[]> = new Map();

  /**
   * Register a transformation step
   */
  register(step: TransformationStep, metadata: Omit<StepMetadata, 'id'>): void {
    if (this.steps.has(step.id)) {
      throw new Error(`Step with ID '${step.id}' is already registered`);
    }

    const fullMetadata: StepMetadata = {
      id: step.id,
      ...metadata,
    };

    const registeredStep: RegisteredStep = {
      step,
      metadata: fullMetadata,
      registeredAt: new Date(),
    };

    this.steps.set(step.id, registeredStep);

    // Update category index
    if (!this.categories.has(metadata.category)) {
      this.categories.set(metadata.category, []);
    }
    this.categories.get(metadata.category)!.push(step.id);
  }

  /**
   * Unregister a transformation step
   */
  unregister(stepId: string): boolean {
    const registeredStep = this.steps.get(stepId);
    if (!registeredStep) {
      return false;
    }

    // Remove from category index
    const category = registeredStep.metadata.category;
    const categorySteps = this.categories.get(category);
    if (categorySteps) {
      const index = categorySteps.indexOf(stepId);
      if (index > -1) {
        categorySteps.splice(index, 1);
      }
      if (categorySteps.length === 0) {
        this.categories.delete(category);
      }
    }

    return this.steps.delete(stepId);
  }

  /**
   * Get a step by ID
   */
  getStep(stepId: string): TransformationStep | undefined {
    return this.steps.get(stepId)?.step;
  }

  /**
   * Get step metadata by ID
   */
  getMetadata(stepId: string): StepMetadata | undefined {
    return this.steps.get(stepId)?.metadata;
  }

  /**
   * Get all registered steps
   */
  getAllSteps(): TransformationStep[] {
    return Array.from(this.steps.values()).map(rs => rs.step);
  }

  /**
   * Get steps by category
   */
  getStepsByCategory(category: string): TransformationStep[] {
    const stepIds = this.categories.get(category) || [];
    return stepIds
      .map(id => this.steps.get(id)?.step)
      .filter((step): step is TransformationStep => step !== undefined);
  }

  /**
   * Get steps by tag
   */
  getStepsByTag(tag: string): TransformationStep[] {
    return Array.from(this.steps.values())
      .filter(rs => rs.metadata.tags?.includes(tag))
      .map(rs => rs.step);
  }

  /**
   * Search steps by name or description
   */
  searchSteps(query: string): TransformationStep[] {
    const lowerQuery = query.toLowerCase();
    return Array.from(this.steps.values())
      .filter(rs => 
        rs.metadata.name.toLowerCase().includes(lowerQuery) ||
        rs.metadata.description.toLowerCase().includes(lowerQuery)
      )
      .map(rs => rs.step);
  }

  /**
   * Check if a step is registered
   */
  hasStep(stepId: string): boolean {
    return this.steps.has(stepId);
  }

  /**
   * Get all available categories
   */
  getCategories(): string[] {
    return Array.from(this.categories.keys());
  }

  /**
   * Get all available tags
   */
  getTags(): string[] {
    const allTags = new Set<string>();
    for (const registeredStep of this.steps.values()) {
      if (registeredStep.metadata.tags) {
        registeredStep.metadata.tags.forEach(tag => allTags.add(tag));
      }
    }
    return Array.from(allTags);
  }

  /**
   * Get step count
   */
  getStepCount(): number {
    return this.steps.size;
  }

  /**
   * Clear all registered steps
   */
  clear(): void {
    this.steps.clear();
    this.categories.clear();
  }

  /**
   * Validate step dependencies
   */
  validateDependencies(stepId: string): { valid: boolean; missingDependencies: string[] } {
    const registeredStep = this.steps.get(stepId);
    if (!registeredStep) {
      return { valid: false, missingDependencies: ['Step not found'] };
    }

    const dependencies = registeredStep.metadata.dependencies || [];
    const missingDependencies = dependencies.filter(dep => !this.hasStep(dep));

    return {
      valid: missingDependencies.length === 0,
      missingDependencies,
    };
  }

  /**
   * Get step execution order based on dependencies
   */
  getExecutionOrder(stepIds: string[]): string[] {
    const visited = new Set<string>();
    const visiting = new Set<string>();
    const result: string[] = [];

    const visit = (stepId: string): void => {
      if (visited.has(stepId)) return;
      if (visiting.has(stepId)) {
        throw new Error(`Circular dependency detected involving step: ${stepId}`);
      }

      visiting.add(stepId);

      const registeredStep = this.steps.get(stepId);
      if (registeredStep) {
        const dependencies = registeredStep.metadata.dependencies || [];
        for (const dep of dependencies) {
          if (stepIds.includes(dep)) {
            visit(dep);
          }
        }
      }

      visiting.delete(stepId);
      visited.add(stepId);
      result.push(stepId);
    };

    for (const stepId of stepIds) {
      visit(stepId);
    }

    return result;
  }

  /**
   * Create a pipeline configuration with registered steps
   */
  createPipelineConfig(stepIds: string[]) {
    const steps = stepIds
      .map(id => this.getStep(id))
      .filter((step): step is TransformationStep => step !== undefined);

    if (steps.length !== stepIds.length) {
      const missing = stepIds.filter(id => !this.hasStep(id));
      throw new Error(`Steps not found: ${missing.join(', ')}`);
    }

    return {
      steps,
      cacheEnabled: true,
      maxCacheSize: 100,
      performanceMonitoring: true,
      errorHandling: 'strict' as const,
    };
  }

  /**
   * Export registry state for debugging
   */
  exportState() {
    return {
      steps: Array.from(this.steps.entries()).map(([id, rs]) => ({
        id,
        metadata: rs.metadata,
        registeredAt: rs.registeredAt,
      })),
      categories: Object.fromEntries(this.categories),
    };
  }
}

// Global registry instance
export const stepRegistry = new StepRegistry();
