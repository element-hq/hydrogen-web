/*
Copyright 2020 Bruno Windels <bruno@windels.cloud>
Copyright 2024 Mirian Margiani <mixosaurus+ichthyo@pm.me>

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

import {TextTile} from "./TextTile.js";
import {BodyFormat} from "./BaseTextTile.js";
import {parsePlainBody} from "../MessageBody.js";
import {parseHTMLBody} from "../deserialize.js";

export class UnknownMessageTile extends TextTile {
    get shape() {
        return "unknown-message";
    }

    get body() {
        let body = this._getPlainBody();

        // body is a string, so we can check for difference by just
        // doing an equality check
        if (!this._messageBody || this._messageBody.sourceString !== body) {
            const msgtype = this._getContentString('msgtype');
            const notice = this.i18n`This app cannot properly display this message (type “${msgtype}”). Please report this issue.`
            body = `<em>${notice}</em><br><code>${body}</code>`;

            // body with markup is an array of parts,
            // so we should not recreate it for the same body string,
            // or else the equality check in the binding will always fail.
            // So cache it here.
            this._messageBody = this._parseBody(body, BodyFormat.Html);
            this._format = BodyFormat.Html;
        }

        return this._messageBody;
    }
}
