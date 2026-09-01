import { defineConfig, devices } from '@playwright/test';

/**
 * The editor's end-to-end suite.
 *
 * It drives the *production build* rather than the dev server: the base path,
 * the minified Phaser bundle and the module graph are all part of what can
 * break, and `npm run build` is already the project's only other gate.
 *
 * Two viewports, always both. Mobile is a first-class target here, and the
 * layout, the file dialogs and the whole touch interaction model differ between
 * them — a desktop-only pass would miss the majority path.
 */

const PORT = Number(process.env.PORT ?? 4173);
/** Must match `base` in vite.config.ts; a wrong base is a blank page. */
const BASE_PATH = '/phaser-gui-tool/';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  // One retry in CI only: a genuinely flaky canvas assertion should be fixed,
  // but a cold runner losing a frame shouldn't fail the run on its own.
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI
    ? [['github'], ['html', { open: 'never' }]]
    : [['list'], ['html', { open: 'never' }]],
  timeout: 60_000,
  expect: { timeout: 10_000 },

  use: {
    baseURL: `http://localhost:${PORT}${BASE_PATH}`,
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
    // Screenshot pixels must map 1:1 to CSS pixels: every canvas assertion
    // compares a centroid measured in the screenshot against a point computed
    // from the element's CSS box.
    deviceScaleFactor: 1,
    launchOptions: {
      // Set CHROMIUM_PATH when the machine has a browser Playwright did not
      // install itself (the case in the container this suite was written in).
      executablePath: process.env.CHROMIUM_PATH || undefined,
    },
  },

  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
    {
      name: 'mobile',
      use: {
        ...devices['Pixel 7'],
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 1,
      },
      // Export is a pure function of the document and its outputs are checked
      // with the toolchain, not the layout — running that twice buys nothing
      // and costs a `tsc` and a `vite build` per run.
      testIgnore: /export.*\.spec\.ts/,
    },
  ],

  webServer: {
    command: `npm run build && npm run preview -- --port=${PORT} --strictPort`,
    url: `http://localhost:${PORT}${BASE_PATH}`,
    reuseExistingServer: !process.env.CI,
    // A cold `tsc -b && vite build` is the slow part, not the server.
    timeout: 180_000,
    stdout: 'pipe',
  },
});
