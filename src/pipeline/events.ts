/**
 * Event system for pipeline state changes and notifications
 */

import type { PipelineEvent, PipelineEventListener } from './types';

export class PipelineEventEmitter {
  private listeners: Map<string, PipelineEventListener[]> = new Map();
  private globalListeners: PipelineEventListener[] = [];

  /**
   * Subscribe to specific event types
   */
  on(eventType: PipelineEvent['type'], listener: PipelineEventListener): () => void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, []);
    }
    
    const listeners = this.listeners.get(eventType)!;
    listeners.push(listener);
    
    // Return unsubscribe function
    return () => {
      const index = listeners.indexOf(listener);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    };
  }

  /**
   * Subscribe to all events
   */
  onAny(listener: PipelineEventListener): () => void {
    this.globalListeners.push(listener);
    
    return () => {
      const index = this.globalListeners.indexOf(listener);
      if (index > -1) {
        this.globalListeners.splice(index, 1);
      }
    };
  }

  /**
   * Emit an event to all relevant listeners
   */
  emit(event: PipelineEvent): void {
    // Notify specific event type listeners
    const typeListeners = this.listeners.get(event.type) || [];
    typeListeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error(`Error in event listener for ${event.type}:`, error);
      }
    });

    // Notify global listeners
    this.globalListeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error('Error in global event listener:', error);
      }
    });
  }

  /**
   * Remove all listeners for a specific event type
   */
  removeAllListeners(eventType?: PipelineEvent['type']): void {
    if (eventType) {
      this.listeners.delete(eventType);
    } else {
      this.listeners.clear();
      this.globalListeners.length = 0;
    }
  }

  /**
   * Get the number of listeners for an event type
   */
  listenerCount(eventType: PipelineEvent['type']): number {
    return (this.listeners.get(eventType) || []).length;
  }

  /**
   * Get all registered event types
   */
  eventTypes(): string[] {
    return Array.from(this.listeners.keys());
  }
}
