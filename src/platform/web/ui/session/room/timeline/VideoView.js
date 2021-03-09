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

export class VideoView extends BaseMediaView {
    renderMedia(t, vm) {
        return t.video({
            // provide empty data url if video is not decrypted yet.
            // Chrome/Electron need this to enable the play button.
            src: vm => vm.videoUrl || `data:${vm.mimeType},`,
            title: vm => vm.label,
            controls: true,
            preload: "none",
            poster: vm => vm.thumbnailUrl,
            onPlay: async evt => {
                if (!vm.videoUrl) {
                    await vm.loadVideo();
                    evt.target.play();
                }
            },
            style: `max-width: ${vm.width}px; max-height: ${vm.height}px;`
        });
    }
}
