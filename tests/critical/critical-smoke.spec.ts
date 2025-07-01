import { test, expect } from '@playwright/test';

/**
 * Critical Smoke Tests - DEPLOYMENT BLOCKING
 * 
 * These tests MUST PASS for deployment to proceed.
 * Only include tests that validate core application functionality
 * that would be broken for ALL users if failing.
 * 
 * Criteria for inclusion:
 * - Test failure indicates app is fundamentally broken
 * - High stability (rarely produces false positives)
 * - Fast execution (< 30 seconds per test)
 * - Critical user-facing functionality
 */

test.describe('Critical Smoke Tests - Deployment Blocking', () => {
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

  test('Application should load without critical errors', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Critical: Main application title should be present
    await expect(page.locator('h1')).toContainText('Card Game PDF Transformer');
    
    // Critical: All wizard steps should be visible
    await expect(page.locator('text=Import PDF')).toBeVisible();
    await expect(page.locator('text=Extract Cards')).toBeVisible();
    await expect(page.locator('text=Configure Layout')).toBeVisible();
    await expect(page.locator('text=Color Calibration')).toBeVisible();
    await expect(page.locator('text=Export')).toBeVisible();
    
    // Critical: Step 1 should be active initially
    const activeStep = page.locator('div').filter({ hasText: /^1$/ }).first();
    await expect(activeStep).toHaveClass(/bg-blue-600/);
  });

  test('File upload interface should be accessible', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Critical: File upload button should be present and functional
    const uploadButton = page.locator('button[aria-label="Select PDF or image files to import"]').first();
    await expect(uploadButton).toBeVisible();
    await expect(uploadButton).toBeEnabled();
    
    // Critical: File input should be present
    const fileInput = page.locator('input[type="file"]').first();
    await expect(fileInput).toBeAttached();
  });

  test('Basic navigation should work', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Critical: Page should load without JavaScript errors
    const logs = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        logs.push(msg.text());
      }
    });
    
    // Wait for any initial loading
    await page.waitForTimeout(2000);
    
    // Should not have critical JavaScript errors
    const criticalErrors = logs.filter(log => 
      !log.includes('favicon.ico') && 
      !log.includes('net::ERR_') &&
      !log.includes('chrome-extension')
    );
    
    expect(criticalErrors).toHaveLength(0);
  });

  test('Essential CSS and styling should load', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Critical: Tailwind CSS should be working
    const testElement = await page.evaluateHandle(() => {
      const div = document.createElement('div');
      div.className = 'flex items-center justify-center';
      document.body.appendChild(div);
      return div;
    });
    
    const styles = await page.evaluate((element) => {
      const computed = window.getComputedStyle(element);
      return {
        display: computed.display,
        alignItems: computed.alignItems,
        justifyContent: computed.justifyContent
      };
    }, testElement);
    
    expect(styles.display).toBe('flex');
    expect(styles.alignItems).toBe('center');
    expect(styles.justifyContent).toBe('center');
    
    // Clean up
    await page.evaluate((element) => {
      element.remove();
    }, testElement);
  });

  test('React application should be properly mounted', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Critical: React root should exist
    const reactRoot = page.locator('#root');
    await expect(reactRoot).toBeAttached();
    
    // Critical: React root should have content
    const hasContent = await reactRoot.evaluate(el => el.children.length > 0);
    expect(hasContent).toBe(true);
    
    // Critical: Main UI elements should be rendered
    await expect(page.locator('[class*="App"], [class*="Step"], main, .wizard')).toHaveCount({ min: 1 });
  });
});