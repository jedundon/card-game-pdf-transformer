/**
 * Base class for transformation steps
 */

import type {
  TransformationStep,
  CardData,
  WorkflowSettings,
  ValidationResult,
  PreviewData,
} from '../types';

export abstract class BaseStep implements TransformationStep {
  public readonly id: string;
  public readonly name: string;
  public readonly description: string;
  public readonly shouldCache: boolean = true;

  constructor(id: string, name: string, description: string) {
    this.id = id;
    this.name = name;
    this.description = description;
  }

  /**
   * Execute the transformation step
   */
  abstract execute(input: CardData[], settings: WorkflowSettings): Promise<CardData[]>;

  /**
   * Generate preview for the step
   */
  abstract generatePreview(input: CardData[], settings: WorkflowSettings): Promise<PreviewData>;

  /**
   * Validate step settings
   */
  abstract validate(settings: WorkflowSettings): ValidationResult;
  /**
   * Hook called before step execution
   */
  async onBeforeExecute?(_input: CardData[], _settings: WorkflowSettings): Promise<void> {
    // Default implementation - override if needed
  }

  /**
   * Hook called after step execution
   */
  async onAfterExecute?(_result: CardData[], _settings: WorkflowSettings): Promise<void> {
    // Default implementation - override if needed
  }

  /**
   * Generate cache key for the step
   */
  getCacheKey?(input: CardData[], settings: WorkflowSettings): string {
    const inputHash = this.hashData(input);
    const settingsHash = this.hashData(this.getRelevantSettings(settings));
    return `${this.id}_${inputHash}_${settingsHash}`;
  }

  /**
   * Get settings that are relevant for this step's caching
   * Override this to specify which settings affect this step
   */
  protected getRelevantSettings(settings: WorkflowSettings): Partial<WorkflowSettings> {
    return settings; // By default, all settings are relevant
  }
  /**
   * Helper method to validate required settings fields
   */
  protected validateRequired(
    settings: WorkflowSettings,
    requiredFields: string[]
  ): ValidationResult {
    const errors: Array<{ field: string; message: string; code: string }> = [];
    
    for (const field of requiredFields) {
      const value = (settings as any)[field];
      if (value === undefined || value === null || value === '') {
        errors.push({
          field,
          message: `${field} is required`,
          code: 'REQUIRED_FIELD_MISSING',
        });
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings: [],
    };
  }

  /**
   * Helper method to validate numeric ranges
   */
  protected validateRange(
    value: number,
    field: string,
    min: number,
    max: number
  ): { field: string; message: string; code: string } | null {
    if (value < min || value > max) {
      return {
        field,
        message: `${field} must be between ${min} and ${max}`,
        code: 'VALUE_OUT_OF_RANGE',
      };
    }
    return null;
  }

  /**
   * Helper method to estimate memory usage
   */
  protected estimateMemoryUsage(data: CardData[]): number {
    return JSON.stringify(data).length * 2; // Rough estimation in bytes
  }

  /**
   * Helper method to hash data for caching
   */
  private hashData(data: any): string {
    try {
      const jsonString = JSON.stringify(data, Object.keys(data).sort());
      return btoa(jsonString).slice(0, 16);
    } catch (error) {
      return Math.random().toString(36).substring(2, 18);
    }
  }

  /**
   * Helper method to create error result
   */
  protected createError(message: string, code: string = 'STEP_ERROR'): ValidationResult {
    return {
      valid: false,
      errors: [{ field: this.id, message, code }],
      warnings: [],
    };
  }

  /**
   * Helper method to create warning
   */
  protected createWarning(message: string, code: string = 'STEP_WARNING'): ValidationResult {
    return {
      valid: true,
      errors: [],
      warnings: [{ field: this.id, message, code }],
    };
  }

  /**
   * Helper method to merge validation results
   */
  protected mergeValidationResults(...results: ValidationResult[]): ValidationResult {
    const allErrors = results.flatMap(r => r.errors);
    const allWarnings = results.flatMap(r => r.warnings);
    
    return {
      valid: allErrors.length === 0,
      errors: allErrors,
      warnings: allWarnings,
    };
  }
}
