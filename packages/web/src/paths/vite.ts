import _downloadSandboxPath from "../../assets/download-sandbox.html?url";
import olmWasmPath from "@matrix-org/olm/olm.wasm?url";
import olmJsPath from "@matrix-org/olm/olm.js?url";
import olmLegacyJsPath from "@matrix-org/olm/olm_legacy.js?url";

export const olmPaths = {
    wasm: olmWasmPath,
    legacyBundle: olmLegacyJsPath,
    wasmBundle: olmJsPath,
};

export const downloadSandboxPath = _downloadSandboxPath;
