/*
Copyright 2022 The Matrix.org Foundation C.I.C.

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

import {SDPStreamMetadataPurpose} from "./callEventTypes";
import {Stream} from "../../platform/types/MediaDevices";
import {SDPStreamMetadata} from "./callEventTypes";

export class LocalMedia {
    constructor(
        public readonly userMedia?: Stream,
        public readonly microphoneMuted: boolean = false,
        public readonly cameraMuted: boolean = false,
        public readonly screenShare?: Stream,
        public readonly dataChannelOptions?: RTCDataChannelInit,
    ) {}

    withMuted(microphone: boolean, camera: boolean) {
        return new LocalMedia(this.userMedia, microphone, camera, this.screenShare, this.dataChannelOptions);
    }

    withUserMedia(stream: Stream) {
        return new LocalMedia(stream, this.microphoneMuted, this.cameraMuted, this.screenShare, this.dataChannelOptions);
    }

    withScreenShare(stream: Stream) {
        return new LocalMedia(this.userMedia, this.microphoneMuted, this.cameraMuted, stream, this.dataChannelOptions);
    }

    withDataChannel(options: RTCDataChannelInit): LocalMedia {
        return new LocalMedia(this.userMedia, this.microphoneMuted, this.cameraMuted, this.screenShare, options);
    }

    clone(): LocalMedia {
        return new LocalMedia(this.userMedia?.clone(), this.microphoneMuted, this.cameraMuted, this.screenShare?.clone(), this.dataChannelOptions);
    }
    
    dispose() {
        this.userMedia?.audioTrack?.stop();
        this.userMedia?.videoTrack?.stop();
        this.screenShare?.videoTrack?.stop();
    }
}
