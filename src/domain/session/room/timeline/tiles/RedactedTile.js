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

import {BaseMessageTile} from "./BaseMessageTile";

export class RedactedTile extends BaseMessageTile {
    get shape() {
        return "redacted";
    }

    get description() {
        const {redactionReason} = this._entry;
        if (this.isRedacting) {
            if (redactionReason) {
                return this.i18n`This message is being deleted (${redactionReason})…`;
            } else {
                return this.i18n`This message is being deleted…`;
            }
        } else {
            if (redactionReason) {
                return this.i18n`This message has been deleted (${redactionReason}).`;
            } else {
                return this.i18n`This message has been deleted.`;
            }
        }
    }

    get isRedacting() {
        return this._entry.isRedacting;
    }

    /** override parent property to disable redacting, even if still pending */
    get canRedact() {
        return false;
    }

    abortPendingRedaction() {
        return this._entry.abortPendingRedaction();
    }
}
