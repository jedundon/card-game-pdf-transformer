import React, { useState, useMemo } from 'react';
import { ChevronLeftIcon, DownloadIcon, CheckCircleIcon } from 'lucide-react';
import { getRotationForCardType, getActivePages, calculateTotalCards } from '../utils/cardUtils';
interface ExportStepProps {
  pdfData: any;
  pdfMode: any;
  pageSettings: any;
  extractionSettings: any;
  outputSettings: any;
  onPrevious: () => void;
}
export const ExportStep: React.FC<ExportStepProps> = ({
  // pdfData,
  pdfMode,
  pageSettings,
  extractionSettings,
  outputSettings,
  onPrevious
}) => {
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
  const handleExport = () => {
    setExportStatus('processing');
    // Simulate processing time
    setTimeout(() => {
      setExportStatus('completed');
      setExportedFiles({
        fronts: 'card_fronts.pdf',
        backs: 'card_backs.pdf'
      });
    }, 2000);
  };
  const handleDownload = (fileType: 'fronts' | 'backs') => {
    // In a real implementation, this would trigger the actual file download
    console.log(`Downloading ${fileType} file`);
  };
  return <div className="space-y-6">
      <h2 className="text-xl font-semibold text-gray-800">Export PDFs</h2>
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <h3 className="text-lg font-medium text-gray-800 mb-3">
          Export Summary
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Card Position:</span>
              <span className="font-medium text-gray-800">
                {outputSettings.offset.horizontal > 0 ? '+' : ''}
                {outputSettings.offset.horizontal}" H,
                {outputSettings.offset.vertical > 0 ? '+' : ''}
                {outputSettings.offset.vertical}" V
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Card Rotation:</span>
              <span className="font-medium text-gray-800">
                Front {getRotationForCardType(outputSettings.rotation, 'front')}°, Back {getRotationForCardType(outputSettings.rotation, 'back')}°
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Crop Applied:</span>
              <span className="font-medium text-gray-800">
                {outputSettings.crop.top + outputSettings.crop.right + outputSettings.crop.bottom + outputSettings.crop.left}
                px total
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
          {exportStatus === 'idle' && <div className="text-center py-8">
              <p className="text-gray-600 mb-6">
                Ready to generate output PDF files with your configured
                settings.
              </p>
              <button onClick={handleExport} className="inline-flex items-center bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700">
                <DownloadIcon size={18} className="mr-2" />
                Generate PDF Files
              </button>
            </div>}
          {exportStatus === 'processing' && <div className="text-center py-8">
              <div className="animate-spin w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full mx-auto mb-4"></div>
              <p className="text-gray-600">Processing your files...</p>
            </div>}
          {exportStatus === 'completed' && <div className="space-y-6">
              <div className="flex items-center justify-center text-green-600 py-2">
                <CheckCircleIcon size={24} className="mr-2" />
                <span className="font-medium">
                  PDF files generated successfully!
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                    Download {exportedFiles.fronts}
                  </button>
                </div>
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
                    Download {exportedFiles.backs}
                  </button>
                </div>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
                <p>
                  <strong>Printing tip:</strong> When printing these files, make
                  sure to set your printer to "Actual size" and disable any
                  auto-scaling options to ensure the cards are printed at the
                  exact dimensions you specified.
                </p>
              </div>
            </div>}
        </div>
      </div>
      <div className="flex justify-start mt-6">
        <button onClick={onPrevious} className="flex items-center bg-gray-200 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-300">
          <ChevronLeftIcon size={16} className="mr-2" />
          Previous Step
        </button>
      </div>
    </div>;
};