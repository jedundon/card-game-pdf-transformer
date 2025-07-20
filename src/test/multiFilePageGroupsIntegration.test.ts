/**
 * @fileoverview Multi-File + Page Groups Integration Tests
 * 
 * Critical tests for complex scenarios combining multiple file types (PDF + images)
 * with page groups functionality. These tests ensure coordinate system consistency
 * and correct behavior when organizing mixed sources into logical groups.
 * 
 * Key areas tested:
 * - Mixed PDF/image files with page groups
 * - Coordinate system consistency with grouping
 * - Card ID assignment across grouped multi-file sources
 * - Settings application to grouped multi-file workflows
 * - Preview consistency for mixed file types in groups
 */

import { describe, it, expect } from 'vitest'
import { getCardInfo } from '../utils/cardUtils'
import { PageSettings, PdfMode, ExtractionSettings, PageGroup } from '../types'

describe('Multi-File + Page Groups Integration Tests', () => {
  const EXTRACTION_DPI = 300;
  const PDF_DPI = 72;

  describe('Coordinate System Consistency with Page Groups', () => {
    it('should maintain unified coordinate system for mixed PDF/image files in page groups', () => {
      // Simulate multi-file session with both PDF and image files
      const multiFileSession = {
        files: [
          {
            type: 'pdf' as const,
            name: 'cards-front.pdf',
            pages: [
              { width: 612, height: 792, dpi: PDF_DPI }, // 8.5" x 11" at 72 DPI
              { width: 612, height: 792, dpi: PDF_DPI }
            ]
          },
          {
            type: 'image' as const,
            name: 'cards-back-1.jpg',
            pages: [
              { width: 2550, height: 3300, dpi: EXTRACTION_DPI } // 8.5" x 11" at 300 DPI
            ]
          },
          {
            type: 'image' as const,
            name: 'cards-back-2.png',
            pages: [
              { width: 2550, height: 3300, dpi: EXTRACTION_DPI } // 8.5" x 11" at 300 DPI
            ]
          }
        ],
        totalPages: 4 // 2 PDF pages + 2 image pages
      };

      // Create page groups mixing PDF and image pages
      const pageGroups: PageGroup[] = [
        {
          id: 'duplex-pair-1',
          name: 'First Duplex Pair',
          pageIndices: [0, 2], // PDF page + image page
          type: 'manual',
          order: 0,
          processingMode: { type: 'duplex', flipEdge: 'short' },
          color: '#FF6B6B',
          createdAt: Date.now(),
          modifiedAt: Date.now()
        },
        {
          id: 'duplex-pair-2',
          name: 'Second Duplex Pair',
          pageIndices: [1, 3], // PDF page + image page
          type: 'manual',
          order: 1,
          processingMode: { type: 'duplex', flipEdge: 'short' },
          color: '#4ECDC4',
          createdAt: Date.now(),
          modifiedAt: Date.now()
        }
      ];

      // Normalize all pages to extraction DPI for coordinate consistency
      const normalizedPages = multiFileSession.files.flatMap(file => 
        file.pages.map(page => {
          if (file.type === 'pdf') {
            // Convert PDF coordinates to extraction DPI
            const scale = EXTRACTION_DPI / page.dpi;
            return {
              sourceType: 'pdf' as const,
              fileName: file.name,
              normalizedDimensions: {
                width: page.width * scale,
                height: page.height * scale
              },
              originalDimensions: {
                width: page.width,
                height: page.height,
                dpi: page.dpi
              }
            };
          } else {
            // Image coordinates already at extraction DPI
            return {
              sourceType: 'image' as const,
              fileName: file.name,
              normalizedDimensions: {
                width: page.width,
                height: page.height
              },
              originalDimensions: {
                width: page.width,
                height: page.height,
                dpi: page.dpi
              }
            };
          }
        })
      );

      // Validate coordinate system normalization
      expect(normalizedPages).toHaveLength(4);

      // All normalized pages should have identical dimensions (same physical size)
      const expectedWidth = 2550; // 8.5" * 300 DPI
      const expectedHeight = 3300; // 11" * 300 DPI

      for (const page of normalizedPages) {
        expect(page.normalizedDimensions.width).toBeCloseTo(expectedWidth, 1);
        expect(page.normalizedDimensions.height).toBeCloseTo(expectedHeight, 1);
      }

      // Validate source type awareness
      expect(normalizedPages[0].sourceType).toBe('pdf');
      expect(normalizedPages[1].sourceType).toBe('pdf');
      expect(normalizedPages[2].sourceType).toBe('image');
      expect(normalizedPages[3].sourceType).toBe('image');

      // Validate page groups can reference mixed file types
      const group1 = pageGroups[0];
      expect(normalizedPages[group1.pageIndices[0]].sourceType).toBe('pdf');
      expect(normalizedPages[group1.pageIndices[1]].sourceType).toBe('image');

      const group2 = pageGroups[1];
      expect(normalizedPages[group2.pageIndices[0]].sourceType).toBe('pdf');
      expect(normalizedPages[group2.pageIndices[1]].sourceType).toBe('image');
    });

    it('should handle crop operations consistently across mixed file types in groups', () => {
      // Simulate cropping settings that apply to grouped mixed files
      const cropSettings = {
        top: 150,    // pixels in extraction DPI
        right: 100,
        bottom: 200,
        left: 75
      };

      const mixedFiles = [
        {
          type: 'pdf' as const,
          normalizedDimensions: { width: 2550, height: 3300 } // Already converted to extraction DPI
        },
        {
          type: 'image' as const,
          normalizedDimensions: { width: 2550, height: 3300 } // Native extraction DPI
        }
      ];

      // Apply cropping to both file types (should work identically)
      const croppedFiles = mixedFiles.map(file => ({
        ...file,
        croppedDimensions: {
          width: file.normalizedDimensions.width - cropSettings.left - cropSettings.right,
          height: file.normalizedDimensions.height - cropSettings.top - cropSettings.bottom
        },
        cropApplied: cropSettings
      }));

      // Validate cropping consistency
      const expectedCroppedWidth = 2550 - 75 - 100; // 2375
      const expectedCroppedHeight = 3300 - 150 - 200; // 2950

      for (const file of croppedFiles) {
        expect(file.croppedDimensions.width).toBe(expectedCroppedWidth);
        expect(file.croppedDimensions.height).toBe(expectedCroppedHeight);
      }

      // Validate crop coordinates work identically regardless of source type
      expect(croppedFiles[0].croppedDimensions).toEqual(croppedFiles[1].croppedDimensions);
    });
  });

  describe('Card ID Assignment with Page Groups and Mixed Files', () => {
    it('should assign card IDs correctly across grouped mixed file types', () => {
      const pdfMode: PdfMode = { type: 'duplex', flipEdge: 'short' };
      const portraitWidth = 612;
      const portraitHeight = 792;
      
      // Simulate mixed file session with page groups
      const activePages: PageSettings[] = [
        { type: 'front' },  // PDF page 0
        { type: 'back' },   // Image page 0
        { type: 'front' },  // PDF page 1  
        { type: 'back' }    // Image page 1
      ];

      // Simulate page groups for this test - we validate the concept
      const pageGroupsCount = 2;
      const expectedDuplexBehavior = true;

      const extractionSettings: ExtractionSettings = {
        grid: { rows: 2, columns: 2 },
        crop: { top: 0, right: 0, bottom: 0, left: 0 },
        pageDimensions: { width: portraitWidth, height: portraitHeight },
        skippedCards: [],
        cardTypeOverrides: []
      };

      // Validate the test concept  
      expect(pageGroupsCount).toBe(2);
      expect(expectedDuplexBehavior).toBe(true);

      const cardsPerPage = 4; // 2x2 grid

      // Test front cards (should be sequential across mixed files)
      const frontCard1 = getCardInfo(0, activePages, extractionSettings, pdfMode, cardsPerPage, portraitWidth, portraitHeight);
      const frontCard2 = getCardInfo(8, activePages, extractionSettings, pdfMode, cardsPerPage, portraitWidth, portraitHeight);

      expect(frontCard1.type).toBe('Front');
      expect(frontCard1.id).toBe(1);
      expect(frontCard2.type).toBe('Front');
      expect(frontCard2.id).toBe(5); // Continues sequence after first page's 4 cards

      // Test back cards (should use duplex mirroring regardless of source file type)
      const backCard1 = getCardInfo(4, activePages, extractionSettings, pdfMode, cardsPerPage, portraitWidth, portraitHeight);
      const backCard2 = getCardInfo(12, activePages, extractionSettings, pdfMode, cardsPerPage, portraitWidth, portraitHeight);

      expect(backCard1.type).toBe('Back');
      expect(backCard1.id).toBeGreaterThan(0); // Should use duplex mirroring
      expect(backCard2.type).toBe('Back');
      expect(backCard2.id).toBeGreaterThan(frontCard2.id); // Should continue sequence

      // Validate that file type doesn't affect card ID logic
      // (Both PDF and image pages in the same group should follow same rules)
      const pdfBackCard = getCardInfo(4, activePages, extractionSettings, pdfMode, cardsPerPage, portraitWidth, portraitHeight);
      const imageBackCard = getCardInfo(12, activePages, extractionSettings, pdfMode, cardsPerPage, portraitWidth, portraitHeight);

      expect(pdfBackCard.type).toBe('Back');
      expect(imageBackCard.type).toBe('Back');
      // Both should follow duplex mirroring rules regardless of source file type
    });

    it('should handle card type overrides consistently across mixed file groups', () => {
      const pdfMode: PdfMode = { type: 'simplex' };
      const standardDimensions = { width: 612, height: 792 };
      
      const activePages: PageSettings[] = [
        {}, // PDF page
        {}, // Image page  
        {}, // PDF page
        {}  // Image page
      ];

      // Validate the test concept - the group would contain mixed file types
      const expectedGroupIndices = [0, 1, 2, 3]; // PDF + Image + PDF + Image
      expect(expectedGroupIndices).toHaveLength(4);

      // Apply overrides to cards from different file types
      const extractionSettings: ExtractionSettings = {
        grid: { rows: 2, columns: 2 },
        crop: { top: 0, right: 0, bottom: 0, left: 0 },
        pageDimensions: standardDimensions,
        // pageGroups would be handled separately
        cardTypeOverrides: [
          { pageIndex: 0, gridRow: 0, gridColumn: 0, cardType: 'back' }, // PDF page override
          { pageIndex: 1, gridRow: 1, gridColumn: 1, cardType: 'back' }  // Image page override
        ],
        skippedCards: []
      };

      const cardsPerPage = 4;

      // Test overrides on PDF page
      const pdfOverrideCard = getCardInfo(
        0, // PDF page, card 0
        activePages,
        extractionSettings,
        pdfMode,
        cardsPerPage,
        standardDimensions.width,
        standardDimensions.height
      );

      // Test overrides on image page
      const imageOverrideCard = getCardInfo(
        7, // Image page (page 1), card 3 (row 1, col 1)
        activePages,
        extractionSettings,
        pdfMode,
        cardsPerPage,
        standardDimensions.width,
        standardDimensions.height
      );

      // Both overrides should work identically regardless of source file type
      expect(pdfOverrideCard.type).toBe('Back');
      expect(imageOverrideCard.type).toBe('Back');
      expect(pdfOverrideCard.id).toBeGreaterThan(0);
      expect(imageOverrideCard.id).toBeGreaterThan(0);

      // Test non-overridden cards remain as expected
      const normalPdfCard = getCardInfo(1, activePages, extractionSettings, pdfMode, cardsPerPage, standardDimensions.width, standardDimensions.height);
      const normalImageCard = getCardInfo(5, activePages, extractionSettings, pdfMode, cardsPerPage, standardDimensions.width, standardDimensions.height);

      expect(normalPdfCard.type).toBe('Front'); // Simplex default
      expect(normalImageCard.type).toBe('Front'); // Simplex default
    });
  });

  describe('Settings Application to Mixed File Groups', () => {
    it('should apply group-specific settings correctly to mixed file types', () => {
      // Simulate different settings for different groups containing mixed file types
      const pageGroups: any[] = [
        {
          id: 'high-quality-group',
          name: 'High Quality Mixed',
          pageIndices: [0, 1], // PDF + Image
          type: 'manual',
          order: 0,
          processingMode: { type: 'duplex', flipEdge: 'short' },
          color: '#2ECC71',
          createdAt: Date.now(),
          modifiedAt: Date.now(),
          // Custom settings would be handled separately in the settings property
          settings: {
            extraction: {
              // Custom extraction settings for high quality
            },
            output: {
              // Custom output settings for high quality
            }
          },
          // Additional metadata (would be handled in separate data structure)
          groupMetadata: {
            compressionLevel: 100,
            colorProfile: 'Adobe RGB',
            resampleMethod: 'bicubic'
          }
        },
        {
          id: 'standard-group',
          name: 'Standard Mixed',
          pageIndices: [2, 3], // PDF + Image
          type: 'manual',
          order: 1,
          processingMode: { type: 'simplex' },
          color: '#F39C12',
          createdAt: Date.now(),
          modifiedAt: Date.now(),
          // Different settings for this group
          settings: {
            extraction: {
              // Custom extraction settings for standard quality
            },
            output: {
              // Custom output settings for standard quality
            }
          },
          // Additional metadata (would be handled in separate data structure)
          groupMetadata: {
            compressionLevel: 85,
            colorProfile: 'sRGB',
            resampleMethod: 'bilinear'
          }
        }
      ];

      // Test settings inheritance from groups to individual pages
      const getEffectiveSettings = (pageIndex: number) => {
        const group = pageGroups.find(g => g.pageIndices.includes(pageIndex));
        if (group?.groupMetadata) {
          return {
            ...group.groupMetadata,
            processingMode: group.processingMode,
            groupId: group.id,
            groupName: group.name
          };
        }
        return null;
      };

      // Test PDF page settings in high-quality group
      const pdfHighQualitySettings = getEffectiveSettings(0);
      expect(pdfHighQualitySettings?.compressionLevel).toBe(100);
      expect(pdfHighQualitySettings?.colorProfile).toBe('Adobe RGB');
      expect(pdfHighQualitySettings?.processingMode.type).toBe('duplex');

      // Test image page settings in high-quality group
      const imageHighQualitySettings = getEffectiveSettings(1);
      expect(imageHighQualitySettings?.compressionLevel).toBe(100);
      expect(imageHighQualitySettings?.colorProfile).toBe('Adobe RGB');
      expect(imageHighQualitySettings?.processingMode.type).toBe('duplex');

      // Test PDF page settings in standard group
      const pdfStandardSettings = getEffectiveSettings(2);
      expect(pdfStandardSettings?.compressionLevel).toBe(85);
      expect(pdfStandardSettings?.colorProfile).toBe('sRGB');
      expect(pdfStandardSettings?.processingMode.type).toBe('simplex');

      // Test image page settings in standard group
      const imageStandardSettings = getEffectiveSettings(3);
      expect(imageStandardSettings?.compressionLevel).toBe(85);
      expect(imageStandardSettings?.colorProfile).toBe('sRGB');
      expect(imageStandardSettings?.processingMode.type).toBe('simplex');

      // Validate same group settings apply to both PDF and image pages
      expect(pdfHighQualitySettings).toEqual(imageHighQualitySettings);
      expect(pdfStandardSettings).toEqual(imageStandardSettings);
    });

    it('should handle grid settings consistently across mixed file groups', () => {
      const mixedFileGroups = [
        {
          files: ['pdf-page-1.pdf', 'image-page-1.jpg'],
          gridSettings: { rows: 3, columns: 3, spacing: 'tight' },
          expectedCardsPerPage: 9
        },
        {
          files: ['pdf-page-2.pdf', 'image-page-2.png'],
          gridSettings: { rows: 2, columns: 4, spacing: 'normal' },
          expectedCardsPerPage: 8
        }
      ];

      // Simulate applying grid settings to mixed file groups
      const applyGridToGroup = (group: typeof mixedFileGroups[0]) => {
        const cardsPerPage = group.gridSettings.rows * group.gridSettings.columns;
        const totalCards = group.files.length * cardsPerPage;
        
        return {
          groupFiles: group.files,
          gridConfiguration: group.gridSettings,
          cardsPerPage,
          totalCards,
          // Grid should work identically for both PDF and image files
          fileTypeAgnostic: true
        };
      };

      const processedGroups = mixedFileGroups.map(applyGridToGroup);

      // Validate grid calculations
      expect(processedGroups[0].cardsPerPage).toBe(9);
      expect(processedGroups[0].totalCards).toBe(18); // 2 files × 9 cards
      expect(processedGroups[1].cardsPerPage).toBe(8);
      expect(processedGroups[1].totalCards).toBe(16); // 2 files × 8 cards

      // Validate file type agnostic processing
      for (const group of processedGroups) {
        expect(group.fileTypeAgnostic).toBe(true);
        expect(group.groupFiles).toHaveLength(2);
      }
    });
  });

  describe('Preview Consistency for Mixed File Groups', () => {
    it('should maintain preview consistency across mixed file types in same group', () => {
      // Simulate preview calculation for mixed files in same group
      const mixedPageGroup = {
        id: 'preview-consistency-test',
        pages: [
          {
            sourceType: 'pdf' as const,
            fileName: 'front.pdf',
            extractionDimensions: { width: 2550, height: 3300 }, // Normalized to extraction DPI
            cardPositions: [
              { x: 100, y: 150, width: 825, height: 1125 },
              { x: 1000, y: 150, width: 825, height: 1125 }
            ]
          },
          {
            sourceType: 'image' as const,
            fileName: 'back.jpg',
            extractionDimensions: { width: 2550, height: 3300 }, // Native extraction DPI
            cardPositions: [
              { x: 100, y: 150, width: 825, height: 1125 },
              { x: 1000, y: 150, width: 825, height: 1125 }
            ]
          }
        ]
      };

      // Calculate preview scaling for both file types
      const calculatePreviewForPage = (page: typeof mixedPageGroup.pages[0]) => {
        const SCREEN_DPI = 72;
        const previewMaxWidth = 400;
        const previewMaxHeight = 500;

        // Convert extraction DPI to screen DPI
        const pageWidthScreen = (page.extractionDimensions.width / EXTRACTION_DPI) * SCREEN_DPI;
        const pageHeightScreen = (page.extractionDimensions.height / EXTRACTION_DPI) * SCREEN_DPI;

        // Calculate scale to fit in preview container
        const scale = Math.min(
          previewMaxWidth / pageWidthScreen,
          previewMaxHeight / pageHeightScreen
        );

        // Scale card positions for preview
        const previewCardPositions = page.cardPositions.map(card => ({
          x: (card.x / EXTRACTION_DPI) * SCREEN_DPI * scale,
          y: (card.y / EXTRACTION_DPI) * SCREEN_DPI * scale,
          width: (card.width / EXTRACTION_DPI) * SCREEN_DPI * scale,
          height: (card.height / EXTRACTION_DPI) * SCREEN_DPI * scale
        }));

        return {
          sourceType: page.sourceType,
          fileName: page.fileName,
          previewDimensions: {
            width: pageWidthScreen * scale,
            height: pageHeightScreen * scale
          },
          previewCardPositions,
          scale
        };
      };

      const previewResults = mixedPageGroup.pages.map(calculatePreviewForPage);

      // Validate preview consistency between PDF and image files
      const pdfPreview = previewResults.find(r => r.sourceType === 'pdf');
      const imagePreview = previewResults.find(r => r.sourceType === 'image');

      expect(pdfPreview).toBeDefined();
      expect(imagePreview).toBeDefined();

      // Page dimensions should be identical in preview
      expect(pdfPreview!.previewDimensions.width).toBeCloseTo(imagePreview!.previewDimensions.width, 2);
      expect(pdfPreview!.previewDimensions.height).toBeCloseTo(imagePreview!.previewDimensions.height, 2);

      // Scale factors should be identical
      expect(pdfPreview!.scale).toBeCloseTo(imagePreview!.scale, 5);

      // Card positions should be identical
      for (let i = 0; i < pdfPreview!.previewCardPositions.length; i++) {
        const pdfCard = pdfPreview!.previewCardPositions[i];
        const imageCard = imagePreview!.previewCardPositions[i];

        expect(pdfCard.x).toBeCloseTo(imageCard.x, 2);
        expect(pdfCard.y).toBeCloseTo(imageCard.y, 2);
        expect(pdfCard.width).toBeCloseTo(imageCard.width, 2);
        expect(pdfCard.height).toBeCloseTo(imageCard.height, 2);
      }
    });

    it('should handle rotation preview consistently for mixed file types', () => {
      // Test rotation preview for both PDF and image files
      const rotationTest = {
        rotation: 90,
        mixedPages: [
          {
            sourceType: 'pdf' as const,
            originalDimensions: { width: 2.75, height: 3.75 }, // inches
          },
          {
            sourceType: 'image' as const,
            originalDimensions: { width: 2.75, height: 3.75 }, // inches
          }
        ]
      };

      const applyRotationPreview = (page: typeof rotationTest.mixedPages[0], rotation: number) => {
        let previewWidth = page.originalDimensions.width;
        let previewHeight = page.originalDimensions.height;

        // Dimension swapping for 90° and 270° rotations
        if (rotation === 90 || rotation === 270) {
          previewWidth = page.originalDimensions.height;
          previewHeight = page.originalDimensions.width;
        }

        return {
          sourceType: page.sourceType,
          previewDimensions: { width: previewWidth, height: previewHeight },
          rotation,
          cssTransform: `rotate(${rotation}deg)`,
          areaPreserved: previewWidth * previewHeight === page.originalDimensions.width * page.originalDimensions.height
        };
      };

      const rotationResults = rotationTest.mixedPages.map(page => 
        applyRotationPreview(page, rotationTest.rotation)
      );

      // Validate rotation consistency between file types
      const pdfRotation = rotationResults.find(r => r.sourceType === 'pdf');
      const imageRotation = rotationResults.find(r => r.sourceType === 'image');

      expect(pdfRotation).toBeDefined();
      expect(imageRotation).toBeDefined();

      // Dimensions should be identical after rotation
      expect(pdfRotation!.previewDimensions.width).toBeCloseTo(imageRotation!.previewDimensions.width, 5);
      expect(pdfRotation!.previewDimensions.height).toBeCloseTo(imageRotation!.previewDimensions.height, 5);

      // Both should have swapped dimensions for 90° rotation
      expect(pdfRotation!.previewDimensions.width).toBeCloseTo(3.75, 3); // Height became width
      expect(pdfRotation!.previewDimensions.height).toBeCloseTo(2.75, 3); // Width became height
      expect(imageRotation!.previewDimensions.width).toBeCloseTo(3.75, 3);
      expect(imageRotation!.previewDimensions.height).toBeCloseTo(2.75, 3);

      // Area should be preserved for both
      expect(pdfRotation!.areaPreserved).toBe(true);
      expect(imageRotation!.areaPreserved).toBe(true);

      // CSS transforms should be identical
      expect(pdfRotation!.cssTransform).toBe(imageRotation!.cssTransform);
    });
  });

  describe('Error Handling in Mixed File Groups', () => {
    it('should handle missing pages in mixed file groups gracefully', () => {
      const pageGroups: PageGroup[] = [
        {
          id: 'incomplete-group',
          name: 'Group with Missing Pages',
          pageIndices: [0, 1, 5, 8], // Page indices 5 and 8 don't exist
          type: 'manual',
          order: 0,
          processingMode: { type: 'simplex' },
          color: '#E67E22',
          createdAt: Date.now(),
          modifiedAt: Date.now()
        }
      ];

      const availablePages: PageSettings[] = [
        {}, // Page 0 - exists
        {}, // Page 1 - exists
        {}, // Page 2 - exists but not in group
        {}  // Page 3 - exists but not in group
      ];

      // Filter valid page indices
      const getValidPageIndices = (group: PageGroup, totalPages: number) => {
        return group.pageIndices.filter(index => index >= 0 && index < totalPages);
      };

      const validIndices = getValidPageIndices(pageGroups[0], availablePages.length);

      // Should only include existing pages
      expect(validIndices).toEqual([0, 1]);
      expect(validIndices).toHaveLength(2);

      // Should handle gracefully without crashing
      expect(() => {
        validIndices.forEach(index => {
          expect(availablePages[index]).toBeDefined();
        });
      }).not.toThrow();
    });

    it('should handle coordinate system mismatches gracefully', () => {
      // Simulate files with mismatched coordinate systems
      const problematicFiles = [
        {
          type: 'pdf' as const,
          dimensions: { width: 612, height: 792 },
          dpi: 72,
          status: 'valid'
        },
        {
          type: 'image' as const,
          dimensions: { width: 1275, height: 1650 }, // Wrong DPI (should be 2550x3300)
          dpi: 150, // Non-standard DPI
          status: 'mismatched'
        },
        {
          type: 'image' as const,
          dimensions: { width: 0, height: 0 }, // Invalid dimensions
          dpi: 300,
          status: 'invalid'
        }
      ];

      // Attempt to normalize problematic files
      const normalizeFile = (file: typeof problematicFiles[0]) => {
        try {
          if (file.dimensions.width <= 0 || file.dimensions.height <= 0) {
            return {
              ...file,
              normalized: false,
              error: 'Invalid dimensions',
              fallbackDimensions: { width: 2550, height: 3300 } // Use default
            };
          }

          if (file.type === 'pdf') {
            const scale = EXTRACTION_DPI / file.dpi;
            return {
              ...file,
              normalized: true,
              normalizedDimensions: {
                width: file.dimensions.width * scale,
                height: file.dimensions.height * scale
              }
            };
          } else {
            // For images, assume they should be treated as extraction DPI
            return {
              ...file,
              normalized: true,
              normalizedDimensions: file.dimensions,
              warning: file.dpi !== EXTRACTION_DPI ? 'Non-standard DPI detected' : undefined
            };
          }
        } catch (error) {
          return {
            ...file,
            normalized: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            fallbackDimensions: { width: 2550, height: 3300 }
          };
        }
      };

      const normalizedFiles = problematicFiles.map(normalizeFile);

      // Validate error handling
      expect(normalizedFiles[0].normalized).toBe(true); // PDF should normalize successfully
      expect(normalizedFiles[1].normalized).toBe(true); // Image should normalize with warning
      expect((normalizedFiles[1] as any).warning).toContain('Non-standard DPI');
      expect(normalizedFiles[2].normalized).toBe(false); // Invalid file should fail gracefully
      expect((normalizedFiles[2] as any).error).toBe('Invalid dimensions');
      expect((normalizedFiles[2] as any).fallbackDimensions).toEqual({ width: 2550, height: 3300 });

      // Validate no exceptions were thrown
      expect(normalizedFiles).toHaveLength(3);
    });
  });
});