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

import {SimpleTile} from "./SimpleTile.js";
import {LocalMedia} from "../../../../../matrix/calls/LocalMedia";

// TODO: timeline entries for state events with the same state key and type
// should also update previous entries in the timeline, so we can update the name of the call, whether it is terminated, etc ...

// alternatively, we could just subscribe to the GroupCall and spontanously emit an update when it updates

export class CallTile extends SimpleTile {
    
    get shape() {
        return "call";
    }

    get name() {
        return this._entry.content["m.name"];
    }

    get _call() {
        const calls = this.getOption("session").callHandler.calls;
        return calls.get(this._entry.stateKey);
    }

    async join() {
        const call = this._call;
        if (call) {
            const mediaTracks = await this.platform.mediaDevices.getMediaTracks(false, true);
            const localMedia = new LocalMedia().withTracks(mediaTracks);
            await call.join(localMedia);
        }
    }
}
