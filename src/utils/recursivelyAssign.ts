/*
Copyright 2015, 2016 OpenMarket Ltd
Copyright 2019 The Matrix.org Foundation C.I.C.

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


/**
 * This function is similar to Object.assign() but it assigns recursively and
 * allows you to ignore nullish values from the source
 *
 * @param {Object} target
 * @param {Object} source
 * @returns the target object
 */
export function recursivelyAssign(target: Object, source: Object, ignoreNullish = false): any {
    for (const [sourceKey, sourceValue] of Object.entries(source)) {
        if (target[sourceKey] instanceof Object && sourceValue) {
            recursivelyAssign(target[sourceKey], sourceValue);
            continue;
        }
        if ((sourceValue !== null && sourceValue !== undefined) || !ignoreNullish) {
            target[sourceKey] = sourceValue;
            continue;
        }
    }
    return target;
}