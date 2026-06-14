// playwright.config.js
const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests/e2e',
  testMatch: /.*\.spec\.js/,
  timeout: 10_000,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:5500',
    trace: 'on-first-retry',
    video: 'off',                       // 关掉视频录制（避免依赖 ffmpeg；CI 用截图就够了）
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'npx http-server -p 5500 -c-1 -s .',
    url: 'http://127.0.0.1:5500/demo.html',
    reuseExistingServer: !process.env.CI,
    timeout: 15_000,
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // 用完整 Chromium（本地手动装）而非 headless-shell
        channel: 'chromium',
      },
    },
  ],
});
