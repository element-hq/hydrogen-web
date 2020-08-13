/*
Copyright 2020 Bruno Windels <bruno@windels.cloud>

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

export function avatarInitials(name) {
    let words = name.split(" ");
    if (words.length === 1) {
        words = words[0].split("-");
    }
    words = words.slice(0, 2);
    return words.reduce((i, w) => {
        let firstChar = w.charAt(0);
        if (firstChar === "!" || firstChar === "@" || firstChar === "#") {
            firstChar = w.charAt(1);
        }
        return i + firstChar.toUpperCase();
    }, "");
}

/**
 * calculates a numeric hash for a given string
 *
 * @param {string} str string to hash
 *
 * @return {number}
 */
function hashCode(str) {
    let hash = 0;
    let i;
    let chr;
    if (str.length === 0) {
        return hash;
    }
    for (i = 0; i < str.length; i++) {
        chr = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + chr;
        hash |= 0;
    }
    return Math.abs(hash);
}

export function getIdentifierColorNumber(id) {
    return (hashCode(id) % 8) + 1;
}
