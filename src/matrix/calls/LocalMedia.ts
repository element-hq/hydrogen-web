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
import {getStreamVideoTrack, getStreamAudioTrack} from "./common";

export class LocalMedia {

    constructor(
        public readonly userMedia?: Stream,
        public readonly screenShare?: Stream,
        public readonly dataChannelOptions?: RTCDataChannelInit,
    ) {}

    withUserMedia(stream: Stream) {
        return new LocalMedia(stream, this.screenShare?.clone(), this.dataChannelOptions);
    }

    withScreenShare(stream: Stream) {
        return new LocalMedia(this.userMedia?.clone(), stream, this.dataChannelOptions);
    }

    withDataChannel(options: RTCDataChannelInit): LocalMedia {
        return new LocalMedia(this.userMedia?.clone(), this.screenShare?.clone(), options);
    }

    /**
     * Create an instance of LocalMedia without audio track (for user preview)
     */
    asPreview(): LocalMedia {
        const media = this.clone();
        const userMedia = media.userMedia;
        if (userMedia && userMedia.getVideoTracks().length > 0) {
            const audioTrack = getStreamAudioTrack(userMedia);
            if (audioTrack) {
                audioTrack.stop();
                userMedia.removeTrack(audioTrack);
            }
        }
        return media;
    }

    /** @internal */
    replaceClone(oldClone: LocalMedia | undefined, oldOriginal: LocalMedia | undefined): LocalMedia {
        const cloneOrAdoptStream = (oldOriginalStream: Stream | undefined, oldCloneStream: Stream | undefined, newStream: Stream | undefined): Stream | undefined => {
            let stream;
            if (oldOriginalStream?.id === newStream?.id) {
                return oldCloneStream;
            } else {
                return newStream?.clone();
            }
        }
        return new LocalMedia(
            cloneOrAdoptStream(oldOriginal?.userMedia, oldClone?.userMedia, this.userMedia),
            cloneOrAdoptStream(oldOriginal?.screenShare, oldClone?.screenShare, this.screenShare),
            this.dataChannelOptions
        );
    }

    /** @internal */
    clone(): LocalMedia {
        return new LocalMedia(this.userMedia?.clone(),this.screenShare?.clone(), this.dataChannelOptions);
    }
    
    dispose() {
        getStreamAudioTrack(this.userMedia)?.stop();
        getStreamVideoTrack(this.userMedia)?.stop();
        getStreamVideoTrack(this.screenShare)?.stop();
    }
}
