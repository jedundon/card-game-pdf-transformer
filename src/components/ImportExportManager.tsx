import React, { useState, useRef, useEffect } from 'react';
import { SaveIcon, UploadIcon, SettingsIcon, TrashIcon, HardDriveIcon, ChevronDownIcon, ChevronUpIcon, EditIcon } from 'lucide-react';
import { WorkflowSettings, getDefaultSettingsForMode } from '../defaults';
import { 
  clearLocalStorageSettings, 
  hasAutoSavedSettings, 
  getAutoSaveTimestamp 
} from '../utils/localStorageUtils';
import { PdfMode, PageSettings, ExtractionSettings, OutputSettings, ColorSettings } from '../types';
import { AutoRestoredSettingsNotification } from './ImportStep/AutoRestoredSettingsNotification';
import { UseMultiFileImportReturn } from '../hooks/useMultiFileImport';

interface ImportExportManagerProps {
  pdfMode: PdfMode;
  pageSettings: PageSettings[];
  extractionSettings: ExtractionSettings;
  outputSettings: OutputSettings;
  colorSettings: ColorSettings;
  currentPdfFileName?: string;
  multiFileImport?: UseMultiFileImportReturn;
  onLoadSettings: (settings: WorkflowSettings) => void;
  onTriggerImportRef?: (triggerFn: () => void) => void;
  autoRestoredSettings?: boolean;
  onResetToDefaults?: () => void;
  onTriggerImportSettings?: () => void;
}

export const ImportExportManager: React.FC<ImportExportManagerProps> = ({
  pdfMode,
  pageSettings,
  extractionSettings,
  outputSettings,
  colorSettings,
  currentPdfFileName,
  multiFileImport,
  onLoadSettings,
  onTriggerImportRef,
  autoRestoredSettings,
  onResetToDefaults,
  onTriggerImportSettings
}) => {
  const [settingsFileName, setSettingsFileName] = useState<string>('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [showDocumentation, setShowDocumentation] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState<string>('');
  const [showFilenamePrompt, setShowFilenamePrompt] = useState(false);
  const [promptedFileName, setPromptedFileName] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Expose the trigger function to parent components
  useEffect(() => {
    if (onTriggerImportRef) {
      const triggerFn = () => {
        // Must call click() synchronously to maintain user activation
        if (fileInputRef.current) {
          fileInputRef.current.click();
        } else {
          console.warn('File input ref not available when triggering import');
        }
      };
      onTriggerImportRef(triggerFn);
    }
  }, [onTriggerImportRef]);

  // Generate default filename based on imported files
  const getDefaultFileName = () => {
    // Check for multi-file import data first
    if (multiFileImport) {
      const files = multiFileImport.getFileList();
      if (files.length > 0) {
        if (files.length === 1) {
          // Single file - use the same logic as before
          const fileName = files[0].name;
          const nameWithoutExt = fileName.replace(/\.(pdf|png|jpg|jpeg)$/i, '');
          return `${nameWithoutExt}_settings.json`;
        } else {
          // Multiple files - create smart name
          const firstFileName = files[0].name.replace(/\.(pdf|png|jpg|jpeg)$/i, '');
          const remainingCount = files.length - 1;
          // Truncate first filename if too long to keep total reasonable
          const truncatedFirst = firstFileName.length > 20 
            ? firstFileName.substring(0, 20) + '...'
            : firstFileName;
          return `${truncatedFirst}_and_${remainingCount}_others_settings.json`;
        }
      }
    }
    
    // Fallback to single PDF filename
    if (currentPdfFileName) {
      // Remove .pdf extension and add .json
      return currentPdfFileName.replace(/\.pdf$/i, '_settings.json');
    }
    
    // Final fallback
    return 'workflow_settings.json';
  };

  // Create settings object to save (excluding PDF name and data)
  const createSettingsObject = (): WorkflowSettings => {
    // Transform ColorSettings to match WorkflowSettings structure
    const transformedColorSettings = {
      selectedRegion: colorSettings.selectedRegion ? {
        x: colorSettings.selectedRegion.centerX - colorSettings.selectedRegion.width / 2,
        y: colorSettings.selectedRegion.centerY - colorSettings.selectedRegion.height / 2,
        width: colorSettings.selectedRegion.width,
        height: colorSettings.selectedRegion.height,
        pageIndex: colorSettings.selectedRegion.pageIndex ?? 0
      } : null,
      gridConfig: colorSettings.gridConfig,
      transformations: colorSettings.transformations,
      selectedPreset: colorSettings.selectedPreset ? {
        name: colorSettings.selectedPreset,
        values: colorSettings.finalAdjustments
      } : null,
      finalAdjustments: colorSettings.finalAdjustments
    };

    // Ensure extractionSettings has all required fields
    const transformedExtractionSettings = {
      crop: extractionSettings.crop,
      grid: extractionSettings.grid,
      gutterWidth: extractionSettings.gutterWidth ?? 0.5,
      cardCrop: extractionSettings.cardCrop ?? { top: 0, right: 0, bottom: 0, left: 0 },
      imageRotation: extractionSettings.imageRotation ?? { front: 0, back: 0 },
      skippedCards: extractionSettings.skippedCards ?? [],
      cardTypeOverrides: extractionSettings.cardTypeOverrides ?? []
    };

    return {
      pdfMode,
      pageSettings,
      extractionSettings: transformedExtractionSettings,
      outputSettings,
      colorSettings: transformedColorSettings,
      savedAt: new Date().toISOString(),
      version: '1.0'
    };
  };

  // Handle save with filename prompt
  const handleSaveSettingsWithPrompt = () => {
    const defaultFileName = getDefaultFileName().replace('.json', '');
    setPromptedFileName(defaultFileName);
    setShowFilenamePrompt(true);
  };

  // Handle saving with prompted filename
  const handleConfirmPromptedSave = () => {
    const finalFileName = promptedFileName.trim() || getDefaultFileName().replace('.json', '');
    const settings = createSettingsObject();
    
    const dataStr = JSON.stringify(settings, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = finalFileName.endsWith('.json') ? finalFileName : `${finalFileName}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
    
    // Close prompt and reset state
    setShowFilenamePrompt(false);
    setPromptedFileName('');
  };

  // Handle direct save (uses current custom filename or default)
  const handleSaveSettings = () => {
    const settings = createSettingsObject();
    // Use smart default filename generation
    const defaultFileName = getDefaultFileName();
    const fileName = settingsFileName.trim() || defaultFileName;
    
    const dataStr = JSON.stringify(settings, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = fileName.endsWith('.json') ? fileName : `${fileName}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
    
    // Clear the custom filename after saving so next save uses default again
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
    // Add missing colorSettings with sensible defaults
    const completeDefaults = {
      ...defaultsForCurrentMode,
      colorSettings: {
        selectedRegion: null,
        gridConfig: { columns: 3, rows: 3 },
        transformations: {
          horizontal: { type: 'brightness', min: -50, max: 50 },
          vertical: { type: 'contrast', min: -50, max: 50 }
        },
        selectedPreset: null,
        finalAdjustments: {
          brightness: 0, contrast: 0, saturation: 0, hue: 0, gamma: 1,
          vibrance: 0, redMultiplier: 1, greenMultiplier: 1, blueMultiplier: 1,
          shadows: 0, highlights: 0, midtoneBalance: 0, blackPoint: 0,
          whitePoint: 100, outputBlack: 0, outputWhite: 100
        }
      }
    };
    onLoadSettings(completeDefaults);
  };

  return (
    <div className="space-y-4">
      <div className="border border-gray-200 rounded-lg bg-gray-50">
        {/* Hidden file input - always rendered for external triggers */}
        <input
          type="file"
          accept=".json"
          className="hidden"
          ref={fileInputRef}
          onChange={handleLoadSettings}
        />
        
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
                <div className="flex space-x-1">
                  <button
                    onClick={handleSaveSettings}
                    className="flex-1 flex items-center justify-center bg-blue-600 text-white px-2 py-1.5 rounded-md hover:bg-blue-700 text-xs"
                  >
                    <SaveIcon size={12} className="mr-1.5" />
                    Export
                  </button>
                  <button
                    onClick={handleSaveSettingsWithPrompt}
                    className="flex items-center justify-center bg-blue-500 text-white px-2 py-1.5 rounded-md hover:bg-blue-600 text-xs"
                    title="Export with custom filename"
                  >
                    <EditIcon size={12} />
                  </button>
                </div>
                
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full flex items-center justify-center bg-green-600 text-white px-2 py-1.5 rounded-md hover:bg-green-700 text-xs"
                >
                  <UploadIcon size={12} className="mr-1.5" />
                  Import Settings
                </button>
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
      
      {/* Auto Restored Settings Notification - positioned directly below settings dropdown */}
      {autoRestoredSettings && onResetToDefaults && onTriggerImportSettings && (
        <AutoRestoredSettingsNotification
          isVisible={autoRestoredSettings}
          onResetToDefaults={onResetToDefaults}
          onTriggerImportSettings={onTriggerImportSettings}
        />
      )}

      {/* Filename Prompt Modal */}
      {showFilenamePrompt && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Export Settings
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              Enter a custom filename for your settings export:
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Filename
                </label>
                <input
                  type="text"
                  value={promptedFileName}
                  onChange={(e) => setPromptedFileName(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter filename (without .json)"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleConfirmPromptedSave();
                    } else if (e.key === 'Escape') {
                      setShowFilenamePrompt(false);
                    }
                  }}
                />
                <p className="text-xs text-gray-500 mt-1">
                  The .json extension will be added automatically
                </p>
              </div>
              <div className="flex space-x-3">
                <button
                  onClick={handleConfirmPromptedSave}
                  className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 text-sm font-medium"
                >
                  Export Settings
                </button>
                <button
                  onClick={() => setShowFilenamePrompt(false)}
                  className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-400 text-sm font-medium"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
