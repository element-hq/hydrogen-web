// Make sure the SDK can be used in a CommonJS environment.
// Usage: node scripts/sdk/test/test-sdk-in-commonjs-env.js
const hydrogenViewSdk = require('hydrogen-view-sdk');

// Test that the "exports" are available:
// Worker
require.resolve('hydrogen-view-sdk/main.js');
// Styles
require.resolve('hydrogen-view-sdk/assets/theme-element-light.css');
// Can access files in the assets/* directory
require.resolve('hydrogen-view-sdk/assets/main.js');

console.log('SDK works in CommonJS ✅');
