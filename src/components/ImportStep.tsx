import React, { useState, useRef } from 'react';
import { ChevronRightIcon } from 'lucide-react';
import { getDefaultGrid } from '../defaults';
import { useImportStep } from '../pipeline';
interface ImportStepProps {
  onFileSelect: (data: any, fileName: string) => void;
  onModeSelect: (mode: any) => void;
  onPageSettingsChange: (settings: any) => void;
  onNext: () => void;
  pdfData: any;
  pdfMode: any;
  pageSettings: any;
}
export const ImportStep: React.FC<ImportStepProps> = ({
  onFileSelect,
  onModeSelect,
  onPageSettingsChange,
  onNext,
  pdfData,
  pdfMode,
  pageSettings
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string>('');
  const [pageCount, setPageCount] = useState<number>(0);
  
  // Use pipeline for import operations
  const { importPdf, validateImportSettings } = useImportStep();
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFileName(file.name);
      setPageCount(0); // Reset page count
      onPageSettingsChange([]); // Reset page settings
      
      try {
        // Use pipeline step for PDF import instead of direct PDF.js calls
        const result = await importPdf(file);
        
        setPageCount(result.pageCount);
        onFileSelect(result.pdfData, result.fileName);
        onPageSettingsChange(result.pageSettings);
      } catch (error) {
        console.error('Failed to import PDF through pipeline:', error);
        // Fall back to showing error to user
        setPageCount(0);
        onPageSettingsChange([]);
      }
    }
  };
  const handleModeChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const type = e.target.value as 'duplex' | 'gutter-fold';
    const newMode = {
      ...pdfMode,
      type
    };
    
    // Validate through pipeline before applying
    try {
      await validateImportSettings(newMode, pageSettings);
      onModeSelect(newMode);
    } catch (error) {
      // Pipeline validation failed, still apply settings but user will see error
      onModeSelect(newMode);
    }
  };
  const handleOrientationChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const orientation = e.target.value as 'vertical' | 'horizontal';
    onModeSelect({
      ...pdfMode,
      orientation
    });
  };
  const handleFlipEdgeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const flipEdge = e.target.value as 'short' | 'long';
    onModeSelect({
      ...pdfMode,
      flipEdge
    });
  };
  const handlePageTypeChange = (index: number, type: string) => {
    const newSettings = [...pageSettings];
    newSettings[index] = {
      ...newSettings[index],
      type
    };
    onPageSettingsChange(newSettings);
  };
  const handlePageSkipChange = (index: number, skip: boolean) => {
    const newSettings = [...pageSettings];
    newSettings[index] = {
      ...newSettings[index],
      skip
    };
    onPageSettingsChange(newSettings);
  };
  return <div className="space-y-6">
      <h2 className="text-xl font-semibold text-gray-800">Import PDF File</h2>
      <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
        <input type="file" accept=".pdf" className="hidden" ref={fileInputRef} onChange={handleFileChange} />
        <button onClick={() => fileInputRef.current?.click()} className="flex items-center justify-center mx-auto mb-4 w-16 h-16 bg-blue-50 rounded-full text-blue-600">
          <span className="material-icons" style={{ fontSize: 24 }}>upload</span>
        </button>
        <p className="text-gray-600 mb-2">
          {fileName || 'Click to upload your print-and-play PDF file'}
        </p>
        {fileName && <p className="text-green-600 text-sm">
            Successfully loaded: {fileName} ({pageCount} pages)
          </p>}
      </div>
      {pdfData && <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                PDF Mode
              </label>
              <select value={pdfMode.type} onChange={handleModeChange} className="w-full border border-gray-300 rounded-md px-3 py-2">
                <option value="duplex">
                  Duplex (fronts and backs on alternate pages)
                </option>
                <option value="gutter-fold">
                  Gutter-fold (fronts and backs on same page)
                </option>
              </select>
            </div>
            {pdfMode.type === 'duplex' ? <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Flip Edge
                </label>
                <select value={pdfMode.flipEdge} onChange={handleFlipEdgeChange} className="w-full border border-gray-300 rounded-md px-3 py-2">
                  <option value="short">Short Edge</option>
                  <option value="long">Long Edge</option>
                </select>
              </div> : <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Orientation
                </label>
                <select value={pdfMode.orientation} onChange={handleOrientationChange} className="w-full border border-gray-300 rounded-md px-3 py-2">              <option value="vertical">Vertical</option>
              <option value="horizontal">Horizontal</option>
                </select>
              </div>}
          </div>
          
          {/* Grid Information */}
          <div className="p-4 bg-blue-50 rounded-md">
            <h4 className="text-sm font-medium text-blue-800 mb-2">
              Default Card Grid for Selected Mode
            </h4>
            <div className="text-sm text-blue-700">
              {(() => {
                const grid = getDefaultGrid(pdfMode);
                return `${grid.rows} rows × ${grid.columns} columns (${grid.rows * grid.columns} cards per page)`;
              })()}
            </div>
            <p className="text-xs text-blue-600 mt-1">
              You can adjust these settings in the next step if needed.
            </p>
          </div>
          
          {pageSettings.length > 0 && <div className="mt-6">
              <h3 className="text-lg font-medium text-gray-800 mb-3">
                Page Settings
              </h3>
              <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-md">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Page
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Type
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Skip
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {pageSettings.map((page: any, index: number) => <tr key={index}>
                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">
                          {index + 1}
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm">
                          {pdfMode.type === 'duplex' && !page?.skip && <select value={page?.type || 'front'} onChange={e => handlePageTypeChange(index, e.target.value)} className="border border-gray-300 rounded px-2 py-1 text-sm">
                              <option value="front">Front</option>
                              <option value="back">Back</option>
                            </select>}
                          {pdfMode.type === 'gutter-fold' && !page?.skip && <span className="text-gray-600">Front & Back</span>}
                          {page?.skip && <span className="text-gray-400 italic">
                              Skipped
                            </span>}
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm">
                          <input type="checkbox" checked={page?.skip || false} onChange={e => handlePageSkipChange(index, e.target.checked)} className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                        </td>
                      </tr>)}
                  </tbody>
                </table>
              </div>
            </div>}
          <div className="flex justify-end mt-6">
            <button onClick={onNext} className="flex items-center bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700">
              Next Step
              <ChevronRightIcon size={16} className="ml-2" />
            </button>
          </div>
        </>}
    </div>;
};