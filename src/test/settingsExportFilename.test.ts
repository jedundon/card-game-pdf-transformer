/**
 * @fileoverview Tests for settings export filename generation
 * 
 * Tests the enhanced filename generation logic for settings export,
 * including single file, multi-file, and fallback scenarios.
 */

import { describe, it, expect } from 'vitest';
import { FileSource } from '../types';

// Mock the hook return for testing
interface MockMultiFileImport {
  getFileList: () => FileSource[];
}

// Helper function to simulate the getDefaultFileName logic
const getDefaultFileName = (currentPdfFileName?: string, multiFileImport?: MockMultiFileImport) => {
  // Check for multi-file import data first
  if (multiFileImport) {
    const files = multiFileImport.getFileList();
    if (files.length > 0) {
      if (files.length === 1) {
        // Single file - use the same logic as before
        const fileName = files[0].name;
        const nameWithoutExt = fileName.replace(/\.(pdf|png|jpg|jpeg)$/i, '');
        return `${nameWithoutExt}_settings.json`;
      } else {
        // Multiple files - create smart name
        const firstFileName = files[0].name.replace(/\.(pdf|png|jpg|jpeg)$/i, '');
        const remainingCount = files.length - 1;
        // Truncate first filename if too long to keep total reasonable
        const truncatedFirst = firstFileName.length > 20 
          ? firstFileName.substring(0, 20) + '...'
          : firstFileName;
        return `${truncatedFirst}_and_${remainingCount}_others_settings.json`;
      }
    }
  }
  
  // Fallback to single PDF filename
  if (currentPdfFileName) {
    // Remove .pdf extension and add .json
    return currentPdfFileName.replace(/\.pdf$/i, '_settings.json');
  }
  
  // Final fallback
  return 'workflow_settings.json';
};

describe('Settings Export Filename Generation', () => {
  describe('Single file scenarios', () => {
    it('should generate correct filename for single PDF file', () => {
      const mockMultiFileImport: MockMultiFileImport = {
        getFileList: () => [{
          name: 'game_cards.pdf',
          type: 'pdf',
          originalPageCount: 10,
          size: 1024000,
          importTimestamp: Date.now()
        }]
      };

      const result = getDefaultFileName(undefined, mockMultiFileImport);
      expect(result).toBe('game_cards_settings.json');
    });

    it('should generate correct filename for single image file', () => {
      const mockMultiFileImport: MockMultiFileImport = {
        getFileList: () => [{
          name: 'card_sheet.png',
          type: 'image',
          originalPageCount: 1,
          size: 2048000,
          importTimestamp: Date.now()
        }]
      };

      const result = getDefaultFileName(undefined, mockMultiFileImport);
      expect(result).toBe('card_sheet_settings.json');
    });

    it('should handle various file extensions correctly', () => {
      const extensions = ['pdf', 'PNG', 'jpg', 'JPEG'];
      
      extensions.forEach(ext => {
        const mockMultiFileImport: MockMultiFileImport = {
          getFileList: () => [{
            name: `test_file.${ext}`,
            type: ext.toLowerCase() === 'pdf' ? 'pdf' : 'image',
            originalPageCount: 1,
            size: 1024000,
            importTimestamp: Date.now()
          }]
        };

        const result = getDefaultFileName(undefined, mockMultiFileImport);
        expect(result).toBe('test_file_settings.json');
      });
    });
  });

  describe('Multi-file scenarios', () => {
    it('should generate smart filename for two files', () => {
      const mockMultiFileImport: MockMultiFileImport = {
        getFileList: () => [
          {
            name: 'player_cards.pdf',
            type: 'pdf',
            originalPageCount: 8,
            size: 1024000,
            importTimestamp: Date.now()
          },
          {
            name: 'monster_cards.pdf',
            type: 'pdf',
            originalPageCount: 6,
            size: 1024000,
            importTimestamp: Date.now()
          }
        ]
      };

      const result = getDefaultFileName(undefined, mockMultiFileImport);
      expect(result).toBe('player_cards_and_1_others_settings.json');
    });

    it('should generate smart filename for multiple files', () => {
      const mockMultiFileImport: MockMultiFileImport = {
        getFileList: () => [
          { name: 'cards1.pdf', type: 'pdf', originalPageCount: 5, size: 1024000, importTimestamp: Date.now() },
          { name: 'cards2.pdf', type: 'pdf', originalPageCount: 5, size: 1024000, importTimestamp: Date.now() },
          { name: 'cards3.png', type: 'image', originalPageCount: 1, size: 2048000, importTimestamp: Date.now() },
          { name: 'cards4.jpg', type: 'image', originalPageCount: 1, size: 2048000, importTimestamp: Date.now() }
        ]
      };

      const result = getDefaultFileName(undefined, mockMultiFileImport);
      expect(result).toBe('cards1_and_3_others_settings.json');
    });

    it('should truncate long filenames in multi-file scenarios', () => {
      const longFileName = 'this_is_a_very_long_filename_that_should_be_truncated.pdf';
      const mockMultiFileImport: MockMultiFileImport = {
        getFileList: () => [
          { name: longFileName, type: 'pdf', originalPageCount: 5, size: 1024000, importTimestamp: Date.now() },
          { name: 'short.pdf', type: 'pdf', originalPageCount: 3, size: 1024000, importTimestamp: Date.now() }
        ]
      };

      const result = getDefaultFileName(undefined, mockMultiFileImport);
      expect(result).toBe('this_is_a_very_long_..._and_1_others_settings.json');
    });
  });

  describe('Fallback scenarios', () => {
    it('should fallback to currentPdfFileName when multiFileImport has no files', () => {
      const mockMultiFileImport: MockMultiFileImport = {
        getFileList: () => []
      };

      const result = getDefaultFileName('fallback_file.pdf', mockMultiFileImport);
      expect(result).toBe('fallback_file_settings.json');
    });

    it('should fallback to currentPdfFileName when multiFileImport is undefined', () => {
      const result = getDefaultFileName('single_file.pdf', undefined);
      expect(result).toBe('single_file_settings.json');
    });

    it('should use final fallback when no data is available', () => {
      const mockMultiFileImport: MockMultiFileImport = {
        getFileList: () => []
      };

      const result = getDefaultFileName(undefined, mockMultiFileImport);
      expect(result).toBe('workflow_settings.json');
    });

    it('should use final fallback when everything is undefined', () => {
      const result = getDefaultFileName(undefined, undefined);
      expect(result).toBe('workflow_settings.json');
    });
  });

  describe('Edge cases', () => {
    it('should handle filenames without extensions', () => {
      const mockMultiFileImport: MockMultiFileImport = {
        getFileList: () => [{
          name: 'filename_without_extension',
          type: 'pdf',
          originalPageCount: 5,
          size: 1024000,
          importTimestamp: Date.now()
        }]
      };

      const result = getDefaultFileName(undefined, mockMultiFileImport);
      expect(result).toBe('filename_without_extension_settings.json');
    });

    it('should handle empty filename', () => {
      const mockMultiFileImport: MockMultiFileImport = {
        getFileList: () => [{
          name: '',
          type: 'pdf',
          originalPageCount: 1,
          size: 1024000,
          importTimestamp: Date.now()
        }]
      };

      const result = getDefaultFileName(undefined, mockMultiFileImport);
      expect(result).toBe('_settings.json');
    });

    it('should handle filename that is exactly 20 characters', () => {
      const exactLength = 'exactly_twenty_chars'; // 20 characters
      const mockMultiFileImport: MockMultiFileImport = {
        getFileList: () => [
          { name: `${exactLength}.pdf`, type: 'pdf', originalPageCount: 5, size: 1024000, importTimestamp: Date.now() },
          { name: 'other.pdf', type: 'pdf', originalPageCount: 3, size: 1024000, importTimestamp: Date.now() }
        ]
      };

      const result = getDefaultFileName(undefined, mockMultiFileImport);
      expect(result).toBe('exactly_twenty_chars_and_1_others_settings.json');
    });
  });
});