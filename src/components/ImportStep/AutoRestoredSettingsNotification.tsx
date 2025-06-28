import React from 'react';
import { RotateCcwIcon, UploadIcon } from 'lucide-react';

interface AutoRestoredSettingsNotificationProps {
  isVisible: boolean;
  onResetToDefaults: () => void;
  onTriggerImportSettings: () => void;
}

/**
 * Notification component for automatically restored workflow settings
 * 
 * Displays when settings have been automatically restored from a previous session,
 * giving users options to reset to defaults or import different settings.
 */
export const AutoRestoredSettingsNotification: React.FC<AutoRestoredSettingsNotificationProps> = ({
  isVisible,
  onResetToDefaults,
  onTriggerImportSettings
}) => {
  if (!isVisible) {
    return null;
  }

  return (
    <div className="p-4 bg-blue-50 border border-blue-200 rounded-md">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h4 className="text-sm font-medium text-blue-800 mb-1">
            Settings Automatically Restored
          </h4>
          <p className="text-xs text-blue-700 mb-3">
            Your previous workflow settings have been automatically applied. 
            This includes PDF mode, extraction settings, output configuration, and color calibration.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={onResetToDefaults}
              className="inline-flex items-center px-3 py-1 text-xs bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              <RotateCcwIcon size={12} className="mr-1" />
              Reset to Defaults
            </button>
            <button
              onClick={onTriggerImportSettings}
              className="inline-flex items-center px-3 py-1 text-xs bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
            >
              <UploadIcon size={12} className="mr-1" />
              Import Different Settings
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};