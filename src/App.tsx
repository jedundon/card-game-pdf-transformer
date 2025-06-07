import { useState } from 'react';
import { ImportStep } from './components/ImportStep';
import { ExtractStep } from './components/ExtractStep';
import { ConfigureStep } from './components/ConfigureStep';
import { ExportStep } from './components/ExportStep';
import { StepIndicator } from './components/StepIndicator';
import { SettingsManager } from './components/SettingsManager';
export function App() {
  const [currentStep, setCurrentStep] = useState(0);
  const [pdfData, setPdfData] = useState(null);
  const [currentPdfFileName, setCurrentPdfFileName] = useState<string>('');
  const [pdfMode, setPdfMode] = useState({
    type: 'duplex',
    orientation: 'portrait',
    flipEdge: 'short' // For duplex: 'short' or 'long'
  });
  const [pageSettings, setPageSettings] = useState([]);
  const [extractionSettings, setExtractionSettings] = useState({
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
  });
  const [outputSettings, setOutputSettings] = useState({
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
    rotation: 0 // 0, 90, 180, or 270 degrees
  });

  // Handle loading settings from file
  const handleLoadSettings = (settings: any) => {
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
  };

  // Handle PDF file selection with filename tracking
  const handleFileSelect = (data: any, fileName: string) => {
    setPdfData(data);
    setCurrentPdfFileName(fileName);
  };
  const steps = [{
    title: 'Import PDF',
    component: <ImportStep onFileSelect={(data, fileName) => handleFileSelect(data, fileName)} onModeSelect={mode => setPdfMode(mode)} onPageSettingsChange={settings => setPageSettings(settings)} onNext={() => setCurrentStep(1)} pdfData={pdfData} pdfMode={pdfMode} pageSettings={pageSettings} />
  }, {
    title: 'Extract Cards',
    component: <ExtractStep pdfData={pdfData} pdfMode={pdfMode} pageSettings={pageSettings} extractionSettings={extractionSettings} onSettingsChange={settings => setExtractionSettings(settings)} onPrevious={() => setCurrentStep(0)} onNext={() => setCurrentStep(2)} />
  }, {
    title: 'Configure Layout',
    component: <ConfigureStep pdfData={pdfData} extractionSettings={extractionSettings} outputSettings={outputSettings} pageSettings={pageSettings} onSettingsChange={settings => setOutputSettings(settings)} onPrevious={() => setCurrentStep(1)} onNext={() => setCurrentStep(3)} />
  }, {
    title: 'Export',
    component: <ExportStep pdfData={pdfData} pdfMode={pdfMode} pageSettings={pageSettings} extractionSettings={extractionSettings} outputSettings={outputSettings} onPrevious={() => setCurrentStep(2)} />
  }];
  return <div className="flex flex-col w-full min-h-screen bg-gray-50">
      <header className="p-4 bg-white shadow-sm">
        <h1 className="text-2xl font-bold text-gray-800">
          Card Game PDF Transformer
        </h1>
      </header>
      <main className="flex-1 p-4 md:p-6">
        <StepIndicator steps={steps.map(s => s.title)} currentStep={currentStep} />
        
        {/* Settings Manager - Always visible */}
        <div className="mt-6">
          <SettingsManager
            pdfMode={pdfMode}
            pageSettings={pageSettings}
            extractionSettings={extractionSettings}
            outputSettings={outputSettings}
            currentPdfFileName={currentPdfFileName}
            onLoadSettings={handleLoadSettings}
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