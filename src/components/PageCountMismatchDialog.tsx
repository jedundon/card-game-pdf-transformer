import React from 'react';
import { AlertTriangleIcon, XIcon, CheckIcon, FileTextIcon } from 'lucide-react';

interface PageCountMismatchDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onProceed: () => void;
  currentPdfPageCount: number;
  importedSettingsPageCount: number;
  appliedSettings: string[];
  skippedSettings: string[];
}

export const PageCountMismatchDialog: React.FC<PageCountMismatchDialogProps> = ({
  isOpen,
  onClose,
  onProceed,
  currentPdfPageCount,
  importedSettingsPageCount,
  appliedSettings,
  skippedSettings
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-yellow-50">
          <div className="flex items-center">
            <div className="flex-shrink-0 w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center mr-3">
              <AlertTriangleIcon size={20} className="text-yellow-600" />
            </div>
            <h3 className="text-lg font-semibold text-yellow-800">
              Page Count Mismatch
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <XIcon size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto">
          <div className="mb-4">
            <p className="text-gray-700 text-sm leading-relaxed">
              The settings you're importing were created for a PDF with a different number of pages than your current PDF.
            </p>
          </div>

          {/* Page Count Comparison */}
          <div className="bg-gray-50 rounded-lg p-3 mb-4">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center">
                <FileTextIcon size={16} className="text-gray-500 mr-2" />
                <span className="text-gray-600">Current PDF:</span>
              </div>
              <span className="font-semibold text-gray-900">
                {currentPdfPageCount} pages
              </span>
            </div>
            <div className="flex items-center justify-between text-sm mt-2">
              <div className="flex items-center">
                <FileTextIcon size={16} className="text-gray-500 mr-2" />
                <span className="text-gray-600">Imported settings:</span>
              </div>
              <span className="font-semibold text-gray-900">
                {importedSettingsPageCount} pages
              </span>
            </div>
          </div>

          {/* Applied Settings */}
          {appliedSettings.length > 0 && (
            <div className="mb-4">
              <h4 className="text-sm font-medium text-green-800 mb-2 flex items-center">
                <CheckIcon size={16} className="mr-2 text-green-600" />
                Successfully Applied Settings
              </h4>
              <div className="bg-green-50 rounded-md p-3">
                <ul className="text-sm text-green-700 space-y-1">
                  {appliedSettings.map((setting, index) => (
                    <li key={index} className="flex items-start">
                      <span className="text-green-500 mr-2">•</span>
                      {setting}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Skipped Settings */}
          {skippedSettings.length > 0 && (
            <div className="mb-4">
              <h4 className="text-sm font-medium text-yellow-800 mb-2 flex items-center">
                <AlertTriangleIcon size={16} className="mr-2 text-yellow-600" />
                Skipped Settings
              </h4>
              <div className="bg-yellow-50 rounded-md p-3">
                <ul className="text-sm text-yellow-700 space-y-1">
                  {skippedSettings.map((setting, index) => (
                    <li key={index} className="flex items-start">
                      <span className="text-yellow-500 mr-2">•</span>
                      {setting}
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-yellow-600 mt-2 italic">
                  These settings require the same number of pages as the original PDF.
                </p>
              </div>
            </div>
          )}

          {/* Explanation */}
          <div className="bg-blue-50 rounded-lg p-3 mb-4">
            <h4 className="text-sm font-medium text-blue-800 mb-2">
              What does this mean?
            </h4>
            <div className="text-sm text-blue-700 space-y-2">
              <p>
                Settings like PDF mode, extraction grid, and output configuration have been successfully imported and will work with your current PDF.
              </p>
              <p>
                However, page-specific settings (like which pages to skip or individual page types) couldn't be imported because they depend on the exact page structure of the original PDF.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end space-x-3 p-4 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 transition-colors"
          >
            Cancel Import
          </button>
          <button
            onClick={onProceed}
            className="px-4 py-2 text-sm text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
          >
            Continue with Compatible Settings
          </button>
        </div>
      </div>
    </div>
  );
};