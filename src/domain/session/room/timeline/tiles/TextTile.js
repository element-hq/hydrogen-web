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

import {MessageTile} from "./MessageTile.js";
import { MessageBodyBuilder } from "../MessageBodyBuilder.js";

export class TextTile extends MessageTile {
    get messageFormat() {
        const content = this._getContent();
        let body = content?.body || "";
        if (content.msgtype === "m.emote") {
            body = `* ${this.displayName} ${body}`;
        }
        const message = new MessageBodyBuilder();
        message.fromText(body);
        return message;
    }
}
