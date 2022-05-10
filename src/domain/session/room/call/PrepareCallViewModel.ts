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

import {AvatarSource} from "../../../AvatarSource";
import {ViewModel, Options as BaseOptions} from "../../../ViewModel";
import {getStreamVideoTrack, getStreamAudioTrack} from "../../../../matrix/calls/common";
import {avatarInitials, getIdentifierColorNumber, getAvatarHttpUrl} from "../../../avatar";
import {EventObservableValue} from "../../../../observable/value/EventObservableValue";
import {ObservableValueMap} from "../../../../observable/map/ObservableValueMap";
import type {GroupCall} from "../../../../matrix/calls/group/GroupCall";
import type {Member} from "../../../../matrix/calls/group/Member";
import type {BaseObservableList} from "../../../../observable/list/BaseObservableList";
import type {BaseObservableMap} from "../../../../observable/map/BaseObservableMap";
import type {Stream, VolumeMeasurer, MediaDevices} from "../../../../platform/types/MediaDevices";
import type {MediaRepository} from "../../../../matrix/net/MediaRepository";
import type {Options as CallViewModelOptions} from "./CallViewModel";

type Options = Omit<CallViewModelOptions, "call"> & {
    call?: GroupCall
};

export class PrepareCallViewModel extends ViewModel<Options> {
    private _availableVideoDevices?: BaseObservableList<VideoDeviceViewModel>;
    private _availableAudioDevices?: BaseObservableList<AudioDeviceViewModel>;
    private _audioDevice?: AudioDeviceViewModel;
    private _videoDevice?: VideoDeviceViewModel;

    async init() {
        const devices = await (this.platform.mediaDevices as MediaDevices).observeDevices();
        const sortByNameAndId = (a: BaseDeviceViewModel, b: BaseDeviceViewModel) => {
            const labelCmp = a.label.localeCompare(b.label);
            if (labelCmp === 0) {
                return a.deviceId.localeCompare(b.deviceId);
            } else {
                return labelCmp;
            }
        };
        this._availableAudioDevices = devices
            .filterValues(v => v.kind === "videoinput")
            .mapValues((device, emitChange) => {
                const vm = new VideoDeviceViewModel(this.childOptions({device, emitChange}));
                vm.init();
                return vm;
            }).sortValues(sortByNameAndId);
        this._availableAudioDevices = devices
            .filterValues(v => v.kind === "audioinput")
            .mapValues((device, emitChange) => {
                const vm = new AudioDeviceViewModel(this.childOptions({device, emitChange}));
                vm.init();
                return vm;
            }).sortValues(sortByNameAndId);
    }

    get availableVideoDevices(): BaseObservableList<VideoDeviceViewModel> | undefined {
        return this._availableVideoDevices;
    }

    get availableAudioDevices(): BaseObservableList<AudioDeviceViewModel> | undefined {
        return this._availableAudioDevices;
    }

    get videoDevice() : DeviceViewModel | undefined {

    }

    setVideoDeviceId(deviceId: string) {
        this.videoDevice = this._availableVideoDevices.get(deviceId);
    }

    get audioDevice() : DeviceViewModel | undefined {

    }
}

type DeviceOptions = BaseOptions & {
    device: MediaDeviceInfo,
}

class BaseDeviceViewModel extends ViewModel<DeviceOptions> {
    get label(): string { return this.options.device.label; }
    get deviceId(): string { return this.options.device.deviceId; }
}

class VideoDeviceViewModel extends BaseDeviceViewModel {
    private _stream: Stream;

    async init() {
        try {
            this._stream = await (this.platform.mediaDevices as MediaDevices).getMediaTracks(false, {deviceId: this.deviceId});
            this.track(() => getStreamVideoTrack(this._stream)?.stop());
        } catch (err) {}
    }

    get stream(): Stream {
        return this._stream;
    }
}

class AudioDeviceViewModel extends BaseDeviceViewModel {
    private volumeMeasurer?: VolumeMeasurer;

    async init() {
        try {
            const stream = await (this.platform.mediaDevices as MediaDevices).getMediaTracks({deviceId: this.deviceId}, false);
            this.track(() => getStreamAudioTrack(stream)?.stop());
            this.volumeMeasurer = this.track((this.platform.mediaDevices as MediaDevices).createVolumeMeasurer(stream, () => {
                this.emitChange("volume");
            }));
        } catch (err) {}
    }

    get volume(): number {
        return this.volumeMeasurer?.volume ?? 0;
    }
}
