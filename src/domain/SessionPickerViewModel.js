/*
Copyright 2025 New Vector Ltd.
Copyright 2020 Bruno Windels <bruno@windels.cloud>

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import {SortedArray} from "../observable";
import {ViewModel} from "./ViewModel";
import {avatarInitials, getIdentifierColorNumber} from "./avatar";

class SessionItemViewModel extends ViewModel {
    constructor(options, pickerVM) {
        super(options);
        this._pickerVM = pickerVM;
        this._sessionInfo = options.sessionInfo;
        this._isDeleting = false;
        this._isClearing = false;
        this._error = null;
        this._exportDataUrl = null;
    }

    get error() {
        return this._error && this._error.message;
    }

    get id() {
        return this._sessionInfo.id;
    }

    get openUrl() {
        return this.urlRouter.urlForSegment("session", this.id);
    }

    get label() {
        const {userId, comment} =  this._sessionInfo;
        if (comment) {
            return `${userId} (${comment})`;
        } else {
            return userId;
        }
    }

    get sessionInfo() {
        return this._sessionInfo;
    }

    get exportDataUrl() {
        return this._exportDataUrl;
    }

    get avatarColorNumber() {
        return getIdentifierColorNumber(this._sessionInfo.userId);
    }

    get avatarInitials() {
        return avatarInitials(this._sessionInfo.userId);
    }
}


export class SessionPickerViewModel extends ViewModel {
    constructor(options) {
        super(options);
        this._sessions = new SortedArray((s1, s2) => s1.id.localeCompare(s2.id));
        this._loadViewModel = null;
        this._error = null;
    }

    // this loads all the sessions
    async load() {
        const sessions = await this.platform.sessionInfoStorage.getAll();
        this._sessions.setManyUnsorted(sessions.map(s => {
            return new SessionItemViewModel(this.childOptions({sessionInfo: s}), this);
        }));
    }

    // for the loading of 1 picked session
    get loadViewModel() {
        return this._loadViewModel;
    }

    get sessions() {
        return this._sessions;
    }

    get cancelUrl() {
        return this.urlRouter.urlForSegment("login");
    }
}
