// From element-web
export type KeyAgreement = "curve25519-hkdf-sha256" | "curve25519";
export type MacMethod = "hkdf-hmac-sha256.v2" | "org.matrix.msc3783.hkdf-hmac-sha256" | "hkdf-hmac-sha256" | "hmac-sha256";

export const KEY_AGREEMENT_LIST: KeyAgreement[] = ["curve25519-hkdf-sha256", "curve25519"];
export const HASHES_LIST = ["sha256"];
export const MAC_LIST: MacMethod[] = [
    "hkdf-hmac-sha256.v2",
    "org.matrix.msc3783.hkdf-hmac-sha256",
    "hkdf-hmac-sha256",
    "hmac-sha256",
];
export const SAS_LIST = ["decimal", "emoji"];
export const SAS_SET = new Set(SAS_LIST);
