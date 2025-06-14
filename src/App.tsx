/**
 * Updated App.tsx using centralized state management
 * This replaces the scattered state with the StateManager
 */

import { ImportStep } from './components/ImportStep';
import { ExtractStep } from './components/ExtractStep';
import { ConfigureStep } from './components/ConfigureStep';
import { ExportStep } from './components/ExportStep';
import { StepIndicator } from './components/StepIndicator';
import { SettingsManager } from './components/SettingsManager';
import { 
  TransformationPipeline, 
  StateManager, 
  StepRegistry, 
  initializeStateManager,
  useNavigation,
  usePdfData,
  useSettings,
  useAppStatus
} from './pipeline';

// Initialize the pipeline and state manager
const stepRegistry = new StepRegistry();
const pipeline = new TransformationPipeline({
  steps: stepRegistry.getAllSteps(),
  cacheEnabled: true,
  maxCacheSize: 100,
  performanceMonitoring: true,
  errorHandling: 'tolerant',
});

const stateManager = new StateManager(pipeline);
initializeStateManager(stateManager);

export function App() {
  const { currentStep, nextStep, previousStep } = useNavigation();
  const { pdfData, currentPdfFileName, setPdfData } = usePdfData();
  const { 
    pdfMode, 
    pageSettings, 
    extractionSettings, 
    outputSettings, 
    cardDimensions,
    setPdfMode,
    setPageSettings,
    setExtractionSettings,
    setOutputSettings,
    setCardDimensions,
    loadSettings
  } = useSettings();
  const { isLoading, errors, warnings } = useAppStatus();

  // Handle PDF file selection (replacing handleFileSelect)
  const handleFileSelect = (data: any, fileName: string) => {
    setPdfData(data, fileName);
  };

  const steps = [{
    title: 'Import PDF',
    component: <ImportStep 
      onFileSelect={handleFileSelect}
      onModeSelect={setPdfMode}
      onPageSettingsChange={setPageSettings}
      onNext={() => nextStep()} 
      pdfData={pdfData} 
      pdfMode={pdfMode} 
      pageSettings={pageSettings} 
    />
  }, {
    title: 'Extract Cards',
    component: <ExtractStep 
      pdfData={pdfData} 
      pdfMode={pdfMode} 
      pageSettings={pageSettings} 
      extractionSettings={extractionSettings} 
      onSettingsChange={setExtractionSettings}
      onCardDimensionsChange={setCardDimensions}
      onPrevious={() => previousStep()} 
      onNext={() => nextStep()} 
    />
  }, {
    title: 'Configure Layout',
    component: <ConfigureStep 
      pdfData={pdfData} 
      pdfMode={pdfMode} 
      extractionSettings={extractionSettings} 
      outputSettings={outputSettings} 
      pageSettings={pageSettings} 
      cardDimensions={cardDimensions} 
      onSettingsChange={setOutputSettings}
      onPrevious={() => previousStep()} 
      onNext={() => nextStep()} 
    />
  }, {
    title: 'Export',
    component: <ExportStep 
      pdfData={pdfData} 
      pdfMode={pdfMode} 
      pageSettings={pageSettings} 
      extractionSettings={extractionSettings} 
      outputSettings={outputSettings} 
      currentPdfFileName={currentPdfFileName}
      onPrevious={() => previousStep()} 
    />
  }];

  return <div className="flex flex-col w-full min-h-screen bg-gray-50">
      <header className="p-4 bg-white shadow-sm">
        <h1 className="text-2xl font-bold text-gray-800">
          Card Game PDF Transformer
        </h1>
        {isLoading && (
          <div className="mt-2 text-sm text-blue-600">
            Processing...
          </div>
        )}
        {errors.length > 0 && (
          <div className="mt-2 text-sm text-red-600">
            {errors.join(', ')}
          </div>
        )}
        {warnings.length > 0 && (
          <div className="mt-2 text-sm text-yellow-600">
            {warnings.join(', ')}
          </div>
        )}
      </header>
      <main className="flex-1 p-4 md:p-6">
        <StepIndicator 
          steps={steps.map(s => s.title)} 
          currentStep={currentStep} 
        />
        
        {/* Settings Manager - Always visible */}
        <div className="mt-6">
          <SettingsManager
            pdfMode={pdfMode}
            pageSettings={pageSettings}
            extractionSettings={extractionSettings}
            outputSettings={outputSettings}
            currentPdfFileName={currentPdfFileName}
            onLoadSettings={loadSettings}
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
