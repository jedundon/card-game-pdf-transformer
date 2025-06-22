import React, { useState, useRef, useEffect } from 'react';
import { SaveIcon, UploadIcon, SettingsIcon, TrashIcon, HardDriveIcon } from 'lucide-react';
import { WorkflowSettings, getDefaultSettingsForMode } from '../defaults';
import { 
  clearLocalStorageSettings, 
  hasAutoSavedSettings, 
  getAutoSaveTimestamp 
} from '../utils/localStorageUtils';

interface ImportExportManagerProps {
  pdfMode: any;
  pageSettings: any;
  extractionSettings: any;
  outputSettings: any;
  colorSettings: any;
  currentPdfFileName?: string;
  onLoadSettings: (settings: any) => void;
  onTriggerImportRef?: (triggerFn: () => void) => void;
}

export const ImportExportManager: React.FC<ImportExportManagerProps> = ({
  pdfMode,
  pageSettings,
  extractionSettings,
  outputSettings,
  colorSettings,
  currentPdfFileName,
  onLoadSettings,
  onTriggerImportRef
}) => {
  const [settingsFileName, setSettingsFileName] = useState<string>('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Expose the trigger function to parent components
  useEffect(() => {
    if (onTriggerImportRef) {
      onTriggerImportRef(() => fileInputRef.current?.click());
    }
  }, [onTriggerImportRef]);

  // Generate default filename based on PDF name
  const getDefaultFileName = () => {
    if (currentPdfFileName) {
      // Remove .pdf extension and add .json
      return currentPdfFileName.replace(/\.pdf$/i, '_settings.json');
    }
    return 'workflow_settings.json';
  };

  // Create settings object to save (excluding PDF name and data)
  const createSettingsObject = (): WorkflowSettings => {
    return {
      pdfMode,
      pageSettings,
      extractionSettings,
      outputSettings,
      colorSettings,
      savedAt: new Date().toISOString(),
      version: '1.0'
    };
  };
  // Save settings to JSON file - always uses current PDF filename as base
  const handleSaveSettings = () => {
    const settings = createSettingsObject();
    // Always use current PDF filename as base, ignore any previously set settingsFileName
    const defaultFileName = getDefaultFileName();
    const fileName = settingsFileName.trim() || defaultFileName;
    
    const dataStr = JSON.stringify(settings, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = fileName.endsWith('.json') ? fileName : `${fileName}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
    
    // Clear the custom filename after saving so next save uses current PDF name again
    setSettingsFileName('');
  };
  // Load settings from JSON file
  const handleLoadSettings = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const text = await file.text();
        const settings: WorkflowSettings = JSON.parse(text);
        
        // Validate the settings structure
        if (settings.pdfMode && settings.extractionSettings && settings.outputSettings) {
          onLoadSettings(settings);
          // Don't update settingsFileName - keep it clear so saves default to current PDF name
        } else {
          alert('Invalid settings file format');
        }
      } catch (error) {
        console.error('Error loading settings:', error);
        alert('Error loading settings file. Please check the file format.');
      }
    }
    
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };  
  
  // Clear auto-saved settings
  const handleClearAutoSave = () => {
    clearLocalStorageSettings();
    setAutoSaveStatus('Auto-saved settings cleared');
    setTimeout(() => setAutoSaveStatus(''), 3000);
  };

  // Get auto-save info
  const getAutoSaveInfo = () => {
    if (hasAutoSavedSettings()) {
      const timestamp = getAutoSaveTimestamp();
      if (timestamp) {
        const date = new Date(timestamp);
        return `Last auto-saved: ${date.toLocaleString()}`;
      }
      return 'Auto-saved settings available';
    }
    return 'No auto-saved settings';
  };

  // Reset to default values with mode-specific grid
  const handleResetToDefaults = () => {
    const defaultsForCurrentMode = getDefaultSettingsForMode(pdfMode);
    onLoadSettings(defaultsForCurrentMode);
  };

  return (
    <div className="border border-gray-200 rounded-lg bg-gray-50">
      <div 
        className="p-3 cursor-pointer hover:bg-gray-100 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <SettingsIcon size={16} className="text-gray-600" />
            <span className="text-sm font-medium text-gray-700">
              Import/Export Settings
            </span>
          </div>
          <div className="text-xs text-gray-500">
            {isExpanded ? 'Hide' : 'Show'} settings controls
          </div>
        </div>
      </div>
      
      {isExpanded && (
        <div className="p-4 border-t border-gray-200 space-y-4">
          {/* Auto-save Status */}
          <div className="bg-blue-50 p-3 rounded-md">
            <div className="flex items-center space-x-2 mb-2">
              <HardDriveIcon size={16} className="text-blue-600" />
              <span className="text-sm font-medium text-blue-800">Auto-save Status</span>
            </div>
            <p className="text-xs text-blue-700">{getAutoSaveInfo()}</p>
            {autoSaveStatus && (
              <p className="text-xs text-green-700 mt-1 font-medium">{autoSaveStatus}</p>
            )}
            <p className="text-xs text-blue-600 mt-2">
              Settings are automatically saved to your browser and restored when you return.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Custom Settings File Name (Optional)
              </label>
              <input
                type="text"
                placeholder={getDefaultFileName()}
                value={settingsFileName}
                onChange={(e) => setSettingsFileName(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              />
              <p className="text-xs text-gray-500 mt-1">
                Leave empty to always use current PDF filename: <strong>{getDefaultFileName()}</strong>
              </p>
            </div>
            
            <div className="space-y-2">
              <div className="text-sm font-medium text-gray-700 mb-2">
                File Operations
              </div>
              <div className="flex flex-col space-y-2">
                <button
                  onClick={handleSaveSettings}
                  className="flex items-center justify-center bg-blue-600 text-white px-3 py-2 rounded-md hover:bg-blue-700 text-sm"
                >
                  <SaveIcon size={14} className="mr-2" />
                  Export Settings to File
                </button>
                
                <div className="relative">
                  <input
                    type="file"
                    accept=".json"
                    className="hidden"
                    ref={fileInputRef}
                    onChange={handleLoadSettings}
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full flex items-center justify-center bg-green-600 text-white px-3 py-2 rounded-md hover:bg-green-700 text-sm"
                  >
                    <UploadIcon size={14} className="mr-2" />
                    Import Settings from File
                  </button>
                </div>
                
                <div className="border-t pt-2 mt-2">
                  <div className="text-xs font-medium text-gray-600 mb-2">
                    Auto-save Controls
                  </div>
                  <button
                    onClick={handleClearAutoSave}
                    className="w-full flex items-center justify-center bg-orange-600 text-white px-3 py-2 rounded-md hover:bg-orange-700 text-sm"
                    disabled={!hasAutoSavedSettings()}
                  >
                    <TrashIcon size={14} className="mr-2" />
                    Clear Auto-saved Settings
                  </button>
                </div>
                
                <div className="border-t pt-2 mt-2">
                  <button
                    onClick={handleResetToDefaults}
                    className="w-full flex items-center justify-center bg-gray-500 text-white px-3 py-2 rounded-md hover:bg-gray-600 text-sm"
                  >
                    Reset to Defaults
                  </button>
                </div>
              </div>
            </div>
          </div>
            <div className="text-xs text-gray-600 bg-gray-50 p-3 rounded-md">
            <p className="font-medium mb-1">File Import/Export includes:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>PDF mode and orientation settings</li>
              <li>Page configuration (skip/type settings)</li>
              <li>Card extraction settings (crop margins and grid)</li>
              <li>Output layout settings (page size, offsets, rotation)</li>
              <li>Color calibration settings (adjustments and presets)</li>
            </ul>
            <p className="mt-2 font-medium">Auto-save Features:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Settings automatically saved to browser storage</li>
              <li>Restored when you reload or return to the page</li>
              <li>Survives browser refresh and prevents data loss</li>
              <li>Can be cleared manually for privacy</li>
            </ul>
            <p className="mt-2 font-medium">Notes:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>PDF file data is never saved (files or auto-save)</li>
              <li>Imported settings override auto-saved settings</li>
              <li>Files download to your browser's default Downloads folder</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};
