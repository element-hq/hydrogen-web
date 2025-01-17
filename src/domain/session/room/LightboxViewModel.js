/*
Copyright 2025 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import {ViewModel} from "../../ViewModel";

export class LightboxViewModel extends ViewModel {
    constructor(options) {
        super(options);
        this._eventId = options.eventId;
        this._unencryptedImageUrl = null;
        this._decryptedImage = null;
        this._closeUrl = this.urlRouter.urlUntilSegment("room");
        this._date = null;
        this._subscribeToEvent(options.room, options.eventId);
    }

    _subscribeToEvent(room, eventId) {
        const eventObservable = room.observeEvent(eventId);
        this.track(eventObservable.subscribe(eventEntry => {
            this._loadEvent(room, eventEntry);
        }));
        this._loadEvent(room, eventObservable.get());
    }

    async _loadEvent(room, eventEntry) {
        if (!eventEntry) {
            return;
        }
        const {mediaRepository} = room;
        this._eventEntry = eventEntry;
        const {content} = this._eventEntry;
        this._date = this._eventEntry.timestamp ? new Date(this._eventEntry.timestamp) : null;
        if (content.url) {
            this._unencryptedImageUrl = mediaRepository.mxcUrl(content.url);
            this.emitChange("imageUrl");
        } else if (content.file) {
            this._decryptedImage = this.track(await mediaRepository.downloadEncryptedFile(content.file));
            this.emitChange("imageUrl");
        }
    }

    get imageWidth() {
        return this._eventEntry?.content?.info?.w;
    }

    get imageHeight() {
        return this._eventEntry?.content?.info?.h;
    }

    get name() {
        return this._eventEntry?.content?.body;
    }

    get sender() {
        return this._eventEntry?.displayName;
    }

    get imageUrl() {
        if (this._decryptedImage) {
            return this._decryptedImage.url;
        } else if (this._unencryptedImageUrl) {
            return this._unencryptedImageUrl;
        } else {
            return "";
        }
    }

    get date() {
        return this._date && this._date.toLocaleDateString({}, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    }

    get time() {
        return this._date && this._date.toLocaleTimeString({}, {hour: "numeric", minute: "2-digit"});
    }

    get closeUrl() {
        return this._closeUrl;
    }

    close() {
        this.platform.history.pushUrl(this.closeUrl);
    }
}
