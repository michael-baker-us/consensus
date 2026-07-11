import { defineConfig, devices } from "@playwright/test";

// E2E runs against the fake backend only (docs/04): the demo room IS the
// full state machine, so these specs are the M2 exit criteria, executable.
export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: "http://localhost:5199",
    ...devices["Pixel 7"], // mobile-first product, mobile-first tests (chromium-based)
  },
  webServer: {
    command: "npx vite --port 5199 --strictPort",
    url: "http://localhost:5199",
    reuseExistingServer: !process.env.CI,
  },
});
