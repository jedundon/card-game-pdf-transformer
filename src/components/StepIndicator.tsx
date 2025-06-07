import React, { Fragment } from 'react';
interface StepIndicatorProps {
  steps: string[];
  currentStep: number;
}
export const StepIndicator: React.FC<StepIndicatorProps> = ({
  steps,
  currentStep
}) => {
  return <div className="flex items-center justify-between w-full max-w-3xl mx-auto">
      {steps.map((step, index) => <Fragment key={index}>
          <div className="flex flex-col items-center">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${index <= currentStep ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'}`}>
              {index + 1}
            </div>
            <span className={`mt-2 text-sm ${index <= currentStep ? 'text-blue-600 font-medium' : 'text-gray-500'}`}>
              {step}
            </span>
          </div>
          {index < steps.length - 1 && <div className={`flex-1 h-1 mx-2 ${index < currentStep ? 'bg-blue-600' : 'bg-gray-200'}`} />}
        </Fragment>)}
    </div>;
};