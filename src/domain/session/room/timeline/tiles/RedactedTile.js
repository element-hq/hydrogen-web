/*
Copyright 2025 New Vector Ltd.
Copyright 2020 Bruno Windels <bruno@windels.cloud>

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import {BaseMessageTile} from "./BaseMessageTile.js";

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
