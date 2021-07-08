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

import {BaseTextTile} from "./BaseTextTile.js";
import {parsePlainBody} from "../MessageBody.js";
import {parseHTMLBody} from "../deserialize.js";

export class TextTile extends BaseTextTile {
    _getContentString(key, format, fallback = null) {
        const content = this._getContent();
        let val = content?.[key] || fallback;
        if (!val && val !== "") { // empty string is falsy, but OK here.
            return null;
        }
        if (content.msgtype === "m.emote") {
            val = `* ${this.displayName} ${body}`;
        }
        return { string: val, format };
    }

    _getPlainBody() {
        return this._getContentString("body", "plain", "");
    }

    _getFormattedBody() {
        return this._getContentString("formatted_body", "html");
    }

    _getBody() {
        return this._getFormattedBody() || this._getPlainBody();
    }

    _parseBody(body) {
        const string = body.string;
        if (body.format === "html") {
            return parseHTMLBody({ mediaRepository: this._mediaRepository, platform: this.platform }, string);
        } else {
            return parsePlainBody(string);
        }
    }
}
