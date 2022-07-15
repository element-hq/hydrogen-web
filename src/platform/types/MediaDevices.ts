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

export interface Event {}

export interface MediaDevices {
    // filter out audiooutput
    enumerate(): Promise<MediaDeviceInfo[]>;
    // to assign to a video element, we downcast to WrappedTrack and use the stream property. 
    getMediaTracks(audio: true | MediaDeviceInfo, video: boolean | MediaDeviceInfo): Promise<Stream>;
    getScreenShareTrack(): Promise<Stream | undefined>;
    createVolumeMeasurer(stream: Stream, callback: () => void): VolumeMeasurer;
}

// Typescript definitions derived from https://github.com/microsoft/TypeScript/blob/main/lib/lib.dom.d.ts
/*! *****************************************************************************
Copyright (c) Microsoft Corporation. All rights reserved.
Licensed under the Apache License, Version 2.0 (the "License"); you may not use
this file except in compliance with the License. You may obtain a copy of the
License at http://www.apache.org/licenses/LICENSE-2.0
THIS CODE IS PROVIDED ON AN *AS IS* BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
KIND, EITHER EXPRESS OR IMPLIED, INCLUDING WITHOUT LIMITATION ANY IMPLIED
WARRANTIES OR CONDITIONS OF TITLE, FITNESS FOR A PARTICULAR PURPOSE,
MERCHANTABLITY OR NON-INFRINGEMENT.
See the Apache Version 2.0 License for specific language governing permissions
and limitations under the License.
***************************************************************************** */

export interface StreamTrackEvent extends Event {
    readonly track: Track;
}

export interface StreamEventMap {
    "addtrack": StreamTrackEvent;
    "removetrack": StreamTrackEvent;
}

export interface Stream {
    getTracks(): ReadonlyArray<Track>;
    getAudioTracks(): ReadonlyArray<Track>;
    getVideoTracks(): ReadonlyArray<Track>;
    readonly id: string;
    clone(): Stream;
    addEventListener<K extends keyof StreamEventMap>(type: K, listener: (this: Stream, ev: StreamEventMap[K]) => any, options?: boolean | AddEventListenerOptions): void;
    removeEventListener<K extends keyof StreamEventMap>(type: K, listener: (this: Stream, ev: StreamEventMap[K]) => any, options?: boolean | EventListenerOptions): void;
    addTrack(track: Track);
    removeTrack(track: Track);
}

export enum TrackKind {
    Video = "video",
    Audio = "audio"
}

export interface Track {
    readonly kind: TrackKind;
    readonly label: string;
    readonly id: string;
    enabled: boolean;
    // getSettings(): MediaTrackSettings;
    stop(): void;
}

export interface VolumeMeasurer {
    get isSpeaking(): boolean;
    setSpeakingThreshold(threshold: number): void;
    stop();
}
