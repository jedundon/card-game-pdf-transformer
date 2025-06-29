import React, { Fragment } from 'react';

interface StepIndicatorProps {
  steps: string[];
  currentStep: number;
  onStepClick?: (stepIndex: number) => void;
  isPdfLoaded?: boolean;
}
export const StepIndicator: React.FC<StepIndicatorProps> = ({
  steps,
  currentStep,
  onStepClick,
  isPdfLoaded = false
}) => {
  const isStepClickable = (stepIndex: number): boolean => {
    // Step 0 (Import) is always accessible
    if (stepIndex === 0) return true;
    // Steps 1-4 only accessible when PDF/files are loaded
    return isPdfLoaded;
  };

  const handleStepClick = (stepIndex: number) => {
    if (isStepClickable(stepIndex) && onStepClick) {
      onStepClick(stepIndex);
    }
  };
  return <div className="flex items-center justify-between w-full max-w-3xl mx-auto">
      {steps.map((step, index) => <Fragment key={index}>
          <div 
            className={`flex flex-col items-center ${
              isStepClickable(index) 
                ? 'cursor-pointer hover:opacity-80 transition-opacity' 
                : 'cursor-default'
            } ${!isStepClickable(index) ? 'opacity-50' : ''}`}
            onClick={() => handleStepClick(index)}
            onKeyDown={(e) => {
              if ((e.key === 'Enter' || e.key === ' ') && isStepClickable(index)) {
                e.preventDefault();
                handleStepClick(index);
              }
            }}
            tabIndex={isStepClickable(index) ? 0 : -1}
            role={isStepClickable(index) ? 'button' : 'presentation'}
            aria-label={isStepClickable(index) ? `Go to ${step}` : `${step} (requires PDF to be loaded)`}
            aria-disabled={!isStepClickable(index)}
          >
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
              index <= currentStep ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'
            }`}>
              {index + 1}
            </div>
            <span className={`mt-2 text-sm ${
              index <= currentStep ? 'text-blue-600 font-medium' : 'text-gray-500'
            }`}>
              {step}
            </span>
          </div>
          {index < steps.length - 1 && <div className={`flex-1 h-1 mx-2 ${index < currentStep ? 'bg-blue-600' : 'bg-gray-200'}`} />}
        </Fragment>)}
    </div>;
};