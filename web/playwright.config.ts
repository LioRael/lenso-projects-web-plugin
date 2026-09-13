import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests",
  webServer: {
    command:
      "npx vite --config vite.workspace-test.config.ts --host 127.0.0.1 --port 55441 --strictPort",
    url: "http://127.0.0.1:55441/tests/workspace-fixture.html",
    reuseExistingServer: false,
  },
  use: { browserName: "chromium", viewport: { width: 1440, height: 900 } },
  workers: 1,
  reporter: "list",
});
