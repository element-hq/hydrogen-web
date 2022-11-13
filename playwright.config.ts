import type { PlaywrightTestConfig } from "@playwright/test";

const BASE_URL = process.env["BASE_URL"] ?? "http://127.0.0.1:3000";

const config: PlaywrightTestConfig = {
    use: {
        headless: false,
        viewport: { width: 1280, height: 720 },
        ignoreHTTPSErrors: true,
        video: "on-first-retry",
        baseURL: BASE_URL,
    },
    testDir: "./playwright/tests",
    globalSetup: require.resolve("./playwright/global-setup"),
    webServer: {
        command: "yarn start",
        url: `${BASE_URL}/#/login`,
    },
    workers: 1
};
export default config;
