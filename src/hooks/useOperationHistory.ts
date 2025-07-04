/**
 * @fileoverview Operation History Management Hook
 * 
 * This hook provides undo/redo functionality for page operations in the unified
 * page management system. It maintains a history of page states and allows
 * users to revert or replay operations.
 * 
 * **Key Features:**
 * - Operation history tracking
 * - Undo/redo functionality
 * - State snapshots with compression
 * - Operation metadata tracking
 * - Memory-efficient history management
 * 
 * @author Card Game PDF Transformer
 */

import { useState, useCallback, useRef, useMemo } from 'react';
import { PageSettings, PageSource } from '../types';

interface OperationHistoryEntry {
  /** Unique identifier for the operation */
  id: string;
  /** Human-readable description of the operation */
  description: string;
  /** Timestamp when the operation was performed */
  timestamp: number;
  /** Page state before the operation */
  beforeState: (PageSettings & PageSource)[];
  /** Page state after the operation */
  afterState: (PageSettings & PageSource)[];
  /** Type of operation performed */
  operationType: 'batch' | 'individual' | 'reorder' | 'delete' | 'add' | 'modify';
  /** Additional metadata about the operation */
  metadata?: Record<string, any>;
}

interface UseOperationHistoryOptions {
  /** Maximum number of operations to keep in history */
  maxHistorySize?: number;
  /** Whether to compress history entries to save memory */
  enableCompression?: boolean;
  /** Callback when history changes */
  onHistoryChange?: (canUndo: boolean, canRedo: boolean) => void;
}

interface UseOperationHistoryReturn {
  /** Whether undo operation is available */
  canUndo: boolean;
  /** Whether redo operation is available */
  canRedo: boolean;
  /** Current position in history */
  historyPosition: number;
  /** Total number of history entries */
  historySize: number;
  /** Record a new operation in history */
  recordOperation: (
    description: string,
    beforeState: (PageSettings & PageSource)[],
    afterState: (PageSettings & PageSource)[],
    operationType: OperationHistoryEntry['operationType'],
    metadata?: Record<string, any>
  ) => void;
  /** Undo the last operation */
  undo: () => (PageSettings & PageSource)[] | null;
  /** Redo the next operation */
  redo: () => (PageSettings & PageSource)[] | null;
  /** Clear all history */
  clearHistory: () => void;
  /** Get history entry at specific position */
  getHistoryEntry: (position: number) => OperationHistoryEntry | null;
  /** Get current operation description */
  getCurrentOperation: () => string | null;
  /** Get next operation description (for redo) */
  getNextOperation: () => string | null;
}

/**
 * Custom hook for managing operation history with undo/redo
 */
export const useOperationHistory = (
  options: UseOperationHistoryOptions = {}
): UseOperationHistoryReturn => {
  const {
    maxHistorySize = 50,
    enableCompression = true,
    onHistoryChange
  } = options;

  const [history, setHistory] = useState<OperationHistoryEntry[]>([]);
  const [currentPosition, setCurrentPosition] = useState<number>(-1);
  const operationIdCounter = useRef<number>(0);

  /**
   * Generate unique operation ID
   */
  const generateOperationId = useCallback((): string => {
    return `op_${Date.now()}_${++operationIdCounter.current}`;
  }, []);

  /**
   * Compress page state for storage (if enabled)
   */
  const compressState = useCallback((state: (PageSettings & PageSource)[]): (PageSettings & PageSource)[] => {
    if (!enableCompression) {
      return state;
    }

    // For now, just return a deep copy
    // In a real implementation, we might use JSON compression or delta encoding
    return JSON.parse(JSON.stringify(state));
  }, [enableCompression]);

  /**
   * Computed values
   */
  const canUndo = useMemo(() => currentPosition >= 0, [currentPosition]);
  const canRedo = useMemo(() => currentPosition < history.length - 1, [currentPosition, history.length]);
  const historySize = useMemo(() => history.length, [history.length]);

  /**
   * Record a new operation in history
   */
  const recordOperation = useCallback((
    description: string,
    beforeState: (PageSettings & PageSource)[],
    afterState: (PageSettings & PageSource)[],
    operationType: OperationHistoryEntry['operationType'],
    metadata?: Record<string, any>
  ) => {
    const newEntry: OperationHistoryEntry = {
      id: generateOperationId(),
      description,
      timestamp: Date.now(),
      beforeState: compressState(beforeState),
      afterState: compressState(afterState),
      operationType,
      metadata
    };

    setHistory(prev => {
      // Remove any future history if we're not at the end
      const newHistory = prev.slice(0, currentPosition + 1);
      
      // Add the new entry
      newHistory.push(newEntry);
      
      // Trim history if it exceeds max size
      if (newHistory.length > maxHistorySize) {
        newHistory.shift();
        setCurrentPosition(pos => Math.max(0, pos - 1));
      }
      
      return newHistory;
    });

    setCurrentPosition(prev => {
      const newPos = Math.min(prev + 1, maxHistorySize - 1);
      return newPos;
    });
  }, [generateOperationId, compressState, currentPosition, maxHistorySize]);

  /**
   * Undo the last operation
   */
  const undo = useCallback((): (PageSettings & PageSource)[] | null => {
    if (!canUndo) {
      return null;
    }

    const entry = history[currentPosition];
    if (!entry) {
      return null;
    }

    setCurrentPosition(prev => prev - 1);
    return entry.beforeState;
  }, [canUndo, history, currentPosition]);

  /**
   * Redo the next operation
   */
  const redo = useCallback((): (PageSettings & PageSource)[] | null => {
    if (!canRedo) {
      return null;
    }

    const entry = history[currentPosition + 1];
    if (!entry) {
      return null;
    }

    setCurrentPosition(prev => prev + 1);
    return entry.afterState;
  }, [canRedo, history, currentPosition]);

  /**
   * Clear all history
   */
  const clearHistory = useCallback(() => {
    setHistory([]);
    setCurrentPosition(-1);
  }, []);

  /**
   * Get history entry at specific position
   */
  const getHistoryEntry = useCallback((position: number): OperationHistoryEntry | null => {
    if (position < 0 || position >= history.length) {
      return null;
    }
    return history[position];
  }, [history]);

  /**
   * Get current operation description
   */
  const getCurrentOperation = useCallback((): string | null => {
    const entry = getHistoryEntry(currentPosition);
    return entry?.description || null;
  }, [getHistoryEntry, currentPosition]);

  /**
   * Get next operation description (for redo)
   */
  const getNextOperation = useCallback((): string | null => {
    const entry = getHistoryEntry(currentPosition + 1);
    return entry?.description || null;
  }, [getHistoryEntry, currentPosition]);

  // Notify about history changes
  useState(() => {
    onHistoryChange?.(canUndo, canRedo);
  });

  return {
    canUndo,
    canRedo,
    historyPosition: currentPosition,
    historySize,
    recordOperation,
    undo,
    redo,
    clearHistory,
    getHistoryEntry,
    getCurrentOperation,
    getNextOperation
  };
};