export default {
    public: false,
    root: "src/platform/web",
    server: {
        hmr: false
    },
    resolve: {
        alias: {
            "safe-buffer": "./scripts/package-overrides/safe-buffer/index.js",
            "buffer": "./scripts/package-overrides/buffer/index.js"
        }
    }
};
