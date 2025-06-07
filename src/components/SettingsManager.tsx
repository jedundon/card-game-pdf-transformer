import React, { useState, useRef } from 'react';
import { SaveIcon, UploadIcon, SettingsIcon } from 'lucide-react';

interface SettingsManagerProps {
  pdfMode: any;
  pageSettings: any;
  extractionSettings: any;
  outputSettings: any;
  currentPdfFileName?: string;
  onLoadSettings: (settings: any) => void;
}

interface WorkflowSettings {
  pdfMode: any;
  pageSettings: any;
  extractionSettings: any;
  outputSettings: any;
  savedAt: string;
  version: string;
}

export const SettingsManager: React.FC<SettingsManagerProps> = ({
  pdfMode,
  pageSettings,
  extractionSettings,
  outputSettings,
  currentPdfFileName,
  onLoadSettings
}) => {
  const [settingsFileName, setSettingsFileName] = useState<string>('');
  const [isExpanded, setIsExpanded] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  // Reset to default values
  const handleResetToDefaults = () => {
    const defaultSettings = {
      pdfMode: {
        type: 'duplex',
        orientation: 'vertical',
        flipEdge: 'short'
      },
      pageSettings: [],
      extractionSettings: {
        crop: {
          top: 0,
          right: 0,
          bottom: 0,
          left: 0
        },
        grid: {
          rows: 3,
          columns: 3
        }
      },
      outputSettings: {
        pageSize: {
          width: 3.5,
          height: 3.5
        },
        offset: {
          horizontal: 0,
          vertical: 0
        },
        crop: {
          top: 0,
          right: 0,
          bottom: 0,
          left: 0
        },
        rotation: 0
      }
    };
    
    onLoadSettings(defaultSettings);
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
              Workflow Settings
            </span>
          </div>
          <div className="text-xs text-gray-500">
            {isExpanded ? 'Hide' : 'Show'} settings controls
          </div>
        </div>
      </div>
      
      {isExpanded && (
        <div className="p-4 border-t border-gray-200 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">            <div>
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
                Quick Actions
              </div>
              <div className="flex flex-col space-y-2">
                <button
                  onClick={handleSaveSettings}
                  className="flex items-center justify-center bg-blue-600 text-white px-3 py-2 rounded-md hover:bg-blue-700 text-sm"
                >
                  <SaveIcon size={14} className="mr-2" />
                  Save Settings
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
                    Load Settings
                  </button>
                </div>
                
                <button
                  onClick={handleResetToDefaults}
                  className="flex items-center justify-center bg-gray-500 text-white px-3 py-2 rounded-md hover:bg-gray-600 text-sm"
                >
                  Reset to Defaults
                </button>
              </div>
            </div>
          </div>
            <div className="text-xs text-gray-600 bg-blue-50 p-3 rounded-md">
            <p className="font-medium mb-1">Settings include:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>PDF mode and orientation settings</li>
              <li>Page configuration (skip/type settings)</li>
              <li>Card extraction settings (crop margins and grid)</li>
              <li>Output layout settings (page size, offsets, rotation)</li>
            </ul>
            <p className="mt-2 font-medium">Notes:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>PDF file data is not saved in settings</li>
              <li>Save always defaults to current PDF filename</li>
              <li>Files download to your browser's default Downloads folder</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};
