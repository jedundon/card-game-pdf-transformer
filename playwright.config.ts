import { defineConfig, devices } from '@playwright/test';

/**
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './tests',
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only - increased retries for stability */
  retries: process.env.CI ? 3 : 0,
  /* Reduce workers in CI for memory constraints */
  workers: process.env.CI ? 1 : undefined,
  /* Global timeout for CI environment - increased for heavy processing tests */
  timeout: process.env.CI ? 180000 : 30000, // 3 minutes for CI, 30s local
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: process.env.CI ? [['github'], ['html'], ['blob']] : 'html',
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: 'http://localhost:4173',

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: process.env.CI ? 'retain-on-failure' : 'on-first-retry',
    
    /* Increase timeouts for CI stability */
    navigationTimeout: process.env.CI ? 60000 : 15000,
    actionTimeout: process.env.CI ? 30000 : 10000,
    
    /* Add screenshot on failure for debugging */
    screenshot: process.env.CI ? 'only-on-failure' : 'off',
    
    /* Add video recording on failure for CI debugging */
    video: process.env.CI ? 'retain-on-failure' : 'off',
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'chromium',
      use: { 
        ...devices['Desktop Chrome'],
        // Enhanced CI arguments for stability and compatibility
        launchOptions: process.env.CI ? {
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
        } : undefined
      },
    },

    // Only run all browsers locally, limit to Chromium in CI for speed/memory
    ...(process.env.CI ? [] : [
      {
        name: 'firefox',
        use: { ...devices['Desktop Firefox'] },
      },

      {
        name: 'webkit',
        use: { ...devices['Desktop Safari'] },
      },
    ]),

    /* Test against mobile viewports. */
    // {
    //   name: 'Mobile Chrome',
    //   use: { ...devices['Pixel 5'] },
    // },
    // {
    //   name: 'Mobile Safari',
    //   use: { ...devices['iPhone 12'] },
    // },

    /* Test against branded browsers. */
    // {
    //   name: 'Microsoft Edge',
    //   use: { ...devices['Desktop Edge'], channel: 'msedge' },
    // },
    // {
    //   name: 'Google Chrome',
    //   use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    // },
  ],

  /* Run your local dev server before starting the tests */
  webServer: {
    command: 'npm run preview',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: process.env.CI ? 180000 : 120000, // 3 minutes in CI
    stdout: 'pipe',
    stderr: 'pipe',
  },
  
  /* Add global setup and teardown for CI debugging */
  globalSetup: process.env.CI ? './tests/global-setup.ts' : undefined,
});