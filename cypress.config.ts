import { defineConfig } from "cypress";

export default defineConfig({
    e2e: {
        setupNodeEvents(on, config) {
            require("./cypress/plugins/index.ts").default(on, config);
            return config;
        },
        baseUrl: "http://127.0.0.1:3000",
    },
    env: {
        SYNAPSE_IP_ADDRESS: "172.18.0.5",
        SYNAPSE_PORT: "8008",
        DEX_IP_ADDRESS: "172.18.0.4",
        DEX_PORT: "5556",
    },
});
