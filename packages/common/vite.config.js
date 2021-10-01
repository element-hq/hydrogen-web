export default {
    build: {
        lib: {
            entry: "src/lib.ts",
            formats: ["es", "iife"],
            name: "hydrogenCommon",
        }
    },
    public: false,
    server: {
        hmr: false
    }
};
