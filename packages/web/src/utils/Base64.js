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

import base64 from "base64-arraybuffer";

export class Base64 {
    encodeUnpadded(buffer) {
        const str = base64.encode(buffer);
        const paddingIdx = str.indexOf("=");
        if (paddingIdx !== -1) {
            return str.substr(0, paddingIdx);
        } else {
            return str;
        }
    }

    encode(buffer) {
        return base64.encode(buffer);
    }

    decode(str) {
        return base64.decode(str);
    }
}
