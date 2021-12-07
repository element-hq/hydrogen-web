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

import {BaseMessageTile} from "./BaseMessageTile.js";
import {stringAsBody} from "../MessageBody.js";
import {createEnum} from "../../../../../utils/enum";
import {avatarInitials, getIdentifierColorNumber} from "../../../../avatar.js";

export const BodyFormat = createEnum("Plain", "Html");

export class BaseTextTile extends BaseMessageTile {
    constructor(options) {
        super(options);
        this._messageBody = null;
        this._format = null
    }

    get shape() {
        return "message";
    }

    _parseBody(body) {
        return stringAsBody(body);
    }

    _getBodyFormat() {
        return BodyFormat.Plain;
    }

    get body() {
        const body = this._getBody();
        const format = this._getBodyFormat();
        // body is a string, so we can check for difference by just
        // doing an equality check
        // Even if the body hasn't changed, but the format has, we need
        // to re-fill our cache.
        if (!this._messageBody || this._messageBody.sourceString !== body || this._format !== format) {
            // body with markup is an array of parts,
            // so we should not recreate it for the same body string,
            // or else the equality check in the binding will always fail.
            // So cache it here.
            this._messageBody = this._parseBody(body, format);
            this._format = format;
        }
        // console.log("messageBody", this._messageBody);
        return this._messageBody;
    }

    get replyPreviewBody() {
        const entry = this._entry.relatedEntry;
        if (!entry) {
            return {};
        }
        const format = entry.content.format === "org.matrix.custom.html" ? BodyFormat.Html : BodyFormat.Plain;
        const body = entry.content["formatted_body"] ?? entry.content["body"];
        return {
            body: this._parseBody(body, format),
            sender: entry.displayName,
            avatar: {
                colorNumber: getIdentifierColorNumber(entry.sender),
                initial: avatarInitials(entry.displayName)
            }
        };
    }
}
