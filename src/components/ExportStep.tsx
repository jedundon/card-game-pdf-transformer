import React, { useState, useMemo, useEffect } from 'react';
import { ChevronLeftIcon, DownloadIcon, CheckCircleIcon } from 'lucide-react';
import { 
  getActivePages, 
  calculateTotalCards,
  getAvailableCardIds,
  getCardInfo,
  extractCardImage as extractCardImageUtil,
  calculateCardDimensions,
  getRotationForCardType
} from '../utils/cardUtils';
import { 
  calculateFinalCardRenderDimensions,
  calculateCardPositioning,
  processCardImageForRendering
} from '../utils/renderUtils';
import { 
  applyColorTransformation,
  getDefaultColorTransformation,
  ColorTransformation,
  hasNonDefaultColorSettings
} from '../utils/colorUtils';
import jsPDF from 'jspdf';

interface ExportStepProps {
  pdfData: any;
  pdfMode: any;
  pageSettings: any;
  extractionSettings: any;
  outputSettings: any;
  colorSettings: any;
  currentPdfFileName?: string;
  onPrevious: () => void;
}

export const ExportStep: React.FC<ExportStepProps> = ({
  pdfData,
  pdfMode,
  pageSettings,
  extractionSettings,
  outputSettings,
  colorSettings,
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

  // Get current color transformation settings
  const currentColorTransformation: ColorTransformation = useMemo(() => {
    return colorSettings?.finalAdjustments || getDefaultColorTransformation();
  }, [colorSettings?.finalAdjustments]);

  // Check if color adjustments are being applied
  const hasColorAdjustments = useMemo(() => {
    return hasNonDefaultColorSettings(currentColorTransformation);
  }, [currentColorTransformation]);

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
    };
  };

  // Helper function to find card index by card ID and type
  const findCardIndexByIDAndType = (targetCardID: number, targetCardType: 'front' | 'back'): number | null => {
    const maxIndex = activePages.length * cardsPerPage;
    
    for (let cardIndex = 0; cardIndex < maxIndex; cardIndex++) {
      const cardInfo = getCardInfo(cardIndex, activePages, extractionSettings, pdfMode, cardsPerPage);
      if (cardInfo.id === targetCardID && cardInfo.type.toLowerCase() === targetCardType) {
        return cardIndex;
      }
    }
    
    return null; // Card ID with matching type not found
  };

  // Generate a PDF with all cards of a specific type
  const generatePDF = async (cardType: 'front' | 'back'): Promise<Blob | null> => {
    if (!pdfData) return null;

    try {
      console.log(`Starting ${cardType} PDF generation...`);
      
      // Get all card IDs for this type (already sorted numerically)
      const cardIds = getAvailableCardIds(cardType, totalCards, pdfMode, activePages, cardsPerPage, extractionSettings);
      
      console.log(`Available ${cardType} card IDs (sorted):`, cardIds);
      
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
      let colorTransformationCount = 0;
      
      console.log(`Processing ${cardIds.length} ${cardType} cards in numerical order...`);
      console.log(`Color adjustments ${hasColorAdjustments ? 'will be applied' : 'are disabled (all settings are neutral)'} for ${cardType} cards`);
      
      // Process each card ID in sorted order
      for (const cardId of cardIds) {
        // Find the card index for this card ID and type
        const cardIndex = findCardIndexByIDAndType(cardId, cardType);
        
        if (cardIndex === null) {
          console.warn(`Could not find card index for ${cardType} card ID ${cardId}`);
          continue;
        }
        
        console.log(`Processing ${cardType} card ${cardId} at index ${cardIndex}...`);
        
        // Extract the card image
        const cardImageUrl = await extractCardImageUtil(cardIndex, pdfData, pdfMode, activePages, pageSettings, extractionSettings);
        
        if (!cardImageUrl) {
          console.warn(`Failed to extract card image for ${cardType} card ${cardId}`);
          continue;
        }

        // Create a new page for each card
        if (cardCount > 0) {
          doc.addPage();
        }

        console.log(`Processing ${cardType} card ${cardId} with unified render utils...`);
        
        try {
          // Use unified rendering functions for consistent behavior
          const renderDimensions = await calculateFinalCardRenderDimensions(cardImageUrl, outputSettings);
          const positioning = calculateCardPositioning(renderDimensions, outputSettings, cardType);
          const processedImage = await processCardImageForRendering(cardImageUrl, renderDimensions, positioning.rotation);
          
          console.log(`Card ${cardId} final dimensions: ${positioning.width.toFixed(3)}" × ${positioning.height.toFixed(3)}" at (${positioning.x.toFixed(3)}", ${positioning.y.toFixed(3)}") with ${positioning.rotation}° rotation`);
          
          // Apply color transformation to the processed image
          let finalImageUrl = processedImage.imageUrl;
          if (hasColorAdjustments) {
            try {
              finalImageUrl = await applyColorTransformation(processedImage.imageUrl, currentColorTransformation);
              colorTransformationCount++;
              console.log(`Applied color transformation to ${cardType} card ${cardId}`);
            } catch (error) {
              console.warn(`Failed to apply color transformation to ${cardType} card ${cardId}:`, error);
              // Use original image if color transformation fails
              finalImageUrl = processedImage.imageUrl;
            }
          }
          const finalX = positioning.x;
          const finalY = positioning.y;
          const finalWidth = positioning.width;
          const finalHeight = positioning.height;

          // Warn if card goes off page (but still allow it in case user intends it)
          if (finalX < 0 || finalX + finalWidth > outputSettings.pageSize.width) {
            console.warn(`Card ${cardId} X position (${finalX.toFixed(3)}") may be off page (width: ${outputSettings.pageSize.width}")`);
          }
          if (finalY < 0 || finalY + finalHeight > outputSettings.pageSize.height) {
            console.warn(`Card ${cardId} Y position (${finalY.toFixed(3)}") may be off page (height: ${outputSettings.pageSize.height}")`);
          }

          console.log(`Adding ${cardType} card ${cardId} to PDF at position (${finalX.toFixed(2)}", ${finalY.toFixed(2)}") with size ${finalWidth.toFixed(2)}" × ${finalHeight.toFixed(2)}"`);

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
        } catch (error) {
          console.warn(`Failed to process ${cardType} card ${cardId} with unified render utils:`, error);
          // Skip this card if processing fails
          continue;
        }
      }

      console.log(`${cardType} PDF generation completed with ${cardCount} cards${hasColorAdjustments ? `, ${colorTransformationCount} with color transformations applied` : ' (no color adjustments)'}`);

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
        alert('Export validation failed:\n\n' + validation.errors.join('\n'));
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
              <span className="text-gray-600">Color Adjustments:</span>
              <span className={`font-medium ${hasColorAdjustments ? 'text-green-700' : 'text-gray-800'}`}>
                {hasColorAdjustments ? '✓ Applied' : 'None'}
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