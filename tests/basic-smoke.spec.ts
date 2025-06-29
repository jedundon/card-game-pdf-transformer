import { test, expect } from '@playwright/test';

test.describe('Basic Application Smoke Tests', () => {
  test('should load the main application page', async ({ page }) => {
    await page.goto('/');
    
    // Should see the main title
    await expect(page.locator('h1')).toContainText('Card Game PDF Transformer');
    
    // Should see the step indicator showing step 1 (Import)
    await expect(page.locator('[data-testid="step-indicator"]')).toBeVisible();
    
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
      await expect(page.locator(`text=${step}`)).toBeVisible();
    }
  });

  test('should show proper step state (first step active, others disabled)', async ({ page }) => {
    await page.goto('/');
    
    // First step should be active/current
    const firstStep = page.locator('[data-testid="step-1"]');
    await expect(firstStep).toHaveClass(/current|active/);
    
    // Other steps should be disabled/inactive initially
    const secondStep = page.locator('[data-testid="step-2"]');
    await expect(secondStep).toHaveClass(/disabled|inactive/);
  });

  test('should display file upload area', async ({ page }) => {
    await page.goto('/');
    
    // Should see file upload drop zone or button
    const uploadArea = page.locator('[data-testid="file-upload"], .upload-zone, input[type="file"]').first();
    await expect(uploadArea).toBeVisible();
    
    // Should see instructions for file upload
    await expect(page.locator('text=PDF')).toBeVisible();
  });

  test('should be responsive on different screen sizes', async ({ page }) => {
    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    
    await expect(page.locator('h1')).toBeVisible();
    await expect(page.locator('[data-testid="step-indicator"]')).toBeVisible();
    
    // Test tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/');
    
    await expect(page.locator('h1')).toBeVisible();
    await expect(page.locator('[data-testid="step-indicator"]')).toBeVisible();
    
    // Test desktop viewport
    await page.setViewportSize({ width: 1200, height: 800 });
    await page.goto('/');
    
    await expect(page.locator('h1')).toBeVisible();
    await expect(page.locator('[data-testid="step-indicator"]')).toBeVisible();
  });

  test('should not have console errors on page load', async ({ page }) => {
    const consoleErrors: string[] = [];
    
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
    
    await page.goto('/');
    
    // Wait a moment for any async errors
    await page.waitForTimeout(1000);
    
    // Should not have any console errors
    expect(consoleErrors).toHaveLength(0);
  });
});