/**
 * ExportPageButton - Reusable component for single-page PDF export
 * 
 * Provides a button that generates a single-page PDF with the currently displayed card
 * for quick testing and preview purposes. Uses the same rendering logic as main export.
 */

import React, { useState, useCallback } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { generateSinglePagePDF, SinglePageExportOptions } from '../../utils/singlePageExport';

export interface ExportPageButtonProps {
  cardId: number;
  cardType: 'front' | 'back';
  pdfData?: any;
  pdfMode: SinglePageExportOptions['pdfMode'];
  extractionSettings: SinglePageExportOptions['extractionSettings'];
  outputSettings: SinglePageExportOptions['outputSettings'];
  colorTransformation?: SinglePageExportOptions['colorTransformation'];
  multiFileImport: SinglePageExportOptions['multiFileImport'];
  activePages: SinglePageExportOptions['activePages'];
  cardsPerPage: number;
  disabled?: boolean;
  className?: string;
  children?: React.ReactNode;
}

/**
 * Button component that exports a single card as a PDF preview
 * 
 * Features:
 * - Uses same rendering logic as main export for consistency
 * - Handles loading states and error messages
 * - Supports both PDF and image sources
 * - Applies color transformations if configured
 * - Generates filename based on card ID and type
 */
export const ExportPageButton: React.FC<ExportPageButtonProps> = ({
  cardId,
  cardType,
  pdfData,
  pdfMode,
  extractionSettings,
  outputSettings,
  colorTransformation,
  multiFileImport,
  activePages,
  cardsPerPage,
  disabled = false,
  className = '',
  children
}) => {
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string>('');

  const handleExportPage = useCallback(async () => {
    if (disabled || isExporting) return;

    setIsExporting(true);
    setExportError('');

    try {
      console.log(`Starting single-page export for ${cardType} card ${cardId}...`);

      const options: SinglePageExportOptions = {
        cardId,
        cardType,
        pdfData,
        pdfMode,
        extractionSettings,
        outputSettings,
        colorTransformation,
        multiFileImport,
        activePages,
        cardsPerPage
      };

      const pdfBlob = await generateSinglePagePDF(options);
      
      // Create download link and trigger download
      const url = URL.createObjectURL(pdfBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `card-${cardId}-${cardType}-preview.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Clean up the blob URL
      setTimeout(() => URL.revokeObjectURL(url), 1000);

      console.log(`Single-page export completed for ${cardType} card ${cardId}`);

    } catch (error) {
      console.error(`Failed to export ${cardType} card ${cardId}:`, error);
      setExportError(error instanceof Error ? error.message : 'Export failed');
    } finally {
      setIsExporting(false);
    }
  }, [
    cardId,
    cardType,
    pdfData,
    pdfMode,
    extractionSettings,
    outputSettings,
    colorTransformation,
    multiFileImport,
    activePages,
    cardsPerPage,
    disabled,
    isExporting
  ]);

  // Clear error when props change
  React.useEffect(() => {
    setExportError('');
  }, [cardId, cardType]);

  return (
    <div className="flex flex-col items-start gap-2">
      <button
        onClick={handleExportPage}
        disabled={disabled || isExporting}
        className={`
          inline-flex items-center gap-2 px-3 py-2 text-sm font-medium
          rounded-md border transition-colors duration-200
          ${disabled || isExporting
            ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
            : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2'
          }
          ${className}
        `}
        title={`Export ${cardType} card ${cardId} as PDF preview`}
      >
        {isExporting ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Download className="w-4 h-4" />
        )}
        {children || (isExporting ? 'Exporting...' : 'Export Page')}
      </button>
      
      {exportError && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1 max-w-xs">
          {exportError}
        </div>
      )}
    </div>
  );
};

export default ExportPageButton;