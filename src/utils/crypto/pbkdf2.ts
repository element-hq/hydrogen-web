/**
 * Copyright (c) 2018 Jun Kurihara
 * Copyright 2020 The Matrix.org Foundation C.I.C.
 * 
 * MIT LICENSE, See https://github.com/junkurihara/jscu/blob/develop/packages/js-crypto-pbkdf/LICENSE
 * Based on https://github.com/junkurihara/jscu/blob/develop/packages/js-crypto-pbkdf/src/pbkdf.ts
 */

import type {Crypto} from "../../platform/web/dom/Crypto.js";

// not used atm, but might in the future
// forked this code to make it use the cryptoDriver for HMAC that is more backwards-compatible


const nwbo = (num: number, len: number): Uint8Array => {
  const arr = new Uint8Array(len);
  for(let i=0; i<len; i++) arr[i] = 0xFF && (num >> ((len - i - 1)*8));
  return arr;
};

export async function pbkdf2(cryptoDriver: Crypto, password: Uint8Array, iterations: number, salt: Uint8Array, hash: "SHA-256" | "SHA-512", length: number): Promise<Uint8Array> {
    const dkLen = length / 8;
    if (iterations <= 0) {
        throw new Error('InvalidIterationCount');
    }
    if (dkLen <= 0) {
        throw new Error('InvalidDerivedKeyLength');
    }
    const hLen = cryptoDriver.digestSize(hash);
    if(dkLen > (Math.pow(2, 32) - 1) * hLen) throw new Error('DerivedKeyTooLong');

    const l = Math.ceil(dkLen/hLen);
    const r = dkLen - (l-1)*hLen;

    const funcF = async (i: number) => {
        const seed = new Uint8Array(salt.length + 4);
        seed.set(salt);
        seed.set(nwbo(i+1, 4), salt.length);
        let u = await cryptoDriver.hmac.compute(password, seed, hash);
        let outputF = new Uint8Array(u);
        for(let j = 1; j < iterations; j++){
            if ((j % 1000) === 0) {
                console.log(j, j/iterations);
            }
            u = await cryptoDriver.hmac.compute(password, u, hash);
            outputF = u.map( (elem, idx) => elem ^ outputF[idx]);
        }
        return {index: i, value: outputF};
    };

    const Tis: Promise<{index: number, value: Uint8Array}>[] = [];
    const DK = new Uint8Array(dkLen);
    for(let i = 0; i < l; i++) {
        Tis.push(funcF(i));
    }
    const TisResolved = await Promise.all(Tis);
    TisResolved.forEach(elem => {
        if (elem.index !== l - 1) {
            DK.set(elem.value, elem.index*hLen);
        }
        else {
            DK.set(elem.value.slice(0, r), elem.index*hLen);
        }
    });

    return DK;
}
