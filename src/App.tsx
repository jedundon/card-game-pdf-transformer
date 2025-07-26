import { ImportStep } from './components/ImportStep';
import { ExtractStep } from './components/ExtractStep';
import { ConfigureStep } from './components/ConfigureStep';
import { ColorCalibrationStep } from './components/ColorCalibrationStep';
import { ExportStep } from './components/ExportStep';
import { StepIndicator } from './components/StepIndicator';
import { ImportExportManager } from './components/ImportExportManager';
import { 
  PDFProcessingErrorBoundary, 
  CardProcessingErrorBoundary, 
  RenderingErrorBoundary, 
  ExportErrorBoundary 
} from './components/ErrorBoundary';
import { PageCountMismatchDialog } from './components/PageCountMismatchDialog';
import { clearLocalStorageSettings } from './utils/localStorageUtils';

// Import our new custom hooks
import { useStepNavigation } from './hooks/useStepNavigation';
import { usePdfData } from './hooks/usePdfData';
import { useSettingsManager } from './hooks/useSettingsManager';
import { useLocalStorageSync } from './hooks/useLocalStorageSync';
import { useFileImport } from './hooks/useFileImport';
import { useMultiFileImport } from './hooks/useMultiFileImport';

export function App() {
  // Initialize all hooks
  const stepNavigation = useStepNavigation();
  const pdfDataManager = usePdfData();
  const settingsManager = useSettingsManager();
  const fileImportManager = useFileImport();
  const multiFileImport = useMultiFileImport();
  
  // Initialize localStorage sync with current settings and PDF data
  const localStorageSync = useLocalStorageSync(
    {
      pdfMode: settingsManager.pdfMode,
      pageSettings: settingsManager.pageSettings,
      extractionSettings: settingsManager.extractionSettings,
      outputSettings: settingsManager.outputSettings,
      colorSettings: settingsManager.colorSettings
    },
    pdfDataManager.pdfData,
    (settings) => settingsManager.applySettings(settings)
  );

  // Handler functions using the new hooks
  const handleResetToDefaults = () => {
    clearLocalStorageSettings();
    pdfDataManager.handleClearLastImportedFile();
    pdfDataManager.clearPdfData();
    settingsManager.resetToDefaults();
    localStorageSync.clearAutoRestoredFlag();
  };

  const steps = [{
    title: 'Import PDF',
    component: (
      <PDFProcessingErrorBoundary onNavigate={() => stepNavigation.goToStep(0)}>
        <ImportStep 
          onFileSelect={pdfDataManager.handleFileSelect} 
          onModeSelect={settingsManager.handleModeSelect} 
          onPageSettingsChange={settingsManager.updatePageSettings} 
          onNext={stepNavigation.nextStep} 
          onResetToDefaults={handleResetToDefaults} 
          pdfData={pdfDataManager.pdfData} 
          pdfMode={settingsManager.pdfMode} 
          pageSettings={settingsManager.pageSettings} 
          lastImportedFileInfo={pdfDataManager.lastImportedFileInfo} 
          onClearLastImportedFile={pdfDataManager.handleClearLastImportedFile} 
          multiFileImport={multiFileImport}
          extractionSettings={settingsManager.extractionSettings}
          outputSettings={settingsManager.outputSettings}
          colorSettings={settingsManager.colorSettings}
        />
      </PDFProcessingErrorBoundary>
    )
  }, {
    title: 'Extract Cards',
    component: (
      <CardProcessingErrorBoundary onNavigate={() => stepNavigation.goToStep(0)}>
        <ExtractStep 
          pdfData={pdfDataManager.pdfData} 
          pdfMode={settingsManager.pdfMode} 
          pageSettings={settingsManager.pageSettings} 
          extractionSettings={settingsManager.extractionSettings} 
          multiFileImport={multiFileImport}
          onSettingsChange={settingsManager.updateExtractionSettings} 
          onCardDimensionsChange={pdfDataManager.setCardDimensions} 
          onPrevious={stepNavigation.previousStep} 
          onNext={stepNavigation.nextStep} 
        />
      </CardProcessingErrorBoundary>
    )
  }, {
    title: 'Configure Layout',
    component: (
      <RenderingErrorBoundary onNavigate={() => stepNavigation.goToStep(1)}>
        <ConfigureStep 
          pdfData={pdfDataManager.pdfData} 
          pdfMode={settingsManager.pdfMode} 
          extractionSettings={settingsManager.extractionSettings} 
          outputSettings={settingsManager.outputSettings} 
          pageSettings={settingsManager.pageSettings} 
          cardDimensions={pdfDataManager.cardDimensions} 
          multiFileImport={multiFileImport}
          onSettingsChange={settingsManager.updateOutputSettings} 
          onPrevious={stepNavigation.previousStep} 
          onNext={stepNavigation.nextStep} 
        />
      </RenderingErrorBoundary>
    )
  }, {
    title: 'Color Calibration',
    component: (
      <RenderingErrorBoundary onNavigate={() => stepNavigation.goToStep(2)}>
        <ColorCalibrationStep 
          pdfData={pdfDataManager.pdfData} 
          pdfMode={settingsManager.pdfMode} 
          extractionSettings={settingsManager.extractionSettings} 
          outputSettings={settingsManager.outputSettings} 
          pageSettings={settingsManager.pageSettings} 
          cardDimensions={pdfDataManager.cardDimensions} 
          colorSettings={settingsManager.colorSettings} 
          multiFileImport={multiFileImport}
          onColorSettingsChange={settingsManager.updateColorSettings} 
          onPrevious={stepNavigation.previousStep} 
          onNext={stepNavigation.nextStep} 
        />
      </RenderingErrorBoundary>
    )
  }, {
    title: 'Export',
    component: (
      <ExportErrorBoundary onNavigate={() => stepNavigation.goToStep(3)}>
        <ExportStep 
          pdfData={pdfDataManager.pdfData} 
          pdfMode={settingsManager.pdfMode} 
          pageSettings={settingsManager.pageSettings} 
          extractionSettings={settingsManager.extractionSettings} 
          outputSettings={settingsManager.outputSettings} 
          colorSettings={settingsManager.colorSettings} 
          currentPdfFileName={pdfDataManager.currentPdfFileName} 
          multiFileImport={multiFileImport}
          onPrevious={stepNavigation.previousStep} 
        />
      </ExportErrorBoundary>
    )
  }];

  return <div className="flex flex-col w-full min-h-screen bg-gray-50">
      <header className="p-4 bg-white shadow-sm">
        <h1 className="text-2xl font-bold text-gray-800">
          Card Game PDF Transformer
        </h1>
      </header>
      <main className="flex-1 p-4 md:p-6">
        <StepIndicator 
          steps={steps.map(s => s.title)} 
          currentStep={stepNavigation.currentStep}
          onStepClick={stepNavigation.goToStep}
          isPdfLoaded={!!pdfDataManager.pdfData || multiFileImport.multiFileState.pages.length > 0}
        />
        
        {/* Import/Export Manager - Always visible */}
        <div className="mt-6" data-import-export-manager>
          <ImportExportManager
            pdfMode={settingsManager.pdfMode}
            pageSettings={settingsManager.pageSettings}
            extractionSettings={settingsManager.extractionSettings}
            outputSettings={settingsManager.outputSettings}
            colorSettings={settingsManager.colorSettings}
            currentPdfFileName={pdfDataManager.currentPdfFileName}
            multiFileImport={multiFileImport}
            onLoadSettings={localStorageSync.handleLoadSettings}
            onTriggerImportRef={fileImportManager.setTriggerImportRef}
            autoRestoredSettings={localStorageSync.autoRestoredSettings}
            onResetToDefaults={handleResetToDefaults}
            onTriggerImportSettings={fileImportManager.handleTriggerImportSettings}
          />
        </div>
        
        <div className="mt-6 p-6 bg-white rounded-lg shadow">
          {steps[stepNavigation.currentStep].component}
        </div>
      </main>
      <footer className="p-4 text-center text-gray-500 text-sm">
        Card Game PDF Transformer &copy; {new Date().getFullYear()}
      </footer>
      
      {/* Page Count Mismatch Dialog */}
      <PageCountMismatchDialog
        isOpen={localStorageSync.pageCountMismatchDialog.isOpen}
        onClose={localStorageSync.handlePageCountMismatchClose}
        onProceed={localStorageSync.handlePageCountMismatchProceed}
        currentPdfPageCount={localStorageSync.pageCountMismatchDialog.currentPdfPageCount}
        importedSettingsPageCount={localStorageSync.pageCountMismatchDialog.importedSettingsPageCount}
        appliedSettings={localStorageSync.pageCountMismatchDialog.appliedSettings}
        skippedSettings={localStorageSync.pageCountMismatchDialog.skippedSettings}
      />
    </div>;
}