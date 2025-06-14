/**
 * Unit tests for PipelineEventEmitter
 */

import { PipelineEventEmitter } from '../events';
import type { PipelineEvent } from '../types';

describe('PipelineEventEmitter', () => {
  let emitter: PipelineEventEmitter;

  beforeEach(() => {
    emitter = new PipelineEventEmitter();
  });

  describe('event subscription', () => {
    it('should register event listeners', () => {
      const listener = jest.fn();
      
      emitter.on('step-started', listener);
      
      expect(emitter.listenerCount('step-started')).toBe(1);
    });

    it('should register multiple listeners for same event', () => {
      const listener1 = jest.fn();
      const listener2 = jest.fn();
      
      emitter.on('step-started', listener1);
      emitter.on('step-started', listener2);
      
      expect(emitter.listenerCount('step-started')).toBe(2);
    });

    it('should register global listeners', () => {
      const listener = jest.fn();
      
      emitter.onAny(listener);
      
      // Global listeners don't affect specific event counts
      expect(emitter.listenerCount('step-started')).toBe(0);
    });

    it('should return unsubscribe function', () => {
      const listener = jest.fn();
      
      const unsubscribe = emitter.on('step-started', listener);
      expect(emitter.listenerCount('step-started')).toBe(1);
      
      unsubscribe();
      expect(emitter.listenerCount('step-started')).toBe(0);
    });

    it('should return unsubscribe function for global listeners', () => {
      const listener = jest.fn();
      
      const unsubscribe = emitter.onAny(listener);
      unsubscribe();
      
      // Emit event and verify global listener wasn't called
      const event: PipelineEvent = {
        type: 'step-started',
        stepId: 'test',
        timestamp: new Date(),
      };
      
      emitter.emit(event);
      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('event emission', () => {
    it('should call specific event listeners', () => {
      const stepListener = jest.fn();
      const resetListener = jest.fn();
      
      emitter.on('step-started', stepListener);
      emitter.on('pipeline-reset', resetListener);
      
      const event: PipelineEvent = {
        type: 'step-started',
        stepId: 'test',
        timestamp: new Date(),
      };
      
      emitter.emit(event);
      
      expect(stepListener).toHaveBeenCalledWith(event);
      expect(resetListener).not.toHaveBeenCalled();
    });

    it('should call all listeners for the same event', () => {
      const listener1 = jest.fn();
      const listener2 = jest.fn();
      
      emitter.on('step-started', listener1);
      emitter.on('step-started', listener2);
      
      const event: PipelineEvent = {
        type: 'step-started',
        stepId: 'test',
        timestamp: new Date(),
      };
      
      emitter.emit(event);
      
      expect(listener1).toHaveBeenCalledWith(event);
      expect(listener2).toHaveBeenCalledWith(event);
    });

    it('should call global listeners for all events', () => {
      const globalListener = jest.fn();
      
      emitter.onAny(globalListener);
      
      const stepEvent: PipelineEvent = {
        type: 'step-started',
        stepId: 'test',
        timestamp: new Date(),
      };
      
      const resetEvent: PipelineEvent = {
        type: 'pipeline-reset',
        timestamp: new Date(),
      };
      
      emitter.emit(stepEvent);
      emitter.emit(resetEvent);
      
      expect(globalListener).toHaveBeenCalledTimes(2);
      expect(globalListener).toHaveBeenNthCalledWith(1, stepEvent);
      expect(globalListener).toHaveBeenNthCalledWith(2, resetEvent);
    });

    it('should handle listener errors gracefully', () => {
      const errorListener = jest.fn().mockImplementation(() => {
        throw new Error('Listener error');
      });
      const normalListener = jest.fn();
      
      // Mock console.error to avoid test output noise
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      emitter.on('step-started', errorListener);
      emitter.on('step-started', normalListener);
      
      const event: PipelineEvent = {
        type: 'step-started',
        stepId: 'test',
        timestamp: new Date(),
      };
      
      emitter.emit(event);
      
      expect(errorListener).toHaveBeenCalled();
      expect(normalListener).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(
        'Error in event listener for step-started:',
        expect.any(Error)
      );
      
      consoleSpy.mockRestore();
    });

    it('should handle global listener errors gracefully', () => {
      const errorListener = jest.fn().mockImplementation(() => {
        throw new Error('Global listener error');
      });
      
      // Mock console.error to avoid test output noise
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      emitter.onAny(errorListener);
      
      const event: PipelineEvent = {
        type: 'step-started',
        stepId: 'test',
        timestamp: new Date(),
      };
      
      emitter.emit(event);
      
      expect(errorListener).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(
        'Error in global event listener:',
        expect.any(Error)
      );
      
      consoleSpy.mockRestore();
    });
  });

  describe('listener management', () => {
    it('should remove all listeners for specific event type', () => {
      const listener1 = jest.fn();
      const listener2 = jest.fn();
      
      emitter.on('step-started', listener1);
      emitter.on('step-started', listener2);
      emitter.on('pipeline-reset', listener1);
      
      expect(emitter.listenerCount('step-started')).toBe(2);
      expect(emitter.listenerCount('pipeline-reset')).toBe(1);
      
      emitter.removeAllListeners('step-started');
      
      expect(emitter.listenerCount('step-started')).toBe(0);
      expect(emitter.listenerCount('pipeline-reset')).toBe(1);
    });

    it('should remove all listeners for all events', () => {
      const listener = jest.fn();
      
      emitter.on('step-started', listener);
      emitter.on('pipeline-reset', listener);
      emitter.onAny(listener);
      
      emitter.removeAllListeners();
      
      expect(emitter.listenerCount('step-started')).toBe(0);
      expect(emitter.listenerCount('pipeline-reset')).toBe(0);
      
      // Verify global listeners were also removed
      const event: PipelineEvent = {
        type: 'step-started',
        stepId: 'test',
        timestamp: new Date(),
      };
      
      emitter.emit(event);
      expect(listener).not.toHaveBeenCalled();
    });

    it('should return correct event types', () => {
      emitter.on('step-started', jest.fn());
      emitter.on('pipeline-reset', jest.fn());
      emitter.on('step-completed', jest.fn());
      
      const eventTypes = emitter.eventTypes();
      
      expect(eventTypes).toContain('step-started');
      expect(eventTypes).toContain('pipeline-reset');
      expect(eventTypes).toContain('step-completed');
      expect(eventTypes).toHaveLength(3);
    });
  });

  describe('edge cases', () => {
    it('should handle emitting events with no listeners', () => {
      const event: PipelineEvent = {
        type: 'step-started',
        stepId: 'test',
        timestamp: new Date(),
      };
      
      // Should not throw
      expect(() => emitter.emit(event)).not.toThrow();
    });

    it('should handle unsubscribing non-existent listener', () => {
      const listener = jest.fn();
      const unsubscribe = emitter.on('step-started', listener);
      
      // Unsubscribe twice
      unsubscribe();
      
      // Should not throw
      expect(() => unsubscribe()).not.toThrow();
      expect(emitter.listenerCount('step-started')).toBe(0);
    });

    it('should handle removing listeners from non-existent event type', () => {
      // Should not throw
      expect(() => emitter.removeAllListeners('non-existent' as any)).not.toThrow();
    });

    it('should handle listener count for non-existent event type', () => {
      expect(emitter.listenerCount('non-existent' as any)).toBe(0);
    });
  });
});
