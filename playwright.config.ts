import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./web-e2e",
  timeout: 60_000,
  expect: {
    timeout: 10_000
  },
  fullyParallel: false,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:3001",
    trace: "retain-on-failure"
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] }
    }
  ],
  webServer: [
    {
      command: "cmd /c npm run api:dev:memory",
      url: "http://localhost:3000/api/health",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000
    },
    {
      command: "cmd /c npm run web:dev",
      url: "http://localhost:3001/cloud-pets",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000
    }
  ]
});
