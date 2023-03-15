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
import {ComposerViewModel} from "./ComposerViewModel.js"
import {CallViewModel} from "./CallViewModel"
import {PickMapObservableValue} from "../../../observable/value";
import {avatarInitials, getIdentifierColorNumber, getAvatarHttpUrl} from "../../avatar";
import {ErrorReportViewModel} from "../../ErrorReportViewModel";
import {ViewModel} from "../../ViewModel";
import {imageToInfo} from "../common.js";
import {LocalMedia} from "../../../matrix/calls/LocalMedia";
// TODO: remove fallback so default isn't included in bundle for SDK users that have their custom tileClassForEntry
// this is a breaking SDK change though to make this option mandatory
import {tileClassForEntry as defaultTileClassForEntry} from "./timeline/tiles/index";
import {joinRoom} from "../../../matrix/room/joinRoom";

export class RoomViewModel extends ErrorReportViewModel {
    constructor(options) {
        super(options);
        const {room, tileClassForEntry} = options;
        this._room = room;
        this._timelineVM = null;
        this._tileClassForEntry = tileClassForEntry ?? defaultTileClassForEntry;
        this._tileOptions = undefined;
        this._onRoomChange = this._onRoomChange.bind(this);
        this._composerVM = null;
        if (room.isArchived) {
            this._composerVM = this.track(new ArchivedViewModel(this.childOptions({archivedRoom: room})));
        } else {
            this._recreateComposerOnPowerLevelChange();
        }
        this._clearUnreadTimout = null;
        this._closeUrl = this.urlRouter.urlUntilSegment("session");
        this._setupCallViewModel();
    }

    _setupCallViewModel() {
        if (!this.features.calls) {
            return;
        }
        // pick call for this room with lowest key
        const calls = this.getOption("session").callHandler.calls;
        this._callObservable = new PickMapObservableValue(calls.filterValues(c => {
            return c.roomId === this._room.id && c.hasJoined;
        }));
        this._callViewModel = undefined;
        this.track(this._callObservable.subscribe(call => {
            if (call && this._callViewModel && call.id === this._callViewModel.id) {
                return;
            }
            this._callViewModel = this.disposeTracked(this._callViewModel);
            if (call) {
                this._callViewModel = this.track(new CallViewModel(this.childOptions({call, room: this._room})));
            }
            this.emitChange("callViewModel");
        }));
        const call = this._callObservable.get();
        // TODO: cleanup this duplication to create CallViewModel
        if (call) {
            this._callViewModel = this.track(new CallViewModel(this.childOptions({call, room: this._room})));
        }
    }

    async load() {
        this.logAndCatch("RoomViewModel.load", async log => {
            this._room.on("change", this._onRoomChange);
            const timeline = await this._room.openTimeline(log);
            this._tileOptions = this.childOptions({
                session: this.getOption("session"),
                roomVM: this,
                timeline,
                tileClassForEntry: this._tileClassForEntry,
            });
            this._timelineVM = this.track(new TimelineViewModel(this.childOptions({
                tileOptions: this._tileOptions,
                timeline,
            })));
            this.emitChange("timelineViewModel");
            await this._clearUnreadAfterDelay(log);
        });
    }

    async _recreateComposerOnPowerLevelChange() {
        const powerLevelObservable = await this._room.observePowerLevels();
        const canSendMessage = () => powerLevelObservable.get().canSendType("m.room.message");
        let oldCanSendMessage = canSendMessage();
        const recreateComposer = newCanSendMessage => {
            this._composerVM = this.disposeTracked(this._composerVM);
            if (newCanSendMessage) {
                this._composerVM = this.track(new ComposerViewModel(this));
            }
            else {
                this._composerVM = this.track(new LowerPowerLevelViewModel(this.childOptions()));
            }
            this.emitChange("powerLevelObservable")
        };
        this.track(powerLevelObservable.subscribe(() => {
            const newCanSendMessage = canSendMessage();
            if (oldCanSendMessage !== newCanSendMessage) {
                recreateComposer(newCanSendMessage);
                oldCanSendMessage = newCanSendMessage;
            }
        }));
        recreateComposer(oldCanSendMessage);
    }

    async _clearUnreadAfterDelay(log) {
        if (this._room.isArchived || this._clearUnreadTimout) {
            return;
        }
        this._clearUnreadTimout = this.clock.createTimeout(2000);
        try {
            await this._clearUnreadTimout.elapsed();
            await this._room.clearUnread(log);
            this._clearUnreadTimout = null;
        } catch (err) {
            if (err.name === "AbortError") {
                log.set("clearUnreadCancelled", true);
            } else {
                throw err;
            }
        }
    }

    focus() {
        this.logAndCatch("RoomViewModel.focus", async log => {
            this._clearUnreadAfterDelay(log);
        });
    }

    dispose() {
        super.dispose();
        this._room.off("change", this._onRoomChange);
        if (this._room.isArchived) {
            this._room.release();
        }
        if (this._clearUnreadTimout) {
            this._clearUnreadTimout.abort();
            this._clearUnreadTimout = null;
        }
    }

    // room doesn't tell us yet which fields changed,
    // so emit all fields originating from summary
    _onRoomChange() {
        // propagate the update to the child view models so it's bindings can update based on room changes
        this._composerVM?.emitChange();
        this.emitChange();
    }

    get kind() { return "room"; }
    get closeUrl() { return this._closeUrl; }
    get name() { return this._room.name || this.i18n`Empty Room`; }
    get id() { return this._room.id; }
    get timelineViewModel() { return this._timelineVM; }
    get isEncrypted() { return this._room.isEncrypted; }

    get avatarLetter() {
        return avatarInitials(this.name);
    }

    get avatarColorNumber() {
        return getIdentifierColorNumber(this._room.avatarColorId)
    }

    avatarUrl(size) {
        return getAvatarHttpUrl(this._room.avatarUrl, size, this.platform, this._room.mediaRepository);
    }

    get avatarTitle() {
        return this.name;
    }

    get canLeave() {
        return this._room.isJoined;
    }

    leaveRoom() {
        this._room.leave();
    }

    get canForget() {
        return this._room.isArchived;
    }

    forgetRoom() {
        this._room.forget();
    }

    get canRejoin() {
        return this._room.isArchived;
    }

    rejoinRoom() {
        this._room.join();
    }

    _createTile(entry) {
        if (this._tileOptions) {
            const Tile = this._tileOptions.tileClassForEntry(entry, this._tileOptions);
            if (Tile) {
                return new Tile(entry, this._tileOptions);
            }
        }
    }
    
    _sendMessage(message, replyingTo) {
        return this.logAndCatch("RoomViewModel.sendMessage", async log => {
            let success = false;
            if (!this._room.isArchived && message) {
                let msgtype = "m.text";
                if (message.startsWith("//")) {
                    message = message.substring(1).trim();
                } else if (message.startsWith("/")) {
                    const result = await this._processCommand(message);
                    msgtype = result.msgtype;
                    message = result.message;
                }
                let content;
                if (replyingTo) {
                    log.set("replyingTo", replyingTo.eventId);
                    content = await replyingTo.createReplyContent(msgtype, message);
                } else {
                    content = {msgtype, body: message};
                }
                await this._room.sendEvent("m.room.message", content, undefined, log);
                success = true;
            }
            log.set("success", success);
            return success;
        }, false);
    }

    async _processCommandJoin(roomName) {
        try {
            const session = this._options.client.session;
            const roomId = await joinRoom(roomName, session);
            this.navigation.push("room", roomId);
        } catch (err) {
            this.reportError(err);
        }
    } 

    async _processCommand(message) {
        let msgtype;
        const [commandName, ...args] = message.substring(1).split(" ");
        switch (commandName) {
            case "me":
                message = args.join(" ");
                msgtype = "m.emote";
                break;
            case "join":
                if (args.length === 1) {
                    const roomName = args[0];
                    await this._processCommandJoin(roomName);
                } else {
                    this.reportError(new Error("join syntax: /join <room-id>"));
                }
                break;
            case "shrug":
                message = "¯\\_(ツ)_/¯ " + args.join(" ");
                msgtype = "m.text";
                break;
            case "tableflip":
                message = "(╯°□°）╯︵ ┻━┻ " + args.join(" ");
                msgtype = "m.text";
                break;
            case "unflip":
                message = "┬──┬ ノ( ゜-゜ノ) " + args.join(" ");
                msgtype = "m.text";
                break;
            case "lenny":
                message = "( ͡° ͜ʖ ͡°) " + args.join(" ");
                msgtype = "m.text";
                break;
            default:
                this.reportError(new Error(`no command name "${commandName}". To send the message instead of executing, please type "/${message}"`));
                message = undefined;
        }
        return {msgtype, message: message};
    }

    _pickAndSendFile() {
        return this.logAndCatch("RoomViewModel.sendFile", async log => {
            const file = await this.platform.openFile();
            if (!file) {
                log.set("cancelled", true);
                return;
            }
            return this._sendFile(file, log);
        });
    }

    async _sendFile(file, log) {
        const content = {
            body: file.name,
            msgtype: "m.file"
        };
        await this._room.sendEvent("m.room.message", content, {
            "url": this._room.createAttachment(file.blob, file.name)
        }, log);
    }

    _pickAndSendVideo() {
        return this.logAndCatch("RoomViewModel.sendVideo", async log => {
            if (!this.platform.hasReadPixelPermission()) {
                throw new Error("Please allow canvas image data access, so we can scale your images down.");
            }
            const file = await this.platform.openFile("video/*");
            if (!file) {
                return;
            }
            if (!file.blob.mimeType.startsWith("video/")) {
                return this._sendFile(file, log);
            }
            let video;
            try {
                video = await this.platform.loadVideo(file.blob);
            } catch (err) {
                // TODO: extract platform dependent code from view model
                if (err instanceof window.MediaError && err.code === 4) {
                    throw new Error(`this browser does not support videos of type ${file?.blob.mimeType}.`);
                } else {
                    throw err;
                }
            }
            const content = {
                body: file.name,
                msgtype: "m.video",
                info: videoToInfo(video)
            };
            const attachments = {
                "url": this._room.createAttachment(video.blob, file.name),
            };

            const limit = await this.platform.settingsStorage.getInt("sentImageSizeLimit");
            const maxDimension = limit || Math.min(video.maxDimension, 800);
            const thumbnail = await video.scale(maxDimension);
            content.info.thumbnail_info = imageToInfo(thumbnail);
            attachments["info.thumbnail_url"] = 
                this._room.createAttachment(thumbnail.blob, file.name);
            await this._room.sendEvent("m.room.message", content, attachments, log);
        });
    }

    async _pickAndSendPicture() {
        this.logAndCatch("RoomViewModel.sendPicture", async log => {
            if (!this.platform.hasReadPixelPermission()) {
                alert("Please allow canvas image data access, so we can scale your images down.");
                return;
            }
            const file = await this.platform.openFile("image/*");
            if (!file) {
                log.set("cancelled", true);
                return;
            }
            if (!file.blob.mimeType.startsWith("image/")) {
                return this._sendFile(file, log);
            }
            let image = await this.platform.loadImage(file.blob);
            const limit = await this.platform.settingsStorage.getInt("sentImageSizeLimit");
            if (limit && image.maxDimension > limit) {
                const scaledImage = await image.scale(limit);
                image.dispose();
                image = scaledImage;
            }
            const content = {
                body: file.name,
                msgtype: "m.image",
                info: imageToInfo(image)
            };
            const attachments = {
                "url": this._room.createAttachment(image.blob, file.name),
            };
            if (image.maxDimension > 600) {
                const thumbnail = await image.scale(400);
                content.info.thumbnail_info = imageToInfo(thumbnail);
                attachments["info.thumbnail_url"] = 
                    this._room.createAttachment(thumbnail.blob, file.name);
            }
            await this._room.sendEvent("m.room.message", content, attachments, log);
        });
    }

    get room() {
        return this._room;
    }

    get composerViewModel() {
        return this._composerVM;
    }

    get callViewModel() {
        return this._callViewModel;
    }

    openDetailsPanel() {
        let path = this.navigation.path.until("room");
        path = path.with(this.navigation.segment("right-panel", true));
        path = path.with(this.navigation.segment("details", true));
        this.navigation.applyPath(path);
    }

    startReply(entry) {
        if (!this._room.isArchived) {
            this._composerVM.setReplyingTo(entry);
        }
    }

    startCall() {
        return this.logAndCatch("RoomViewModel.startCall", async log => {
            if (!this.features.calls) {
                log.set("feature_disbled", true);
                return;
            }
            log.set("roomId", this._room.id);
            let localMedia;
            try {
                const stream = await this.platform.mediaDevices.getMediaTracks(false, true);
                localMedia = new LocalMedia().withUserMedia(stream);
            } catch (err) {
                throw new Error(`Could not get local audio and/or video stream: ${err.message}`);
            }
            const session = this.getOption("session");
            let call;
            try {
                // this will set the callViewModel above as a call will be added to callHandler.calls
                call = await session.callHandler.createCall(
                    this._room.id,
                    "m.video",
                    "A call " + Math.round(this.platform.random() * 100),
                    undefined,
                    log
                );
            } catch (err) {
                throw new Error(`Could not create call: ${err.message}`);
            }
            try {
                await call.join(localMedia, log);
            } catch (err) {
                throw new Error(`Could not join call: ${err.message}`);
            }
        });
    }
}

function videoToInfo(video) {
    const info = imageToInfo(video);
    info.duration = video.duration;
    return info;
}

class ArchivedViewModel extends ViewModel {
    constructor(options) {
        super(options);
        this._archivedRoom = options.archivedRoom;
    }

    get description() {
        if (this._archivedRoom.isKicked) {
            if (this._archivedRoom.kickReason) {
                return this.i18n`You were kicked from the room by ${this._archivedRoom.kickedBy.name} because: ${this._archivedRoom.kickReason}`;
            } else {
                return this.i18n`You were kicked from the room by ${this._archivedRoom.kickedBy.name}.`;
            }
        } else if (this._archivedRoom.isBanned) {
            if (this._archivedRoom.kickReason) {
                return this.i18n`You were banned from the room by ${this._archivedRoom.kickedBy.name} because: ${this._archivedRoom.kickReason}`;
            } else {
                return this.i18n`You were banned from the room by ${this._archivedRoom.kickedBy.name}.`;
            }
        } else {
            return this.i18n`You left this room`;
        }
    }

    get kind() {
        return "disabled";
    }
}

class LowerPowerLevelViewModel extends ViewModel {
    get description() {
        return this.i18n`You do not have the powerlevel necessary to send messages`;
    }

    get kind() {
        return "disabled";
    }
}
