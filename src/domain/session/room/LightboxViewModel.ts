/*
Copyright 2020 The Matrix.org Foundation C.I.C.

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

import {ViewModel} from "../../ViewModel";
import type {Options as ViewModelOptions} from "../../ViewModel";
import type {Room} from "../../../matrix/room/Room";
import type {EventEntry} from "../../../matrix/room/timeline/entries/EventEntry";
import type {BlobHandle} from "../../../platform/web/dom/BlobHandle";

type Options = {
    eventId: string;
    room: Room;
} & ViewModelOptions

export class LightboxViewModel extends ViewModel {
    private _eventId: string;
    private _unencryptedImageUrl: string | null = null;
    private _decryptedImage?: BlobHandle;
    private _closeUrl: string;
    private _eventEntry: EventEntry | null;
    private _date?: Date;

    constructor(options: Options) {
        super(options);
        this._eventId = options.eventId;
        this._closeUrl = this.urlCreator.urlUntilSegment("room");
        this._eventEntry = null;
        this._subscribeToEvent(options.room, options.eventId);
    }

    _subscribeToEvent(room: Room, eventId: string): void {
        const eventObservable = room.observeEvent(eventId);
        this.track(eventObservable.subscribe(eventEntry => {
            void this._loadEvent(room, eventEntry);
        }));
        void this._loadEvent(room, eventObservable.get());
    }

    async _loadEvent(room: Room, eventEntry: any | null): Promise<void> {
        if (!eventEntry) {
            return;
        }
        const {mediaRepository} = room;
        this._eventEntry = eventEntry;
        const {content} = this._eventEntry;
        this._date = this._eventEntry.timestamp ? new Date(this._eventEntry.timestamp) : undefined;
        if (content.url) {
            this._unencryptedImageUrl = mediaRepository.mxcUrl(content.url);
            this.emitChange("imageUrl");
        } else if (content.file) {
            this._decryptedImage = this.track(await mediaRepository.downloadEncryptedFile(content.file));
            this.emitChange("imageUrl");
        }
    }

    get imageWidth(): number | undefined {
        return this._eventEntry?.content?.info?.w;
    }

    get imageHeight(): number | undefined {
        return this._eventEntry?.content?.info?.h;
    }

    get name(): string {
        return this._eventEntry?.content?.body;
    }

    get sender(): string {
        return this._eventEntry?.displayName;
    }

    get imageUrl(): string {
        if (this._decryptedImage) {
            return this._decryptedImage.url;
        } else if (this._unencryptedImageUrl) {
            return this._unencryptedImageUrl;
        } else {
            return "";
        }
    }

    get date(): string | undefined {
        return this._date && this._date.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    }

    get time(): string | undefined {
        return this._date && this._date.toLocaleTimeString(undefined, {hour: "numeric", minute: "2-digit"});
    }

    get closeUrl(): string {
        return this._closeUrl;
    }

    close(): void {
        this.platform.history.pushUrl(this.closeUrl);
    }
}
