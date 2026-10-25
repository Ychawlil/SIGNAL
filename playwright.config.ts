import { defineConfig, devices } from "@playwright/test";
import path from "node:path";
export default defineConfig({
 testDir: "./tests/browser",
 fullyParallel: false,
 workers: 1,
 timeout: 45000,
 expect: { timeout: 12000 },
 use: { baseURL: "http://127.0.0.1:2030", ...devices["Desktop Chrome"], viewport: { width: 1440, height: 1000 }, launchOptions: { channel: "chrome", args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] }, trace: "retain-on-failure" },
 webServer: { command: "node node_modules/next/dist/bin/next start --port 2030 --hostname 127.0.0.1", url: "http://127.0.0.1:2030", reuseExistingServer: false, timeout: 60000, env: { SIGNAL_DB_PATH: path.join(process.cwd(), ".next", "universe-test.db"), SIGNAL_SCHEDULER_ENABLED: "false" } },
});
