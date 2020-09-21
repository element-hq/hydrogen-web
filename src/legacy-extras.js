import aesjs from "../lib/aes-js/index.js";
import {hkdf} from "./utils/crypto/hkdf.js";

// these are run-time dependencies that are only needed for the legacy bundle.
// they are exported here and passed into main to make them available to the app.
export const legacyExtras = {crypto:{aesjs, hkdf}};
