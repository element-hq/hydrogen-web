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

import {ViewModel} from "../ViewModel";
import {imageToInfo} from "./common.js";
import {RoomType} from "../../matrix/room/common";

export class CreateRoomViewModel extends ViewModel {
    constructor(options) {
        super(options);
        const {session} = options;
        this._session = session;
        this._name = undefined;
        this._topic = undefined;
        this._roomAlias = undefined;
        this._isPublic = false;
        this._isEncrypted = true;
        this._isAdvancedShown = false;
        this._isFederationDisabled = false;
        this._avatarScaledBlob = undefined;
        this._avatarFileName = undefined;
        this._avatarInfo = undefined;
        this._closeUrl = this.urlRouter.urlUntilSegment("session");
    }

    get isPublic() { return this._isPublic; }
    get isEncrypted() { return this._isEncrypted; }
    get canCreate() { return !!this._name; }
    avatarUrl() { return this._avatarScaledBlob.url; }
    get avatarTitle() { return this._name; }
    get avatarLetter() { return ""; }
    get avatarColorNumber() { return 0; }
    get hasAvatar() { return !!this._avatarScaledBlob; }
    get isFederationDisabled() { return this._isFederationDisabled; }
    get isAdvancedShown() { return this._isAdvancedShown; }
    get closeUrl() { return this._closeUrl; }

    setName(name) {
        this._name = name;
        this.emitChange("canCreate");
    }

    setRoomAlias(roomAlias) {
        this._roomAlias = roomAlias;
    }

    setTopic(topic) {
        this._topic = topic;
    }

    setPublic(isPublic) {
        this._isPublic = isPublic;
        this.emitChange("isPublic");
    }

    setEncrypted(isEncrypted) {
        this._isEncrypted = isEncrypted;
        this.emitChange("isEncrypted");
    }

    setFederationDisabled(disable) {
        this._isFederationDisabled = disable;
        this.emitChange("isFederationDisabled");
    }

    toggleAdvancedShown() {
        this._isAdvancedShown = !this._isAdvancedShown;
        this.emitChange("isAdvancedShown");
    }

    create() {
        let avatar;
        if (this._avatarScaledBlob) {
            avatar = {
                info: this._avatarInfo,
                name: this._avatarFileName,
                blob: this._avatarScaledBlob
            }
        }
        const roomBeingCreated = this._session.createRoom({
            type: this.isPublic ? RoomType.Public : RoomType.Private,
            name: this._name ?? undefined,
            topic: this._topic ?? undefined,
            isEncrypted: !this.isPublic && this._isEncrypted,
            isFederationDisabled: this._isFederationDisabled,
            alias: this.isPublic ? ensureAliasIsLocalPart(this._roomAlias) : undefined,
            avatar,
        });
        this.navigation.push("room", roomBeingCreated.id);
    }

    async selectAvatar() {
        if (!this.platform.hasReadPixelPermission()) {
            alert("Please allow canvas image data access, so we can scale your images down.");
            return;
        }
        if (this._avatarScaledBlob) {
            this._avatarScaledBlob.dispose();
        }
        this._avatarScaledBlob = undefined;
        this._avatarFileName = undefined;
        this._avatarInfo = undefined;

        const file = await this.platform.openFile("image/*");
        if (!file || !file.blob.mimeType.startsWith("image/")) {
            // allow to clear the avatar by not selecting an image
            this.emitChange("hasAvatar");
            return;
        }
        let image = await this.platform.loadImage(file.blob);
        const limit = 800;
        if (image.maxDimension > limit) {
            const scaledImage = await image.scale(limit);
            image.dispose();
            image = scaledImage;
        }
        this._avatarScaledBlob = image.blob;
        this._avatarInfo = imageToInfo(image);
        this._avatarFileName = file.name;
        this.emitChange("hasAvatar");
    }
}

function ensureAliasIsLocalPart(roomAliasLocalPart) {
    if (roomAliasLocalPart.startsWith("#")) {
        roomAliasLocalPart = roomAliasLocalPart.substr(1);
    }
    const colonIdx = roomAliasLocalPart.indexOf(":");
    if (colonIdx !== -1) {
        roomAliasLocalPart = roomAliasLocalPart.substr(0, colonIdx);
    }
    return roomAliasLocalPart;
}
