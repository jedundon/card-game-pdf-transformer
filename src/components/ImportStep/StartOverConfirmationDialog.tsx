import React from 'react';

interface StartOverConfirmationDialogProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Confirmation dialog for starting over the import process
 * 
 * This modal dialog warns the user about the destructive nature of starting over
 * and provides clear confirmation/cancellation options.
 */
export const StartOverConfirmationDialog: React.FC<StartOverConfirmationDialogProps> = ({
  isOpen,
  onConfirm,
  onCancel
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg p-6 max-w-md mx-4 shadow-xl">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Start Over?</h3>
        <p className="text-gray-600 mb-4">
          This will remove all imported files and reset your workflow. You'll need to re-import your files and reconfigure any settings.
        </p>
        <div className="flex justify-end space-x-3">
          <button 
            onClick={onCancel}
            className="px-4 py-2 text-gray-600 hover:text-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 rounded transition-colors"
          >
            Cancel
          </button>
          <button 
            onClick={onConfirm}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors"
          >
            Start Over
          </button>
        </div>
      </div>
    </div>
  );
};