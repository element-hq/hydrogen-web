/*
Copyright 2025 New Vector Ltd.
Copyright 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

export function stringify(value: any): string {
    return JSON.stringify(encodeValue(value));
}

export function parse(value: string): any {
    return decodeValue(JSON.parse(value));
}

function encodeValue(value: any): any {
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
        // TypedArray
        if (value.byteLength) {
            return {_type: value.constructor.name, value: Array.from(value)};
        }
        let newObj = {};
        for (const prop in value) {
            if (value.hasOwnProperty(prop)) {
                newObj[prop] = encodeValue(value[prop]);
            }
        }
        return newObj;
    } else {
        return value;
    }
}

function decodeValue(value: any): any {
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
        if (typeof value._type === "string") {
            switch (value._type) {
                case "Int8Array": return Int8Array.from(value.value);
                case "Uint8Array": return Uint8Array.from(value.value);
                case "Uint8ClampedArray": return Uint8ClampedArray.from(value.value);
                case "Int16Array": return Int16Array.from(value.value);
                case "Uint16Array": return Uint16Array.from(value.value);
                case "Int32Array": return Int32Array.from(value.value);
                case "Uint32Array": return Uint32Array.from(value.value);
                case "Float32Array": return Float32Array.from(value.value);
                case "Float64Array": return Float64Array.from(value.value);
                case "BigInt64Array": return BigInt64Array.from(value.value);
                case "BigUint64Array": return BigUint64Array.from(value.value);
                default:
                    return value.value;
            }
        }
        let newObj = {};
        for (const prop in value) {
            if (value.hasOwnProperty(prop)) {
                newObj[prop] = decodeValue(value[prop]);
            }
        }
        return newObj;
    } else {
        return value;
    }
}

export function tests() {
    return {
        "Uint8Array and primitives": assert => {
            const value = {
                foo: "bar",
                bar: 5,
                baz: false,
                fuzz: new Uint8Array([3, 1, 2])
            };
            const serialized = stringify(value);
            assert.strictEqual(typeof serialized, "string");
            const deserialized = parse(serialized);
            assert.strictEqual(deserialized.foo, "bar");
            assert.strictEqual(deserialized.bar, 5);
            assert.strictEqual(deserialized.baz, false);
            assert(deserialized.fuzz instanceof Uint8Array);
            assert.strictEqual(deserialized.fuzz.length, 3);
            assert.strictEqual(deserialized.fuzz[0], 3);
            assert.strictEqual(deserialized.fuzz[1], 1);
            assert.strictEqual(deserialized.fuzz[2], 2);
        }
    }
}
