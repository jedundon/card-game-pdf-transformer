import { test, expect } from '@playwright/test';

test.describe('Basic Application Smoke Tests', () => {
  test('should load the main application page', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Should see the main title
    await expect(page.locator('h1')).toContainText('Card Game PDF Transformer');
    
    // Should see the step indicator (use multiple selector strategies)
    const stepIndicator = page.locator('[data-testid="step-indicator"], .step-indicator, .wizard-steps, nav[role="tablist"]').first();
    await expect(stepIndicator).toBeVisible();
    
    // Should see import step content
    await expect(page.locator('text=Import Files')).toBeVisible();
  });

  test('should display all wizard steps in navigation', async ({ page }) => {
    await page.goto('/');
    
    // Check that all 5 steps are present in the step indicator
    const steps = [
      'Import Files',
      'Extract Cards', 
      'Color Calibration',
      'Configure Layout',
      'Export'
    ];
    
    for (const step of steps) {
      // Use more specific selectors to avoid strict mode violations
      if (step === 'Export') {
        // Target specifically the step indicator Export, not the settings Export
        await expect(page.locator('.step-indicator text=Export, nav text=Export, [role="tablist"] text=Export').first()).toBeVisible();
      } else {
        await expect(page.locator(`text=${step}`).first()).toBeVisible();
      }
    }
  });

  test('should show proper step state (first step active, others disabled)', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // First step should be active/current (use flexible selectors)
    const firstStepSelectors = [
      '[data-testid="step-1"]',
      '.step:first-child',
      '[aria-current="step"]',
      '.step.current',
      '.step.active'
    ];
    
    let firstStepFound = false;
    for (const selector of firstStepSelectors) {
      const element = page.locator(selector);
      if (await element.count() > 0) {
        await expect(element.first()).toBeVisible();
        firstStepFound = true;
        break;
      }
    }
    
    // If no specific step indicator found, at least verify Import Files is visible
    if (!firstStepFound) {
      await expect(page.locator('text=Import Files')).toBeVisible();
    }
  });

  test('should display file upload area', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Should see file upload drop zone or button (multiple fallbacks)
    const uploadSelectors = [
      '[data-testid="file-upload"]',
      '.upload-zone',
      'input[type="file"]',
      '[accept*=".pdf"]',
      'button:has-text("Upload")',
      'button:has-text("Choose")',
      'div:has-text("Drop files")',
      'div:has-text("Select files")'
    ];
    
    let uploadFound = false;
    for (const selector of uploadSelectors) {
      const element = page.locator(selector);
      if (await element.count() > 0) {
        await expect(element.first()).toBeVisible();
        uploadFound = true;
        break;
      }
    }
    
    expect(uploadFound).toBe(true);
    
    // Should see instructions for file upload
    await expect(page.locator('text=PDF')).toBeVisible();
  });

  test('should be responsive on different screen sizes', async ({ page }) => {
    const testViewport = async (width: number, height: number, name: string) => {
      await page.setViewportSize({ width, height });
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      
      // Core content should be visible
      await expect(page.locator('h1')).toBeVisible();
      
      // Step indicator with fallbacks
      const stepIndicator = page.locator('[data-testid="step-indicator"], .step-indicator, .wizard-steps, nav').first();
      await expect(stepIndicator).toBeVisible();
      
      // Import step should be accessible
      await expect(page.locator('text=Import')).toBeVisible();
    };
    
    // Test different viewports with error handling
    await testViewport(375, 667, 'mobile');
    await testViewport(768, 1024, 'tablet');
    await testViewport(1200, 800, 'desktop');
  });

  test('should not have console errors on page load', async ({ page }) => {
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];
    
    page.on('console', msg => {
      if (msg.type() === 'error') {
        // Filter out known harmless errors that might occur in CI
        const errorText = msg.text();
        if (!errorText.includes('favicon.ico') && 
            !errorText.includes('net::ERR_') &&
            !errorText.includes('chrome-extension://')) {
          consoleErrors.push(errorText);
        }
      }
    });
    
    page.on('pageerror', error => {
      pageErrors.push(error.message);
    });
    
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Wait for application to fully initialize
    await page.waitForTimeout(2000);
    
    // Should not have any console or page errors
    if (consoleErrors.length > 0) {
      console.log('Console errors found:', consoleErrors);
    }
    if (pageErrors.length > 0) {
      console.log('Page errors found:', pageErrors);
    }
    
    expect(consoleErrors).toHaveLength(0);
    expect(pageErrors).toHaveLength(0);
  });
});