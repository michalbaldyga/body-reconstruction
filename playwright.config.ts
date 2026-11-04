import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e",
  timeout: 45000,
  use: {
    baseURL: "http://localhost:4176" + (process.env.VITE_BASE_PATH || "/"),
    ...devices["iPhone 13"],
    browserName: "chromium",
    timezoneId: "Europe/Warsaw",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "npm run preview -- --port 4176",
    url: "http://localhost:4176" + (process.env.VITE_BASE_PATH || "/"),
    reuseExistingServer: !process.env.CI,
  },
  workers: 1,
});
