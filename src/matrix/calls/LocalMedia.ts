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
        public readonly screenShare?: Stream,
        public readonly dataChannelOptions?: RTCDataChannelInit,
    ) {}

    withUserMedia(stream: Stream) {
        return new LocalMedia(stream, this.screenShare, this.dataChannelOptions);
    }

    withScreenShare(stream: Stream) {
        return new LocalMedia(this.userMedia, stream, this.dataChannelOptions);
    }

    withDataChannel(options: RTCDataChannelInit): LocalMedia {
        return new LocalMedia(this.userMedia, this.screenShare, options);
    }

    getSDPMetadata(): SDPStreamMetadata {
        const metadata = {};
        const userMediaTrack = this.microphoneTrack ?? this.cameraTrack;
        if (userMediaTrack) {
            metadata[userMediaTrack.streamId] = {
                purpose: SDPStreamMetadataPurpose.Usermedia,
                audio_muted: this.microphoneTrack?.muted ?? true,
                video_muted: this.cameraTrack?.muted ?? true,
            };
        }
        if (this.screenShareTrack) {
            metadata[this.screenShareTrack.streamId] = {
                purpose: SDPStreamMetadataPurpose.Screenshare
            };
        }
        return metadata;
    }

    clone() {
        return new LocalMedia(this.userMedia?.clone(), this.screenShare?.clone(), this.dataChannelOptions);
    }

    dispose() {
        this.userMedia?.audioTrack?.stop();
        this.userMedia?.videoTrack?.stop();
        this.screenShare?.videoTrack?.stop();
    }
}
