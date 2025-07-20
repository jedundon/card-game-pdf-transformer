import { chromium } from '@playwright/test';

async function globalSetup() {
  if (process.env.CI) {
    console.log('🔧 Setting up Playwright for CI environment...');
    
    // Log system information for debugging
    console.log('Node version:', process.version);
    console.log('Platform:', process.platform);
    console.log('Architecture:', process.arch);
    console.log('Memory usage:', process.memoryUsage());
    console.log('Environment variables:', {
      CI: process.env.CI,
      GITHUB_ACTIONS: process.env.GITHUB_ACTIONS,
      RUNNER_OS: process.env.RUNNER_OS,
    });
    
    // Test if browser can launch properly with enhanced diagnostics
    try {
      console.log('🚀 Testing browser launch...');
      const browser = await chromium.launch({
        args: [
          '--no-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows',
          '--disable-renderer-backgrounding',
          '--disable-features=TranslateUI',
          '--disable-ipc-flooding-protection',
          '--memory-pressure-off',
          '--max_old_space_size=4096'
        ]
      });
      
      const context = await browser.newContext({
        // Reduce viewport for CI memory efficiency
        viewport: { width: 1024, height: 768 }
      });
      const page = await context.newPage();
      
      // Enhanced browser functionality test
      await page.goto('data:text/html,<h1>Test</h1><canvas id="test-canvas" width="100" height="50"></canvas>');
      const title = await page.textContent('h1');
      
      if (title !== 'Test') {
        throw new Error('Browser DOM functionality test failed');
      }
      
      // Test canvas functionality (critical for the application)
      const canvasSupported = await page.evaluate(() => {
        const canvas = document.getElementById('test-canvas') as HTMLCanvasElement;
        if (!canvas) return false;
        const ctx = canvas.getContext('2d');
        if (!ctx) return false;
        ctx.fillStyle = 'red';
        ctx.fillRect(0, 0, 10, 10);
        return true;
      });
      
      if (!canvasSupported) {
        throw new Error('Browser canvas functionality test failed');
      }
      
      await browser.close();
      console.log('✅ Browser setup verification passed');
      console.log('✅ Canvas functionality verified');
      
    } catch (error) {
      console.error('❌ Browser setup verification failed:', error);
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
      
      // Don't throw in CI to avoid blocking builds - let individual tests handle failures
      console.log('⚠️ Continuing with tests despite setup verification failure');
    }
  }
}

export default globalSetup;