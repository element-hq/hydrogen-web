import aesjs from "../../../lib/aes-js/index.js";
import {hkdf} from "../../utils/crypto/hkdf.js";
import {Platform as ModernPlatform} from "./Platform.js";

export function Platform(container, paths) {
    return new ModernPlatform(container, paths, {aesjs, hkdf});
}
