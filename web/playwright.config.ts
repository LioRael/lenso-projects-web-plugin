import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests",
  use: { browserName: "chromium", viewport: { width: 1440, height: 900 } },
  workers: 1,
  reporter: "list",
});
