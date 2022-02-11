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

import {avatarInitials, getIdentifierColorNumber, getAvatarHttpUrl} from "../../avatar.js";
import {ViewModel} from "../../ViewModel.js";

const KIND_ORDER = ["roomBeingCreated", "invite", "room"];

export class BaseTileViewModel extends ViewModel {
    constructor(options) {
        super(options);
        this._isOpen = false;
        this._hidden = false;
    }

    get hidden() {
        return this._hidden;
    }

    set hidden(value) {
        if (value !== this._hidden) {
            this._hidden = value;
            this.emitChange("hidden");
        }
    }

    close() {
        if (this._isOpen) {
            this._isOpen = false;
            this.emitChange("isOpen");
        }
    }

    open() {
        if (!this._isOpen) {
            this._isOpen = true;
            this.emitChange("isOpen");
        }
    }

    get isOpen() {
        return this._isOpen;
    }

    compare(other) {
        if (other.kind !== this.kind) {
            return KIND_ORDER.indexOf(this.kind) - KIND_ORDER.indexOf(other.kind);
        }
        return 0;
    }

    // Avatar view model contract
    get avatarLetter() {
        return avatarInitials(this.name);
    }

    get avatarColorNumber() {
        return getIdentifierColorNumber(this._avatarSource.avatarColorId);
    }

    avatarUrl(size) {
        return getAvatarHttpUrl(this._avatarSource.avatarUrl, size, this.platform, this._avatarSource.mediaRepository);
    }

    get avatarTitle() {
        return this.name;
    }
}
