/*
Copyright 2020 Bruno Windels <bruno@windels.cloud>

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

import {BaseMediaView} from "./BaseMediaView.js";
import {domEventAsPromise} from "../../../../dom/utils";

export class VideoView extends BaseMediaView {
    renderMedia(t) {
        const video = t.video({
            // provide empty data url if video is not decrypted yet.
            // Chrome/Electron need this to enable the play button.
            src: vm => vm.videoUrl || `data:${vm.mimeType},`,
            title: vm => vm.label,
            controls: true,
            preload: "none",
            poster: vm => vm.thumbnailUrl,
            onPlay: this._onPlay.bind(this),
            style: vm => `max-width: ${vm.width}px; max-height: ${vm.height}px;${vm.isPending ? "z-index: -1": ""}`
        });

        video.addEventListener("error", this._onError.bind(this));

        return video;
    }

    async _onPlay(evt) {
        const vm = this.value;
        // download and decrypt the video if needed,
        if (!vm.videoUrl) {
            try {
                const video = evt.target;
                // this will trigger the src to update
                await vm.loadVideo();
                // important to only listen for this after src has changed,
                // or we get the error for the placeholder data url
                const loadPromise = domEventAsPromise(video, "loadeddata");
                // now, reload the video and play
                video.load();
                await loadPromise;
                video.play();
            } catch (err) {/* errors are already caught in error event handler */}
        }  
    }

    _onError(evt) {
        const vm = this.value;
        const video = evt.target;
        const err = video.error;
        if (err instanceof window.MediaError && err.code === 4) {
            if (!video.src.startsWith("data:")) {
                vm.setViewError(new Error(`this browser does not support videos of type ${vm.mimeType}.`));
            } else {
                // ignore placeholder url failing to load
                return;
            }
        } else {
            vm.setViewError(err);
        }
    }
}
