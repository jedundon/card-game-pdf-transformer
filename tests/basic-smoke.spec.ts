import { test, expect } from '@playwright/test';

test.describe('Basic Application Smoke Tests', () => {
  test('should load the main application page', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Should see the main title
    await expect(page.locator('h1')).toContainText('Card Game PDF Transformer');
    
    // Should see the step indicator (it's a flexbox div with numbered circles)
    const stepIndicator = page.locator('div').filter({ hasText: /^1$/ }).first();
    await expect(stepIndicator).toBeVisible();
    
    // Should see import step content - updated step name
    await expect(page.locator('text=Import PDF')).toBeVisible();
  });

  test('should display all wizard steps in navigation', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Check that all 5 steps are present in the step indicator - updated step names
    const steps = [
      'Import PDF',
      'Extract Cards', 
      'Configure Layout',
      'Color Calibration',
      'Export'
    ];
    
    for (const step of steps) {
      // Look for step text in the step indicator area
      await expect(page.locator(`text=${step}`).first()).toBeVisible();
    }
    
    // Also verify the numbered circles (1-5) are present
    for (let i = 1; i <= 5; i++) {
      const stepNumber = page.locator('div').filter({ hasText: new RegExp(`^${i}$`) }).first();
      await expect(stepNumber).toBeVisible();
    }
  });

  test('should show proper step state (first step active, others disabled)', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // First step should be active - look for blue colored step 1
    const firstStepNumber = page.locator('div').filter({ hasText: /^1$/ }).first();
    await expect(firstStepNumber).toBeVisible();
    
    // The first step should have blue background (active), check CSS classes on the circle
    const activeStepCircle = page.locator('div').filter({ hasText: /^1$/ }).first();
    await expect(activeStepCircle).toHaveClass(/bg-blue-600/);
    
    // Import PDF text should be visible and active (blue text)
    const importText = page.locator('text=Import PDF');
    await expect(importText).toBeVisible();
    await expect(importText).toHaveClass(/text-blue-600/);
  });

  test('should display file upload area', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Should see file upload area based on current UI structure
    
    // File input should exist (it's hidden but present)
    const fileInput = page.locator('input[type="file"][accept*=".pdf"]');
    await expect(fileInput).toBeAttached();
    
    // Should see the upload button with Upload icon
    const uploadButton = page.locator('button[aria-label="Select PDF or image files to import"]');
    await expect(uploadButton).toBeVisible();
    
    // Should see the clickable text link
    const selectButton = page.locator('button:has-text("Select PDF or image files")');
    await expect(selectButton).toBeVisible();
    
    // Should see instructions mentioning drag & drop and PDF/image files
    await expect(page.locator('text=/Drag.*drop.*PDF.*image/')).toBeVisible();
  });

  test('should be responsive on different screen sizes', async ({ page }) => {
    const testViewport = async (width: number, height: number, name: string) => {
      await page.setViewportSize({ width, height });
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      
      // Core content should be visible
      await expect(page.locator('h1')).toBeVisible();
      
      // Step indicator should be visible (numbered circles)
      const firstStepNumber = page.locator('div').filter({ hasText: /^1$/ }).first();
      await expect(firstStepNumber).toBeVisible();
      
      // Import step should be accessible
      await expect(page.locator('text=Import PDF')).toBeVisible();
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