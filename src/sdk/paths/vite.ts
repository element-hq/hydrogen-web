import _downloadSandboxPath from "../../../assets/download-sandbox.html?url";
import olmWasmPath from "../../../lib/olm/olm.wasm?url";
import olmJsPath from "../../../lib/olm/olm.js?url";
import olmLegacyJsPath from "../../../lib/olm/olm_legacy.js?url";

export const olmPaths = {
    wasm: olmWasmPath,
    legacyBundle: olmLegacyJsPath,
    wasmBundle: olmJsPath,
};

export const downloadSandboxPath = _downloadSandboxPath;
