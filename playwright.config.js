import { defineConfig } from '@playwright/test';
import { validatePlaywrightTarget } from './scripts/playwright-target.js';

const targetErrors = validatePlaywrightTarget();
if (targetErrors.length) throw new Error(targetErrors.join('\n'));

export default defineConfig({
    testDir: './tests/e2e',
    fullyParallel: false,
    workers: 1,
    forbidOnly: Boolean(process.env.CI),
    retries: process.env.CI ? 1 : 0,
    outputDir: process.env.PLAYWRIGHT_OUTPUT_DIR || 'test-results',
    reporter: [
        ['list'],
        ['html', {
            outputFolder: process.env.PLAYWRIGHT_REPORT_DIR || 'playwright-report',
            open: 'never'
        }]
    ],
    use: {
        baseURL: process.env.PLAYWRIGHT_BASE_URL,
        trace: 'retain-on-failure',
        screenshot: 'only-on-failure',
        video: 'retain-on-failure'
    },
    projects: [
        { name: 'chromium', use: { browserName: 'chromium' } },
        { name: 'firefox', use: { browserName: 'firefox' } },
        { name: 'webkit', use: { browserName: 'webkit' } }
    ]
});
