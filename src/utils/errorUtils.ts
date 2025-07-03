/**
 * Standardized error message formatting utilities
 * Provides consistent error messaging across the application
 */

export interface ErrorContext {
  component?: string;
  operation?: string;
  file?: string;
  details?: Record<string, any>;
}

export enum ErrorType {
  VALIDATION = 'validation',
  PROCESSING = 'processing',
  NETWORK = 'network',
  FILE_SYSTEM = 'file_system',
  MEMORY = 'memory',
  TIMEOUT = 'timeout',
  UNKNOWN = 'unknown',
}

export interface FormattedError {
  message: string;
  userMessage: string;
  type: ErrorType;
  context?: ErrorContext;
  timestamp: number;
}

/**
 * Format error messages consistently across the application
 */
export function formatErrorMessage(
  error: Error | string,
  context?: ErrorContext
): FormattedError {
  const errorObj = error instanceof Error ? error : new Error(error);
  const type = detectErrorType(errorObj);
  
  return {
    message: errorObj.message,
    userMessage: createUserFriendlyMessage(errorObj, type, context),
    type,
    context,
    timestamp: Date.now(),
  };
}

/**
 * Detect the type of error based on error message and context
 */
function detectErrorType(error: Error): ErrorType {
  const message = error.message.toLowerCase();
  
  if (message.includes('invalid') || message.includes('validation') || message.includes('required')) {
    return ErrorType.VALIDATION;
  }
  
  if (message.includes('network') || message.includes('fetch') || message.includes('connection')) {
    return ErrorType.NETWORK;
  }
  
  if (message.includes('file') || message.includes('permission') || message.includes('not found')) {
    return ErrorType.FILE_SYSTEM;
  }
  
  if (message.includes('memory') || message.includes('out of memory')) {
    return ErrorType.MEMORY;
  }
  
  if (message.includes('timeout') || message.includes('timed out')) {
    return ErrorType.TIMEOUT;
  }
  
  if (message.includes('processing') || message.includes('transform') || message.includes('render')) {
    return ErrorType.PROCESSING;
  }
  
  return ErrorType.UNKNOWN;
}

/**
 * Create user-friendly error messages
 */
function createUserFriendlyMessage(
  error: Error,
  type: ErrorType,
  context?: ErrorContext
): string {
  const operation = context?.operation || 'operation';
  const component = context?.component || 'application';
  
  switch (type) {
    case ErrorType.VALIDATION:
      return `Please check your input and try again. ${error.message}`;
      
    case ErrorType.PROCESSING:
      return `Failed to process ${context?.file ? `file "${context.file}"` : 'your request'}. Please try again or contact support if the problem persists.`;
      
    case ErrorType.NETWORK:
      return 'Network connection failed. Please check your internet connection and try again.';
      
    case ErrorType.FILE_SYSTEM:
      return `File operation failed. Please check file permissions and ensure the file exists.`;
      
    case ErrorType.MEMORY:
      return 'The operation requires too much memory. Try processing fewer files at once or restart the application.';
      
    case ErrorType.TIMEOUT:
      return `The ${operation} took too long to complete. Please try again or use smaller files.`;
      
    case ErrorType.UNKNOWN:
    default:
      return `An unexpected error occurred in ${component}. Please try again or contact support if the problem persists.`;
  }
}

/**
 * Common error messages for the application
 */
export const ERROR_MESSAGES = {
  // File processing errors
  FILE_UPLOAD_FAILED: 'Failed to upload file. Please check the file format and try again.',
  FILE_TOO_LARGE: 'File is too large. Please use a smaller file (max 50MB).',
  INVALID_FILE_TYPE: 'Invalid file type. Please use PDF, PNG, or JPG files.',
  FILE_CORRUPTED: 'File appears to be corrupted. Please try a different file.',
  
  // PDF processing errors
  PDF_LOAD_FAILED: 'Failed to load PDF. Please ensure the file is not password protected.',
  PDF_RENDER_FAILED: 'Failed to render PDF page. The file may be corrupted.',
  PDF_WORKER_FAILED: 'PDF processing failed. Please refresh the page and try again.',
  
  // Image processing errors
  IMAGE_LOAD_FAILED: 'Failed to load image. Please check the file format.',
  IMAGE_RENDER_FAILED: 'Failed to process image. The file may be corrupted.',
  IMAGE_TOO_LARGE: 'Image is too large to process. Please use a smaller image.',
  
  // Processing errors
  EXTRACTION_FAILED: 'Failed to extract cards. Please check your settings and try again.',
  EXPORT_FAILED: 'Failed to export PDF. Please try again or contact support.',
  CALIBRATION_FAILED: 'Color calibration failed. Please check your settings.',
  
  // Memory errors
  OUT_OF_MEMORY: 'Not enough memory to complete the operation. Try processing fewer files.',
  CACHE_FULL: 'Cache is full. Please clear cache or restart the application.',
  
  // Network errors
  NETWORK_ERROR: 'Network error occurred. Please check your connection.',
  TIMEOUT_ERROR: 'Operation timed out. Please try again with smaller files.',
  
  // Generic errors
  UNKNOWN_ERROR: 'An unknown error occurred. Please try again.',
  OPERATION_CANCELLED: 'Operation was cancelled by user.',
} as const;

/**
 * Get a predefined error message
 */
export function getErrorMessage(key: keyof typeof ERROR_MESSAGES): string {
  return ERROR_MESSAGES[key];
}

/**
 * Create error with context
 */
export function createError(
  message: string,
  context?: ErrorContext,
  cause?: Error
): Error {
  const error = new Error(message);
  if (cause) {
    error.cause = cause;
  }
  
  // Add context as a property for debugging
  if (context) {
    (error as any).context = context;
  }
  
  return error;
}

/**
 * Check if error is of specific type
 */
export function isErrorType(error: Error, type: ErrorType): boolean {
  return detectErrorType(error) === type;
}

/**
 * Extract error details for logging
 */
export function getErrorDetails(error: Error): Record<string, any> {
  return {
    message: error.message,
    name: error.name,
    stack: error.stack,
    cause: error.cause,
    context: (error as any).context,
  };
}