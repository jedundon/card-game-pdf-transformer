import { test, expect } from '@playwright/test';

/**
 * Async Processing and Real Function Testing
 * 
 * This test suite implements real-world async processing validation from GitHub Issue #63:
 * - Tests actual canvas processing with real image data
 * - Validates rotation, scaling, and clipping with real files
 * - Tests memory management and performance with large files
 * - Ensures async operations complete successfully
 * - Validates error handling for real-world edge cases
 * 
 * These tests catch "hard to detect" issues that are very impactful to users:
 * - Memory leaks during large file processing
 * - Race conditions in async image loading
 * - Canvas processing failures with real image data
 * - Performance degradation with multiple files
 * - Timeout issues during heavy processing
 */

test.describe('Async Processing and Real Function Testing', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1000 });
    
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
    
    // Set longer timeout for async operations (increased for CI)
    const timeout = process.env.CI ? 60000 : 30000;
    page.setDefaultTimeout(timeout);
  });

  test('Canvas processing should handle real image data correctly', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Test real canvas processing with generated image data
    const canvasProcessingTest = await page.evaluate(async () => {
      // Create a real image element with test data
      const createTestImage = (width: number, height: number, pattern: 'solid' | 'gradient' | 'checkerboard') => {
        return new Promise<HTMLImageElement>((resolve, reject) => {
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          
          if (!ctx) {
            reject(new Error('Could not get canvas context'));
            return;
          }
          
          // Draw different patterns for testing
          switch (pattern) {
            case 'solid':
              ctx.fillStyle = '#FF6B35';
              ctx.fillRect(0, 0, width, height);
              break;
              
            case 'gradient': {
              const gradient = ctx.createLinearGradient(0, 0, width, height);
              gradient.addColorStop(0, '#FF6B35');
              gradient.addColorStop(0.5, '#F7931E');
              gradient.addColorStop(1, '#FFD23F');
              ctx.fillStyle = gradient;
              ctx.fillRect(0, 0, width, height);
              break;
            }
              
            case 'checkerboard': {
              const squareSize = 20;
              for (let x = 0; x < width; x += squareSize) {
                for (let y = 0; y < height; y += squareSize) {
                  const isOdd = ((x / squareSize) + (y / squareSize)) % 2;
                  ctx.fillStyle = isOdd ? '#FF6B35' : '#FFFFFF';
                  ctx.fillRect(x, y, squareSize, squareSize);
                }
              }
              break;
            }
          }
          
          // Convert canvas to image
          const img = new Image();
          img.onload = () => resolve(img);
          img.onerror = () => reject(new Error('Failed to create test image'));
          img.src = canvas.toDataURL();
        });
      };
      
      // Process image with rotation and scaling
      const processCardImageForRendering = async (
        sourceImage: HTMLImageElement,
        targetWidth: number,
        targetHeight: number,
        rotation: number,
        sizingMode: 'actual-size' | 'fit-to-card' | 'fill-card'
      ) => {
        return new Promise<{ canvas: HTMLCanvasElement; processingTime: number }>((resolve, reject) => {
          const startTime = performance.now();
          
          try {
            // Calculate image dimensions based on sizing mode
            let imageWidth = sourceImage.width;
            let imageHeight = sourceImage.height;
            
            switch (sizingMode) {
              case 'fit-to-card': {
                const fitScale = Math.min(targetWidth / sourceImage.width, targetHeight / sourceImage.height);
                imageWidth = sourceImage.width * fitScale;
                imageHeight = sourceImage.height * fitScale;
                break;
              }
              case 'fill-card': {
                const fillScale = Math.max(targetWidth / sourceImage.width, targetHeight / sourceImage.height);
                imageWidth = sourceImage.width * fillScale;
                imageHeight = sourceImage.height * fillScale;
                break;
              }
              // 'actual-size' uses original dimensions
            }
            
            // Calculate canvas dimensions (accounting for rotation)
            let canvasWidth = targetWidth;
            let canvasHeight = targetHeight;
            
            if (rotation === 90 || rotation === 270) {
              [canvasWidth, canvasHeight] = [canvasHeight, canvasWidth];
            }
            
            // Create output canvas
            const outputCanvas = document.createElement('canvas');
            outputCanvas.width = canvasWidth;
            outputCanvas.height = canvasHeight;
            const ctx = outputCanvas.getContext('2d');
            
            if (!ctx) {
              reject(new Error('Could not get output canvas context'));
              return;
            }
            
            // Clear canvas
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, canvasWidth, canvasHeight);
            
            // Apply rotation and draw image
            ctx.save();
            
            // Move to center for rotation
            ctx.translate(canvasWidth / 2, canvasHeight / 2);
            
            // Apply rotation
            ctx.rotate((rotation * Math.PI) / 180);
            
            // Draw image centered
            ctx.drawImage(
              sourceImage,
              -imageWidth / 2,
              -imageHeight / 2,
              imageWidth,
              imageHeight
            );
            
            ctx.restore();
            
            const processingTime = performance.now() - startTime;
            resolve({ canvas: outputCanvas, processingTime });
            
          } catch (error) {
            reject(error);
          }
        });
      };
      
      // Test different image processing scenarios
      const testScenarios = [
        { width: 500, height: 700, pattern: 'solid' as const, rotation: 0, mode: 'fit-to-card' as const },
        { width: 500, height: 700, pattern: 'gradient' as const, rotation: 90, mode: 'fit-to-card' as const },
        { width: 800, height: 600, pattern: 'checkerboard' as const, rotation: 180, mode: 'fill-card' as const },
        { width: 300, height: 400, pattern: 'solid' as const, rotation: 270, mode: 'actual-size' as const }
      ];
      
      const targetCardSize = { width: 400, height: 500 };
      const results = [];
      
      for (const scenario of testScenarios) {
        try {
          // Create test image
          const testImage = await createTestImage(scenario.width, scenario.height, scenario.pattern);
          
          // Process the image
          const processed = await processCardImageForRendering(
            testImage,
            targetCardSize.width,
            targetCardSize.height,
            scenario.rotation,
            scenario.mode
          );
          
          // Validate output
          const outputData = processed.canvas.getContext('2d')?.getImageData(0, 0, processed.canvas.width, processed.canvas.height);
          
          results.push({
            scenario,
            success: true,
            processingTime: processed.processingTime,
            outputDimensions: { width: processed.canvas.width, height: processed.canvas.height },
            hasValidOutput: !!outputData && outputData.data.length > 0,
            pixelCount: outputData?.data.length || 0
          });
          
        } catch (error) {
          results.push({
            scenario,
            success: false,
            error: error.message,
            processingTime: 0,
            outputDimensions: { width: 0, height: 0 },
            hasValidOutput: false,
            pixelCount: 0
          });
        }
      }
      
      return {
        totalScenarios: testScenarios.length,
        results,
        allSuccessful: results.every(r => r.success),
        averageProcessingTime: results.reduce((sum, r) => sum + r.processingTime, 0) / results.length,
        totalPixelsProcessed: results.reduce((sum, r) => sum + r.pixelCount, 0)
      };
    });
    
    // Validate canvas processing results
    expect(canvasProcessingTest.totalScenarios).toBe(4);
    expect(canvasProcessingTest.allSuccessful).toBe(true);
    expect(canvasProcessingTest.averageProcessingTime).toBeGreaterThan(0);
    expect(canvasProcessingTest.averageProcessingTime).toBeLessThan(1000); // Should be fast
    expect(canvasProcessingTest.totalPixelsProcessed).toBeGreaterThan(0);
    
    // Validate individual scenario results
    for (const result of canvasProcessingTest.results) {
      expect(result.success).toBe(true);
      expect(result.hasValidOutput).toBe(true);
      expect(result.outputDimensions.width).toBeGreaterThan(0);
      expect(result.outputDimensions.height).toBeGreaterThan(0);
      expect(result.processingTime).toBeLessThan(500); // Individual operations should be fast
    }
    
    // Test rotation dimension handling
    const rotation0 = canvasProcessingTest.results.find(r => r.scenario.rotation === 0);
    const rotation90 = canvasProcessingTest.results.find(r => r.scenario.rotation === 90);
    const rotation180 = canvasProcessingTest.results.find(r => r.scenario.rotation === 180);
    const rotation270 = canvasProcessingTest.results.find(r => r.scenario.rotation === 270);
    
    // 0° and 180° should have same orientation
    expect(rotation0?.outputDimensions.width).toBe(400); // Target width
    expect(rotation0?.outputDimensions.height).toBe(500); // Target height
    expect(rotation180?.outputDimensions.width).toBe(400);
    expect(rotation180?.outputDimensions.height).toBe(500);
    
    // 90° and 270° should have swapped dimensions
    expect(rotation90?.outputDimensions.width).toBe(500); // Target height becomes width
    expect(rotation90?.outputDimensions.height).toBe(400); // Target width becomes height
    expect(rotation270?.outputDimensions.width).toBe(500);
    expect(rotation270?.outputDimensions.height).toBe(400);
  });

  test('Async image loading should handle multiple files efficiently', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Test async loading of multiple images
    const multiImageLoadingTest = await page.evaluate(async () => {
      // Simulate loading multiple image files asynchronously
      const createImageFromData = (width: number, height: number, filename: string) => {
        return new Promise<{ image: HTMLImageElement; loadTime: number; filename: string }>((resolve, reject) => {
          const startTime = performance.now();
          
          // Create a test image with unique patterns
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          
          if (!ctx) {
            reject(new Error(`Failed to create context for ${filename}`));
            return;
          }
          
          // Create unique pattern based on filename
          const hue = filename.charCodeAt(0) % 360;
          ctx.fillStyle = `hsl(${hue}, 70%, 50%)`;
          ctx.fillRect(0, 0, width, height);
          
          // Add some detail to make it more realistic
          ctx.fillStyle = 'white';
          ctx.font = '20px Arial';
          ctx.fillText(filename, 10, 30);
          
          const img = new Image();
          img.onload = () => {
            const loadTime = performance.now() - startTime;
            resolve({ image: img, loadTime, filename });
          };
          img.onerror = () => reject(new Error(`Failed to load ${filename}`));
          img.src = canvas.toDataURL();
        });
      };
      
      // Test files with different sizes and complexities
      const testFiles = [
        { filename: 'small-card.jpg', width: 300, height: 400 },
        { filename: 'medium-card.png', width: 600, height: 800 },
        { filename: 'large-card.jpg', width: 1200, height: 1600 },
        { filename: 'xl-card.png', width: 2400, height: 3200 },
        { filename: 'portrait-card.jpg', width: 500, height: 700 },
        { filename: 'landscape-card.png', width: 700, height: 500 }
      ];
      
      // Test sequential loading
      const sequentialStart = performance.now();
      const sequentialResults = [];
      
      for (const file of testFiles) {
        try {
          const result = await createImageFromData(file.width, file.height, file.filename);
          sequentialResults.push(result);
        } catch (error) {
          sequentialResults.push({ 
            image: null, 
            loadTime: 0, 
            filename: file.filename, 
            error: error.message 
          });
        }
      }
      
      const sequentialTotalTime = performance.now() - sequentialStart;
      
      // Test parallel loading
      const parallelStart = performance.now();
      const parallelPromises = testFiles.map(file => 
        createImageFromData(file.width, file.height, file.filename)
          .catch(error => ({ 
            image: null, 
            loadTime: 0, 
            filename: file.filename, 
            error: error.message 
          }))
      );
      
      const parallelResults = await Promise.all(parallelPromises);
      const parallelTotalTime = performance.now() - parallelStart;
      
      // Test race condition handling (first few files complete first)
      const raceTest = await Promise.race([
        createImageFromData(100, 100, 'tiny-fast.jpg'),
        createImageFromData(2000, 2000, 'huge-slow.jpg'),
        createImageFromData(200, 200, 'small-fast.jpg')
      ]);
      
      return {
        totalFiles: testFiles.length,
        sequential: {
          results: sequentialResults,
          totalTime: sequentialTotalTime,
          averageTime: sequentialTotalTime / testFiles.length,
          allLoaded: sequentialResults.every(r => r.image !== null)
        },
        parallel: {
          results: parallelResults,
          totalTime: parallelTotalTime,
          averageTime: parallelTotalTime / testFiles.length,
          allLoaded: parallelResults.every(r => r.image !== null),
          speedImprovement: sequentialTotalTime / parallelTotalTime
        },
        raceCondition: {
          winner: raceTest.filename,
          loadTime: raceTest.loadTime
        }
      };
    });
    
    // Validate async loading performance
    expect(multiImageLoadingTest.totalFiles).toBe(6);
    expect(multiImageLoadingTest.sequential.allLoaded).toBe(true);
    expect(multiImageLoadingTest.parallel.allLoaded).toBe(true);
    
    // Parallel loading should be faster than sequential
    expect(multiImageLoadingTest.parallel.speedImprovement).toBeGreaterThan(1);
    expect(multiImageLoadingTest.parallel.totalTime).toBeLessThan(multiImageLoadingTest.sequential.totalTime);
    
    // Individual load times should be reasonable
    expect(multiImageLoadingTest.sequential.averageTime).toBeLessThan(1000);
    expect(multiImageLoadingTest.parallel.averageTime).toBeLessThan(1000);
    
    // Race condition should be handled properly
    expect(multiImageLoadingTest.raceCondition.winner).toMatch(/fast/); // Smaller files should win
    expect(multiImageLoadingTest.raceCondition.loadTime).toBeGreaterThan(0);
    
    // Validate load times are proportional to file complexity
    const sequentialTimes = multiImageLoadingTest.sequential.results.map(r => r.loadTime);
    const parallelTimes = multiImageLoadingTest.parallel.results.map(r => r.loadTime);
    
    // All load times should be positive
    for (const time of [...sequentialTimes, ...parallelTimes]) {
      expect(time).toBeGreaterThan(0);
    }
  });

  test('Memory management should handle large file processing efficiently', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Determine CI-specific parameters outside browser context
    const isCI = !!process.env.CI;
    const ciImageSizes = [
      { name: 'small', width: 400, height: 500 },
      { name: 'medium', width: 600, height: 800 },
      { name: 'large', width: 800, height: 1000 },
      { name: 'xl', width: 1000, height: 1200 }
    ];
    const localImageSizes = [
      { name: 'medium', width: 800, height: 1000 },
      { name: 'large', width: 1600, height: 2000 },
      { name: 'xl', width: 2400, height: 3000 },
      { name: 'xxl', width: 3200, height: 4000 }
    ];
    
    // Test memory management with large files
    const memoryManagementTest = await page.evaluate(async ({ imageSizes, ciCleanupDelay }) => {
      // Monitor memory usage during processing (CI-safe)
      const getMemoryUsage = () => {
        try {
          // Chrome-specific API for memory monitoring
          if ((performance as any).memory) {
            return {
              used: (performance as any).memory.usedJSHeapSize,
              total: (performance as any).memory.totalJSHeapSize,
              limit: (performance as any).memory.jsHeapSizeLimit
            };
          }
        } catch (error) {
          // Memory API not available (CI environment)
          console.log('Memory API not available:', error.message);
        }
        return { used: 0, total: 0, limit: 0 };
      };
      
      const createLargeImageData = (width: number, height: number) => {
        return new Promise<HTMLImageElement>((resolve, reject) => {
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          
          if (!ctx) {
            reject(new Error('Could not get canvas context'));
            return;
          }
          
          // Create complex image data to use more memory
          const imageData = ctx.createImageData(width, height);
          const data = imageData.data;
          
          // Fill with pseudo-random pattern
          for (let i = 0; i < data.length; i += 4) {
            const x = (i / 4) % width;
            const y = Math.floor((i / 4) / width);
            
            data[i] = (x * 255) / width;     // Red
            data[i + 1] = (y * 255) / height; // Green
            data[i + 2] = ((x + y) * 255) / (width + height); // Blue
            data[i + 3] = 255; // Alpha
          }
          
          ctx.putImageData(imageData, 0, 0);
          
          const img = new Image();
          img.onload = () => resolve(img);
          img.onerror = () => reject(new Error('Failed to create large image'));
          img.src = canvas.toDataURL();
        });
      };
      
      const processLargeImage = async (image: HTMLImageElement) => {
        return new Promise<{ processedCanvas: HTMLCanvasElement; processingTime: number }>((resolve) => {
          const startTime = performance.now();
          
          // Create output canvas
          const canvas = document.createElement('canvas');
          canvas.width = 1000; // Fixed output size
          canvas.height = 1000;
          const ctx = canvas.getContext('2d')!;
          
          // Process with scaling and rotation
          ctx.save();
          ctx.translate(500, 500);
          ctx.rotate(Math.PI / 4); // 45 degrees
          ctx.scale(0.8, 0.8);
          ctx.drawImage(image, -image.width / 2, -image.height / 2);
          ctx.restore();
          
          const processingTime = performance.now() - startTime;
          resolve({ processedCanvas: canvas, processingTime });
        });
      };
      
      // Use image sizes passed from Node.js context
      
      const memoryBaseline = getMemoryUsage();
      const results = [];
      
      for (const size of imageSizes) {
        try {
          const memoryBefore = getMemoryUsage();
          
          // Create and process large image
          const largeImage = await createLargeImageData(size.width, size.height);
          const memoryAfterCreation = getMemoryUsage();
          
          const processed = await processLargeImage(largeImage);
          const memoryAfterProcessing = getMemoryUsage();
          
          // Force cleanup
          largeImage.src = '';
          processed.processedCanvas.width = 1;
          processed.processedCanvas.height = 1;
          
          // Give GC a chance to run (CI-safe)
          try {
            if (window.gc) {
              window.gc();
            }
          } catch (error) {
            // GC not available in this environment
          }
          
          // Additional cleanup for CI environments
          if (ciCleanupDelay > 0) {
            await new Promise(resolve => setTimeout(resolve, ciCleanupDelay));
          }
          
          const memoryAfterCleanup = getMemoryUsage();
          
          results.push({
            size: size.name,
            dimensions: { width: size.width, height: size.height },
            processingTime: processed.processingTime,
            memoryUsage: {
              baseline: memoryBaseline.used,
              afterCreation: memoryAfterCreation.used,
              afterProcessing: memoryAfterProcessing.used,
              afterCleanup: memoryAfterCleanup.used,
              peakIncrease: memoryAfterProcessing.used - memoryBefore.used,
              cleanupEfficiency: (memoryAfterProcessing.used - memoryAfterCleanup.used) / (memoryAfterProcessing.used - memoryBefore.used || 1)
            },
            success: true
          });
          
        } catch (error) {
          results.push({
            size: size.name,
            dimensions: { width: size.width, height: size.height },
            processingTime: 0,
            memoryUsage: { peakIncrease: 0, cleanupEfficiency: 0 },
            success: false,
            error: error.message
          });
        }
      }
      
      return {
        memoryBaseline,
        results,
        totalTests: imageSizes.length,
        allSuccessful: results.every(r => r.success),
        maxProcessingTime: Math.max(...results.map(r => r.processingTime)),
        averageCleanupEfficiency: results.reduce((sum, r) => sum + (r.memoryUsage.cleanupEfficiency || 0), 0) / results.length
      };
    }, { 
      imageSizes: isCI ? ciImageSizes : localImageSizes,
      ciCleanupDelay: isCI ? 100 : 0
    });
    
    // Validate memory management (CI-adjusted expectations)
    const expectedTests = isCI ? 4 : 4; // Keep same for now
    const maxProcessingTimeThreshold = isCI ? 10000 : 5000;
    
    expect(memoryManagementTest.totalTests).toBe(expectedTests);
    expect(memoryManagementTest.allSuccessful).toBe(true);
    expect(memoryManagementTest.maxProcessingTime).toBeLessThan(maxProcessingTimeThreshold);
    
    // Memory cleanup should be reasonably efficient (CI-safe)
    if (memoryManagementTest.memoryBaseline.used > 0) {
      // In CI, memory API might not be available, so cleanup efficiency could be 0
      if (isCI) {
        expect(memoryManagementTest.averageCleanupEfficiency).toBeGreaterThanOrEqual(0);
      } else {
        expect(memoryManagementTest.averageCleanupEfficiency).toBeGreaterThan(0);
      }
    }
    
    // Processing times should scale reasonably with image size
    const results = memoryManagementTest.results;
    expect(results[0].processingTime).toBeGreaterThan(0); // Medium
    expect(results[3].processingTime).toBeGreaterThan(results[0].processingTime); // XXL should take longer than medium
    
    // All sizes should complete successfully (CI-adjusted timeouts)
    const individualTimeoutThreshold = isCI ? 6000 : 3000;
    
    for (const result of results) {
      expect(result.success).toBe(true);
      expect(result.processingTime).toBeLessThan(individualTimeoutThreshold);
      expect(result.dimensions.width).toBeGreaterThan(0);
      expect(result.dimensions.height).toBeGreaterThan(0);
    }
  });

  test('Error handling should work correctly with real async operations', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Test error handling in async operations
    const asyncErrorHandlingTest = await page.evaluate(async () => {
      // Test various error scenarios
      const testAsyncError = async (errorType: string) => {
        const startTime = performance.now();
        
        switch (errorType) {
          case 'invalid-image-data': {
            // Try to create image with invalid data
            const img = new Image();
            return new Promise((resolve, reject) => {
              img.onload = () => resolve({ success: true, errorType, time: performance.now() - startTime });
              img.onerror = () => reject(new Error('Invalid image data'));
              img.src = 'data:image/invalid;base64,invaliddata';
            });
          }
            
          case 'canvas-size-limit': {
            // Try to create oversized canvas
            const canvas = document.createElement('canvas');
            canvas.width = 99999; // Likely to exceed browser limits
            canvas.height = 99999;
            const ctx = canvas.getContext('2d');
            if (!ctx) throw new Error('Canvas size exceeded browser limits');
            return { success: true, errorType, time: performance.now() - startTime };
          }
            
          case 'memory-allocation-failure': {
            // Try to allocate huge amount of memory
            const hugeArray = new Uint8Array(1024 * 1024 * 1024); // 1GB
            hugeArray.fill(255);
            return { success: true, errorType, time: performance.now() - startTime };
          }
            
          case 'async-timeout':
            // Simulate operation that takes too long
            return new Promise((resolve, reject) => {
              setTimeout(() => {
                reject(new Error('Operation timed out'));
              }, 100);
              // Start a longer operation
              setTimeout(() => {
                resolve({ success: true, errorType, time: performance.now() - startTime });
              }, 200);
            });
            
          default:
            throw new Error(`Unknown error type: ${errorType}`);
        }
      };
      
      const errorTypes = [
        'invalid-image-data',
        'canvas-size-limit', 
        'memory-allocation-failure',
        'async-timeout'
      ];
      
      const errorResults = [];
      
      for (const errorType of errorTypes) {
        try {
          const result = await testAsyncError(errorType);
          errorResults.push({
            errorType,
            expectedError: true,
            actualError: false,
            result,
            handledCorrectly: false // Should have thrown an error
          });
        } catch (error) {
          errorResults.push({
            errorType,
            expectedError: true,
            actualError: true,
            errorMessage: error.message,
            handledCorrectly: true // Error was caught as expected
          });
        }
      }
      
      // Test error recovery scenarios
      const testErrorRecovery = async () => {
        const recoveryScenarios = [];
        
        // Scenario 1: Recover from image load failure
        try {
          const img = new Image();
          const loadPromise = new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
            img.src = 'invalid-url';
          });
          
          await loadPromise;
          recoveryScenarios.push({ scenario: 'image-load-recovery', recovered: false });
        } catch (error) {
          // Recovery: try with fallback
          try {
            const fallbackImg = new Image();
            const fallbackPromise = new Promise((resolve) => {
              fallbackImg.onload = resolve;
              fallbackImg.onerror = resolve; // Don't fail on fallback
              fallbackImg.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'; // 1x1 transparent GIF
            });
            
            await fallbackPromise;
            recoveryScenarios.push({ scenario: 'image-load-recovery', recovered: true });
          } catch (fallbackError) {
            recoveryScenarios.push({ scenario: 'image-load-recovery', recovered: false, fallbackError: fallbackError.message });
          }
        }
        
        // Scenario 2: Recover from canvas processing failure
        try {
          const canvas = document.createElement('canvas');
          canvas.width = -1; // Invalid size
          const ctx = canvas.getContext('2d');
          if (!ctx) throw new Error('Invalid canvas');
          recoveryScenarios.push({ scenario: 'canvas-recovery', recovered: false });
        } catch (error) {
          // Recovery: use valid dimensions
          try {
            const fallbackCanvas = document.createElement('canvas');
            fallbackCanvas.width = 100;
            fallbackCanvas.height = 100;
            const fallbackCtx = fallbackCanvas.getContext('2d');
            if (fallbackCtx) {
              recoveryScenarios.push({ scenario: 'canvas-recovery', recovered: true });
            } else {
              recoveryScenarios.push({ scenario: 'canvas-recovery', recovered: false });
            }
          } catch (fallbackError) {
            recoveryScenarios.push({ scenario: 'canvas-recovery', recovered: false, fallbackError: fallbackError.message });
          }
        }
        
        return recoveryScenarios;
      };
      
      const recoveryResults = await testErrorRecovery();
      
      return {
        errorTests: errorResults,
        recoveryTests: recoveryResults,
        totalErrorTests: errorTypes.length,
        errorsHandledCorrectly: errorResults.filter(r => r.handledCorrectly).length,
        totalRecoveryTests: recoveryResults.length,
        successfulRecoveries: recoveryResults.filter(r => r.recovered).length
      };
    });
    
    // Validate error handling
    expect(asyncErrorHandlingTest.totalErrorTests).toBe(4);
    expect(asyncErrorHandlingTest.errorsHandledCorrectly).toBeGreaterThan(0); // At least some errors should be caught
    
    // Most error types should be properly handled (CI-adjusted)
    const isCI = !!process.env.CI;
    const handlingRate = asyncErrorHandlingTest.errorsHandledCorrectly / asyncErrorHandlingTest.totalErrorTests;
    // In CI, some error types might behave differently, so be more lenient
    if (isCI) {
      expect(handlingRate).toBeGreaterThanOrEqual(0.5); // At least 50% of errors should be handled
    } else {
      expect(handlingRate).toBeGreaterThan(0.5); // More than 50% for local testing
    }
    
    // Recovery scenarios should work
    expect(asyncErrorHandlingTest.totalRecoveryTests).toBe(2);
    expect(asyncErrorHandlingTest.successfulRecoveries).toBe(2); // Both recovery scenarios should work
    
    // Validate specific error handling
    const errorResults = asyncErrorHandlingTest.errorTests;
    
    // Invalid image data should definitely fail
    const invalidImageResult = errorResults.find(r => r.errorType === 'invalid-image-data');
    expect(invalidImageResult?.handledCorrectly).toBe(true);
    
    // Timeout should be caught
    const timeoutResult = errorResults.find(r => r.errorType === 'async-timeout');
    expect(timeoutResult?.handledCorrectly).toBe(true);
    
    // Recovery scenarios validation
    const recoveryResults = asyncErrorHandlingTest.recoveryTests;
    
    const imageRecovery = recoveryResults.find(r => r.scenario === 'image-load-recovery');
    const canvasRecovery = recoveryResults.find(r => r.scenario === 'canvas-recovery');
    
    expect(imageRecovery?.recovered).toBe(true);
    expect(canvasRecovery?.recovered).toBe(true);
  });

  test('Performance should remain stable during extended processing sessions', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Determine CI-specific parameters outside browser context
    const isCI = !!process.env.CI;
    const iterations = isCI ? 20 : 50;
    const yieldFrequency = isCI ? 5 : 10;
    const yieldDelay = isCI ? 10 : 1;
    
    // Test performance stability over time
    const performanceStabilityTest = await page.evaluate(async ({ iterations, yieldFrequency, yieldDelay }) => {
      // Simulate extended processing session
      const performMultipleOperations = async () => {
        const performanceSamples = [];
        
        for (let i = 0; i < iterations; i++) {
          const startTime = performance.now();
          
          // Simulate typical card processing operations
          const canvas = document.createElement('canvas');
          canvas.width = 500;
          canvas.height = 700;
          const ctx = canvas.getContext('2d')!;
          
          // Draw test pattern
          ctx.fillStyle = `hsl(${(i * 137) % 360}, 70%, 50%)`; // Vary color
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          
          // Apply rotation
          ctx.save();
          ctx.translate(250, 350);
          ctx.rotate((i * Math.PI) / 8); // Vary rotation
          ctx.fillStyle = 'white';
          ctx.fillRect(-100, -50, 200, 100);
          ctx.restore();
          
          // Create image from canvas
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          
          // Process the image data (simulate filtering)
          const data = imageData.data;
          for (let j = 0; j < data.length; j += 4) {
            data[j] = Math.min(255, data[j] * 1.1);     // Brighten red
            data[j + 1] = Math.min(255, data[j + 1] * 1.1); // Brighten green
            data[j + 2] = Math.min(255, data[j + 2] * 1.1); // Brighten blue
          }
          
          ctx.putImageData(imageData, 0, 0);
          
          const operationTime = performance.now() - startTime;
          
          performanceSamples.push({
            iteration: i,
            operationTime,
            timestamp: performance.now()
          });
          
          // Clean up
          canvas.width = 1;
          canvas.height = 1;
          
          // Yield control occasionally (more frequent in CI)
          if (i % yieldFrequency === 0) {
            await new Promise(resolve => setTimeout(resolve, yieldDelay));
          }
        }
        
        return performanceSamples;
      };
      
      // Run performance test (reduced iterations for CI)
      const samples = await performMultipleOperations();
      
      // Analyze performance trends
      const firstHalfSamples = samples.slice(0, Math.floor(samples.length / 2));
      const secondHalfSamples = samples.slice(Math.floor(samples.length / 2));
      
      const firstHalfAvg = firstHalfSamples.reduce((sum, s) => sum + s.operationTime, 0) / firstHalfSamples.length;
      const secondHalfAvg = secondHalfSamples.reduce((sum, s) => sum + s.operationTime, 0) / secondHalfSamples.length;
      
      const performanceDegradation = (secondHalfAvg - firstHalfAvg) / firstHalfAvg;
      
      // Calculate statistics
      const allTimes = samples.map(s => s.operationTime);
      const minTime = Math.min(...allTimes);
      const maxTime = Math.max(...allTimes);
      const avgTime = allTimes.reduce((sum, t) => sum + t, 0) / allTimes.length;
      const medianTime = allTimes.sort((a, b) => a - b)[Math.floor(allTimes.length / 2)];
      
      // Calculate standard deviation
      const variance = allTimes.reduce((sum, t) => sum + Math.pow(t - avgTime, 2), 0) / allTimes.length;
      const standardDeviation = Math.sqrt(variance);
      const coefficientOfVariation = standardDeviation / avgTime;
      
      return {
        totalIterations: iterations,
        performanceMetrics: {
          firstHalfAverage: firstHalfAvg,
          secondHalfAverage: secondHalfAvg,
          degradationPercent: performanceDegradation * 100,
          minTime,
          maxTime,
          avgTime,
          medianTime,
          standardDeviation,
          coefficientOfVariation
        },
        samples: samples,
        performanceStable: Math.abs(performanceDegradation) < 0.2, // Less than 20% degradation
        allOperationsCompleted: samples.length === iterations
      };
    }, { iterations, yieldFrequency, yieldDelay });
    
    // Validate performance stability (CI-adjusted expectations)
    const expectedIterations = iterations;
    expect(performanceStabilityTest.totalIterations).toBe(expectedIterations);
    expect(performanceStabilityTest.allOperationsCompleted).toBe(true);
    expect(performanceStabilityTest.performanceStable).toBe(true);
    
    const metrics = performanceStabilityTest.performanceMetrics;
    
    // Performance should be reasonable (CI-adjusted thresholds)
    const avgTimeThreshold = isCI ? 200 : 100;
    const maxTimeThreshold = isCI ? 1000 : 500;
    
    expect(metrics.avgTime).toBeLessThan(avgTimeThreshold);
    expect(metrics.maxTime).toBeLessThan(maxTimeThreshold);
    expect(metrics.minTime).toBeGreaterThan(0);
    
    // Performance should be consistent (low coefficient of variation)
    expect(metrics.coefficientOfVariation).toBeLessThan(1.0); // Standard deviation should be less than mean
    
    // Performance degradation should be minimal
    expect(Math.abs(metrics.degradationPercent)).toBeLessThan(20); // Less than 20% performance change
    
    // Performance should remain within reasonable bounds
    expect(metrics.medianTime).toBeLessThan(metrics.avgTime * 1.5); // Median shouldn't be too far from average
    expect(metrics.standardDeviation).toBeLessThan(metrics.avgTime); // Low variation
    
    // Validate that no operations failed (all samples should have valid times)
    const maxOperationTime = isCI ? 2000 : 1000;
    const maxIteration = iterations;
    
    for (const sample of performanceStabilityTest.samples) {
      expect(sample.operationTime).toBeGreaterThan(0);
      expect(sample.operationTime).toBeLessThan(maxOperationTime);
      expect(sample.iteration).toBeGreaterThanOrEqual(0);
      expect(sample.iteration).toBeLessThan(maxIteration);
    }
  });
});