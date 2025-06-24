/**
 * @fileoverview Drag and drop utilities for page reordering
 * 
 * This module provides utilities for implementing drag-and-drop functionality
 * for page reordering operations. It includes helper functions for managing
 * drag state, calculating drop positions, and providing visual feedback during
 * drag operations.
 * 
 * **Key Responsibilities:**
 * - Drag operation state management
 * - Drop position calculation and validation
 * - Visual feedback utilities for drag operations
 * - Touch and mouse event handling abstractions
 * - Accessibility support for drag-and-drop operations
 * 
 * **Design Considerations:**
 * - Works with both mouse and touch events for mobile support
 * - Provides visual feedback without disrupting page layout
 * - Includes keyboard alternatives for accessibility
 * - Optimized for performance during drag operations
 * 
 * @author Card Game PDF Transformer
 */

// import { DRAG_DROP_CONSTANTS } from '../constants'; // Reserved for future use
import { PageReorderState } from '../types';

/**
 * Calculate drop position based on mouse/touch coordinates
 * 
 * Determines where a dragged item should be dropped based on the current
 * cursor position relative to the drop target container.
 * 
 * @param clientY - Current Y coordinate of the cursor/touch
 * @param containerElement - Container element for the drop operation
 * @param itemHeight - Height of individual items in pixels
 * @param maxItems - Maximum number of items (to clamp the result)
 * @returns Index where the item should be dropped (0-based)
 * 
 * @example
 * ```typescript
 * const dropIndex = calculateDropPosition(mouseEvent.clientY, tableElement, 50, pages.length);
 * // Returns the row index where the dragged item should be dropped
 * ```
 */
export function calculateDropPosition(
  clientY: number,
  containerElement: HTMLElement,
  itemHeight: number,
  maxItems: number
): number {
  const containerRect = containerElement.getBoundingClientRect();
  const relativeY = clientY - containerRect.top;
  
  // Calculate which item position the cursor is over
  const dropIndex = Math.floor(relativeY / itemHeight);
  
  // Clamp to valid range (0 to maxItems-1)
  return Math.max(0, Math.min(dropIndex, maxItems - 1));
}

/**
 * Check if coordinates are within a drop zone
 * 
 * Determines whether the current drag position is within a valid drop zone
 * for the drag-and-drop operation.
 * 
 * @param clientX - Current X coordinate
 * @param clientY - Current Y coordinate
 * @param dropZoneElement - Element representing the drop zone
 * @param margin - Optional margin around the drop zone (default: 0)
 * @returns true if coordinates are within the drop zone
 * 
 * @example
 * ```typescript
 * const isValidDrop = isWithinDropZone(
 *   event.clientX, 
 *   event.clientY, 
 *   dropZoneElement, 
 *   10
 * );
 * ```
 */
export function isWithinDropZone(
  clientX: number,
  clientY: number,
  dropZoneElement: HTMLElement,
  margin: number = 0
): boolean {
  const rect = dropZoneElement.getBoundingClientRect();
  
  return (
    clientX >= rect.left - margin &&
    clientX <= rect.right + margin &&
    clientY >= rect.top - margin &&
    clientY <= rect.bottom + margin
  );
}

/**
 * Create initial drag state
 * 
 * Initializes a PageReorderState object with default values for starting
 * a new drag operation.
 * 
 * @param pageCount - Total number of pages in the list
 * @returns Initial PageReorderState with default values
 * 
 * @example
 * ```typescript
 * const initialState = createInitialDragState(10);
 * // Returns state with dragIndex: null, hoverIndex: null, etc.
 * ```
 */
export function createInitialDragState(pageCount: number): PageReorderState {
  return {
    dragIndex: null,
    hoverIndex: null,
    isDragging: false,
    pageOrder: Array.from({ length: pageCount }, (_, index) => index)
  };
}

/**
 * Update drag state during drag operation
 * 
 * Creates a new drag state with updated values during an active drag operation.
 * This function maintains immutability by returning a new state object.
 * 
 * @param currentState - Current drag state
 * @param updates - Partial state updates to apply
 * @returns New PageReorderState with updates applied
 * 
 * @example
 * ```typescript
 * const newState = updateDragState(currentState, {
 *   dragIndex: 2,
 *   hoverIndex: 5,
 *   isDragging: true
 * });
 * ```
 */
export function updateDragState(
  currentState: PageReorderState,
  updates: Partial<PageReorderState>
): PageReorderState {
  return {
    ...currentState,
    ...updates
  };
}

/**
 * Calculate visual feedback for drag operation
 * 
 * Determines visual styling and positioning for drag feedback elements
 * based on the current drag state and cursor position.
 * 
 * @param dragState - Current drag operation state
 * @param cursorY - Current Y position of cursor
 * @param itemHeight - Height of individual items
 * @returns Object with visual feedback properties
 * 
 * @example
 * ```typescript
 * const feedback = calculateDragFeedback(dragState, mouseY, 50);
 * // Returns: { showDropLine: true, dropLineY: 150, highlightIndex: 3 }
 * ```
 */
export function calculateDragFeedback(
  dragState: PageReorderState,
  _cursorY: number,
  itemHeight: number
): {
  showDropLine: boolean;
  dropLineY: number;
  highlightIndex: number | null;
} {
  if (!dragState.isDragging || dragState.hoverIndex === null) {
    return {
      showDropLine: false,
      dropLineY: 0,
      highlightIndex: null
    };
  }
  
  const dropLineY = dragState.hoverIndex * itemHeight;
  
  return {
    showDropLine: true,
    dropLineY,
    highlightIndex: dragState.hoverIndex
  };
}

/**
 * Handle drag start event
 * 
 * Processes the start of a drag operation, setting up initial state and
 * preparing the drag feedback elements.
 * 
 * @param event - Mouse or touch event that started the drag
 * @param dragIndex - Index of the item being dragged
 * @param currentState - Current drag state
 * @returns Updated drag state for the start of the operation
 * 
 * @example
 * ```typescript
 * const newState = handleDragStart(mouseEvent, 2, currentState);
 * // Sets up drag state with dragIndex: 2, isDragging: true
 * ```
 */
export function handleDragStart(
  event: MouseEvent | TouchEvent,
  dragIndex: number,
  currentState: PageReorderState
): PageReorderState {
  // Prevent default drag behavior
  event.preventDefault();
  
  return updateDragState(currentState, {
    dragIndex,
    hoverIndex: dragIndex,
    isDragging: true
  });
}

/**
 * Handle drag over event
 * 
 * Processes mouse/touch movement during a drag operation, updating the
 * hover index and visual feedback based on the current position.
 * 
 * @param event - Mouse or touch event during drag
 * @param containerElement - Container element for the drag operation
 * @param itemHeight - Height of individual items
 * @param currentState - Current drag state
 * @param maxItems - Maximum number of items (to clamp hover index)
 * @returns Updated drag state with new hover position
 * 
 * @example
 * ```typescript
 * const newState = handleDragOver(mouseEvent, tableElement, 50, currentState, pages.length);
 * // Updates hoverIndex based on mouse position
 * ```
 */
export function handleDragOver(
  event: MouseEvent | TouchEvent,
  containerElement: HTMLElement,
  itemHeight: number,
  currentState: PageReorderState,
  maxItems: number
): PageReorderState {
  if (!currentState.isDragging) {
    return currentState;
  }
  
  // Get cursor position from event
  const clientY = 'touches' in event ? event.touches[0].clientY : event.clientY;
  
  // Calculate new hover index
  const hoverIndex = calculateDropPosition(clientY, containerElement, itemHeight, maxItems);
  
  // Only update if hover index changed
  if (hoverIndex !== currentState.hoverIndex) {
    return updateDragState(currentState, {
      hoverIndex
    });
  }
  
  return currentState;
}

/**
 * Handle drag end event
 * 
 * Completes a drag operation by finalizing the drop position and resetting
 * the drag state. Returns both the updated state and the reorder operation
 * that should be performed.
 * 
 * @param currentState - Current drag state at end of operation
 * @returns Object with updated state and reorder operation details
 * 
 * @example
 * ```typescript
 * const result = handleDragEnd(currentState);
 * if (result.shouldReorder) {
 *   performReorder(result.fromIndex, result.toIndex);
 * }
 * setState(result.newState);
 * ```
 */
export function handleDragEnd(currentState: PageReorderState): {
  newState: PageReorderState;
  shouldReorder: boolean;
  fromIndex: number | null;
  toIndex: number | null;
} {
  const shouldReorder = 
    currentState.isDragging &&
    currentState.dragIndex !== null &&
    currentState.hoverIndex !== null &&
    currentState.dragIndex !== currentState.hoverIndex;
  
  const newState = updateDragState(currentState, {
    dragIndex: null,
    hoverIndex: null,
    isDragging: false
  });
  
  return {
    newState,
    shouldReorder,
    fromIndex: currentState.dragIndex,
    toIndex: currentState.hoverIndex
  };
}

/**
 * Add drag event listeners to an element
 * 
 * Sets up mouse and touch event listeners for drag operations on a specific
 * element. Returns a cleanup function to remove the listeners.
 * 
 * @param element - Element to make draggable
 * @param onDragStart - Callback for drag start
 * @param onDragOver - Callback for drag over
 * @param onDragEnd - Callback for drag end
 * @returns Cleanup function to remove event listeners
 * 
 * @example
 * ```typescript
 * const cleanup = addDragListeners(
 *   tableRowElement,
 *   handleStart,
 *   handleOver,
 *   handleEnd
 * );
 * 
 * // Later, when component unmounts:
 * cleanup();
 * ```
 */
export function addDragListeners(
  element: HTMLElement,
  onDragStart: (event: MouseEvent | TouchEvent) => void,
  onDragOver: (event: MouseEvent | TouchEvent) => void,
  onDragEnd: (event: MouseEvent | TouchEvent) => void
): () => void {
  // Mouse event handlers
  const handleMouseDown = (event: MouseEvent) => {
    onDragStart(event);
    
    const handleMouseMove = (moveEvent: MouseEvent) => {
      onDragOver(moveEvent);
    };
    
    const handleMouseUp = (upEvent: MouseEvent) => {
      onDragEnd(upEvent);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };
  
  // Touch event handlers
  const handleTouchStart = (event: TouchEvent) => {
    onDragStart(event);
    
    const handleTouchMove = (moveEvent: TouchEvent) => {
      onDragOver(moveEvent);
    };
    
    const handleTouchEnd = (endEvent: TouchEvent) => {
      onDragEnd(endEvent);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
    
    document.addEventListener('touchmove', handleTouchMove);
    document.addEventListener('touchend', handleTouchEnd);
  };
  
  // Add event listeners
  element.addEventListener('mousedown', handleMouseDown);
  element.addEventListener('touchstart', handleTouchStart);
  
  // Return cleanup function
  return () => {
    element.removeEventListener('mousedown', handleMouseDown);
    element.removeEventListener('touchstart', handleTouchStart);
  };
}

/**
 * Create keyboard navigation handlers for accessibility
 * 
 * Provides keyboard alternatives for drag-and-drop operations to ensure
 * accessibility compliance. Supports arrow keys and Enter/Space for reordering.
 * 
 * @param onMoveUp - Callback to move item up in the list
 * @param onMoveDown - Callback to move item down in the list
 * @param onConfirm - Callback to confirm current position
 * @returns Object with keyboard event handlers
 * 
 * @example
 * ```typescript
 * const keyboardHandlers = createKeyboardHandlers(
 *   () => moveUp(currentIndex),
 *   () => moveDown(currentIndex),
 *   () => confirmPosition()
 * );
 * 
 * <div onKeyDown={keyboardHandlers.handleKeyDown} tabIndex={0}>
 *   Draggable item
 * </div>
 * ```
 */
export function createKeyboardHandlers(
  onMoveUp: () => void,
  onMoveDown: () => void,
  onConfirm: () => void
): {
  handleKeyDown: (event: KeyboardEvent) => void;
} {
  const handleKeyDown = (event: KeyboardEvent) => {
    switch (event.key) {
      case 'ArrowUp':
        event.preventDefault();
        onMoveUp();
        break;
      case 'ArrowDown':
        event.preventDefault();
        onMoveDown();
        break;
      case 'Enter':
      case ' ':
        event.preventDefault();
        onConfirm();
        break;
    }
  };
  
  return { handleKeyDown };
}

/**
 * Throttle drag events for performance
 * 
 * Creates a throttled version of a drag event handler to prevent excessive
 * updates during rapid mouse movement.
 * 
 * @param handler - Original event handler function
 * @param delay - Throttle delay in milliseconds (default: 16ms for 60fps)
 * @returns Throttled version of the handler
 * 
 * @example
 * ```typescript
 * const throttledDragOver = throttleDragEvents(handleDragOver, 16);
 * // Now throttledDragOver will only fire at most every 16ms
 * ```
 */
export function throttleDragEvents<T extends (...args: any[]) => any>(
  handler: T,
  delay: number = 16
): T {
  let lastCall = 0;
  let timeoutId: NodeJS.Timeout | null = null;
  
  return ((...args: Parameters<T>) => {
    const now = Date.now();
    
    if (now - lastCall >= delay) {
      lastCall = now;
      handler(...args);
    } else {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      timeoutId = setTimeout(() => {
        lastCall = Date.now();
        handler(...args);
      }, delay - (now - lastCall));
    }
  }) as T;
}