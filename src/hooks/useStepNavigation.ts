/**
 * @fileoverview Step navigation hook for managing multi-step workflow
 * 
 * Provides centralized state management for step-based UI navigation with
 * validation and transition guards. Handles the main application flow
 * through Import → Extract → Configure → Color Calibration → Export steps.
 * 
 * **Key Features:**
 * - Current step state management
 * - Safe navigation with bounds checking  
 * - Step validation and transition guards
 * - Navigation helpers (next, previous, goto)
 * 
 * @example
 * ```typescript
 * const { currentStep, goToStep, nextStep, previousStep, canGoToStep } = useStepNavigation();
 * 
 * // Navigate to specific step
 * goToStep(2);
 * 
 * // Move through workflow
 * nextStep(); // currentStep + 1
 * previousStep(); // currentStep - 1
 * ```
 */

import { useState, useCallback } from 'react';

/**
 * Step navigation configuration and state
 */
export interface StepNavigationState {
  /** Current active step (0-based index) */
  currentStep: number;
  /** Total number of steps in the workflow */
  totalSteps: number;
}

/**
 * Step navigation actions and utilities
 */
export interface StepNavigationActions {
  /** Navigate to a specific step by index */
  goToStep: (step: number) => void;
  /** Move to the next step in the workflow */
  nextStep: () => void;
  /** Move to the previous step in the workflow */
  previousStep: () => void;
  /** Check if navigation to a specific step is allowed */
  canGoToStep: (step: number) => boolean;
  /** Check if user can proceed to next step */
  canGoNext: () => boolean;
  /** Check if user can go back to previous step */
  canGoPrevious: () => boolean;
}

/**
 * Complete step navigation interface
 */
export type StepNavigationHook = StepNavigationState & StepNavigationActions;

/**
 * Default configuration for the step workflow
 */
const DEFAULT_TOTAL_STEPS = 5; // Import, Extract, Configure, Color Calibration, Export
const DEFAULT_INITIAL_STEP = 0; // Start at Import step

/**
 * Custom hook for managing step-based navigation workflow
 * 
 * Provides safe navigation between steps with bounds checking and validation.
 * Designed specifically for the Card Game PDF Transformer's 5-step workflow.
 * 
 * **Step Flow:**
 * 0. Import PDF - Upload file, configure mode, set page settings
 * 1. Extract Cards - Set up grid layout and cropping parameters  
 * 2. Configure Layout - Adjust output format, sizing, and positioning
 * 3. Color Calibration - Fine-tune color corrections and adjustments
 * 4. Export - Generate final PDF for printing
 * 
 * @param totalSteps - Total number of steps in workflow (default: 5)
 * @param initialStep - Starting step index (default: 0)
 * @returns Step navigation state and actions
 * 
 * @example
 * ```typescript
 * // Basic usage
 * const { currentStep, nextStep, previousStep } = useStepNavigation();
 * 
 * // With custom configuration
 * const navigation = useStepNavigation(3, 1); // 3 steps, start at step 1
 * 
 * // Navigation with validation
 * if (navigation.canGoNext()) {
 *   navigation.nextStep();
 * }
 * ```
 */
export function useStepNavigation(
  totalSteps: number = DEFAULT_TOTAL_STEPS,
  initialStep: number = DEFAULT_INITIAL_STEP
): StepNavigationHook {
  // Validate initial parameters
  const validInitialStep = Math.max(0, Math.min(initialStep, totalSteps - 1));
  const [currentStep, setCurrentStep] = useState<number>(validInitialStep);

  /**
   * Navigate to a specific step with bounds checking
   * 
   * @param step - Target step index (0-based)
   */
  const goToStep = useCallback((step: number): void => {
    if (step >= 0 && step < totalSteps) {
      setCurrentStep(step);
    } else {
      console.warn(`Invalid step navigation: step ${step} is out of bounds (0-${totalSteps - 1})`);
    }
  }, [totalSteps]);

  /**
   * Move to the next step in the workflow
   * 
   * Does nothing if already at the last step.
   */
  const nextStep = useCallback((): void => {
    if (currentStep < totalSteps - 1) {
      setCurrentStep(currentStep + 1);
    }
  }, [currentStep, totalSteps]);

  /**
   * Move to the previous step in the workflow
   * 
   * Does nothing if already at the first step.
   */
  const previousStep = useCallback((): void => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  }, [currentStep]);

  /**
   * Check if navigation to a specific step is allowed
   * 
   * @param step - Target step index to validate
   * @returns True if navigation is permitted
   */
  const canGoToStep = useCallback((step: number): boolean => {
    return step >= 0 && step < totalSteps;
  }, [totalSteps]);

  /**
   * Check if user can proceed to the next step
   * 
   * @returns True if next step is available
   */
  const canGoNext = useCallback((): boolean => {
    return currentStep < totalSteps - 1;
  }, [currentStep, totalSteps]);

  /**
   * Check if user can go back to the previous step
   * 
   * @returns True if previous step is available
   */
  const canGoPrevious = useCallback((): boolean => {
    return currentStep > 0;
  }, [currentStep]);

  return {
    // State
    currentStep,
    totalSteps,
    
    // Actions
    goToStep,
    nextStep,
    previousStep,
    canGoToStep,
    canGoNext,
    canGoPrevious
  };
}