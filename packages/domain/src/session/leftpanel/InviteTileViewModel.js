/*
Copyright 2020 Bruno Windels <bruno@windels.cloud>
Copyright 2020, 2021 The Matrix.org Foundation C.I.C.

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

import {BaseTileViewModel} from "./BaseTileViewModel.js";

export class InviteTileViewModel extends BaseTileViewModel {
    constructor(options) {
        super(options);
        const {invite} = options;
        this._invite = invite;
        this._url = this.urlCreator.openRoomActionUrl(this._invite.id);
    }

    get busy() {
        return this._invite.accepting || this._invite.rejecting;
    }

    get kind() {
        return "invite";
    }

    get url() {
        return this._url;
    }

    compare(other) {
        const parentComparison = super.compare(other);
        if (parentComparison !== 0) {
            return parentComparison;
        }
        return other._invite.timestamp - this._invite.timestamp;
    }

    get name() {
        return this._invite.name;
    }

    get _avatarSource() {
        return this._invite;
    }
}
