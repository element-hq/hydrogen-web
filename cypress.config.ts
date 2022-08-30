import { defineConfig } from "cypress";

export default defineConfig({
    e2e: {
        setupNodeEvents(on, config) {
            require("./cypress/plugins/index.ts").default(on, config);
            return config;
        },
        baseUrl: "http://localhost:3000",
    },
});
