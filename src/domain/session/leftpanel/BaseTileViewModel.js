/*
Copyright 2025 New Vector Ltd.
Copyright 2020, 2021 The Matrix.org Foundation C.I.C.
Copyright 2020 Bruno Windels <bruno@windels.cloud>

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import {avatarInitials, getIdentifierColorNumber, getAvatarHttpUrl} from "../../avatar";
import {ViewModel} from "../../ViewModel";

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
