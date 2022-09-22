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

import {SimpleTile} from "./SimpleTile";

export class EncryptionEnabledTile extends SimpleTile {
    get shape() {
        return "announcement";
    }

    get announcement() {
        const senderName =  this._entry.displayName || this._entry.sender;
        return this.i18n`${senderName} has enabled end-to-end encryption`;
    }
}
