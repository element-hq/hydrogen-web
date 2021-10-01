export default {
    build: {
        lib: {
            entry: "src/lib.ts",
            formats: ["es", "iife"],
            name: "hydrogenDomain",
        }
    },
    public: false,
    server: {
        hmr: false
    }
};
