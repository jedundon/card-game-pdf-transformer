import React, { useState, useMemo, useEffect } from 'react';
import { ChevronLeftIcon, DownloadIcon, CheckCircleIcon } from 'lucide-react';
import { 
  getRotationForCardType, 
  getActivePages, 
  calculateTotalCards,
  calculateCardDimensions
} from '../utils/cardUtils';
import { useExportStep } from '../pipeline';

interface ExportStepProps {
  pdfData: any;
  pdfMode: any;
  pageSettings: any;
  extractionSettings: any;
  outputSettings: any;
  currentPdfFileName?: string;
  onPrevious: () => void;
}

export const ExportStep: React.FC<ExportStepProps> = ({
  pdfData,
  pdfMode,
  pageSettings,
  extractionSettings,
  outputSettings,
  currentPdfFileName,
  onPrevious
}) => {  // Use pipeline for export operations
  const { exportPdf, validateExportSettings: pipelineValidateExportSettings } = useExportStep();
  
  const [exportStatus, setExportStatus] = useState<'idle' | 'processing' | 'completed'>('idle');
  const [exportedFiles, setExportedFiles] = useState<{
    fronts: string | null;
    backs: string | null;
  }>({
    fronts: null,
    backs: null
  });

  // Calculate total cards
  const activePages = useMemo(() => 
    getActivePages(pageSettings), 
    [pageSettings]
  );
  
  const cardsPerPage = extractionSettings.grid.rows * extractionSettings.grid.columns;
  const totalCards = useMemo(() => 
    calculateTotalCards(pdfMode, activePages, cardsPerPage), 
    [pdfMode, activePages, cardsPerPage]
  );
  // Cleanup blob URLs when component unmounts or files change
  useEffect(() => {
    return () => {
      if (exportedFiles.fronts) {
        URL.revokeObjectURL(exportedFiles.fronts);
      }
      if (exportedFiles.backs) {
        URL.revokeObjectURL(exportedFiles.backs);
      }
    };
  }, [exportedFiles]);

  // Generate filename based on PDF name
  const generateFileName = (fileType: 'fronts' | 'backs'): string => {
    if (currentPdfFileName) {
      // Remove .pdf extension and add the type suffix
      const baseName = currentPdfFileName.replace(/\.pdf$/i, '');
      return `${baseName} - ${fileType}.pdf`;
    }
    return `card_${fileType}.pdf`;
  };
  // Validate export settings before generating PDFs
  const validateExportSettings = (): { isValid: boolean; errors: string[] } => {
    const errors: string[] = [];
    
    // Check if PDF data is available
    if (!pdfData) {
      errors.push('No PDF data available for export');
    }
    
    // Check if there are active pages
    if (activePages.length === 0) {
      errors.push('No active pages selected for export');
    }
    
    // Check if output settings are valid
    if (!outputSettings.pageSize || outputSettings.pageSize.width <= 0 || outputSettings.pageSize.height <= 0) {
      errors.push('Invalid page size settings');
    }
    
    // Check if card size settings are valid
    if (outputSettings.cardSize && (outputSettings.cardSize.widthInches <= 0 || outputSettings.cardSize.heightInches <= 0)) {
      errors.push('Invalid card size settings');
    }
    
    // Check if card scale is valid
    const scale = outputSettings.cardScalePercent || 100;
    if (scale <= 0 || scale > 200) {
      errors.push('Invalid card scale percentage (must be between 1% and 200%)');
    }
      // Check if bleed margin is valid
    const bleed = outputSettings.bleedMarginInches || 0;
    if (bleed < 0 || bleed > 1) {
      errors.push('Invalid bleed margin (must be between 0 and 1 inch)');
    }
    
    // Check if offset values are reasonable
    const horizontalOffset = outputSettings.offset.horizontal || 0;
    const verticalOffset = outputSettings.offset.vertical || 0;
    if (Math.abs(horizontalOffset) > outputSettings.pageSize.width / 2) {
      errors.push('Horizontal offset is too large for page size');
    }
    if (Math.abs(verticalOffset) > outputSettings.pageSize.height / 2) {
      errors.push('Vertical offset is too large for page size');
    }
    
    // Check if total cards is greater than 0
    if (totalCards <= 0) {
      errors.push('No cards available for export');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };  };

  const handleExport = async () => {
    setExportStatus('processing');
    
    try {
      console.log('Starting PDF export process...');        // Validate settings before export
      // First validate through pipeline
      const pipelineValidation = await pipelineValidateExportSettings(outputSettings);
      if (!pipelineValidation.valid) {
        console.error('Pipeline export validation failed:', pipelineValidation.errors);
        alert('Export validation failed (Pipeline):\n\n' + pipelineValidation.errors.map((e: any) => e.message).join('\n'));
        setExportStatus('idle');
        return;
      }
      
      // Also run local validation for UI-specific checks
      const validation = validateExportSettings();
      if (!validation.isValid) {
        console.error('Export validation failed:', validation.errors);
        alert('Export validation failed:\n\n' + validation.errors.join('\n'));
        setExportStatus('idle');
        return;
      }
      
      console.log('PDF Mode:', pdfMode);
      console.log('Total Cards:', totalCards);
      console.log('Active Pages:', activePages.length);
      console.log('Output Settings:', outputSettings);        // Use pipeline export functionality through ExportStep pipeline class
      const exportResults = await exportPdf(
        pdfData,
        pdfMode,
        pageSettings,
        extractionSettings,
        outputSettings
      );

      console.log('PDF generation completed:', {
        frontsPdf: exportResults.fronts ? 'Generated' : 'No fronts found',
        backsPdf: exportResults.backs ? 'Generated' : 'No backs found',
        metadata: exportResults.metadata
      });

      // Convert blobs to URLs for download
      const frontsUrl = exportResults.fronts ? URL.createObjectURL(exportResults.fronts) : null;
      const backsUrl = exportResults.backs ? URL.createObjectURL(exportResults.backs) : null;

      // Set the exported files URLs from the pipeline results
      setExportedFiles({
        fronts: frontsUrl,
        backs: backsUrl
      });
      
      setExportStatus('completed');
    } catch (error) {
      console.error('Export failed:', error);
      setExportStatus('idle');
    }
  };
  const handleDownload = (fileType: 'fronts' | 'backs') => {
    const url = exportedFiles[fileType];
    if (!url) {
      console.error(`No ${fileType} PDF available for download`);
      return;
    }

    try {
      // Create download link and trigger download
      const link = document.createElement('a');
      link.href = url;
      link.download = generateFileName(fileType);
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      console.log(`Download initiated for ${fileType} PDF`);
    } catch (error) {
      console.error(`Error downloading ${fileType} PDF:`, error);
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-gray-800">Export PDFs</h2>
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <h3 className="text-lg font-medium text-gray-800 mb-3">
          Export Summary
        </h3>        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">PDF Mode:</span>
              <span className="font-medium text-gray-800">{pdfMode.type}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Total Cards:</span>
              <span className="font-medium text-gray-800">{totalCards}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Output Page Size:</span>
              <span className="font-medium text-gray-800">
                {outputSettings.pageSize.width}" ×{' '}
                {outputSettings.pageSize.height}"
              </span>
            </div>            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Card Size:</span>
              <span className="font-medium text-gray-800">
                {outputSettings.cardSize?.widthInches || 2.5}" ×{' '}
                {outputSettings.cardSize?.heightInches || 3.5}"
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Final Print Size:</span>
              <span className="font-medium text-gray-800">
                {(() => {
                  const cardDimensions = calculateCardDimensions(outputSettings);
                  return `${cardDimensions.scaledCardWidthInches.toFixed(2)}" × ${cardDimensions.scaledCardHeightInches.toFixed(2)}"`;
                })()}
              </span>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Card Position:</span>
              <span className="font-medium text-gray-800">
                {outputSettings.offset.horizontal > 0 ? '+' : ''}
                {outputSettings.offset.horizontal}" H,{' '}
                {outputSettings.offset.vertical > 0 ? '+' : ''}
                {outputSettings.offset.vertical}" V
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Card Scale:</span>
              <span className="font-medium text-gray-800">
                {outputSettings.cardScalePercent || 100}%
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Card Rotation:</span>
              <span className="font-medium text-gray-800">
                Front {getRotationForCardType(outputSettings, 'front')}°, Back {getRotationForCardType(outputSettings, 'back')}°
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Bleed Margin:</span>
              <span className="font-medium text-gray-800">
                {outputSettings.bleedMarginInches || 0}" 
                ({outputSettings.bleedMarginInches ? 'applied' : 'none'})
              </span>
            </div>
          </div>
        </div>
      </div>
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <div className="bg-gray-50 p-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-800">Output Files</h3>
        </div>
        <div className="p-6">
          {exportStatus === 'idle' && (
            <div className="text-center py-8">
              <p className="text-gray-600 mb-6">
                Ready to generate output PDF files with your configured
                settings.
              </p>
              <button onClick={handleExport} className="inline-flex items-center bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700">
                <DownloadIcon size={18} className="mr-2" />
                Generate PDF Files
              </button>
            </div>
          )}
          {exportStatus === 'processing' && (
            <div className="text-center py-8">
              <div className="animate-spin w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full mx-auto mb-4"></div>
              <p className="text-gray-600">Processing your files...</p>
            </div>
          )}
          {exportStatus === 'completed' && (
            <div className="space-y-6">
              <div className="flex items-center justify-center text-green-600 py-2">
                <CheckCircleIcon size={24} className="mr-2" />
                <span className="font-medium">
                  PDF files generated successfully!
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {exportedFiles.fronts && (
                  <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                    <div className="flex items-center mb-3">
                      <CheckCircleIcon size={24} className="text-red-500 mr-2" />
                      <h4 className="text-lg font-medium">Card Fronts</h4>
                    </div>
                    <p className="text-sm text-gray-600 mb-4">
                      Contains all front card images positioned according to your
                      settings.
                    </p>
                    <button onClick={() => handleDownload('fronts')} className="w-full flex items-center justify-center bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-50">
                      <DownloadIcon size={16} className="mr-2" />
                      Download Card Fronts
                    </button>
                  </div>
                )}
                {exportedFiles.backs && (
                  <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                    <div className="flex items-center mb-3">
                      <CheckCircleIcon size={24} className="text-blue-500 mr-2" />
                      <h4 className="text-lg font-medium">Card Backs</h4>
                    </div>
                    <p className="text-sm text-gray-600 mb-4">
                      Contains all back card images positioned according to your
                      settings.
                    </p>
                    <button onClick={() => handleDownload('backs')} className="w-full flex items-center justify-center bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-50">
                      <DownloadIcon size={16} className="mr-2" />
                      Download Card Backs
                    </button>
                  </div>
                )}
                {!exportedFiles.fronts && !exportedFiles.backs && (
                  <div className="col-span-full bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <p className="text-yellow-800">
                      No PDF files were generated. This could happen if no cards were found matching your current settings.
                    </p>
                  </div>
                )}
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
                <p>
                  <strong>Printing tip:</strong> When printing these files, make
                  sure to set your printer to "Actual size" and disable any
                  auto-scaling options to ensure the cards are printed at the
                  exact dimensions you specified.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
      <div className="flex justify-start mt-6">
        <button onClick={onPrevious} className="flex items-center bg-gray-200 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-300">
          <ChevronLeftIcon size={16} className="mr-2" />
          Previous Step
        </button>
      </div>
    </div>
  );
};