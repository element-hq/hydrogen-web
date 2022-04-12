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

export interface MediaDevices {
    // filter out audiooutput
    enumerate(): Promise<MediaDeviceInfo[]>;
    // to assign to a video element, we downcast to WrappedTrack and use the stream property. 
    getMediaTracks(audio: true | MediaDeviceInfo, video: boolean | MediaDeviceInfo): Promise<Stream>;
    getScreenShareTrack(): Promise<Stream | undefined>;
}

export interface Stream {
    readonly audioTrack: AudioTrack | undefined;
    readonly videoTrack: Track | undefined;
    readonly id: string;
    clone(): Stream;
}

export enum TrackKind {
    Video = "video",
    Audio = "audio"
}

export interface Track {
    readonly kind: TrackKind;
    readonly label: string;
    readonly id: string;
    readonly settings: MediaTrackSettings;
    stop(): void;
}

export interface AudioTrack extends Track {
    // TODO: how to emit updates on this?
    get isSpeaking(): boolean;
}

