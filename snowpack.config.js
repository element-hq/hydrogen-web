// Snowpack Configuration File
// See all supported options: https://www.snowpack.dev/reference/configuration

/** @type {import("snowpack").SnowpackUserConfig } */
module.exports = {
  mount: {
    // More specific paths before less specific paths (if they overlap)
    "src/platform/web/docroot": "/",
    "src": "/src",
    "lib": {url: "/lib", static: true },
    "assets": "/assets",
    /* ... */
  },
  exclude: [
    /* Avoid scanning scripts which use dev-dependencies and pull in babel, rollup, etc. */
    '**/node_modules/**/*',
    '**/scripts/**',
    '**/target/**',
    '**/prototypes/**',
    '**/src/platform/web/legacy-polyfill.js',
    '**/src/platform/web/worker/polyfill.js'
  ],
  plugins: [
    /* ... */
  ],
  packageOptions: {
    /* ... */
  },
  devOptions: {
    open: "none",
    hmr: false,
    /* ... */
  },
  buildOptions: {
    /* ... */
  },
};
