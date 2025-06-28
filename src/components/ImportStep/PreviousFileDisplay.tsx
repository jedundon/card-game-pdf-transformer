import React from 'react';
import { ClockIcon, XIcon } from 'lucide-react';
import { LastImportedFileInfo, formatFileSize, formatImportTimestamp } from '../../utils/localStorageUtils';

interface PreviousFileDisplayProps {
  lastImportedFileInfo: LastImportedFileInfo | null;
  hasCurrentData: boolean;
  onClearLastImportedFile: () => void;
}

/**
 * Display component for previously imported file information
 * 
 * Shows a notification about the last imported file when no current data is loaded,
 * including file name, size, timestamp, and a clear button.
 */
export const PreviousFileDisplay: React.FC<PreviousFileDisplayProps> = ({
  lastImportedFileInfo,
  hasCurrentData,
  onClearLastImportedFile
}) => {
  // Don't show if no previous file info or if current data is already loaded
  if (!lastImportedFileInfo || hasCurrentData) {
    return null;
  }

  return (
    <div className="p-4 bg-blue-50 border border-blue-200 rounded-md">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center mb-2">
            <ClockIcon size={16} className="text-blue-600 mr-2" />
            <h4 className="text-sm font-medium text-blue-800">
              Previously Imported File
            </h4>
          </div>
          <div className="mb-2">
            <p className="text-sm font-medium text-blue-900 mb-1">
              {lastImportedFileInfo.name}
            </p>
            <p className="text-xs text-blue-700">
              {formatFileSize(lastImportedFileInfo.size)} • {formatImportTimestamp(lastImportedFileInfo.importTimestamp)}
            </p>
          </div>
          <p className="text-xs text-blue-600">
            Upload the same file or choose a different one to continue working.
          </p>
        </div>
        <button
          onClick={onClearLastImportedFile}
          className="ml-3 flex-shrink-0 p-1 text-blue-400 hover:text-blue-600 hover:bg-blue-100 rounded transition-colors"
          title="Clear previous file info"
        >
          <XIcon size={16} />
        </button>
      </div>
    </div>
  );
};