/*
Copyright 2025 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import {ILogItem} from "../../logging/types";
import type {Track, Stream} from "../../platform/types/MediaDevices";
import {LocalMedia} from "./LocalMedia";

export function getStreamAudioTrack(stream: Stream | undefined): Track | undefined {
    return stream?.getAudioTracks()[0];
}

export function getStreamVideoTrack(stream: Stream | undefined): Track | undefined {
    return stream?.getVideoTracks()[0];
}

export function mute(localMedia: LocalMedia, localMuteSettings: MuteSettings, log: ILogItem) {
        return log.wrap("mute", log => {
            log.set("cameraMuted", localMuteSettings.camera);
            log.set("microphoneMuted", localMuteSettings.microphone);

            // Mute audio
            const userMediaAudio = getStreamAudioTrack(localMedia.userMedia);
            if (userMediaAudio) {
                const enabled = !localMuteSettings.microphone;
                log.set("microphone enabled", enabled);
                userMediaAudio.enabled = enabled;
            }

            // Mute video
            const userMediaVideo = getStreamVideoTrack(localMedia.userMedia);
            if (userMediaVideo) {
                const enabled = !localMuteSettings.camera;
                log.set("camera enabled", enabled);
                userMediaVideo.enabled = enabled;
            }
        });
}

export class MuteSettings {
    constructor (
        private readonly isMicrophoneMuted: boolean = false,
        private readonly isCameraMuted: boolean = false,
        private hasMicrophoneTrack: boolean = false,
        private hasCameraTrack: boolean = false,
    ) {}

    updateTrackInfo(userMedia: Stream | undefined) {
        this.hasMicrophoneTrack = !!getStreamAudioTrack(userMedia);
        this.hasCameraTrack = !!getStreamVideoTrack(userMedia);
    }

    get microphone(): boolean {
        return !this.hasMicrophoneTrack || this.isMicrophoneMuted;
    }

    get camera(): boolean {
        return !this.hasCameraTrack || this.isCameraMuted;
    }

    toggleCamera(): MuteSettings {
        return new MuteSettings(this.microphone, !this.camera, this.hasMicrophoneTrack, this.hasCameraTrack);
    }

    toggleMicrophone(): MuteSettings {
        return new MuteSettings(!this.microphone, this.camera, this.hasMicrophoneTrack, this.hasCameraTrack);
    }

    equals(other: MuteSettings) {
        return this.microphone === other.microphone && this.camera === other.camera;
    }
}

export const CALL_LOG_TYPE = "call";
export const CALL_MEMBER_VALIDITY_PERIOD_MS = 3600 * 1000; // 1h
