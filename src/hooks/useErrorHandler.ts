import { useState, useCallback } from 'react';

export interface ErrorState {
  hasError: boolean;
  error: Error | null;
  errorMessage: string;
  timestamp: number;
}

export interface ErrorHandlerOptions {
  /** Whether to log errors to console */
  logErrors?: boolean;
  /** Custom error message formatter */
  formatError?: (error: Error) => string;
  /** Callback when error occurs */
  onError?: (error: Error) => void;
}

/**
 * Custom hook for consistent error state management across components
 * 
 * @param options Configuration options for error handling
 * @returns Object containing error state and handler functions
 */
export function useErrorHandler(options: ErrorHandlerOptions = {}) {
  const { logErrors = true, formatError, onError } = options;
  
  const [errorState, setErrorState] = useState<ErrorState>({
    hasError: false,
    error: null,
    errorMessage: '',
    timestamp: 0,
  });

  const handleError = useCallback((error: Error | string, context?: string) => {
    const errorObj = error instanceof Error ? error : new Error(error);
    
    // Format error message
    let errorMessage = formatError ? formatError(errorObj) : errorObj.message;
    if (context) {
      errorMessage = `${context}: ${errorMessage}`;
    }
    
    // Update error state
    setErrorState({
      hasError: true,
      error: errorObj,
      errorMessage,
      timestamp: Date.now(),
    });
    
    // Log error if enabled
    if (logErrors) {
      console.error('Error handled by useErrorHandler:', errorObj);
      if (context) {
        console.error('Context:', context);
      }
    }
    
    // Call optional error callback
    if (onError) {
      onError(errorObj);
    }
  }, [formatError, logErrors, onError]);

  const clearError = useCallback(() => {
    setErrorState({
      hasError: false,
      error: null,
      errorMessage: '',
      timestamp: 0,
    });
  }, []);

  const handleAsyncError = useCallback(async <T>(
    asyncFn: () => Promise<T>,
    context?: string
  ): Promise<T | null> => {
    try {
      return await asyncFn();
    } catch (error) {
      handleError(error instanceof Error ? error : new Error(String(error)), context);
      return null;
    }
  }, [handleError]);

  const wrapFunction = useCallback(<T extends (...args: any[]) => any>(
    fn: T,
    context?: string
  ): T => {
    return ((...args: Parameters<T>) => {
      try {
        return fn(...args);
      } catch (error) {
        handleError(error instanceof Error ? error : new Error(String(error)), context);
        return null;
      }
    }) as T;
  }, [handleError]);

  return {
    // Error state
    ...errorState,
    
    // Error handlers
    handleError,
    clearError,
    handleAsyncError,
    wrapFunction,
    
    // Utility functions
    isError: errorState.hasError,
    errorAge: errorState.timestamp ? Date.now() - errorState.timestamp : 0,
  };
}

export default useErrorHandler;