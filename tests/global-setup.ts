import { chromium, FullConfig } from '@playwright/test';

async function globalSetup(config: FullConfig) {
  if (process.env.CI) {
    console.log('🔧 Setting up Playwright for CI environment...');
    
    // Log system information for debugging
    console.log('Node version:', process.version);
    console.log('Platform:', process.platform);
    console.log('Memory usage:', process.memoryUsage());
    
    // Test if browser can launch properly
    try {
      const browser = await chromium.launch({
        args: [
          '--no-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--memory-pressure-off'
        ]
      });
      
      const context = await browser.newContext();
      const page = await context.newPage();
      
      // Simple test to verify browser functionality
      await page.goto('data:text/html,<h1>Test</h1>');
      const title = await page.textContent('h1');
      
      if (title !== 'Test') {
        throw new Error('Browser functionality test failed');
      }
      
      await browser.close();
      console.log('✅ Browser setup verification passed');
      
    } catch (error) {
      console.error('❌ Browser setup verification failed:', error.message);
      throw error;
    }
  }
}

export default globalSetup;