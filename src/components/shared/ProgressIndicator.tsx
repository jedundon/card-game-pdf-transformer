/**
 * @fileoverview Progress indicator components for long operations
 * 
 * Provides various progress indicator components to show the status
 * of long-running operations like file processing, thumbnail generation,
 * and export operations.
 * 
 * **Key Features:**
 * - Linear and circular progress bars
 * - Operation status tracking
 * - Cancellation support
 * - Time estimation
 * - Error state handling
 * 
 * @author Card Game PDF Transformer
 */

import React from 'react';
import { Loader2, X, AlertCircle, CheckCircle } from 'lucide-react';

interface BaseProgressProps {
  /** Current progress percentage (0-100) */
  progress: number;
  /** Current operation status */
  status: 'idle' | 'running' | 'completed' | 'error' | 'cancelled';
  /** Optional operation label */
  label?: string;
  /** Optional detailed status message */
  statusMessage?: string;
  /** Optional error message */
  errorMessage?: string;
  /** Whether operation can be cancelled */
  cancellable?: boolean;
  /** Cancel handler */
  onCancel?: () => void;
  /** Whether to show percentage text */
  showPercentage?: boolean;
  /** Custom class name */
  className?: string;
}

/**
 * Linear progress bar component
 * 
 * Shows progress as a horizontal bar with optional text indicators.
 * 
 * @example
 * ```tsx
 * <LinearProgress
 *   progress={65}
 *   status="running"
 *   label="Generating thumbnails"
 *   statusMessage="Processing page 13 of 20"
 *   cancellable
 *   onCancel={() => cancelOperation()}
 * />
 * ```
 */
export function LinearProgress({
  progress,
  status,
  label,
  statusMessage,
  errorMessage,
  cancellable = false,
  onCancel,
  showPercentage = true,
  className = ''
}: BaseProgressProps) {
  const getStatusColor = () => {
    switch (status) {
      case 'completed':
        return 'bg-green-500';
      case 'error':
        return 'bg-red-500';
      case 'cancelled':
        return 'bg-gray-500';
      default:
        return 'bg-blue-500';
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'running':
        return <Loader2 className="animate-spin w-4 h-4" />;
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      case 'cancelled':
        return <X className="w-4 h-4 text-gray-500" />;
      default:
        return null;
    }
  };

  const displayProgress = Math.max(0, Math.min(100, progress));
  const isActive = status === 'running';

  return (
    <div className={`w-full space-y-2 ${className}`}>
      {/* Header with label and cancel button */}
      {(label || cancellable) && (
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            {getStatusIcon()}
            {label && (
              <span className="text-sm font-medium text-gray-700">
                {label}
              </span>
            )}
          </div>
          
          {cancellable && onCancel && isActive && (
            <button
              onClick={onCancel}
              className="text-gray-500 hover:text-gray-700 p-1"
              title="Cancel operation"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      )}

      {/* Progress bar */}
      <div className="relative">
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all duration-300 ${getStatusColor()}`}
            style={{ width: `${displayProgress}%` }}
          />
        </div>
        
        {/* Animated overlay for active state */}
        {isActive && (
          <div className="absolute top-0 left-0 w-full h-2 rounded-full overflow-hidden">
            <div className="h-full bg-white opacity-30 animate-pulse" />
          </div>
        )}
      </div>

      {/* Status and percentage */}
      <div className="flex items-center justify-between text-xs text-gray-600">
        <div className="flex-1">
          {errorMessage && status === 'error' ? (
            <span className="text-red-600">{errorMessage}</span>
          ) : (
            <span>{statusMessage || ''}</span>
          )}
        </div>
        
        {showPercentage && (
          <span className="ml-2 font-mono">
            {displayProgress.toFixed(0)}%
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * Circular progress indicator component
 * 
 * Shows progress as a circular indicator with optional center content.
 * 
 * @example
 * ```tsx
 * <CircularProgress
 *   progress={75}
 *   status="running"
 *   size={64}
 *   label="Exporting PDF"
 * />
 * ```
 */
export function CircularProgress({
  progress,
  status,
  label,
  statusMessage,
  errorMessage,
  cancellable = false,
  onCancel,
  showPercentage = true,
  className = '',
  size = 48,
  strokeWidth = 4
}: BaseProgressProps & {
  /** Size of the circular progress in pixels */
  size?: number;
  /** Stroke width of the progress ring */
  strokeWidth?: number;
}) {
  const getStatusColor = () => {
    switch (status) {
      case 'completed':
        return 'stroke-green-500';
      case 'error':
        return 'stroke-red-500';
      case 'cancelled':
        return 'stroke-gray-500';
      default:
        return 'stroke-blue-500';
    }
  };

  const getStatusIcon = () => {
    const iconSize = Math.max(16, size * 0.4);
    
    switch (status) {
      case 'running':
        return <Loader2 className={`animate-spin`} style={{ width: iconSize, height: iconSize }} />;
      case 'completed':
        return <CheckCircle className="text-green-500" style={{ width: iconSize, height: iconSize }} />;
      case 'error':
        return <AlertCircle className="text-red-500" style={{ width: iconSize, height: iconSize }} />;
      case 'cancelled':
        return <X className="text-gray-500" style={{ width: iconSize, height: iconSize }} />;
      default:
        return null;
    }
  };

  const displayProgress = Math.max(0, Math.min(100, progress));
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDasharray = circumference;
  const strokeDashoffset = circumference - (displayProgress / 100) * circumference;

  return (
    <div className={`flex flex-col items-center space-y-2 ${className}`}>
      {/* Circular progress */}
      <div className="relative" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          className="transform -rotate-90"
        >
          {/* Background circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="currentColor"
            strokeWidth={strokeWidth}
            fill="none"
            className="text-gray-200"
          />
          
          {/* Progress circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="currentColor"
            strokeWidth={strokeWidth}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={strokeDasharray}
            strokeDashoffset={strokeDashoffset}
            className={`transition-all duration-300 ${getStatusColor()}`}
          />
        </svg>
        
        {/* Center content */}
        <div className="absolute inset-0 flex items-center justify-center">
          {status === 'running' || status === 'idle' ? (
            showPercentage ? (
              <span className="text-xs font-mono text-gray-700">
                {displayProgress.toFixed(0)}%
              </span>
            ) : null
          ) : (
            getStatusIcon()
          )}
        </div>
        
        {/* Cancel button */}
        {cancellable && onCancel && status === 'running' && (
          <button
            onClick={onCancel}
            className="absolute -top-1 -right-1 bg-white rounded-full shadow-sm p-1 text-gray-500 hover:text-gray-700"
            title="Cancel operation"
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* Label and status */}
      {(label || statusMessage || errorMessage) && (
        <div className="text-center">
          {label && (
            <div className="text-sm font-medium text-gray-700">
              {label}
            </div>
          )}
          
          {errorMessage && status === 'error' ? (
            <div className="text-xs text-red-600 mt-1">
              {errorMessage}
            </div>
          ) : statusMessage ? (
            <div className="text-xs text-gray-600 mt-1">
              {statusMessage}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

/**
 * Multi-step progress indicator
 * 
 * Shows progress across multiple steps with individual step status.
 * 
 * @example
 * ```tsx
 * <MultiStepProgress
 *   steps={[
 *     { label: 'Import Files', status: 'completed' },
 *     { label: 'Extract Cards', status: 'running', progress: 60 },
 *     { label: 'Generate PDF', status: 'pending' }
 *   ]}
 *   currentStep={1}
 * />
 * ```
 */
export function MultiStepProgress({
  steps,
  currentStep,
  className = ''
}: {
  steps: Array<{
    label: string;
    status: 'pending' | 'running' | 'completed' | 'error';
    progress?: number;
  }>;
  currentStep: number;
  className?: string;
}) {
  return (
    <div className={`w-full ${className}`}>
      <div className="flex items-center">
        {steps.map((step, index) => (
          <React.Fragment key={index}>
            {/* Step indicator */}
            <div className="flex flex-col items-center">
              <div className={`
                w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium
                ${step.status === 'completed' ? 'bg-green-500 text-white' :
                  step.status === 'running' ? 'bg-blue-500 text-white' :
                  step.status === 'error' ? 'bg-red-500 text-white' :
                  'bg-gray-200 text-gray-600'}
              `}>
                {step.status === 'completed' ? (
                  <CheckCircle className="w-5 h-5" />
                ) : step.status === 'running' ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : step.status === 'error' ? (
                  <AlertCircle className="w-5 h-5" />
                ) : (
                  <span>{index + 1}</span>
                )}
              </div>
              
              <div className="mt-2 text-xs text-center max-w-20">
                <div className={`font-medium ${
                  step.status === 'running' ? 'text-blue-600' :
                  step.status === 'completed' ? 'text-green-600' :
                  step.status === 'error' ? 'text-red-600' :
                  'text-gray-600'
                }`}>
                  {step.label}
                </div>
                
                {step.status === 'running' && step.progress !== undefined && (
                  <div className="text-gray-500 mt-1">
                    {step.progress.toFixed(0)}%
                  </div>
                )}
              </div>
            </div>
            
            {/* Connector line */}
            {index < steps.length - 1 && (
              <div className={`
                flex-1 h-0.5 mx-4
                ${index < currentStep ? 'bg-green-500' : 'bg-gray-200'}
              `} />
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

/**
 * Batch operation progress indicator
 * 
 * Shows progress for operations processing multiple items.
 * 
 * @example
 * ```tsx
 * <BatchProgress
 *   totalItems={50}
 *   completedItems={32}
 *   failedItems={1}
 *   currentItem="Processing page 33"
 *   onCancel={() => cancelBatch()}
 * />
 * ```
 */
export function BatchProgress({
  totalItems,
  completedItems,
  failedItems = 0,
  currentItem,
  cancellable = false,
  onCancel,
  className = ''
}: {
  totalItems: number;
  completedItems: number;
  failedItems?: number;
  currentItem?: string;
  cancellable?: boolean;
  onCancel?: () => void;
  className?: string;
}) {
  const remainingItems = totalItems - completedItems - failedItems;
  const progress = (completedItems / totalItems) * 100;
  const hasErrors = failedItems > 0;

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Loader2 className="animate-spin w-4 h-4 text-blue-500" />
          <span className="text-sm font-medium text-gray-700">
            Processing Items
          </span>
        </div>
        
        {cancellable && onCancel && (
          <button
            onClick={onCancel}
            className="text-gray-500 hover:text-gray-700 p-1"
            title="Cancel batch operation"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Progress bar */}
      <div className="relative">
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="h-2 bg-blue-500 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Stats */}
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center space-x-4">
          <span className="text-green-600">
            ✓ {completedItems} completed
          </span>
          
          {hasErrors && (
            <span className="text-red-600">
              ✗ {failedItems} failed
            </span>
          )}
          
          <span className="text-gray-600">
            {remainingItems} remaining
          </span>
        </div>
        
        <span className="font-mono text-gray-700">
          {completedItems}/{totalItems}
        </span>
      </div>

      {/* Current item */}
      {currentItem && (
        <div className="text-xs text-gray-600 truncate">
          {currentItem}
        </div>
      )}
    </div>
  );
}

export default LinearProgress;