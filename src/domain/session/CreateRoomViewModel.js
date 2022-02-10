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

import {ViewModel} from "../ViewModel.js";
import {imageToInfo} from "./common.js";
import {RoomType} from "../../matrix/room/create";

export class CreateRoomViewModel extends ViewModel {
    constructor(options) {
        super(options);
        const {session} = options;
        this._session = session;
        this._name = "";
        this._topic = "";
        this._isPublic = false;
        this._isEncrypted = true;
        this._avatarScaledBlob = undefined;
        this._avatarFileName = undefined;
        this._avatarInfo = undefined;
    }

    setName(name) {
        this._name = name;
        this.emitChange("name");
    }

    get name() { return this._name; }

    setTopic(topic) {
        this._topic = topic;
        this.emitChange("topic");
    }

    get topic() { return this._topic; }

    setPublic(isPublic) {
        this._isPublic = isPublic;
        this.emitChange("isPublic");
    }

    get isPublic() { return this._isPublic; }

    setEncrypted(isEncrypted) {
        this._isEncrypted = isEncrypted;
        this.emitChange("isEncrypted");
    }

    get isEncrypted() { return this._isEncrypted; }

    get canCreate() {
        return !!this.name;
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
            name: this.name ?? undefined,
            topic: this.topic ?? undefined,
            isEncrypted: !this.isPublic && this._isEncrypted,
            alias: this.isPublic ? this.roomAlias : undefined,
            avatar,
            invites: ["@bwindels:matrix.org"]
        });
        this.navigation.push("room", roomBeingCreated.id);
    }

    
    avatarUrl() { return this._avatarScaledBlob.url; }
    get avatarTitle() { return this.name; }
    get avatarLetter() { return ""; }
    get avatarColorNumber() { return 0; }
    get hasAvatar() { return !!this._avatarScaledBlob; }
    get error() { return ""; }

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
