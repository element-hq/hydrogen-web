/*
Copyright 2021 Šimon Brandner <simon.bra.ag@gmail.com>
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

import {MediaDevices as IMediaDevices, Stream, Track, TrackKind, VolumeMeasurer} from "../../types/MediaDevices";

const POLLING_INTERVAL = 200; // ms
export const SPEAKING_THRESHOLD = -60; // dB
const SPEAKING_SAMPLE_COUNT = 8; // samples

export class MediaDevicesWrapper implements IMediaDevices {
    constructor(private readonly mediaDevices: MediaDevices) {}

    enumerate(): Promise<MediaDeviceInfo[]> {
        return this.mediaDevices.enumerateDevices();
    }

    async getMediaTracks(audio: true | MediaDeviceInfo, video: boolean | MediaDeviceInfo): Promise<Stream> {
        const stream = await this.mediaDevices.getUserMedia(this.getUserMediaContraints(audio, video));
        stream.addEventListener("removetrack", evt => {
            console.log(`removing track ${evt.track.id} (${evt.track.kind}) from stream ${stream.id}`);
        });
        return stream as Stream;
    }

    async getScreenShareTrack(): Promise<Stream | undefined> {
        const stream = await this.mediaDevices.getDisplayMedia(this.getScreenshareContraints());
        return stream as Stream;
    }

    private getUserMediaContraints(audio: boolean | MediaDeviceInfo, video: boolean | MediaDeviceInfo): MediaStreamConstraints {
        const isWebkit = !!navigator["webkitGetUserMedia"];

        return {
            audio: audio
                ? {
                    deviceId: typeof audio !== "boolean" ? { ideal: audio.deviceId } : undefined,
                }
                : false,
            video: video
                ? {
                    deviceId: typeof video !== "boolean" ? { ideal: video.deviceId } : undefined,
                    /* We want 640x360.  Chrome will give it only if we ask exactly,
                   FF refuses entirely if we ask exactly, so have to ask for ideal
                   instead
                   XXX: Is this still true?
                 */
                    width: isWebkit ? { exact: 640 } : { ideal: 640 },
                    height: isWebkit ? { exact: 360 } : { ideal: 360 },
                }
                : false,
        };
    }

    private getScreenshareContraints(): MediaStreamConstraints {
        return {
            audio: false,
            video: true,
        };
    }

    createVolumeMeasurer(stream: Stream, callback: () => void): VolumeMeasurer {
        return new WebAudioVolumeMeasurer(stream as MediaStream, callback);
    }
}

export class WebAudioVolumeMeasurer implements VolumeMeasurer {
    private measuringVolumeActivity = false;
    private audioContext?: AudioContext;
    private analyser: AnalyserNode;
    private frequencyBinCount: Float32Array;
    private speakingThreshold = SPEAKING_THRESHOLD;
    private speaking = false;
    private volumeLooperTimeout: number;
    private speakingVolumeSamples: number[];
    private callback: () => void;
    private stream: MediaStream;

    constructor(stream: MediaStream, callback: () => void) {
        this.stream = stream;
        this.callback = callback;
        this.speakingVolumeSamples = new Array(SPEAKING_SAMPLE_COUNT).fill(-Infinity);
        this.initVolumeMeasuring();
        this.measureVolumeActivity(true);
    }

    get isSpeaking(): boolean { return this.speaking; }
    /**
     * Starts emitting volume_changed events where the emitter value is in decibels
     * @param enabled emit volume changes
     */
    private measureVolumeActivity(enabled: boolean): void {
        if (enabled) {
            if (!this.audioContext || !this.analyser || !this.frequencyBinCount) return;

            this.measuringVolumeActivity = true;
            this.volumeLooper();
        } else {
            this.measuringVolumeActivity = false;
            this.speakingVolumeSamples.fill(-Infinity);
            this.callback();
            // this.emit(CallFeedEvent.VolumeChanged, -Infinity);
        }
    }

    private initVolumeMeasuring(): void {
        const AudioContext = window.AudioContext || window["webkitAudioContext"] as undefined | typeof window.AudioContext;
        if (!AudioContext) return;

        this.audioContext = new AudioContext();

        this.analyser = this.audioContext.createAnalyser();
        this.analyser.fftSize = 512;
        this.analyser.smoothingTimeConstant = 0.1;

        const mediaStreamAudioSourceNode = this.audioContext.createMediaStreamSource(this.stream);
        mediaStreamAudioSourceNode.connect(this.analyser);

        this.frequencyBinCount = new Float32Array(this.analyser.frequencyBinCount);
    }

    public setSpeakingThreshold(threshold: number) {
        this.speakingThreshold = threshold;
    }

    private volumeLooper = () => {
        if (!this.analyser) return;

        if (!this.measuringVolumeActivity) return;

        this.analyser.getFloatFrequencyData(this.frequencyBinCount);

        let maxVolume = -Infinity;
        for (let i = 0; i < this.frequencyBinCount.length; i++) {
            if (this.frequencyBinCount[i] > maxVolume) {
                maxVolume = this.frequencyBinCount[i];
            }
        }

        this.speakingVolumeSamples.shift();
        this.speakingVolumeSamples.push(maxVolume);

        this.callback();
        // this.emit(CallFeedEvent.VolumeChanged, maxVolume);

        let newSpeaking = false;

        for (let i = 0; i < this.speakingVolumeSamples.length; i++) {
            const volume = this.speakingVolumeSamples[i];

            if (volume > this.speakingThreshold) {
                newSpeaking = true;
                break;
            }
        }

        if (this.speaking !== newSpeaking) {
            this.speaking = newSpeaking;
            this.callback();
            // this.emit(CallFeedEvent.Speaking, this.speaking);
        }

        this.volumeLooperTimeout = setTimeout(this.volumeLooper, POLLING_INTERVAL) as unknown as number;
    };

    public stop(): void {
        clearTimeout(this.volumeLooperTimeout);
        this.analyser.disconnect();
        this.audioContext?.close();
    }
}
