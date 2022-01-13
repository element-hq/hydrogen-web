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

import {BaseTextTile, BodyFormat} from "./BaseTextTile.js";
import {parsePlainBody} from "../MessageBody.js";
import {parseHTMLBody} from "../deserialize.js";

export class TextTile extends BaseTextTile {
    _getContentString(key) {
        return this._getContent()?.[key] || "";
    }

    _getPlainBody() {
        return this._getContentString("body");
    }

    _getFormattedBody() {
        return this._getContentString("formatted_body");
    }

    _getBody() {
        if (this._getBodyFormat() === BodyFormat.Html) {
            return this._getFormattedBody();
        } else {
            return this._getPlainBody();
        }
    }

    _getBodyFormat() {
        if (this._getContent()?.format === "org.matrix.custom.html") {
            return BodyFormat.Html;
        } else {
            return BodyFormat.Plain;
        }
    }

    _parseBody(body, format) {
        let messageBody;
        if (format === BodyFormat.Html) {
            messageBody = parseHTMLBody(this.platform, this._mediaRepository, body);
        } else {
            messageBody = parsePlainBody(body);
        }
        if (this._getContent()?.msgtype === "m.emote") {
            messageBody.insertEmote(`* ${this.displayName} `);
        }
        return messageBody;
    }
}
