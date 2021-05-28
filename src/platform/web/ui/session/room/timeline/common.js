/*
Copyright 2020 Bruno Windels <bruno@windels.cloud>
Copyright 2020 The Matrix.org Foundation C.I.C.

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

import {renderStaticAvatar} from "../../../avatar.js";

export function renderMessage(t, vm, body) {
    const classes = {
        "Timeline_message": true,
        own: vm.isOwn,
        unsent: vm.isUnsent,
        unverified: vm.isUnverified,
        continuation: vm => vm.isContinuation,
    };
    return t.li({className: classes}, [
        t.if(vm => !vm.isContinuation, t => renderStaticAvatar(vm, 30, "Timeline_messageAvatar")),
        t.if(vm => !vm.isContinuation, t => t.div({className: `Timeline_messageSender usercolor${vm.avatarColorNumber}`}, vm.displayName)),
        body,
        // should be after body as it is overlayed on top
        t.button({className: "Timeline_messageOptions"}, "⋯"),
    ]);
}
