import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  timeout: 180000,
  retries: 0,
  use: {
    baseURL: "http://localhost:5173",
    headless: false,
    viewport: { width: 1920, height: 1080 },
  },
});
