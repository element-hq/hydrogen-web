/*
Copyright 2023 The Matrix.org Foundation C.I.C.

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

import {ObservableArray} from "../../observable/list/ObservableArray.ts";

export class RoomTypingStore {
    constructor({logger} = {}) {
        this._typingUserIds = new ObservableArray();
        this._logger = logger;
    }

    get typingUserIds() {
        return this._typingUserIds;
    }

    handleTypingEvent(content) {
        const newUserIds = content.user_ids || [];
        const oldUserIds = this._typingUserIds.array;

        if (this._logger) {
            this._logger.log({
                l: "typing",
                userIds: newUserIds,
                oldUserIds,
                content,
            });
        }

        const hasChanged = this._hasTypingUsersChanged(oldUserIds, newUserIds);

        if (hasChanged) {
            // Clear existing users
            while (this._typingUserIds.array.length > 0) {
                this._typingUserIds.remove(0);
            }
            // Add new users
            for (const userId of newUserIds) {
                this._typingUserIds.append(userId);
            }
        }
    }

    _hasTypingUsersChanged(oldUsers, newUsers) {
        if (!oldUsers && !newUsers) return false;
        if (!oldUsers || !newUsers) return true;
        if (oldUsers.length !== newUsers.length) return true;
        return !oldUsers.every((user, idx) => user === newUsers[idx]);
    }

    dispose() {
        // nothing to dispose yet
    }
}
