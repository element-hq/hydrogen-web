/*
Copyright 2020 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

export class InvalidPathError extends Error {
    constructor(obj, path, field) {
        super(`Could not read path ${path.join("/")}, stopped at ${field}. Base value is ${obj}`);
    }

    get name() {
        return "InvalidPathError";
    }
}

export class InvalidTypeError extends Error {
    constructor(path, fieldValue, validator) {
        super(`Value ${path.join("/")} is not of type ${getTypeName(validator)} but is: ${fieldValue}`);
    }

    get name() {
        return "InvalidTypeError";
    }
}

function getTypeName(validator) {
    if (validator === Type.Array) {
        return "Array";
    }
    if (validator === Type.Integer) {
        return "Integer";
    }
    if (validator === Type.String) {
        return "String";
    }
    if (validator === Type.Object) {
        return "Object";
    }
    if (typeof validator === "function") {
        return "Custom";
    }
    return "None";
}

export function readPath(obj, path, typeOrDefaultValue) {
    if (!obj) {
        throw new InvalidPathError(obj, path);
    }
    const hasDefaultValue = typeof typeOrDefaultValue !== "function"; 
    let currentValue = obj;
    for (const field of path) {
        currentValue = currentValue[field];
        if (typeof currentValue === "undefined") {
            if (hasDefaultValue) {
                return typeOrDefaultValue;
            } else {
                throw new InvalidPathError(obj, path, field);
            }
        }
    }
    if (!hasDefaultValue) {
        const validator = typeOrDefaultValue;
        if (!validator(currentValue)) {
            throw new InvalidTypeError(path, currentValue, validator);
        }
    }
    return currentValue;
}

export const Type = Object.freeze({
    "Array": Array.isArray,
    "Integer": Number.isSafeInteger,
    "Boolean": value => value === true || value === false,
    "String": value => typeof value === "string",
    "Object": value => value !== null && typeof value === "object",
});

export function tests() {
    return {
        "readPath value at top level": assert => {
            assert.strictEqual(readPath({a: 5}, ["a"]), 5);
        },
        "readPath value at deep level": assert => {
            assert.strictEqual(readPath({a: {b: {c: 5}}}, ["a", "b", "c"]), 5);
        },
        "readPath value with correct type": assert => {
            assert.strictEqual(readPath({a: 5}, ["a"], Type.Integer), 5);
        },
        "readPath value with failing type": assert => {
            assert.throws(
                () => readPath({a: 5}, ["a"], Type.String),
                {name: "InvalidTypeError"}
            );
        },
        "readPath value with failing path with intermediate field not being an object": assert => {
            assert.throws(
                () => readPath({a: {b: "bar"}}, ["a", "b", "c"], Type.Integer),
                {name: "InvalidPathError"}
            );
        },
        "readPath returns default value for incomplete path": assert => {
            assert.strictEqual(readPath({a: {b: "bar"}}, ["a", "b", "c"], 5), 5);
        },
        
    }
}
