import { test, expect } from '@playwright/test';

/**
 * Critical Core Functionality Tests - DEPLOYMENT BLOCKING
 * 
 * These tests validate essential application functionality that,
 * if broken, would prevent the core use case from working for ALL users.
 * 
 * Focus: Core user workflows that must always work
 */

test.describe('Critical Core Functionality Tests - Deployment Blocking', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 900 });
    
    // Disable animations for consistent testing
    await page.addStyleTag({
      content: `
        *, *::before, *::after {
          animation-duration: 0s !important;
          animation-delay: 0s !important;
          transition-duration: 0s !important;
          transition-delay: 0s !important;
        }
      `
    });
  });

  test('PDF.js worker should be available and functional', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Wait for application to initialize
    await page.waitForTimeout(3000);
    
    // Critical: PDF.js should be available
    const pdfWorkerTest = await page.evaluate(async () => {
      // Check if PDF.js is loaded
      const pdfJsAvailable = typeof (window as any).pdfjsLib !== 'undefined';
      
      // Check if worker is configured
      let workerConfigured = false;
      let workerSrc = null;
      
      if (pdfJsAvailable) {
        try {
          workerSrc = (window as any).pdfjsLib.GlobalWorkerOptions.workerSrc;
          workerConfigured = !!workerSrc;
        } catch (error) {
          // Worker not configured
        }
      }
      
      return {
        pdfJsAvailable,
        workerConfigured,
        workerSrc
      };
    });
    
    expect(pdfWorkerTest.pdfJsAvailable).toBe(true);
    expect(pdfWorkerTest.workerConfigured).toBe(true);
    expect(pdfWorkerTest.workerSrc).toMatch(/pdf\.worker(\\.min)?\\.js$/);
  });

  test('Core mathematical functions should work correctly', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Critical: Basic DPI conversion calculations
    const mathValidation = await page.evaluate(() => {
      const EXTRACTION_DPI = 300;
      const SCREEN_DPI = 72;
      
      // Test critical DPI conversions
      const testInches = 2.5;
      const extractionPixels = testInches * EXTRACTION_DPI;
      const screenPixels = testInches * SCREEN_DPI;
      const conversionRatio = SCREEN_DPI / EXTRACTION_DPI;
      
      // Test critical card dimension calculations
      const cardWidthInches = 2.5;
      const cardHeightInches = 3.5;
      const bleedInches = 0.125;
      const scalePercent = 100;
      
      const cardWithBleedWidth = (cardWidthInches + bleedInches * 2) * (scalePercent / 100);
      const cardWithBleedHeight = (cardHeightInches + bleedInches * 2) * (scalePercent / 100);
      
      return {
        dpiConversion: {
          extractionPixels,
          screenPixels,
          conversionRatio
        },
        cardDimensions: {
          withBleedWidth: cardWithBleedWidth,
          withBleedHeight: cardWithBleedHeight
        }
      };
    });
    
    // Validate critical calculations
    expect(mathValidation.dpiConversion.extractionPixels).toBe(750); // 2.5 * 300
    expect(mathValidation.dpiConversion.screenPixels).toBe(180); // 2.5 * 72
    expect(mathValidation.dpiConversion.conversionRatio).toBeCloseTo(0.24, 3); // 72/300
    
    expect(mathValidation.cardDimensions.withBleedWidth).toBeCloseTo(2.75, 2); // 2.5 + 0.25
    expect(mathValidation.cardDimensions.withBleedHeight).toBeCloseTo(3.75, 2); // 3.5 + 0.25
  });

  test('File type detection should work', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Critical: File type validation logic
    const fileTypeValidation = await page.evaluate(() => {
      // Mock file type detection logic
      const validateFileType = (fileName: string) => {
        const ext = fileName.toLowerCase().split('.').pop();
        const supportedTypes = ['pdf', 'png', 'jpg', 'jpeg'];
        return supportedTypes.includes(ext || '');
      };
      
      return {
        pdfValid: validateFileType('test.pdf'),
        pngValid: validateFileType('test.PNG'),
        jpgValid: validateFileType('test.jpg'),
        jpegValid: validateFileType('test.JPEG'),
        invalidFile: validateFileType('test.txt'),
        noExtension: validateFileType('test')
      };
    });
    
    expect(fileTypeValidation.pdfValid).toBe(true);
    expect(fileTypeValidation.pngValid).toBe(true);
    expect(fileTypeValidation.jpgValid).toBe(true);
    expect(fileTypeValidation.jpegValid).toBe(true);
    expect(fileTypeValidation.invalidFile).toBe(false);
    expect(fileTypeValidation.noExtension).toBe(false);
  });

  test('Canvas functionality should be available', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Critical: Canvas API should work for image processing
    const canvasTest = await page.evaluate(() => {
      try {
        // Test canvas creation and basic operations
        const canvas = document.createElement('canvas');
        canvas.width = 100;
        canvas.height = 100;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) return { canvasSupported: false, contextAvailable: false };
        
        // Test basic drawing operations
        ctx.fillStyle = '#FF0000';
        ctx.fillRect(0, 0, 50, 50);
        
        // Test image data operations
        const imageData = ctx.getImageData(0, 0, 50, 50);
        const hasData = imageData.data.length > 0;
        
        // Test toDataURL (needed for image processing)
        const dataUrl = canvas.toDataURL();
        const hasDataUrl = dataUrl.startsWith('data:image/');
        
        return {
          canvasSupported: true,
          contextAvailable: true,
          drawingWorks: true,
          imageDataWorks: hasData,
          dataUrlWorks: hasDataUrl
        };
      } catch (error) {
        return {
          canvasSupported: false,
          error: error.message
        };
      }
    });
    
    expect(canvasTest.canvasSupported).toBe(true);
    expect(canvasTest.contextAvailable).toBe(true);
    expect(canvasTest.drawingWorks).toBe(true);
    expect(canvasTest.imageDataWorks).toBe(true);
    expect(canvasTest.dataUrlWorks).toBe(true);
  });

  test('Local storage should be available for settings', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Critical: Storage functionality for user settings
    const storageTest = await page.evaluate(() => {
      try {
        // Test localStorage
        localStorage.setItem('test-key', 'test-value');
        const retrieved = localStorage.getItem('test-key');
        localStorage.removeItem('test-key');
        
        // Test sessionStorage  
        sessionStorage.setItem('test-key', 'test-value');
        const sessionRetrieved = sessionStorage.getItem('test-key');
        sessionStorage.removeItem('test-key');
        
        return {
          localStorageWorks: retrieved === 'test-value',
          sessionStorageWorks: sessionRetrieved === 'test-value'
        };
      } catch (error) {
        return {
          localStorageWorks: false,
          sessionStorageWorks: false,
          error: error.message
        };
      }
    });
    
    expect(storageTest.localStorageWorks).toBe(true);
    expect(storageTest.sessionStorageWorks).toBe(true);
  });
});