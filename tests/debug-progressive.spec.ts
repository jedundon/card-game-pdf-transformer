import { test, expect } from '@playwright/test';

/**
 * Progressive Debug Tests
 * 
 * These tests are designed to help identify fundamental issues by testing
 * the most basic functionality first, then gradually more complex features.
 * 
 * Run these tests first when debugging to isolate problems:
 * npx playwright test tests/debug-progressive.spec.ts
 */

test.describe('Progressive Debug Tests', () => {
  // Test 1: Absolute basics - can we reach the server?
  test('Level 1: Server responds to HTTP requests', async ({ page }) => {
    const response = await page.request.get('/');
    expect(response.status()).toBe(200);
  });

  // Test 2: Basic page loading
  test('Level 2: Page loads without errors', async ({ page }) => {
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];
    
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
    
    page.on('pageerror', error => {
      pageErrors.push(error.message);
    });
    
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Basic assertions
    expect(consoleErrors).toHaveLength(0);
    expect(pageErrors).toHaveLength(0);
  });

  // Test 3: DOM structure exists
  test('Level 3: Basic DOM elements exist', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    
    // Should have a root div
    const root = page.locator('#root');
    await expect(root).toBeAttached();
    
    // Should have some content
    const body = page.locator('body');
    await expect(body).not.toBeEmpty();
  });

  // Test 4: React app renders
  test('Level 4: React application renders', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Should see main title
    const title = page.locator('h1');
    await expect(title).toBeVisible();
    await expect(title).toContainText('Card Game PDF Transformer');
  });

  // Test 5: Navigation structure
  test('Level 5: Step navigation exists', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Should have step navigation with numbered circles
    const firstStepNumber = page.locator('div').filter({ hasText: /^1$/ });
    await expect(firstStepNumber.first()).toBeVisible();
    
    // Should have step text labels
    await expect(page.locator('text=Import PDF')).toBeVisible();
    await expect(page.locator('text=Extract Cards')).toBeVisible();
  });

  // Test 6: First step content
  test('Level 6: Import step content loads', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Should see import-related content
    await expect(page.locator('text=Import PDF')).toBeVisible();
    
    // Should see file upload capability based on current structure
    const fileInput = page.locator('input[type="file"][accept*=".pdf"]');
    await expect(fileInput).toBeAttached();
    
    const uploadButton = page.locator('button[aria-label="Select PDF or image files to import"]');
    await expect(uploadButton).toBeVisible();
    
    const selectButton = page.locator('button:has-text("Select PDF or image files")');
    await expect(selectButton).toBeVisible();
  });

  // Test 7: JavaScript functionality
  test('Level 7: Basic JavaScript interactions work', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Test that we can interact with the page
    const clickableElements = [
      'button',
      '[role="button"]',
      'input[type="file"]',
      '.clickable'
    ];
    
    let foundClickable = false;
    for (const selector of clickableElements) {
      const elements = page.locator(selector);
      const count = await elements.count();
      if (count > 0) {
        // Try to hover over the first element to test basic interaction
        await elements.first().hover();
        foundClickable = true;
        break;
      }
    }
    
    expect(foundClickable).toBe(true);
  });

  // Test 8: Responsive design basics
  test('Level 8: Responsive design works', async ({ page }) => {
    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Should still see title and basic navigation
    await expect(page.locator('h1')).toBeVisible();
    await expect(page.locator('text=Import PDF')).toBeVisible();
    
    // Test desktop viewport
    await page.setViewportSize({ width: 1200, height: 800 });
    await page.waitForLoadState('networkidle');
    
    // Should still see title and navigation
    await expect(page.locator('h1')).toBeVisible();
    await expect(page.locator('text=Import PDF')).toBeVisible();
  });

  // Test 9: Performance basics
  test('Level 9: Basic performance is acceptable', async ({ page }) => {
    const startTime = Date.now();
    
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    const loadTime = Date.now() - startTime;
    
    // Should load in reasonable time (generous threshold for CI)
    expect(loadTime).toBeLessThan(30000); // 30 seconds max
    
    // Should be responsive to interactions
    const interactionStart = Date.now();
    await page.locator('body').click();
    const interactionTime = Date.now() - interactionStart;
    
    expect(interactionTime).toBeLessThan(1000); // 1 second max for click response
  });

  // Test 10: Full basic workflow
  test('Level 10: Complete basic user flow works', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // 1. See the app
    await expect(page.locator('h1')).toContainText('Card Game PDF Transformer');
    
    // 2. See import step
    await expect(page.locator('text=Import PDF')).toBeVisible();
    
    // 3. See file upload capability
    const fileInput = page.locator('input[type="file"][accept*=".pdf"]');
    await expect(fileInput).toBeAttached();
    
    const uploadButton = page.locator('button[aria-label="Select PDF or image files to import"]');
    await expect(uploadButton).toBeVisible();
    
    // 4. See step navigation (numbered circles)
    const firstStepNumber = page.locator('div').filter({ hasText: /^1$/ });
    await expect(firstStepNumber.first()).toBeVisible();
    
    // All basic functionality is working
  });
});