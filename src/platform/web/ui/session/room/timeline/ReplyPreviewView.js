/*
Copyright 2021 The Matrix.org Foundation C.I.C.

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

import {renderStaticAvatar} from "../../../avatar";
import {tag} from "../../../general/html";
import {TemplateView} from "../../../general/TemplateView";
import {FileView} from "./FileView";
import {ImageView} from "./ImageView";
import {RedactedView} from "./RedactedView";
import {TextMessageView} from "./TextMessageView.js";
import {VideoView} from "./VideoView";

export class ReplyPreviewView extends TemplateView {
    render(t, vm) {
        return t.div({ className: "ReplyPreviewView" }, this._renderReplyPreview(t, vm));
    }

    _renderReplyPreview(t, vm) {
        const view = this._viewFromViewModel(vm);
        const rendered = this._renderContent(t, vm, view);
        return this._renderReplyHeader(vm, [rendered]);
    }

    _renderContent(t, vm, view) {
        switch (vm.shape) {
            case "image":
            case "video":
                return view.renderMedia(t, vm);
            default:
                return view.renderMessageBody(t, vm);
        }
    }

    _viewFromViewModel(vm) {
        if (vm.isRedacted) {
            return new RedactedView(vm);
        }
        const shape = vm.shape;
        switch (shape) {
            case "image":
                return new ImageView(vm);
            case "video":
                return new VideoView(vm);
            case "file":
                return new FileView(vm);
            case "message":
            case "message-status":
                return new TextMessageView(vm);
        }
    }

    _renderReplyHeader(vm, children = []) {
        return tag.blockquote(
            [
            tag.a({ className: "link", href: `https://matrix.to/#/${vm.roomId}/${vm.eventId}` }, "In reply to"),
            tag.a({ className: "pill", href: `https://matrix.to/#/${vm.sender}` }, [renderStaticAvatar(vm, 12, undefined, true), vm.displayName]),
            tag.br(),
            ...children
        ]);
    }
}
