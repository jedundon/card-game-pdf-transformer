import React, { useState, useMemo, useEffect } from 'react';
import { ChevronLeftIcon, DownloadIcon, CheckCircleIcon } from 'lucide-react';
import { 
  getRotationForCardType, 
  getActivePages, 
  calculateTotalCards,
  getAvailableCardIds,
  getCardInfo,
  extractCardImage as extractCardImageUtil,
  calculateCardDimensions
} from '../utils/cardUtils';
import { DPI_CONSTANTS } from '../constants';
import jsPDF from 'jspdf';

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
    
    // Check if total cards is greater than 0
    if (totalCards <= 0) {
      errors.push('No cards available for export');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  };

  // Generate a PDF with all cards of a specific type
  const generatePDF = async (cardType: 'front' | 'back'): Promise<Blob | null> => {
    if (!pdfData) return null;

    try {
      console.log(`Starting ${cardType} PDF generation...`);
      
      // Get all card IDs for this type
      const cardIds = getAvailableCardIds(cardType, totalCards, pdfMode, activePages, cardsPerPage, extractionSettings);
      
      console.log(`Available ${cardType} card IDs:`, cardIds);
      
      if (cardIds.length === 0) {
        console.log(`No ${cardType} cards found`);
        return null;
      }

      // Create new PDF document
      const doc = new jsPDF({
        orientation: outputSettings.pageSize.width > outputSettings.pageSize.height ? 'landscape' : 'portrait',
        unit: 'in',
        format: [outputSettings.pageSize.width, outputSettings.pageSize.height]
      });

      let cardCount = 0;
      
      // Find the maximum card index for iteration
      const maxCardIndex = activePages.length * cardsPerPage;
      
      console.log(`Processing up to ${maxCardIndex} card indices for ${cardType} cards...`);
      
      // Process each card index to find cards of the specified type
      for (let cardIndex = 0; cardIndex < maxCardIndex; cardIndex++) {
        const cardInfo = getCardInfo(cardIndex, activePages, extractionSettings, pdfMode, cardsPerPage);
        
        // Skip cards that don't match the type we're generating
        if (cardInfo.type.toLowerCase() !== cardType) continue;
        
        console.log(`Processing ${cardType} card ${cardInfo.id} at index ${cardIndex}...`);
        
        // Extract the card image
        const cardImageUrl = await extractCardImageUtil(cardIndex, pdfData, pdfMode, activePages, pageSettings, extractionSettings);
        
        if (!cardImageUrl) {
          console.warn(`Failed to extract card image for ${cardType} card ${cardInfo.id}`);
          continue;
        }

        // Create a new page for each card
        if (cardCount > 0) {
          doc.addPage();
        }        // Calculate card dimensions using new settings
        const cardDimensions = calculateCardDimensions(outputSettings);

        // Convert pixels to inches at target DPI
        const cardWidthInches = cardDimensions.width / DPI_CONSTANTS.EXTRACTION_DPI;
        const cardHeightInches = cardDimensions.height / DPI_CONSTANTS.EXTRACTION_DPI;// Apply rotation if needed by rotating the image on a canvas before adding to PDF
        const rotation = getRotationForCardType(outputSettings, cardType);
        let finalImageUrl = cardImageUrl;
        let finalWidth = cardWidthInches;
        let finalHeight = cardHeightInches;
        
        if (rotation !== 0) {
          console.log(`Applying ${rotation}° rotation to ${cardType} card #${cardInfo.id}`);
          
          try {
            // Create a new canvas for rotation
            const rotationCanvas = document.createElement('canvas');
            const rotationCtx = rotationCanvas.getContext('2d');
            
            if (rotationCtx) {
              // Load the image
              const img = new Image();
              await new Promise((resolve, reject) => {
                img.onload = resolve;
                img.onerror = reject;
                img.src = cardImageUrl;
              });
              
              // Calculate rotated canvas dimensions
              const radians = (rotation * Math.PI) / 180;
              const cos = Math.abs(Math.cos(radians));
              const sin = Math.abs(Math.sin(radians));
              
              const rotatedWidth = img.width * cos + img.height * sin;
              const rotatedHeight = img.width * sin + img.height * cos;
              
              rotationCanvas.width = rotatedWidth;
              rotationCanvas.height = rotatedHeight;
              
              // Clear canvas and setup transformation
              rotationCtx.clearRect(0, 0, rotatedWidth, rotatedHeight);
              rotationCtx.save();
              
              // Move to center, rotate, then draw image centered
              rotationCtx.translate(rotatedWidth / 2, rotatedHeight / 2);
              rotationCtx.rotate(radians);
              rotationCtx.drawImage(img, -img.width / 2, -img.height / 2);
              
              rotationCtx.restore();
              
              // Get rotated image as data URL
              finalImageUrl = rotationCanvas.toDataURL('image/png');
              
              // Update dimensions for rotated image
              finalWidth = rotatedWidth / DPI_CONSTANTS.EXTRACTION_DPI;
              finalHeight = rotatedHeight / DPI_CONSTANTS.EXTRACTION_DPI;
              
              console.log(`Rotation applied successfully to ${cardType} card #${cardInfo.id}`);
            }
          } catch (error) {
            console.warn(`Failed to apply rotation to ${cardType} card #${cardInfo.id}:`, error);
            // Continue with original image if rotation fails
          }        }        // Calculate position
        const finalX = (outputSettings.pageSize.width - finalWidth) / 2 + outputSettings.offset.horizontal;
        const finalY = (outputSettings.pageSize.height - finalHeight) / 2 + outputSettings.offset.vertical;

        console.log(`Adding ${cardType} card ${cardInfo.id} to PDF at position (${finalX.toFixed(2)}", ${finalY.toFixed(2)}") with size ${finalWidth.toFixed(2)}" × ${finalHeight.toFixed(2)}"`);

        // Add the card image to PDF
        doc.addImage(
          finalImageUrl,
          'PNG',
          finalX,
          finalY,
          finalWidth,
          finalHeight
        );

        cardCount++;
      }

      console.log(`${cardType} PDF generation completed with ${cardCount} cards`);

      if (cardCount === 0) return null;

      // Return the PDF as a blob
      return new Blob([doc.output('arraybuffer')], { type: 'application/pdf' });
    } catch (error) {
      console.error(`Error generating ${cardType} PDF:`, error);
      return null;
    }
  };

  const handleExport = async () => {
    setExportStatus('processing');
    
    try {
      console.log('Starting PDF export process...');
      
      // Validate settings before export
      const validation = validateExportSettings();
      if (!validation.isValid) {
        console.error('Export validation failed:', validation.errors);
        setExportStatus('idle');
        return;
      }
      
      console.log('PDF Mode:', pdfMode);
      console.log('Total Cards:', totalCards);
      console.log('Active Pages:', activePages.length);
      console.log('Output Settings:', outputSettings);
      
      // Generate both PDFs
      const [frontsPdf, backsPdf] = await Promise.all([
        generatePDF('front'),
        generatePDF('back')
      ]);

      console.log('PDF generation completed:', {
        frontsPdf: frontsPdf ? 'Generated' : 'No fronts found',
        backsPdf: backsPdf ? 'Generated' : 'No backs found'
      });

      // Create download URLs
      const frontsUrl = frontsPdf ? URL.createObjectURL(frontsPdf) : null;
      const backsUrl = backsPdf ? URL.createObjectURL(backsPdf) : null;

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
            </div>            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Card Rotation:</span>
              <span className="font-medium text-gray-800">
                Front {getRotationForCardType(outputSettings, 'front')}°, Back {getRotationForCardType(outputSettings, 'back')}°
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