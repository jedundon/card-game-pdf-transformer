import React, { useState, useMemo, useEffect } from 'react';
import { ChevronLeftIcon, DownloadIcon, CheckCircleIcon } from 'lucide-react';
import { AddFilesButton } from './AddFilesButton';
import { 
  getActivePagesWithSource,
  calculateTotalCards,
  getAvailableCardIds,
  getCardInfo,
  extractCardImage as extractCardImageUtil,
  extractCardImageFromCanvas,
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
  multiFileImport: any; // Add multiFileImport as a prop
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
  multiFileImport,
  onPrevious
}) => {
  const [exportStatus, setExportStatus] = useState<'idle' | 'processing' | 'completed' | 'error'>('idle');
  const [exportError, setExportError] = useState<string>('');
  const [exportProgress, setExportProgress] = useState<string>('');
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

  // Unified page data handling - always prioritize multi-file state
  const unifiedPages = useMemo(() => {
    if (multiFileImport.multiFileState.pages.length > 0) {
      // Use pages from multi-file import with source information
      return multiFileImport.multiFileState.pages;
    } else if (pageSettings.length > 0) {
      // Fallback: convert pageSettings to unified format for backward compatibility
      return pageSettings.map((page: any, index: number) => ({
        ...page,
        fileName: 'current.pdf', // Default filename for single PDF mode
        fileType: 'pdf' as const,
        originalPageIndex: index,
        displayOrder: index
      }));
    } else {
      // No data available
      return [];
    }
  }, [multiFileImport.multiFileState.pages, pageSettings]);

  // Calculate total cards using unified pages
  const activePages = useMemo(() => 
    getActivePagesWithSource(unifiedPages), 
    [unifiedPages]
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
    
    // Check if data is available for export
    if (!pdfData && (!multiFileImport.multiFileState.files || multiFileImport.multiFileState.files.length === 0)) {
      errors.push('No files available for export');
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
      const cardInfo = getCardInfo(cardIndex, activePages, extractionSettings, pdfMode, cardsPerPage, undefined, undefined);
      if (cardInfo.id === targetCardID && cardInfo.type.toLowerCase() === targetCardType) {
        return cardIndex;
      }
    }
    
    return null; // Card ID with matching type not found
  };

  // Generate a PDF with all cards of a specific type
  const generatePDF = async (cardType: 'front' | 'back'): Promise<Blob | null> => {
    // Validate data availability
    if (!pdfData && (!multiFileImport.multiFileState.files || multiFileImport.multiFileState.files.length === 0)) {
      throw new Error('No files available for export');
    }

    try {
      console.log(`Starting ${cardType} PDF generation...`);
      setExportProgress(`Preparing ${cardType} cards...`);
      
      // Get all card IDs for this type (already sorted numerically)
      const cardIds = getAvailableCardIds(cardType, totalCards, pdfMode, activePages, cardsPerPage, extractionSettings);
      
      console.log(`Available ${cardType} card IDs (sorted):`, cardIds);
      
      if (cardIds.length === 0) {
        console.log(`No ${cardType} cards found`);
        return null;
      }

      // Validate jsPDF creation
      let doc: jsPDF;
      try {
        doc = new jsPDF({
          orientation: outputSettings.pageSize.width > outputSettings.pageSize.height ? 'landscape' : 'portrait',
          unit: 'in',
          format: [outputSettings.pageSize.width, outputSettings.pageSize.height]
        });
      } catch (error) {
        throw new Error(`Failed to create PDF document: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }

      let cardCount = 0;
      let colorTransformationCount = 0;
      const failedCards: number[] = [];
      
      console.log(`Processing ${cardIds.length} ${cardType} cards in numerical order...`);
      console.log(`Color adjustments ${hasColorAdjustments ? 'will be applied' : 'are disabled (all settings are neutral)'} for ${cardType} cards`);
      
      // Process each card ID in sorted order
      for (let i = 0; i < cardIds.length; i++) {
        const cardId = cardIds[i];
        
        try {
          setExportProgress(`Processing ${cardType} card ${cardId} (${i + 1}/${cardIds.length})...`);
          
          // Find the card index for this card ID and type
          const cardIndex = findCardIndexByIDAndType(cardId, cardType);
          
          if (cardIndex === null) {
            console.warn(`Could not find card index for ${cardType} card ID ${cardId}`);
            failedCards.push(cardId);
            continue;
          }
          
          console.log(`Processing ${cardType} card ${cardId} at index ${cardIndex}...`);
          
          // Extract the card image with source-aware logic and timeout
          let extractPromise: Promise<string | null>;
          
          // Get current page info to determine extraction method
          const pageIndex = Math.floor(cardIndex / cardsPerPage);
          const currentPageInfo = activePages[pageIndex];
          
          if (currentPageInfo && currentPageInfo.fileType === 'image') {
            // Extract from image file
            const imageData = multiFileImport.getImageData(currentPageInfo.fileName);
            if (!imageData) {
              console.error(`No image data found for file: ${currentPageInfo.fileName}`);
              failedCards.push(cardId);
              continue;
            }
            extractPromise = extractCardImageFromCanvas(cardIndex, imageData, pdfMode, activePages, extractionSettings);
          } else {
            // Extract from PDF (original logic)
            extractPromise = extractCardImageUtil(cardIndex, pdfData, pdfMode, activePages, unifiedPages, extractionSettings);
          }
          const extractTimeout = new Promise<null>((_, reject) => 
            setTimeout(() => reject(new Error(`Card ${cardId} extraction timed out`)), 30000)
          );
          
          const cardImageUrl = await Promise.race([extractPromise, extractTimeout]);
          
          if (!cardImageUrl) {
            console.warn(`Failed to extract card image for ${cardType} card ${cardId}`);
            failedCards.push(cardId);
            continue;
          }

          // Create a new page for each card
          if (cardCount > 0) {
            doc.addPage();
          }

          console.log(`Processing ${cardType} card ${cardId} with unified render utils...`);
          
          // Use unified rendering functions with timeout
          const renderPromise = calculateFinalCardRenderDimensions(cardImageUrl, outputSettings);
          const renderTimeout = new Promise<never>((_, reject) => 
            setTimeout(() => reject(new Error(`Card ${cardId} render calculation timed out`)), 20000)
          );
          
          const renderDimensions = await Promise.race([renderPromise, renderTimeout]);
          const positioning = calculateCardPositioning(renderDimensions, outputSettings, cardType);
          
          const processPromise = processCardImageForRendering(cardImageUrl, renderDimensions, positioning.rotation);
          const processTimeout = new Promise<never>((_, reject) => 
            setTimeout(() => reject(new Error(`Card ${cardId} image processing timed out`)), 20000)
          );
          
          const processedImage = await Promise.race([processPromise, processTimeout]);
          
          console.log(`Card ${cardId} final dimensions: ${positioning.width.toFixed(3)}" × ${positioning.height.toFixed(3)}" at (${positioning.x.toFixed(3)}", ${positioning.y.toFixed(3)}") with ${positioning.rotation}° rotation`);
          
          // Apply color transformation to the processed image
          let finalImageUrl = processedImage.imageUrl;
          if (hasColorAdjustments) {
            try {
              const colorPromise = applyColorTransformation(processedImage.imageUrl, currentColorTransformation);
              const colorTimeout = new Promise<never>((_, reject) => 
                setTimeout(() => reject(new Error(`Card ${cardId} color transformation timed out`)), 15000)
              );
              
              finalImageUrl = await Promise.race([colorPromise, colorTimeout]);
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

          // Validate dimensions
          if (finalWidth <= 0 || finalHeight <= 0) {
            throw new Error(`Invalid dimensions for card ${cardId}: ${finalWidth}" × ${finalHeight}"`);
          }

          // Warn if card goes off page (but still allow it in case user intends it)
          if (finalX < 0 || finalX + finalWidth > outputSettings.pageSize.width) {
            console.warn(`Card ${cardId} X position (${finalX.toFixed(3)}") may be off page (width: ${outputSettings.pageSize.width}")`);
          }
          if (finalY < 0 || finalY + finalHeight > outputSettings.pageSize.height) {
            console.warn(`Card ${cardId} Y position (${finalY.toFixed(3)}") may be off page (height: ${outputSettings.pageSize.height}")`);
          }

          console.log(`Adding ${cardType} card ${cardId} to PDF at position (${finalX.toFixed(2)}", ${finalY.toFixed(2)}") with size ${finalWidth.toFixed(2)}" × ${finalHeight.toFixed(2)}"`);

          // Add the card image to PDF with error handling
          try {
            doc.addImage(
              finalImageUrl,
              'PNG',
              finalX,
              finalY,
              finalWidth,
              finalHeight
            );
          } catch (error) {
            throw new Error(`Failed to add card ${cardId} to PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }

          cardCount++;
          
        } catch (error) {
          console.error(`Failed to process ${cardType} card ${cardId}:`, error);
          failedCards.push(cardId);
          
          // If more than 50% of cards fail, abort the process
          if (failedCards.length > cardIds.length / 2) {
            throw new Error(`Too many cards failed to process (${failedCards.length}/${cardIds.length}). Export aborted.`);
          }
          
          continue;
        }
      }

      console.log(`${cardType} PDF generation completed with ${cardCount} cards${hasColorAdjustments ? `, ${colorTransformationCount} with color transformations applied` : ' (no color adjustments)'}`);
      
      if (failedCards.length > 0) {
        console.warn(`${failedCards.length} ${cardType} cards failed to process: ${failedCards.join(', ')}`);
      }

      if (cardCount === 0) {
        throw new Error(`No ${cardType} cards were successfully processed`);
      }

      // Generate PDF blob with error handling
      try {
        setExportProgress(`Finalizing ${cardType} PDF...`);
        return new Blob([doc.output('arraybuffer')], { type: 'application/pdf' });
      } catch (error) {
        throw new Error(`Failed to generate ${cardType} PDF blob: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
      
    } catch (error) {
      console.error(`Error generating ${cardType} PDF:`, error);
      throw error; // Re-throw to be handled by caller
    }
  };

  const handleExport = async () => {
    // Reset state
    setExportStatus('processing');
    setExportError('');
    setExportProgress('Initializing export...');
    
    // Clean up any existing blob URLs
    if (exportedFiles.fronts) {
      URL.revokeObjectURL(exportedFiles.fronts);
    }
    if (exportedFiles.backs) {
      URL.revokeObjectURL(exportedFiles.backs);
    }
    setExportedFiles({ fronts: null, backs: null });
    
    try {
      console.log('Starting PDF export process...');
      setExportProgress('Validating export settings...');
      
      // Validate settings before export
      const validation = validateExportSettings();
      if (!validation.isValid) {
        const errorMessage = 'Export validation failed:\n\n' + validation.errors.join('\n');
        console.error('Export validation failed:', validation.errors);
        setExportError(errorMessage);
        setExportStatus('error');
        return;
      }
      
      console.log('PDF Mode:', pdfMode);
      console.log('Total Cards:', totalCards);
      console.log('Active Pages:', activePages.length);
      console.log('Output Settings:', outputSettings);
      
      setExportProgress('Generating PDF files...');
      
      // Generate PDFs with individual error handling
      let frontsPdf: Blob | null = null;
      let backsPdf: Blob | null = null;
      let frontsError: string | null = null;
      let backsError: string | null = null;
      
      try {
        setExportProgress('Generating fronts PDF...');
        frontsPdf = await generatePDF('front');
      } catch (error) {
        frontsError = error instanceof Error ? error.message : 'Unknown error generating fronts PDF';
        console.error('Failed to generate fronts PDF:', error);
      }
      
      try {
        setExportProgress('Generating backs PDF...');
        backsPdf = await generatePDF('back');
      } catch (error) {
        backsError = error instanceof Error ? error.message : 'Unknown error generating backs PDF';
        console.error('Failed to generate backs PDF:', error);
      }
      
      // Check if any PDFs were generated successfully
      if (!frontsPdf && !backsPdf) {
        const errorMessages = [];
        if (frontsError) errorMessages.push(`Fronts PDF: ${frontsError}`);
        if (backsError) errorMessages.push(`Backs PDF: ${backsError}`);
        
        throw new Error(`Failed to generate any PDF files:\n\n${errorMessages.join('\n\n')}`);
      }
      
      // Log warnings for partial failures
      if (frontsError && backsPdf) {
        console.warn('Fronts PDF generation failed, but backs PDF was successful:', frontsError);
      }
      if (backsError && frontsPdf) {
        console.warn('Backs PDF generation failed, but fronts PDF was successful:', backsError);
      }

      console.log('PDF generation completed:', {
        frontsPdf: frontsPdf ? 'Generated' : 'Failed',
        backsPdf: backsPdf ? 'Generated' : 'Failed'
      });

      setExportProgress('Creating download links...');
      
      // Create download URLs with error handling
      let frontsUrl: string | null = null;
      let backsUrl: string | null = null;
      
      try {
        frontsUrl = frontsPdf ? URL.createObjectURL(frontsPdf) : null;
      } catch (error) {
        console.error('Failed to create fronts blob URL:', error);
        frontsError = 'Failed to create download link for fronts PDF';
      }
      
      try {
        backsUrl = backsPdf ? URL.createObjectURL(backsPdf) : null;
      } catch (error) {
        console.error('Failed to create backs blob URL:', error);
        backsError = 'Failed to create download link for backs PDF';
      }

      setExportedFiles({
        fronts: frontsUrl,
        backs: backsUrl
      });
      
      // Set final status
      if (frontsUrl || backsUrl) {
        setExportStatus('completed');
        setExportProgress('Export completed successfully!');
        
        // Show warning if some PDFs failed
        if (frontsError || backsError) {
          const warnings = [];
          if (frontsError) warnings.push(`Fronts: ${frontsError}`);
          if (backsError) warnings.push(`Backs: ${backsError}`);
          
          setExportError(`Some files failed to generate:\n\n${warnings.join('\n\n')}\n\nSuccessfully generated files are available for download.`);
        }
      } else {
        throw new Error('Failed to create download links for generated PDFs');
      }
      
    } catch (error) {
      console.error('Export failed:', error);
      
      let errorMessage = 'Export failed due to an unexpected error.';
      
      if (error instanceof Error) {
        if (error.message.includes('validation failed')) {
          errorMessage = error.message;
        } else if (error.message.includes('timeout') || error.message.includes('timed out')) {
          errorMessage = 'Export timed out. This can happen with large or complex PDFs. Please try:\n\n• Using a smaller PDF file\n• Reducing output quality settings\n• Refreshing the page and trying again';
        } else if (error.message.includes('memory') || error.message.includes('out of memory')) {
          errorMessage = 'Not enough memory to complete export. Please try:\n\n• Refreshing the page\n• Using a smaller PDF file\n• Closing other browser tabs\n• Reducing card scale or page size';
        } else if (error.message.includes('Failed to generate any PDF files')) {
          errorMessage = error.message;
        } else {
          errorMessage = `Export failed: ${error.message}`;
        }
      }
      
      setExportError(errorMessage);
      setExportStatus('error');
      setExportProgress('');
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
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-800">Export PDFs</h2>
        
        {/* Add Files button */}
        <AddFilesButton 
          multiFileImport={multiFileImport}
          variant="subtle"
          size="sm"
        />
      </div>
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <h3 className="text-lg font-medium text-gray-800 mb-3">
          Export Summary
        </h3>        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Source Type:</span>
              <span className="font-medium text-gray-800">
                {(() => {
                  if (multiFileImport.multiFileState.files.length > 0) {
                    const fileTypes = [...new Set(multiFileImport.multiFileState.files.map((f: any) => f.type))];
                    if (fileTypes.length === 1) {
                      return fileTypes[0] === 'pdf' ? 'PDF Only' : 'Images Only';
                    } else {
                      return 'Mixed (PDF + Images)';
                    }
                  } else {
                    return 'Single PDF';
                  }
                })()}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">PDF Mode:</span>
              <span className="font-medium text-gray-800">{pdfMode.type}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Total Cards:</span>
              <span className="font-medium text-gray-800">
                {(() => {
                  const frontCards = getAvailableCardIds('front', totalCards, pdfMode, activePages, cardsPerPage, extractionSettings).length;
                  const backCards = getAvailableCardIds('back', totalCards, pdfMode, activePages, cardsPerPage, extractionSettings).length;
                  const effectiveTotal = frontCards + backCards;
                  const skippedCount = extractionSettings.skippedCards?.length || 0;
                  return skippedCount > 0 ? `${effectiveTotal} (${skippedCount} skipped)` : totalCards;
                })()}
              </span>
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
              <p className="text-gray-600 mb-2">Processing your files...</p>
              {exportProgress && (
                <p className="text-sm text-gray-500">{exportProgress}</p>
              )}
            </div>
          )}

          {exportStatus === 'error' && (
            <div className="text-center py-8">
              <div className="mb-6">
                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-red-600 text-2xl">⚠️</span>
                </div>
                <h3 className="text-lg font-medium text-red-800 mb-2">Export Failed</h3>
                <div className="max-w-md mx-auto">
                  <p className="text-sm text-red-700 whitespace-pre-line mb-4">
                    {exportError}
                  </p>
                  <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <button
                      onClick={() => {
                        setExportStatus('idle');
                        setExportError('');
                        setExportProgress('');
                      }}
                      className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
                    >
                      Try Again
                    </button>
                    <button
                      onClick={onPrevious}
                      className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
                    >
                      Go Back
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
          {exportStatus === 'completed' && (
            <div className="space-y-6">
              <div className="flex items-center justify-center py-2">
                <div className={`flex items-center ${exportError ? 'text-yellow-600' : 'text-green-600'}`}>
                  <CheckCircleIcon size={24} className="mr-2" />
                  <span className="font-medium">
                    {exportError ? 'PDF files generated with warnings' : 'PDF files generated successfully!'}
                  </span>
                </div>
              </div>
              
              {/* Show warnings if there were partial failures */}
              {exportError && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <span className="text-yellow-600">⚠️</span>
                    </div>
                    <div className="ml-3">
                      <h3 className="text-sm font-medium text-yellow-800">
                        Partial Export Warning
                      </h3>
                      <div className="mt-2 text-sm text-yellow-700 whitespace-pre-line">
                        {exportError}
                      </div>
                    </div>
                  </div>
                </div>
              )}
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