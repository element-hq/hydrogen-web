// Snowpack Configuration File
// See all supported options: https://www.snowpack.dev/reference/configuration

/** @type {import("snowpack").SnowpackUserConfig } */
module.exports = {
  mount: {
    "src": "/src",
    "public": "/",
    "lib": {url: "/lib", static: true },
    "src/platform/web/ui/css/themes": "/themes",
    "assets": "/assets",
    /* ... */
  },
  exclude: [
    /* Avoid scanning scripts which use dev-dependencies and pull in babel, rollup, etc. */
    '**/node_modules/**/*', '**/scripts/**', '**/target/**', '**/prototypes/**', '**/src/matrix/storage/memory/**'
  ],
  plugins: [
    /* ... */
  ],
  packageOptions: {
    /* ... */
  },
  devOptions: {
    open: "none",
    /* ... */
  },
  buildOptions: {
    /* ... */
  },
};
