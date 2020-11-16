/*
Copyright 2020 Bruno Windels <bruno@windels.cloud>
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

import {TimelineViewModel} from "./timeline/TimelineViewModel.js";
import {avatarInitials, getIdentifierColorNumber} from "../../avatar.js";
import {ViewModel} from "../../ViewModel.js";

export class RoomViewModel extends ViewModel {
    constructor(options) {
        super(options);
        const {room, ownUserId} = options;
        this._room = room;
        this._ownUserId = ownUserId;
        this._timelineVM = null;
        this._onRoomChange = this._onRoomChange.bind(this);
        this._timelineError = null;
        this._sendError = null;
        this._composerVM = new ComposerViewModel(this);
        this._clearUnreadTimout = null;
        this._closeUrl = this.urlCreator.urlUntilSegment("session");
    }

    get closeUrl() {
        return this._closeUrl;
    }

    async load() {
        this._room.on("change", this._onRoomChange);
        try {
            const timelineVM = this.track(new TimelineViewModel(this.childOptions({
                room: this._room,
                timeline: this._room.openTimeline(),
                ownUserId: this._ownUserId,
            })));
            await timelineVM.load();
            this._timelineVM = timelineVM;
            this.emitChange("timelineViewModel");
        } catch (err) {
            console.error(`room.openTimeline(): ${err.message}:\n${err.stack}`);
            this._timelineError = err;
            this.emitChange("error");
        }
        this._clearUnreadAfterDelay();
    }

    async _clearUnreadAfterDelay() {
        if (this._clearUnreadTimout) {
            return;
        }
        this._clearUnreadTimout = this.clock.createTimeout(2000);
        try {
            await this._clearUnreadTimout.elapsed();
            await this._room.clearUnread();
            this._clearUnreadTimout = null;
        } catch (err) {
            if (err.name !== "AbortError") {
                throw err;
            }    
        }
    }

    focus() {
        this._clearUnreadAfterDelay();
    }

    dispose() {
        super.dispose();
        this._room.off("change", this._onRoomChange);
        if (this._clearUnreadTimout) {
            this._clearUnreadTimout.abort();
            this._clearUnreadTimout = null;
        }
    }

    // called from view to close room
    // parent vm will dispose this vm
    close() {
        this._closeCallback();
    }

    // room doesn't tell us yet which fields changed,
    // so emit all fields originating from summary
    _onRoomChange() {
        this.emitChange("name");
    }

    get name() {
        return this._room.name || this.i18n`Empty Room`;
    }

    get id() {
        return this._room.id;
    }

    get timelineViewModel() {
        return this._timelineVM;
    }

    get isEncrypted() {
        return this._room.isEncrypted;
    }

    get error() {
        if (this._timelineError) {
            return `Something went wrong loading the timeline: ${this._timelineError.message}`;
        }
        if (this._sendError) {
            return `Something went wrong sending your message: ${this._sendError.message}`;
        }
        return "";
    }

    get avatarLetter() {
        return avatarInitials(this.name);
    }

    get avatarColorNumber() {
        return getIdentifierColorNumber(this._room.id)
    }

    get avatarUrl() {
        if (this._room.avatarUrl) {
            const size = 32 * this.platform.devicePixelRatio;
            return this._room.mediaRepository.mxcUrlThumbnail(this._room.avatarUrl, size, size, "crop");
        }
        return null;
    }

    get avatarTitle() {
        return this.name;
    }
    
    async _sendMessage(message) {
        if (message) {
            try {
                let msgtype = "m.text";
                if (message.startsWith("/me ")) {
                    message = message.substr(4).trim();
                    msgtype = "m.emote";
                }
                await this._room.sendEvent("m.room.message", {msgtype, body: message});
            } catch (err) {
                console.error(`room.sendMessage(): ${err.message}:\n${err.stack}`);
                this._sendError = err;
                this._timelineError = null;
                this.emitChange("error");
                return false;
            }
            return true;
        }
        return false;
    }

    async _sendFile() {
        let file;
        try {
            file = await this.platform.openFile();
        } catch (err) {
            return;
        }
        const content = {
            body: file.name,
            msgtype: "m.file"
        };
        await this._room.sendEvent("m.room.message", content, {
            "url": this._room.createAttachment(file.blob, file.name)
        });
        // TODO: dispose file.blob (in the attachment, after upload)
    }

    async _sendPicture() {
        if (!this.platform.hasReadPixelPermission()) {
            alert("Please allow canvas image data access, so we can scale your images down.");
            return;
        }
        let file;
        try {
            file = await this.platform.openFile("image/*");
        } catch (err) {
            return;
        }
        const image = await this.platform.loadImage(file.blob);
        const content = {
            body: file.name,
            msgtype: "m.image",
            info: imageToInfo(image)
        };
        const attachments = {
            "url": this._room.createAttachment(file.blob, file.name),
        };
        if (image.maxDimension > 600) {
            const thumbnail = await image.scale(400);
            content.info.thumbnail_info = imageToInfo(thumbnail);
            attachments["info.thumbnail_url"] = 
                this._room.createAttachment(thumbnail.blob, file.name);
        }
        await this._room.sendEvent("m.room.message", content, attachments);
    }
    

    get composerViewModel() {
        return this._composerVM;
    }
}

class ComposerViewModel extends ViewModel {
    constructor(roomVM) {
        super();
        this._roomVM = roomVM;
        this._isEmpty = true;
    }

    get isEncrypted() {
        return this._roomVM.isEncrypted;
    }

    sendMessage(message) {
        const success = this._roomVM._sendMessage(message);
        if (success) {
            this._isEmpty = true;
            this.emitChange("canSend");
        }
        return success;
    }

    sendPicture() {
        this._roomVM._sendPicture();
    }

    sendFile() {
        this._roomVM._sendFile();
    }

    get canSend() {
        return !this._isEmpty;
    }

    async setInput(text) {
        const wasEmpty = this._isEmpty;
        this._isEmpty = text.length === 0;
        if (wasEmpty && !this._isEmpty) {
            this._roomVM._room.ensureMessageKeyIsShared();
        }
        if (wasEmpty !== this._isEmpty) {
            this.emitChange("canSend");
        }
    }
}

function imageToInfo(image) {
    return {
        w: image.width,
        h: image.height,
        mimetype: image.blob.mimeType,
        size: image.blob.size
    };
}
