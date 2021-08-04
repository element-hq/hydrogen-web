// Snowpack Configuration File
// See all supported options: https://www.snowpack.dev/reference/configuration

/** @type {import("snowpack").SnowpackUserConfig } */
module.exports = {
  mount: {
    "src": "/src",
    "public": "/",
    "lib": {url: "/lib", static: true },
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
    external: [
      /* Olm seems to import these but not use them. */
      "path",
      "crypto",
      "fs",
    ],
  },
  devOptions: {
    open: "none",
    /* ... */
  },
  buildOptions: {
    /* ... */
  },
};
