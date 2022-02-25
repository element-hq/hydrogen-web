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

import {StreamPurpose} from "../../platform/types/WebRTC";
import {Track, AudioTrack, TrackType} from "../../platform/types/MediaDevices";
import {SDPStreamMetadata} from "./callEventTypes";

export class LocalMedia {
    constructor(
        public readonly cameraTrack?: Track,
        public readonly screenShareTrack?: Track,
        public readonly microphoneTrack?: AudioTrack
    ) {}

    withTracks(tracks: Track[]) {
        const cameraTrack = tracks.find(t => t.type === TrackType.Camera) ?? this.cameraTrack;
        const screenShareTrack = tracks.find(t => t.type === TrackType.ScreenShare) ?? this.screenShareTrack;
        const microphoneTrack = tracks.find(t => t.type === TrackType.Microphone) ?? this.microphoneTrack;
        if (cameraTrack && microphoneTrack && cameraTrack.streamId !== microphoneTrack.streamId) {
            throw new Error("The camera and audio track should have the same stream id");
        }
        return new LocalMedia(cameraTrack, screenShareTrack, microphoneTrack as AudioTrack);
    }

    get tracks(): Track[] { return []; }

    getSDPMetadata(): SDPStreamMetadata {
        const metadata = {};
        const userMediaTrack = this.microphoneTrack ?? this.cameraTrack;
        if (userMediaTrack) {
            metadata[userMediaTrack.streamId] = {
                purpose: StreamPurpose.UserMedia,
                audio_muted: this.microphoneTrack?.muted ?? false,
                video_muted: this.cameraTrack?.muted ?? false,
            };
        }
        if (this.screenShareTrack) {
            metadata[this.screenShareTrack.streamId] = {
                purpose: StreamPurpose.ScreenShare
            };
        }
        return metadata;
    }
}
