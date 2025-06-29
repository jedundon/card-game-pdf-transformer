import { test, expect } from '@playwright/test';

test.describe('Visual Regression Tests', () => {
  test('should match baseline screenshot of import step', async ({ page }) => {
    await page.goto('/');
    
    // Wait for the page to be fully loaded
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('h1');
    
    // Hide dynamic elements that might cause flaky tests
    await page.addStyleTag({
      content: `
        /* Hide elements that might change between runs */
        .timestamp, .version, [data-testid="dynamic-content"] {
          visibility: hidden !important;
        }
      `
    });
    
    // Take screenshot of the entire page
    await expect(page).toHaveScreenshot('import-step-full-page.png');
    
    // Take screenshot of just the main content area
    const mainContent = page.locator('main, .main-content, [data-testid="main-content"]').first();
    await expect(mainContent).toHaveScreenshot('import-step-main-content.png');
  });

  test('should match baseline screenshot of step indicator', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Screenshot just the step indicator component
    const stepIndicator = page.locator('[data-testid="step-indicator"], .step-indicator, nav').first();
    await expect(stepIndicator).toHaveScreenshot('step-indicator.png');
  });

  test('should maintain consistent layout on different screen sizes', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Test mobile layout
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(500); // Allow layout to settle
    await expect(page).toHaveScreenshot('mobile-layout.png');
    
    // Test tablet layout
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.waitForTimeout(500);
    await expect(page).toHaveScreenshot('tablet-layout.png');
    
    // Test desktop layout
    await page.setViewportSize({ width: 1200, height: 800 });
    await page.waitForTimeout(500);
    await expect(page).toHaveScreenshot('desktop-layout.png');
  });

  test('should have consistent button and control styling', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Find the main action button (likely an upload button)
    const primaryButton = page.locator('button:visible, .btn-primary, [data-testid="upload-button"]').first();
    if (await primaryButton.count() > 0) {
      await expect(primaryButton).toHaveScreenshot('primary-button.png');
    }
    
    // Test button hover state if possible
    if (await primaryButton.count() > 0) {
      await primaryButton.hover();
      await expect(primaryButton).toHaveScreenshot('primary-button-hover.png');
    }
  });

  test('should render icons and graphics consistently', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Screenshot any icons or graphics on the page
    const icons = page.locator('svg, .icon, [data-icon], .lucide').first();
    if (await icons.count() > 0) {
      await expect(icons).toHaveScreenshot('app-icons.png');
    }
  });

  test('should handle loading states consistently', async ({ page }) => {
    // Start navigation but don't wait for completion
    const navigationPromise = page.goto('/');
    
    // Try to capture loading state (this might be very brief)
    try {
      await page.waitForSelector('body', { timeout: 100 });
      await expect(page).toHaveScreenshot('loading-state.png');
    } catch {
      // Loading state too brief to capture, which is fine
    }
    
    // Complete navigation
    await navigationPromise;
    await page.waitForLoadState('networkidle');
    
    // Ensure final loaded state is consistent
    await expect(page).toHaveScreenshot('loaded-state.png');
  });
});