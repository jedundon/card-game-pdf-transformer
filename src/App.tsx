import { useState, useEffect } from 'react';
import { ImportStep } from './components/ImportStep';
import { ExtractStep } from './components/ExtractStep';
import { ConfigureStep } from './components/ConfigureStep';
import { ColorCalibrationStep } from './components/ColorCalibrationStep';
import { ExportStep } from './components/ExportStep';
import { StepIndicator } from './components/StepIndicator';
import { ImportExportManager } from './components/ImportExportManager';
import { DEFAULT_SETTINGS, getDefaultGrid, getDefaultRotation } from './defaults';
import { 
  saveSettingsToLocalStorage, 
  loadSettingsFromLocalStorage,
  clearLocalStorageSettings
} from './utils/localStorageUtils';
import { getDefaultSettingsForMode } from './defaults';

export function App() {
  const [currentStep, setCurrentStep] = useState(0);
  const [pdfData, setPdfData] = useState(null);
  const [currentPdfFileName, setCurrentPdfFileName] = useState<string>('');
  const [autoRestoredSettings, setAutoRestoredSettings] = useState(false);
  const [triggerImportSettings, setTriggerImportSettings] = useState<(() => void) | null>(null);
  const [pdfMode, setPdfMode] = useState(DEFAULT_SETTINGS.pdfMode);
  const [pageSettings, setPageSettings] = useState(DEFAULT_SETTINGS.pageSettings);
  const [cardDimensions, setCardDimensions] = useState<{
    widthPx: number;
    heightPx: number;
    widthInches: number;
    heightInches: number;
  } | null>(null);
  
  // Initialize extraction settings with mode-specific grid
  const [extractionSettings, setExtractionSettings] = useState(() => {
    const defaultGrid = getDefaultGrid(DEFAULT_SETTINGS.pdfMode);
    return {
      ...DEFAULT_SETTINGS.extractionSettings,
      grid: defaultGrid
    };
  });
  
  // Initialize output settings with mode-specific rotation
  const [outputSettings, setOutputSettings] = useState(() => {
    const defaultRotation = getDefaultRotation(DEFAULT_SETTINGS.pdfMode);
    return {
      ...DEFAULT_SETTINGS.outputSettings,
      rotation: defaultRotation
    };
  });

  // Initialize color calibration settings
  const [colorSettings, setColorSettings] = useState({
    selectedRegion: null,
    gridConfig: { columns: 4, rows: 4 },
    transformations: {
      horizontal: { type: 'brightness', min: -20, max: 20 },
      vertical: { type: 'contrast', min: 0.8, max: 1.3 }
    },
    selectedPreset: null,
    finalAdjustments: {
      brightness: 0,
      contrast: 1.0,
      saturation: 0,
      hue: 0,
      gamma: 1.0,
      vibrance: 0,
      redMultiplier: 1.0,
      greenMultiplier: 1.0,
      blueMultiplier: 1.0,
      shadows: 0,
      highlights: 0,
      midtoneBalance: 0,
      blackPoint: 0,
      whitePoint: 255,
      outputBlack: 0,
      outputWhite: 255
    }
  });

  // Auto-restore settings from localStorage on app start
  useEffect(() => {
    const autoSavedSettings = loadSettingsFromLocalStorage();
    if (autoSavedSettings) {
      console.log('Auto-restoring settings from localStorage');
      handleLoadSettings(autoSavedSettings, true);
      setAutoRestoredSettings(true);
    }
  }, []);

  // Auto-save settings whenever they change (debounced)
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      saveSettingsToLocalStorage(pdfMode, pageSettings, extractionSettings, outputSettings, colorSettings);
    }, 1000); // 1 second debounce

    return () => clearTimeout(timeoutId);
  }, [pdfMode, pageSettings, extractionSettings, outputSettings, colorSettings]);

  // Handle PDF mode changes and update grid and rotation defaults
  const handleModeSelect = (mode: any) => {
    setPdfMode(mode);
    
    // Update extraction settings with appropriate grid for the new mode
    const newGrid = getDefaultGrid(mode);
    setExtractionSettings({
      ...extractionSettings,
      grid: newGrid
    });
    
    // Update output settings with appropriate rotation for the new mode
    const newRotation = getDefaultRotation(mode);
    setOutputSettings({
      ...outputSettings,
      rotation: newRotation
    });
  };

  // Handle loading settings from file or auto-restore
  const handleLoadSettings = (settings: any, isAutoRestore = false) => {
    if (settings.pdfMode) {
      setPdfMode(settings.pdfMode);
    }
    if (settings.pageSettings) {
      setPageSettings(settings.pageSettings);
    }
    if (settings.extractionSettings) {
      setExtractionSettings(settings.extractionSettings);
    }
    if (settings.outputSettings) {
      setOutputSettings(settings.outputSettings);
    }
    if (settings.colorSettings) {
      setColorSettings(settings.colorSettings);
    }
    // Clear auto-restored flag when manually loading settings (not auto-restore)
    if (!isAutoRestore) {
      setAutoRestoredSettings(false);
    }
  };

  // Handle PDF file selection with filename tracking
  const handleFileSelect = (data: any, fileName: string) => {
    setPdfData(data);
    setCurrentPdfFileName(fileName);
  };

  // Handle resetting to defaults (clears auto-save and resets to defaults)
  const handleResetToDefaults = () => {
    clearLocalStorageSettings();
    const defaultsForCurrentMode = getDefaultSettingsForMode(DEFAULT_SETTINGS.pdfMode);
    setPdfMode(DEFAULT_SETTINGS.pdfMode);
    setPageSettings(DEFAULT_SETTINGS.pageSettings);
    setExtractionSettings(defaultsForCurrentMode.extractionSettings);
    setOutputSettings(defaultsForCurrentMode.outputSettings);
    // Reset color settings to initial state
    setColorSettings({
      selectedRegion: null,
      gridConfig: { columns: 4, rows: 4 },
      transformations: {
        horizontal: { type: 'brightness', min: -20, max: 20 },
        vertical: { type: 'contrast', min: 0.8, max: 1.3 }
      },
      selectedPreset: null,
      finalAdjustments: {
        brightness: 0,
        contrast: 1.0,
        saturation: 0,
        hue: 0,
        gamma: 1.0,
        vibrance: 0,
        redMultiplier: 1.0,
        greenMultiplier: 1.0,
        blueMultiplier: 1.0,
        shadows: 0,
        highlights: 0,
        midtoneBalance: 0,
        blackPoint: 0,
        whitePoint: 255,
        outputBlack: 0,
        outputWhite: 255
      }
    });
    setAutoRestoredSettings(false);
  };

  // Handle triggering the import settings functionality
  const handleTriggerImportSettings = () => {
    if (triggerImportSettings) {
      triggerImportSettings();
    }
  };

  const steps = [{
    title: 'Import PDF',
    component: <ImportStep onFileSelect={(data, fileName) => handleFileSelect(data, fileName)} onModeSelect={handleModeSelect} onPageSettingsChange={settings => setPageSettings(settings)} onNext={() => setCurrentStep(1)} onResetToDefaults={handleResetToDefaults} onTriggerImportSettings={handleTriggerImportSettings} pdfData={pdfData} pdfMode={pdfMode} pageSettings={pageSettings} autoRestoredSettings={autoRestoredSettings} />
  }, {
    title: 'Extract Cards',
    component: <ExtractStep pdfData={pdfData} pdfMode={pdfMode} pageSettings={pageSettings} extractionSettings={extractionSettings} onSettingsChange={settings => setExtractionSettings(settings)} onCardDimensionsChange={setCardDimensions} onPrevious={() => setCurrentStep(0)} onNext={() => setCurrentStep(2)} />
  }, {
    title: 'Configure Layout',
    component: <ConfigureStep pdfData={pdfData} pdfMode={pdfMode} extractionSettings={extractionSettings} outputSettings={outputSettings} pageSettings={pageSettings} cardDimensions={cardDimensions} onSettingsChange={settings => setOutputSettings(settings)} onPrevious={() => setCurrentStep(1)} onNext={() => setCurrentStep(3)} />
  }, {
    title: 'Color Calibration',
    component: <ColorCalibrationStep pdfData={pdfData} pdfMode={pdfMode} extractionSettings={extractionSettings} outputSettings={outputSettings} pageSettings={pageSettings} cardDimensions={cardDimensions} colorSettings={colorSettings} onColorSettingsChange={settings => setColorSettings(settings)} onPrevious={() => setCurrentStep(2)} onNext={() => setCurrentStep(4)} />
  }, {
    title: 'Export',
    component: <ExportStep pdfData={pdfData} pdfMode={pdfMode} pageSettings={pageSettings} extractionSettings={extractionSettings} outputSettings={outputSettings} colorSettings={colorSettings} currentPdfFileName={currentPdfFileName} onPrevious={() => setCurrentStep(3)} />
  }];

  return <div className="flex flex-col w-full min-h-screen bg-gray-50">
      <header className="p-4 bg-white shadow-sm">
        <h1 className="text-2xl font-bold text-gray-800">
          Card Game PDF Transformer
        </h1>
      </header>
      <main className="flex-1 p-4 md:p-6">
        <StepIndicator steps={steps.map(s => s.title)} currentStep={currentStep} />
        
        {/* Import/Export Manager - Always visible */}
        <div className="mt-6" data-import-export-manager>
          <ImportExportManager
            pdfMode={pdfMode}
            pageSettings={pageSettings}
            extractionSettings={extractionSettings}
            outputSettings={outputSettings}
            colorSettings={colorSettings}
            currentPdfFileName={currentPdfFileName}
            onLoadSettings={handleLoadSettings}
            onTriggerImportRef={setTriggerImportSettings}
          />
        </div>
        
        <div className="mt-6 p-6 bg-white rounded-lg shadow">
          {steps[currentStep].component}
        </div>
      </main>
      <footer className="p-4 text-center text-gray-500 text-sm">
        Card Game PDF Transformer &copy; {new Date().getFullYear()}
      </footer>
    </div>;
}