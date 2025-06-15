/**
 * Centralized state management for the PnP Card Utility
 * Replaces scattered state from App.tsx with reactive pipeline state
 */

import { TransformationPipeline } from './TransformationPipeline';
import { PipelineEventEmitter } from './events';
import type { 
  PipelineState, 
  PipelineEvent
} from './types';
import { DEFAULT_SETTINGS, getDefaultGrid, getDefaultRotation } from '../defaults';

export interface AppState {
  // Navigation state
  currentStep: number;
  
  // PDF data and metadata
  pdfData: any | null; // PDF.js document
  currentPdfFileName: string;
  
  // Settings from App.tsx
  pdfMode: any;
  pageSettings: any;
  cardDimensions: {
    widthPx: number;
    heightPx: number;
    widthInches: number;
    heightInches: number;
  } | null;
  extractionSettings: any;
  outputSettings: any;
  
  // Pipeline state
  pipeline: PipelineState;
  
  // UI state
  isLoading: boolean;
  errors: string[];
  warnings: string[];
}

export interface StateChangeEvent {
  type: 'state-changed';
  state: PipelineState;
  timestamp: Date;
  appState?: AppState;
  changedFields?: string[];
}

export class StateManager {
  private state: AppState;
  private pipeline: TransformationPipeline;
  private eventEmitter: PipelineEventEmitter;
  private stateHistory: AppState[] = [];
  private maxHistorySize = 50;

  constructor(pipeline: TransformationPipeline) {
    this.pipeline = pipeline;
    this.eventEmitter = new PipelineEventEmitter();
    
    // Initialize state with defaults from App.tsx
    this.state = {
      currentStep: 0,
      pdfData: null,
      currentPdfFileName: '',
      pdfMode: DEFAULT_SETTINGS.pdfMode,
      pageSettings: DEFAULT_SETTINGS.pageSettings,
      cardDimensions: null,
      extractionSettings: {
        ...DEFAULT_SETTINGS.extractionSettings,
        grid: getDefaultGrid(DEFAULT_SETTINGS.pdfMode)
      },
      outputSettings: {
        ...DEFAULT_SETTINGS.outputSettings,
        rotation: getDefaultRotation(DEFAULT_SETTINGS.pdfMode)
      },
      pipeline: pipeline.getState(),
      isLoading: false,
      errors: [],
      warnings: []
    };

    // Subscribe to pipeline events to keep state in sync
    this.setupPipelineListeners();
  }

  /**
   * Get current state (read-only)
   */
  getState(): Readonly<AppState> {
    return { ...this.state };
  }  /**
   * Subscribe to state changes
   */
  onChange(listener: (appState: AppState, changedFields: string[]) => void): () => void {
    return this.eventEmitter.on('state-changed', (event: PipelineEvent) => {
      if (event.type === 'state-changed' && 'state' in event) {
        // Cast the event to include our custom fields
        const stateEvent = event as any;
        if (stateEvent.appState && stateEvent.changedFields) {
          listener(stateEvent.appState, stateEvent.changedFields);
        }
      }
    });
  }

  /**
   * Subscribe to specific field changes
   */
  onFieldChange(fieldName: keyof AppState, listener: (value: any, prevValue: any) => void): () => void {
    return this.eventEmitter.on('state-changed', (event: PipelineEvent) => {
      if (event.type === 'state-changed') {
        const stateEvent = event as any;
        if (stateEvent.changedFields && stateEvent.changedFields.includes(fieldName)) {
          const currentValue = this.state[fieldName];
          // Find previous value from history
          const prevState = this.stateHistory[this.stateHistory.length - 1];
          const prevValue = prevState ? prevState[fieldName] : undefined;
          listener(currentValue, prevValue);
        }
      }
    });
  }

  /**
   * Update multiple state fields at once
   */
  updateState(updates: Partial<AppState>): void {
    const prevState = { ...this.state };
    const changedFields: string[] = [];
    
    // Track which fields actually changed
    Object.keys(updates).forEach(key => {
      if (updates[key as keyof AppState] !== this.state[key as keyof AppState]) {
        changedFields.push(key);
      }
    });

    if (changedFields.length === 0) {
      return; // No actual changes
    }

    // Save to history
    this.saveToHistory(prevState);
    
    // Apply updates
    this.state = { ...this.state, ...updates };
    
    // Update pipeline state to stay in sync
    this.state.pipeline = this.pipeline.getState();

    // Emit change event
    this.emitStateChange(changedFields);
  }

  /**
   * Navigation methods
   */
  setCurrentStep(step: number): void {
    if (step !== this.state.currentStep) {
      this.updateState({ currentStep: step });
    }
  }

  nextStep(): void {
    if (this.state.currentStep < 3) {
      this.setCurrentStep(this.state.currentStep + 1);
    }
  }

  previousStep(): void {
    if (this.state.currentStep > 0) {
      this.setCurrentStep(this.state.currentStep - 1);
    }
  }

  /**
   * PDF data management
   */
  setPdfData(data: any, fileName: string): void {
    this.updateState({
      pdfData: data,
      currentPdfFileName: fileName
    });
  }

  /**
   * Settings management from App.tsx
   */
  setPdfMode(mode: any): void {
    // Update mode and related defaults like App.tsx does
    const newGrid = getDefaultGrid(mode);
    const newRotation = getDefaultRotation(mode);
    
    this.updateState({
      pdfMode: mode,
      extractionSettings: {
        ...this.state.extractionSettings,
        grid: newGrid
      },
      outputSettings: {
        ...this.state.outputSettings,
        rotation: newRotation
      }
    });
  }

  setPageSettings(settings: any): void {
    this.updateState({ pageSettings: settings });
  }

  setCardDimensions(dimensions: any): void {
    this.updateState({ cardDimensions: dimensions });
  }

  setExtractionSettings(settings: any): void {
    this.updateState({ extractionSettings: settings });
  }

  setOutputSettings(settings: any): void {
    this.updateState({ outputSettings: settings });
  }

  /**
   * Load settings from file (like App.tsx handleLoadSettings)
   */
  loadSettings(settings: any): void {
    const updates: Partial<AppState> = {};
    
    if (settings.pdfMode) {
      updates.pdfMode = settings.pdfMode;
    }
    if (settings.pageSettings) {
      updates.pageSettings = settings.pageSettings;
    }
    if (settings.extractionSettings) {
      updates.extractionSettings = settings.extractionSettings;
    }
    if (settings.outputSettings) {
      updates.outputSettings = settings.outputSettings;
    }

    this.updateState(updates);
  }

  /**
   * Error and loading state management
   */
  setLoading(loading: boolean): void {
    this.updateState({ isLoading: loading });
  }

  addError(error: string): void {
    this.updateState({
      errors: [...this.state.errors, error]
    });
  }

  clearErrors(): void {
    this.updateState({ errors: [] });
  }

  addWarning(warning: string): void {
    this.updateState({
      warnings: [...this.state.warnings, warning]
    });
  }

  clearWarnings(): void {
    this.updateState({ warnings: [] });
  }

  /**
   * History management for undo/redo
   */
  canUndo(): boolean {
    return this.stateHistory.length > 0;
  }

  undo(): boolean {
    if (!this.canUndo()) {
      return false;
    }

    const previousState = this.stateHistory.pop()!;
    this.state = previousState;
    this.emitStateChange(['*']); // All fields potentially changed
      return true;
  }

  /**
   * Get the pipeline instance for direct step execution
   */
  getPipeline(): TransformationPipeline {
    return this.pipeline;
  }

  /**
   * Execute a pipeline step through the state manager
   */
  async executeStep(stepId: string, input?: any): Promise<any> {
    try {
      this.setLoading(true);
      const result = await this.pipeline.executeStep(stepId, input);
      
      // Update pipeline state after execution
      this.state.pipeline = this.pipeline.getState();
      this.emitStateChange(['pipeline']);
      
      return result;
    } catch (error) {
      this.addError(`Step execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    } finally {
      this.setLoading(false);
    }
  }

  /**
   * Private methods
   */
  private setupPipelineListeners(): void {
    // Keep pipeline state in sync
    this.pipeline.onAny((event: PipelineEvent) => {
      this.updateState({
        pipeline: this.pipeline.getState()
      });

      // Handle pipeline errors
      if (event.type === 'step-failed' && 'error' in event) {
        this.addError(`Pipeline error: ${event.error.message}`);
      }
    });
  }

  private saveToHistory(state: AppState): void {
    this.stateHistory.push(state);
    
    // Limit history size
    if (this.stateHistory.length > this.maxHistorySize) {
      this.stateHistory.shift();
    }
  }
  private emitStateChange(changedFields: string[]): void {
    // Emit as a state-changed event with extra app state data
    const event: any = {
      type: 'state-changed',
      state: this.pipeline.getState(),
      timestamp: new Date(),
      appState: this.getState(),
      changedFields
    };
    
    this.eventEmitter.emit(event);
  }
}
