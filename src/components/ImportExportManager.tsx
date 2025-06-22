import React, { useState, useRef, useEffect } from 'react';
import { SaveIcon, UploadIcon, SettingsIcon, TrashIcon, HardDriveIcon, ChevronDownIcon, ChevronUpIcon } from 'lucide-react';
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
  const [showDocumentation, setShowDocumentation] = useState(false);
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
        <div className="p-3 border-t border-gray-200 space-y-3">
          {/* Compact Auto-save Status */}
          <div className="bg-blue-50 p-2 rounded-md">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <HardDriveIcon size={14} className="text-blue-600" />
                <span className="text-xs font-medium text-blue-800">Auto-save:</span>
                <span className="text-xs text-blue-700">{getAutoSaveInfo()}</span>
              </div>
              {autoSaveStatus && (
                <span className="text-xs text-green-700 font-medium">{autoSaveStatus}</span>
              )}
            </div>
          </div>

          {/* Main Controls Grid - 3 columns for better space usage */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            {/* Column 1: File Name Input */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Custom File Name
              </label>
              <input
                type="text"
                placeholder={getDefaultFileName()}
                value={settingsFileName}
                onChange={(e) => setSettingsFileName(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-xs"
              />
              <p className="text-xs text-gray-500 mt-1">
                Default: <strong>{getDefaultFileName()}</strong>
              </p>
            </div>
            
            {/* Column 2: File Operations */}
            <div>
              <div className="text-xs font-medium text-gray-700 mb-1">
                File Operations
              </div>
              <div className="space-y-1.5">
                <button
                  onClick={handleSaveSettings}
                  className="w-full flex items-center justify-center bg-blue-600 text-white px-2 py-1.5 rounded-md hover:bg-blue-700 text-xs"
                >
                  <SaveIcon size={12} className="mr-1.5" />
                  Export Settings
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
                    className="w-full flex items-center justify-center bg-green-600 text-white px-2 py-1.5 rounded-md hover:bg-green-700 text-xs"
                  >
                    <UploadIcon size={12} className="mr-1.5" />
                    Import Settings
                  </button>
                </div>
              </div>
            </div>
            
            {/* Column 3: System Operations */}
            <div>
              <div className="text-xs font-medium text-gray-700 mb-1">
                System Controls
              </div>
              <div className="space-y-1.5">
                <button
                  onClick={handleClearAutoSave}
                  className="w-full flex items-center justify-center bg-orange-600 text-white px-2 py-1.5 rounded-md hover:bg-orange-700 text-xs disabled:bg-gray-400"
                  disabled={!hasAutoSavedSettings()}
                >
                  <TrashIcon size={12} className="mr-1.5" />
                  Clear Auto-save
                </button>
                
                <button
                  onClick={handleResetToDefaults}
                  className="w-full flex items-center justify-center bg-gray-500 text-white px-2 py-1.5 rounded-md hover:bg-gray-600 text-xs"
                >
                  Reset to Defaults
                </button>
              </div>
            </div>
          </div>

          {/* Collapsible Documentation */}
          <div className="border-t pt-2">
            <button
              onClick={() => setShowDocumentation(!showDocumentation)}
              className="flex items-center justify-between w-full text-xs text-gray-600 hover:text-gray-800 transition-colors"
            >
              <span className="font-medium">Documentation & Details</span>
              {showDocumentation ? (
                <ChevronUpIcon size={14} />
              ) : (
                <ChevronDownIcon size={14} />
              )}
            </button>
            
            {showDocumentation && (
              <div className="mt-2 text-xs text-gray-600 bg-gray-50 p-2 rounded-md space-y-2">
                <div>
                  <p className="font-medium mb-1">Import/Export includes:</p>
                  <p className="text-xs leading-relaxed">
                    PDF mode & orientation, page configuration, extraction settings, output layout, and color calibration.
                  </p>
                </div>
                <div>
                  <p className="font-medium mb-1">Auto-save:</p>
                  <p className="text-xs leading-relaxed">
                    Settings saved to browser storage, restored on page reload. PDF data never saved.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
