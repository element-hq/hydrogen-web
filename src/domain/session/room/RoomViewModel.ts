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

import {IGridItemViewModel} from './IGridItemViewModel';
import {TimelineViewModel} from "./timeline/TimelineViewModel";
import {ComposerViewModel} from "./ComposerViewModel";
import {avatarInitials, getIdentifierColorNumber, getAvatarHttpUrl} from "../../avatar";
import {ViewModel} from "../../ViewModel";
import {imageToInfo, MultiMediaInfo} from "../common";
// TODO: remove fallback so default isn't included in bundle for SDK users that have their custom tileClassForEntry
// this is a breaking SDK change though to make this option mandatory
import {tileClassForEntry as defaultTileClassForEntry, TimelineEntry} from "./timeline/tiles/index";
import {joinRoom} from "../../../matrix/room/joinRoom";

import type {Room} from "../../../matrix/room/Room";
import type {TileClassForEntryFn, Options as TileOptions} from "./timeline/tiles";
import type {SimpleTile} from "./timeline/tiles/SimpleTile";
import type {Client} from "../../../matrix/Client";
import type {Timeout} from "../../../platform/web/dom/Clock";
import type {VideoHandle} from "../../../platform/web/dom/ImageHandle";
import type {Options as ViewModelOptions} from "../../ViewModel";


type Options = {
    client?: Client;
    room: Room,
    tileClassForEntry?: TileClassForEntryFn
} & ViewModelOptions;

export class RoomViewModel extends ViewModel implements IGridItemViewModel {
    private _client?: Client;
    private _room: Room;
    private _tileClassForEntry: TileClassForEntryFn;
    private _composerVM?: InternalViewModel;
    private _timelineVM?: TimelineViewModel;
    private _tileOptions?: TileOptions;
    private _timelineError?: Error;
    private _sendError?: Error;
    private _clearUnreadTimout?: Timeout;
    private _closeUrl: string;

    constructor(options: Options) {
        super(options);
        const {client, room, tileClassForEntry} = options;
        this._client = client;
        this._room = room;
        this._tileClassForEntry = tileClassForEntry ?? defaultTileClassForEntry;
        this._onRoomChange = this._onRoomChange.bind(this);
        if (room.isArchived) {
            this._composerVM = this.track(new ArchivedViewModel(this.childOptions({archivedRoom: room})));
        } else {
            void this._recreateComposerOnPowerLevelChange();
        }
        this._closeUrl = this.urlRouter.urlUntilSegment("session");
    }

    async load(): Promise<void> {
        this._room.on("change", this._onRoomChange);
        try {
            const timeline = await this._room.openTimeline();
            this._tileOptions = this.childOptions({
                roomVM: this,
                timeline,
                tileClassForEntry: this._tileClassForEntry,
            });
            this._timelineVM = this.track(new TimelineViewModel(this.childOptions({
                tileOptions: this._tileOptions,
                timeline,
            })));
            this.emitChange("timelineViewModel");
        } catch (err) {
            console.error(`room.openTimeline(): ${err.message}:\n${err.stack}`);
            this._timelineError = err;
            this.emitChange("error");
        }
        void this._clearUnreadAfterDelay();
    }

    async _recreateComposerOnPowerLevelChange(): Promise<void> {
        const powerLevelObservable = await this._room.observePowerLevels();
        const canSendMessage = (): boolean => powerLevelObservable.get().canSendType("m.room.message");
        let oldCanSendMessage = canSendMessage();
        const recreateComposer = (newCanSendMessage: boolean): void => {
            this._composerVM = this.disposeTracked(this._composerVM);
            if (newCanSendMessage) {
                this._composerVM = this.track(new ComposerViewModel(this));
            }
            else {
                this._composerVM = this.track(new LowerPowerLevelViewModel(this.childOptions({})));
            }
            this.emitChange("powerLevelObservable");
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

    async _clearUnreadAfterDelay(): Promise<void> {
        if (this._room.isArchived || this._clearUnreadTimout) {
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

    focus(): void {
        void this._clearUnreadAfterDelay();
    }

    dispose(): void {
        super.dispose();
        this._room.off("change", this._onRoomChange);
        if (this._room.isArchived) {
            this._room.release();
        }
        if (this._clearUnreadTimout) {
            this._clearUnreadTimout.abort();
            this._clearUnreadTimout = undefined;
        }
    }

    // room doesn't tell us yet which fields changed,
    // so emit all fields originating from summary
    _onRoomChange(): void {
        // propagate the update to the child view models so it's bindings can update based on room changes
        this._composerVM?.emitChange("room");
        this.emitChange("room");
    }

    get kind(): "room" { return "room"; }
    get closeUrl(): string { return this._closeUrl; }
    get name(): string { return this._room.name || this.i18n`Empty Room`; }
    get id(): string { return this._room.id; }
    get timelineViewModel(): TimelineViewModel { return this._timelineVM; }
    get isEncrypted(): boolean { return this._room.isEncrypted; }

    get error(): string {
        if (this._timelineError) {
            return `Something went wrong loading the timeline: ${this._timelineError.message}`;
        }
        if (this._sendError) {
            return `Something went wrong sending your message: ${this._sendError.message}`;
        }
        return "";
    }

    get avatarLetter(): string {
        return avatarInitials(this.name);
    }

    get avatarColorNumber(): number {
        return getIdentifierColorNumber(this._room.avatarColorId);
    }

    avatarUrl(size): string | null {
        return getAvatarHttpUrl(this._room.avatarUrl, size, this.platform, this._room.mediaRepository);
    }

    get avatarTitle(): string {
        return this.name;
    }

    get canLeave(): boolean {
        return this._room.isJoined;
    }

    leaveRoom(): void {
        this._room.leave();
    }

    get canForget(): boolean {
        return this._room.isArchived;
    }

    forgetRoom(): void {
        this._room.forget();
    }

    get canRejoin(): boolean {
        return this._room.isArchived;
    }

    rejoinRoom(): void {
        this._room.join();
    }

    _createTile(entry: TimelineEntry): SimpleTile | undefined {
        if (this._tileOptions) {
            const Tile = this._tileOptions.tileClassForEntry(entry);
            if (Tile) {
                return new Tile(entry, this._tileOptions);
            }
        }
    }

    async _processCommandJoin(roomName: string): Promise<void> {
        try {
            const session = this._client?.session;
            const roomId = await joinRoom(roomName, session);
            this.navigation.push("room", roomId);
        } catch (err) {
            this._sendError = err;
            this._timelineError = undefined;
            this.emitChange("error");
        }
    }

    async _processCommand(message: string | undefined): Promise<{
        type: string,
        message?: string
    }> {
        let msgtype: string = "";
        const [commandName, ...args] = message!.substring(1).split(" ");
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
                    this._sendError = new Error("join syntax: /join <room-id>");
                    this._timelineError = undefined;
                    this.emitChange("error");
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
                this._sendError = new Error(`no command name "${commandName}". To send the message instead of executing, please type "/${message}"`);
                this._timelineError = undefined;
                this.emitChange("error");
                message = undefined;
       }
       return {type: msgtype, message: message};
   }

    async _sendMessage(message: string, replyingTo): Promise<boolean> {
        if (!this._room.isArchived && message) {
            let messinfo: {type: string, message?: string} = {type : "m.text", message: message};
            if (message.startsWith("//")) {
                messinfo.message = message.substring(1).trim();
            } else if (message.startsWith("/")) {
                messinfo = await this._processCommand(message);
            }
            try {
                const msgtype = messinfo.type;
                const message = messinfo.message;
                if (msgtype && message) {
                    if (replyingTo) {
                        await replyingTo.reply(msgtype, message);
                    } else {
                        await this._room.sendEvent("m.room.message", {msgtype, body: message});
                    }
                }
            } catch (err) {
                console.error(`room.sendMessage(): ${err.message}:\n${err.stack}`);
                this._sendError = err;
                this._timelineError = undefined;
                this.emitChange("error");
                return false;
            }
            return true;
        }
        return false;
    }

    async _pickAndSendFile(): Promise<void>{
        try {
            const file = await this.platform.openFile();
            if (!file) {
                return;
            }
            return this._sendFile(file);
        } catch (err) {
            console.error(err);
        }
    }

    async _sendFile(file): Promise<void> {
        const content = {
            body: file.name,
            msgtype: "m.file"
        };
        await this._room.sendEvent("m.room.message", content, {
            "url": this._room.createAttachment(file.blob, file.name)
        });
    }

    async _pickAndSendVideo(): Promise<void>{
        try {
            if (!this.platform.hasReadPixelPermission()) {
                alert("Please allow canvas image data access, so we can scale your images down.");
                return;
            }
            const file = await this.platform.openFile("video/*");
            if (!file) {
                return;
            }
            if (!file.blob.mimeType.startsWith("video/")) {
                return this._sendFile(file);
            }
            let video: VideoHandle;
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
            await this._room.sendEvent("m.room.message", content, attachments);
        } catch (err) {
            this._sendError = err;
            this.emitChange("error");
            console.error(err.stack);
        }
    }

    async _pickAndSendPicture(): Promise<void> {
        try {
            if (!this.platform.hasReadPixelPermission()) {
                alert("Please allow canvas image data access, so we can scale your images down.");
                return;
            }
            const file = await this.platform.openFile("image/*");
            if (!file) {
                return;
            }
            if (!file.blob.mimeType.startsWith("image/")) {
                return this._sendFile(file);
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
            await this._room.sendEvent("m.room.message", content, attachments);
        } catch (err) {
            this._sendError = err;
            this.emitChange("error");
            console.error(err.stack);
        }
    }

    get room(): Room {
        return this._room;
    }

    get composerViewModel(): InternalViewModel | undefined {
        return this._composerVM;
    }

    openDetailsPanel(): void {
        let path = this.navigation.path.until("room");
        path = path.with(this.navigation.segment("right-panel", true))!;
        path = path.with(this.navigation.segment("details", true))!;
        this.navigation.applyPath(path);
    }

    startReply(entry): void {
        if (!this._room.isArchived) {
            if (this._composerVM instanceof ComposerViewModel) {
                this._composerVM?.setReplyingTo(entry);
            }
        }
    }

    dismissError(): void {
        this._sendError = undefined;
        this.emitChange("error");
    }
}

function videoToInfo(video: VideoHandle): MultiMediaInfo {
    const info = imageToInfo(video);
    info.duration = video.duration;
    return info;
}

type ArchivedViewModelOptions = {
    archivedRoom: Room;
} & ViewModelOptions;

class ArchivedViewModel extends ViewModel {
    private _archivedRoom: Room;

    constructor(options: ArchivedViewModelOptions) {
        super(options);
        this._archivedRoom = options.archivedRoom;
    }

    get description(): string {
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

    get kind(): string {
        return "disabled";
    }
}

class LowerPowerLevelViewModel extends ViewModel {
    get description(): string {
        return this.i18n`You do not have the powerlevel necessary to send messages`;
    }

    get kind(): string {
        return "disabled";
    }
}

type InternalViewModel = ArchivedViewModel | ComposerViewModel | LowerPowerLevelViewModel;