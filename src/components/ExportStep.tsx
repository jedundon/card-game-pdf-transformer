import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { ChevronLeftIcon, DownloadIcon, CheckCircleIcon } from 'lucide-react';
import { AddFilesButton } from './AddFilesButton';
import { MultiStreamExportManager } from './shared/MultiStreamExportManager';
import { 
  getActivePagesWithSource,
  calculateTotalCards,
  getAvailableCardIds,
  getCardInfo,
  extractCardImageFromCanvas,
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
import { extractCardImageFromPdfPage } from '../utils/pdfCardExtraction';
import type { ExportStepProps /*, MultiFileImportHook */ } from '../types';
import jsPDF from 'jspdf';


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
  // State declarations first
  const [selectedGroupIds, setSelectedGroupIds] = useState<Set<string>>(new Set());
  const [exportStatus, setExportStatus] = useState<'idle' | 'processing' | 'completed' | 'error'>('idle');
  const [exportError, setExportError] = useState<string>('');
  const [exportProgress, setExportProgress] = useState<string>('');
  const [exportedFiles, setExportedFiles] = useState<{
    [groupId: string]: {
      fronts: string | null;
      backs: string | null;
    };
  }>({});

  // Get page groups from multi-file state - must be declared before callbacks that use it
  const groups = useMemo(() => {
    return multiFileImport.multiFileState.pageGroups || [];
  }, [multiFileImport.multiFileState.pageGroups]);
  
  // Group selection helpers
  const handleGroupSelectionChange = useCallback((groupId: string, selected: boolean) => {
    setSelectedGroupIds(prev => {
      const newSet = new Set(prev);
      if (selected) {
        newSet.add(groupId);
      } else {
        newSet.delete(groupId);
      }
      return newSet;
    });
    
    // Reset export state when changing selection
    setExportStatus('idle');
    setExportError('');
    setExportProgress('');
    
    // Clean up old exported files
    Object.values(exportedFiles).forEach(files => {
      if (files.fronts) URL.revokeObjectURL(files.fronts);
      if (files.backs) URL.revokeObjectURL(files.backs);
    });
    setExportedFiles({});
  }, [exportedFiles]);
  
  const handleSelectAll = useCallback(() => {
    const allGroupIds = new Set([
      'default', // Always include default group
      ...groups.map(g => g.id)
    ]);
    setSelectedGroupIds(allGroupIds);
  }, [groups]);
  
  const handleSelectNone = useCallback(() => {
    setSelectedGroupIds(new Set());
  }, []);

  // Helper function to get effective settings for a specific group
  const getEffectiveSettingsForGroup = useCallback((groupId: string | null) => {
    if (!groupId || groupId === 'default') {
      return {
        extraction: extractionSettings,
        output: outputSettings,
        color: colorSettings,
        pdfMode: pdfMode
      };
    }
    
    const group = groups.find(g => g.id === groupId);
    if (!group) {
      return {
        extraction: extractionSettings,
        output: outputSettings,
        color: colorSettings,
        pdfMode: pdfMode
      };
    }
    
    return {
      extraction: group.settings?.extraction ? 
        { ...extractionSettings, ...group.settings.extraction } : 
        extractionSettings,
      output: group.settings?.output ? 
        { ...outputSettings, ...group.settings.output } : 
        outputSettings,
      color: group.settings?.color ? 
        { ...colorSettings, ...group.settings.color } : 
        colorSettings,
      pdfMode: group.processingMode || pdfMode
    };
  }, [extractionSettings, outputSettings, colorSettings, pdfMode, groups]);

  // Get current color transformation settings (use global settings for summary)
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

  // Helper function to get pages for a specific group
  const getPagesForGroup = useCallback((groupId: string | null) => {
    const allPages = getActivePagesWithSource(unifiedPages);
    
    if (!groupId || groupId === 'default') {
      // Get ungrouped pages for default group
      const groupedPageIndices = new Set(
        groups
          .filter(g => g.id !== 'default')
          .flatMap(g => g.pageIndices)
      );
      
      return allPages.filter((page, index) => !groupedPageIndices.has(index));
    }
    
    const group = groups.find(g => g.id === groupId);
    if (!group) return [];
    
    return group.pageIndices
      .map(index => unifiedPages[index])
      .filter(page => page && !page.skip && !page.removed);
  }, [unifiedPages, groups]);

  // Calculate stats for all groups
  const groupStats = useMemo(() => {
    // Check if default group already exists
    const hasDefaultGroup = groups.some(g => g.id === 'default');
    
    const allGroups = [
      // Only add default group if it doesn't already exist
      ...(hasDefaultGroup ? [] : [{ id: 'default', name: 'Default Group' }]),
      ...groups.map(g => ({ id: g.id, name: g.name }))
    ];
    
    return allGroups.map(group => {
      const groupPages = getPagesForGroup(group.id);
      const groupSettings = getEffectiveSettingsForGroup(group.id);
      const cardsPerPage = groupSettings.extraction.grid.rows * groupSettings.extraction.grid.columns;
      const totalCards = calculateTotalCards(groupSettings.pdfMode, groupPages, cardsPerPage);
      
      // Fix parameter order for getAvailableCardIds: (viewMode, totalCards, pdfMode, activePages, cardsPerPage, extractionSettings)
      const frontCards = getAvailableCardIds('front', totalCards, groupSettings.pdfMode, groupPages, cardsPerPage, groupSettings.extraction).length;
      const backCards = getAvailableCardIds('back', totalCards, groupSettings.pdfMode, groupPages, cardsPerPage, groupSettings.extraction).length;
      
      return {
        id: group.id,
        name: group.name,
        pageCount: groupPages.length,
        frontCards,
        backCards,
        totalCards,
        processingMode: groupSettings.pdfMode.type,
        hasCustomSettings: group.id !== 'default' && groups.find(g => g.id === group.id)?.settings !== undefined
      };
    }).filter(stat => stat.pageCount > 0); // Only include groups with pages
  }, [groups, getPagesForGroup, getEffectiveSettingsForGroup]);

  // Note: activePages removed as it was unused - use getActivePagesWithSource(unifiedPages) directly where needed
  
  // Overall totals across all groups
  const overallTotals = useMemo(() => {
    return groupStats.reduce((totals, group) => ({
      pages: totals.pages + group.pageCount,
      frontCards: totals.frontCards + group.frontCards,
      backCards: totals.backCards + group.backCards,
      totalCards: totals.totalCards + group.totalCards
    }), { pages: 0, frontCards: 0, backCards: 0, totalCards: 0 });
  }, [groupStats]);

  // Create a stable reference to image data map to prevent dependency issues
  const imageDataMap = useMemo(() => {
    const map = new Map();
    if (multiFileImport?.multiFileState?.pages) {
      multiFileImport.multiFileState.pages.forEach((page: any) => {
        if (page.fileType === 'image') {
          const imageData = multiFileImport.getImageData(page.fileName);
          if (imageData) {
            map.set(page.fileName, imageData);
          }
        }
      });
    }
    return map;
  }, [multiFileImport]);
  
  // Create a stable reference to PDF data map to prevent dependency issues
  const pdfDataMap = useMemo(() => {
    const map = new Map();
    if (multiFileImport?.multiFileState?.pages) {
      multiFileImport.multiFileState.pages.forEach((page: any) => {
        if (page.fileType === 'pdf') {
          const pdfData = multiFileImport.getPdfData(page.fileName);
          if (pdfData) {
            map.set(page.fileName, pdfData);
          }
        }
      });
    }
    return map;
  }, [multiFileImport]);

  // Initialize selected groups to all groups by default
  useEffect(() => {
    if (groupStats.length > 0 && selectedGroupIds.size === 0) {
      const allGroupIds = new Set(groupStats.map(stat => stat.id));
      setSelectedGroupIds(allGroupIds);
    }
  }, [groupStats, selectedGroupIds.size]);
  // Cleanup blob URLs when component unmounts or files change
  useEffect(() => {
    return () => {
      Object.values(exportedFiles).forEach(files => {
        if (files.fronts) URL.revokeObjectURL(files.fronts);
        if (files.backs) URL.revokeObjectURL(files.backs);
      });
    };
  }, [exportedFiles]);


  // Generate a PDF with all cards of a specific type
  // Generate PDF for a specific group with group-specific settings
  const generatePDFForGroup = async (
    cardType: 'front' | 'back',
    groupId: string,
    groupSettings: {
      extraction: ExtractionSettings;
      output: OutputSettings;
      color: ColorSettings;
    },
    groupPages: (PageSettings & PageSource)[]
  ): Promise<Blob> => {
    try {
      console.log(`Generating ${cardType} PDF for group ${groupId}...`);
      
      // Get group-specific processing mode
      const groupProcessingMode = groupId === 'default' ? pdfMode : 
        groups.find(g => g.id === groupId)?.processingMode || pdfMode;
      
      // Calculate cards for this specific group
      const groupCardsPerPage = groupSettings.extraction.grid.rows * groupSettings.extraction.grid.columns;
      const groupTotalCards = calculateTotalCards(groupProcessingMode, groupPages, groupCardsPerPage);
      
      console.log(`Group ${groupId} ${cardType} cards:`, {
        pages: groupPages.length,
        cardsPerPage: groupCardsPerPage,
        totalCards: groupTotalCards,
        processingMode: groupProcessingMode
      });
      
      // Get available card IDs for this group
      const groupCardIds = getAvailableCardIds(
        cardType,
        groupTotalCards,
        groupProcessingMode,
        groupPages,
        groupCardsPerPage,
        groupSettings.extraction
      );
      
      if (groupCardIds.length === 0) {
        console.warn(`No ${cardType} cards found for group ${groupId}`);
        // Return an empty PDF rather than throwing an error
        const emptyDoc = new jsPDF({
          orientation: groupSettings.output.pageSize.width > groupSettings.output.pageSize.height ? 'landscape' : 'portrait',
          unit: 'in',
          format: [groupSettings.output.pageSize.width, groupSettings.output.pageSize.height]
        });
        const groupName = groupId === 'default' ? 'Default Group' : 
          groups.find(g => g.id === groupId)?.name || groupId;
        emptyDoc.text(`No ${cardType} cards found in group "${groupName}"`, 1, 1);
        return new Blob([emptyDoc.output('arraybuffer')], { type: 'application/pdf' });
      }
      
      // For card export, use one card per page approach
      // The PDF page size should accommodate the card size plus margins
      const cardWidth = groupSettings.output.cardSize?.widthInches || 2.5;
      const cardHeight = groupSettings.output.cardSize?.heightInches || 3.5;
      const margin = groupSettings.output.margin || 0.5;
      
      // Calculate required page size for one card plus margins
      const requiredPageWidth = cardWidth + 2 * margin;
      const requiredPageHeight = cardHeight + 2 * margin;
      
      // Use the larger of configured page size or required size for card
      const pageWidth = Math.max(groupSettings.output.pageSize.width, requiredPageWidth);
      const pageHeight = Math.max(groupSettings.output.pageSize.height, requiredPageHeight);
      
      // For card export, we use one card per page
      const cardsPerOutputPage = 1;
      
      // Create PDF document with calculated page settings to fit cards
      const doc = new jsPDF({
        orientation: pageWidth > pageHeight ? 'landscape' : 'portrait',
        unit: 'in',
        format: [pageWidth, pageHeight]
      });
      
      console.log(`Group ${groupId} layout:`, {
        pageSize: `${pageWidth}" x ${pageHeight}"`,
        cardSize: `${cardWidth}" x ${cardHeight}"`,
        layout: 'One card per page',
        cardsPerPage: cardsPerOutputPage
      });
      
      // Process each card using one card per page logic
      for (let i = 0; i < groupCardIds.length; i++) {
        const cardId = groupCardIds[i];
        
        // Add new page if needed (skip for first card)
        if (i > 0) {
          doc.addPage();
        }
        
        // Center the card on the page
        const x = (pageWidth - cardWidth) / 2;
        const y = (pageHeight - cardHeight) / 2;
        
        try {
          // Find the actual global card index that produces this card ID and type
          let globalCardIndex = -1;
          const maxIndex = groupPages.length * groupCardsPerPage;
          
          for (let testIndex = 0; testIndex < maxIndex; testIndex++) {
            const testCardInfo = getCardInfo(
              testIndex,
              groupPages,
              groupSettings.extraction,
              groupProcessingMode,
              groupCardsPerPage,
              groupSettings.extraction.pageDimensions?.width,
              groupSettings.extraction.pageDimensions?.height
            );
            
            if (testCardInfo.type.toLowerCase() === cardType && testCardInfo.id === cardId) {
              globalCardIndex = testIndex;
              break;
            }
          }
          
          if (globalCardIndex === -1) {
            console.warn(`Could not find global card index for card ${cardId} of type ${cardType} in group ${groupId}`);
            continue;
          }
          
          // Get card info using group-specific pages and settings
          const cardInfo = getCardInfo(
            globalCardIndex,
            groupPages,
            groupSettings.extraction,
            groupProcessingMode,
            groupCardsPerPage,
            groupSettings.extraction.pageDimensions?.width,
            groupSettings.extraction.pageDimensions?.height
          );
          
          if (!cardInfo) {
            console.warn(`No card info found for card ${cardId} in group ${groupId}`);
            continue;
          }
          
          // Calculate which page this card belongs to
          const pageIndex = Math.floor(globalCardIndex / groupCardsPerPage);
          if (pageIndex >= groupPages.length) {
            console.warn(`Page index ${pageIndex} exceeds available pages for card ${cardId} in group ${groupId}`);
            continue;
          }
          
          const pageData = groupPages[pageIndex];
          if (!pageData) {
            console.warn(`No page data found for page ${pageIndex}, card ${cardId} in group ${groupId}`);
            continue;
          }
          
          // Extract card image URL using source-aware logic
          let cardImageUrl: string | null = null;
          
          if (pageData.sourceType === 'image') {
            // Handle image source
            const imageData = imageDataMap.get(pageData.fileName);
            if (!imageData) {
              console.error(`No image data found for file: ${pageData.fileName}`);
              continue;
            }
            cardImageUrl = await extractCardImageFromCanvas(
              globalCardIndex,
              imageData,
              groupProcessingMode,
              groupPages,
              groupSettings.extraction
            );
          } else {
            // Handle PDF source
            const filePdfData = pdfDataMap.get(pageData.fileName) || pdfData;
            if (!filePdfData) {
              console.error(`No PDF data available for file ${pageData.fileName}`);
              continue;
            }
            
            // Use the PDF extraction method
            const actualPageNumber = pageData.originalPageIndex + 1;
            const cardOnPage = globalCardIndex % groupCardsPerPage;
            
            cardImageUrl = await extractCardImageFromPdfPage(
              filePdfData,
              actualPageNumber,
              cardOnPage,
              groupSettings.extraction,
              globalCardIndex,
              groupPages,
              groupProcessingMode
            );
          }
          
          if (!cardImageUrl) {
            console.warn(`Failed to extract card image for card ${cardId} in group ${groupId}`);
            continue;
          }
          
          // Calculate final card dimensions using the extracted image
          const groupCardDimensions = await calculateFinalCardRenderDimensions(
            cardImageUrl,
            groupSettings.output
          );
          
          // Calculate positioning
          const positioning = calculateCardPositioning(groupCardDimensions, groupSettings.output, cardType);
          
          // Process card image for rendering
          const processedImage = await processCardImageForRendering(
            cardImageUrl,
            groupCardDimensions,
            positioning.rotation
          );
          
          // Apply group-specific color transformations if needed
          let finalImageUrl = processedImage.imageUrl;
          const groupColorTransformation = groupSettings.color.finalAdjustments || {
            brightness: groupSettings.color.brightness ?? 0,
            contrast: groupSettings.color.contrast ?? 0,
            saturation: groupSettings.color.saturation ?? 0,
            gamma: groupSettings.color.gamma ?? 1.0,
            temperature: groupSettings.color.temperature ?? 0,
            tint: groupSettings.color.tint ?? 0,
            highlights: groupSettings.color.highlights ?? 0,
            shadows: groupSettings.color.shadows ?? 0,
            whites: groupSettings.color.whites ?? 0,
            blacks: groupSettings.color.blacks ?? 0
          };
          
          if (hasNonDefaultColorSettings(groupColorTransformation)) {
            finalImageUrl = await applyColorTransformation(processedImage.imageUrl, groupColorTransformation);
          }
          
          // Add to PDF
          doc.addImage(
            finalImageUrl,
            'JPEG',
            x,
            y,
            cardWidth,
            cardHeight
          );
          
        } catch (error) {
          console.error(`Error processing card ${cardId} in group ${groupId}:`, error);
          // Continue with next card instead of failing entire export
        }
      }
      
      // Generate PDF blob
      try {
        return new Blob([doc.output('arraybuffer')], { type: 'application/pdf' });
      } catch (error) {
        throw new Error(`Failed to generate ${cardType} PDF blob for group ${groupId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
      
    } catch (error) {
      console.error(`Error generating ${cardType} PDF for group ${groupId}:`, error);
      throw error;
    }
  };


  const handleExport = async () => {
    // Reset state
    setExportStatus('processing');
    setExportError('');
    setExportProgress('Initializing multi-group export...');
    
    // Clean up any existing blob URLs
    Object.values(exportedFiles).forEach(files => {
      if (files.fronts) URL.revokeObjectURL(files.fronts);
      if (files.backs) URL.revokeObjectURL(files.backs);
    });
    setExportedFiles({});
    
    // Validate that groups are selected
    if (selectedGroupIds.size === 0) {
      setExportError('Please select at least one group to export.');
      setExportStatus('error');
      return;
    }
    
    try {
      console.log('Starting multi-group PDF export process...');
      console.log('Selected Groups:', Array.from(selectedGroupIds));
      setExportProgress('Validating export settings...');
      
      const selectedGroupsArray = Array.from(selectedGroupIds);
      const newExportedFiles: { [groupId: string]: { fronts: string | null; backs: string | null } } = {};
      
      // Process each selected group
      for (let i = 0; i < selectedGroupsArray.length; i++) {
        const groupId = selectedGroupsArray[i];
        const groupName = groupId === 'default' ? 'Default Group' : 
          groups.find(g => g.id === groupId)?.name || groupId;
        
        setExportProgress(`Processing group "${groupName}" (${i + 1} of ${selectedGroupsArray.length})...`);
        
        try {
          // Get effective settings for this group
          const groupEffectiveSettings = getEffectiveSettingsForGroup(groupId === 'default' ? null : groupId);
          const groupPages = getPagesForGroup(groupId === 'default' ? null : groupId);
          
          console.log(`Processing group ${groupId}:`, {
            groupName,
            pageCount: groupPages.length,
            settings: groupEffectiveSettings
          });
          
          // Validate this group has pages
          if (groupPages.length === 0) {
            console.warn(`Group ${groupId} has no pages, skipping...`);
            continue;
          }
          
          // Generate PDFs for this group using its specific settings
          let groupFrontsPdf: Blob | null = null;
          let groupBacksPdf: Blob | null = null;
          let groupFrontsError: string | null = null;
          let groupBacksError: string | null = null;
          
          try {
            setExportProgress(`Generating fronts PDF for "${groupName}"...`);
            groupFrontsPdf = await generatePDFForGroup('front', groupId, groupEffectiveSettings, groupPages);
          } catch (error) {
            groupFrontsError = error instanceof Error ? error.message : 'Unknown error';
            console.error(`Failed to generate fronts PDF for group ${groupId}:`, error);
          }
          
          try {
            setExportProgress(`Generating backs PDF for "${groupName}"...`);
            groupBacksPdf = await generatePDFForGroup('back', groupId, groupEffectiveSettings, groupPages);
          } catch (error) {
            groupBacksError = error instanceof Error ? error.message : 'Unknown error';
            console.error(`Failed to generate backs PDF for group ${groupId}:`, error);
          }
          
          // Create download URLs for this group
          let groupFrontsUrl: string | null = null;
          let groupBacksUrl: string | null = null;
          
          try {
            groupFrontsUrl = groupFrontsPdf ? URL.createObjectURL(groupFrontsPdf) : null;
          } catch (error) {
            console.error(`Failed to create fronts blob URL for group ${groupId}:`, error);
            groupFrontsError = 'Failed to create download link';
          }
          
          try {
            groupBacksUrl = groupBacksPdf ? URL.createObjectURL(groupBacksPdf) : null;
          } catch (error) {
            console.error(`Failed to create backs blob URL for group ${groupId}:`, error);
            groupBacksError = 'Failed to create download link';
          }
          
          // Store results for this group
          newExportedFiles[groupId] = {
            fronts: groupFrontsUrl,
            backs: groupBacksUrl
          };
          
          // Log progress
          console.log(`Group ${groupId} processing completed:`, {
            fronts: groupFrontsUrl ? 'Generated' : (groupFrontsError || 'No content'),
            backs: groupBacksUrl ? 'Generated' : (groupBacksError || 'No content')
          });
          
        } catch (error) {
          console.error(`Error processing group ${groupId}:`, error);
          // Continue with other groups even if one fails
        }
      }
      
      setExportedFiles(newExportedFiles);
      
      // Check if any PDFs were generated successfully
      const hasAnySuccess = Object.values(newExportedFiles).some(files => 
        files.fronts || files.backs
      );
      
      if (hasAnySuccess) {
        setExportStatus('completed');
        setExportProgress(`Export completed! Generated PDFs for ${Object.keys(newExportedFiles).length} groups.`);
        
        // Count partial failures for warning
        const totalExpected = selectedGroupsArray.length * 2; // fronts + backs per group
        const actualGenerated = Object.values(newExportedFiles).reduce((count, files) => 
          count + (files.fronts ? 1 : 0) + (files.backs ? 1 : 0), 0
        );
        
        if (actualGenerated < totalExpected) {
          setExportError(`Some files could not be generated. Successfully created ${actualGenerated} of ${totalExpected} possible PDF files. Check console for details.`);
        }
      } else {
        throw new Error('Failed to generate any PDF files for the selected groups.');
      }
      
    } catch (error) {
      console.error('Multi-group export failed:', error);
      
      let errorMessage = 'Export failed due to an unexpected error.';
      
      if (error instanceof Error) {
        if (error.message.includes('validation failed')) {
          errorMessage = error.message;
        } else if (error.message.includes('timeout') || error.message.includes('timed out')) {
          errorMessage = 'Export timed out. This can happen with large or complex PDFs. Please try:\n\n• Using a smaller PDF file\n• Reducing output quality settings\n• Refreshing the page and trying again';
        } else if (error.message.includes('memory') || error.message.includes('out of memory')) {
          errorMessage = 'Not enough memory to complete export. Please try:\n\n• Refreshing the page\n• Using a smaller PDF file\n• Closing other browser tabs\n• Reducing card scale or page size';
        } else {
          errorMessage = `Export failed: ${error.message}`;
        }
      }
      
      setExportError(errorMessage);
      setExportStatus('error');
      setExportProgress('');
    }
  };
  const handleDownload = (groupId: string, fileType: 'fronts' | 'backs') => {
    const groupFiles = exportedFiles[groupId];
    const url = groupFiles?.[fileType];
    if (!url) {
      console.error(`No ${fileType} PDF available for group ${groupId}`);
      return;
    }

    try {
      // Create download link and trigger download
      const link = document.createElement('a');
      link.href = url;
      link.download = generateFileNameForGroup(groupId, fileType);
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      console.log(`Download initiated for ${fileType} PDF from group ${groupId}`);
    } catch (error) {
      console.error(`Error downloading ${fileType} PDF from group ${groupId}:`, error);
    }
  };

  const generateFileNameForGroup = (groupId: string, fileType: 'fronts' | 'backs'): string => {
    const groupName = groupId === 'default' ? 'Default_Group' : 
      groups.find(g => g.id === groupId)?.name?.replace(/[^a-zA-Z0-9]/g, '_') || groupId;
    const fileName = currentPdfFileName || 'cards';
    const timestamp = new Date().toISOString().split('T')[0];
    return `${fileName}_${groupName}_${fileType}_${timestamp}.pdf`;
  };

  // State for controlling export mode
  const [showAdvancedExport, setShowAdvancedExport] = useState(false);

  // Check if multi-file state has groups or page types for advanced export
  const hasAdvancedFeatures = useMemo(() => {
    const hasPageTypes = multiFileImport.multiFileState.pages.some((page: any) => page.pageType && page.pageType !== 'card');
    const hasGroups = multiFileImport.multiFileState.pageGroups && multiFileImport.multiFileState.pageGroups.length > 0;
    return hasPageTypes || hasGroups;
  }, [multiFileImport.multiFileState.pages, multiFileImport.multiFileState.pageGroups]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-800">Export PDFs</h2>
        
        <div className="flex items-center space-x-3">
          {/* Advanced Export Toggle */}
          {hasAdvancedFeatures && (
            <button
              onClick={() => setShowAdvancedExport(!showAdvancedExport)}
              className={`px-3 py-1 text-sm rounded-md transition-colors ${
                showAdvancedExport 
                  ? 'bg-indigo-100 text-indigo-800' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {showAdvancedExport ? 'Basic Export' : 'Advanced Export'}
            </button>
          )}
          
          {/* Add Files button */}
          <AddFilesButton 
            multiFileImport={multiFileImport}
            variant="subtle"
            size="sm"
          />
        </div>
      </div>

      {/* Overall Export Summary */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <h3 className="text-lg font-medium text-gray-800 mb-3">
          Export Summary
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            {/* Overall statistics */}
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Total Groups:</span>
              <span className="font-medium text-gray-800">
                {groupStats.length} groups
              </span>
            </div>
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
              <span className="text-gray-600">Total Pages:</span>
              <span className="font-medium text-gray-800">{overallTotals.pages} pages</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Total Cards:</span>
              <span className="font-medium text-gray-800">
                {overallTotals.frontCards} front, {overallTotals.backCards} back
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Selected for Export:</span>
              <span className="font-medium text-gray-800">
                {selectedGroupIds.size} of {groupStats.length} groups
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Output Page Size:</span>
              <span className="font-medium text-gray-800">
                {outputSettings.pageSize.width}" ×{' '}
                {outputSettings.pageSize.height}" (global default)
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Card Size:</span>
              <span className="font-medium text-gray-800">
                {outputSettings.cardSize?.widthInches || 2.5}" ×{' '}
                {outputSettings.cardSize?.heightInches || 3.5}" (global default)
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
                {outputSettings.offset.vertical}" V (global default)
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Card Scale:</span>
              <span className="font-medium text-gray-800">
                {outputSettings.cardScalePercent || 100}% (global default)
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Card Rotation:</span>
              <span className="font-medium text-gray-800">
                Front {getRotationForCardType(outputSettings, 'front')}°, Back {getRotationForCardType(outputSettings, 'back')}° (global default)
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Color Adjustments:</span>
              <span className={`font-medium ${hasColorAdjustments ? 'text-green-700' : 'text-gray-800'}`}>
                {hasColorAdjustments ? '✓ Applied' : 'None'} (global default)
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Bleed Margin:</span>
              <span className="font-medium text-gray-800">
                {outputSettings.bleedMarginInches || 0}" 
                ({outputSettings.bleedMarginInches ? 'applied' : 'none'}) (global default)
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Group Selection Interface */}
      {groupStats.length > 0 && (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <div className="bg-gray-50 p-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-800">Group Selection</h3>
              <div className="flex items-center space-x-2">
                <button
                  onClick={handleSelectAll}
                  className="text-sm px-3 py-1 bg-indigo-100 text-indigo-800 rounded-md hover:bg-indigo-200"
                >
                  Select All
                </button>
                <button
                  onClick={handleSelectNone}
                  className="text-sm px-3 py-1 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
                >
                  Select None
                </button>
              </div>
            </div>
          </div>
          <div className="p-4">
            <div className="space-y-3">
              {groupStats.map((stat) => (
                <div
                  key={stat.id}
                  className={`flex items-center justify-between p-3 border rounded-lg ${
                    selectedGroupIds.has(stat.id) 
                      ? 'border-indigo-200 bg-indigo-50' 
                      : 'border-gray-200 bg-white'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      checked={selectedGroupIds.has(stat.id)}
                      onChange={(e) => handleGroupSelectionChange(stat.id, e.target.checked)}
                      className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <div>
                      <div className="font-medium text-gray-900">
                        {stat.name}
                        {stat.hasCustomSettings && (
                          <span className="ml-2 text-xs bg-green-100 text-green-700 px-2 py-1 rounded">
                            Custom Settings
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-gray-600">
                        {stat.pageCount} pages • {stat.frontCards} front cards • {stat.backCards} back cards • {stat.processingMode}
                      </div>
                    </div>
                  </div>
                  <div className="text-sm text-gray-500">
                    {stat.totalCards} total cards
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Advanced Export System */}
      {showAdvancedExport && hasAdvancedFeatures && (
        <MultiStreamExportManager
          pages={unifiedPages}
          groups={multiFileImport.multiFileState.pageGroups || []}
          pageTypeSettings={multiFileImport.multiFileState.pageTypeSettings || {}}
          globalExtractionSettings={extractionSettings}
          globalOutputSettings={outputSettings}
          globalColorSettings={colorSettings}
          pdfMode={pdfMode}
          pdfData={pdfData}
          multiFileImport={multiFileImport}
          disabled={exportStatus === 'processing'}
        />
      )}

      {/* Basic Export System */}
      {!showAdvancedExport && (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
        <div className="bg-gray-50 p-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-800">Output Files</h3>
        </div>
        <div className="p-6">
          {exportStatus === 'idle' && (
            <div className="text-center py-8">
              <p className="text-gray-600 mb-6">
                Ready to generate PDF files for {selectedGroupIds.size} selected group{selectedGroupIds.size !== 1 ? 's' : ''}.
                {selectedGroupIds.size === 0 && (
                  <span className="text-red-600"> Please select at least one group above.</span>
                )}
              </p>
              <button 
                onClick={handleExport} 
                disabled={selectedGroupIds.size === 0}
                className="inline-flex items-center bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <DownloadIcon size={18} className="mr-2" />
                Generate PDF Files for Selected Groups
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
              {/* Per-Group Export Results */}
              <div className="space-y-4">
                {Object.keys(exportedFiles).length > 0 ? (
                  Object.entries(exportedFiles).map(([groupId, files]) => {
                    const groupName = groupId === 'default' ? 'Default Group' : 
                      groups.find(g => g.id === groupId)?.name || groupId;
                    const groupStat = groupStats.find(s => s.id === groupId);
                    
                    return (
                      <div key={groupId} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center">
                            <CheckCircleIcon size={20} className="text-green-500 mr-2" />
                            <h4 className="text-lg font-medium text-gray-900">{groupName}</h4>
                            {groupStat?.hasCustomSettings && (
                              <span className="ml-2 text-xs bg-green-100 text-green-700 px-2 py-1 rounded">
                                Custom Settings
                              </span>
                            )}
                          </div>
                          <div className="text-sm text-gray-600">
                            {groupStat?.frontCards || 0} front • {groupStat?.backCards || 0} back cards
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {files.fronts && (
                            <button 
                              onClick={() => handleDownload(groupId, 'fronts')} 
                              className="flex items-center justify-center bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-50"
                            >
                              <DownloadIcon size={16} className="mr-2" />
                              Download Fronts PDF
                            </button>
                          )}
                          {files.backs && (
                            <button 
                              onClick={() => handleDownload(groupId, 'backs')} 
                              className="flex items-center justify-center bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-50"
                            >
                              <DownloadIcon size={16} className="mr-2" />
                              Download Backs PDF
                            </button>
                          )}
                        </div>
                        
                        {!files.fronts && !files.backs && (
                          <div className="bg-yellow-50 border border-yellow-200 rounded p-3">
                            <p className="text-sm text-yellow-800">
                              No PDF files were generated for this group. This could happen if no cards were found.
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
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
      )}

      <div className="flex justify-start mt-6">
        <button onClick={onPrevious} className="flex items-center bg-gray-200 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-300">
          <ChevronLeftIcon size={16} className="mr-2" />
          Previous Step
        </button>
      </div>
    </div>
  );
};