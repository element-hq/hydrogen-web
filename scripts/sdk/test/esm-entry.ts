import * as hydrogenViewSdk from "hydrogen-view-sdk";
import downloadSandboxPath from 'hydrogen-view-sdk/download-sandbox.html?url';
import workerPath from 'hydrogen-view-sdk/main.js?url';
import olmWasmPath from '@matrix-org/olm/olm.wasm?url';
import olmJsPath from '@matrix-org/olm/olm.js?url';
import olmLegacyJsPath from '@matrix-org/olm/olm_legacy.js?url';
const assetPaths = {
  downloadSandbox: downloadSandboxPath,
  worker: workerPath,
  olm: {
      wasm: olmWasmPath,
      legacyBundle: olmLegacyJsPath,
      wasmBundle: olmJsPath
  }
};
import "hydrogen-view-sdk/assets/theme-element-light.css";

console.log('hydrogenViewSdk', hydrogenViewSdk);
console.log('assetPaths', assetPaths);

console.log('Entry ESM works ✅');
