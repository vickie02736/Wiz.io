import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e', timeout: 180_000, expect: { timeout: 20_000 }, workers: 3,
  use: { baseURL: process.env.WIZ_BASE_URL || 'http://127.0.0.1:5173/Wiz.io/', trace: 'retain-on-failure', viewport: { width: 1440, height: 1000 } },
  projects: [{name:'chromium',use:{...devices['Desktop Chrome'],launchOptions:{args:['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']}}},{name:'firefox',use:{...devices['Desktop Firefox']}},{name:'webkit',use:{...devices['Desktop Safari']}}],
  webServer: process.env.WIZ_BASE_URL ? undefined : { command:'npm run dev -- --port 5173',url:'http://127.0.0.1:5173/Wiz.io/',reuseExistingServer:true },
});
