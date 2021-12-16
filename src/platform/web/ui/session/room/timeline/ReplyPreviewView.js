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
import {TextMessageView} from "./TextMessageView.js";
import {VideoView} from "./VideoView";

export class ReplyPreviewView extends TemplateView {
    render(t, vm) {
        const replyContainer = t.div({ className: "ReplyPreviewView" }, [
            vm.isRedacted
                ? this._renderRedaction(vm)
                : this._renderReplyPreview(t, vm),
        ]);
        return replyContainer;
    }

    _renderRedaction(vm) {
        const children = [tag.span({ className: "statusMessage" }, vm.description), tag.br()];
        const reply = this._renderReplyHeader(vm, children);
        return reply;
    }

    _renderReplyPreview(t, vm) {
        let reply;
        switch (vm.shape) {
            case "image":
            case "video":
                reply = this._renderMediaPreview(t, vm);
                break;
            default:
                reply = this._renderPreview(t, vm);
                break;
        }
        return reply;
    }

    _renderPreview(t, vm) {
        const view = this._viewFromShape(vm);
        const rendered = view.renderMessageBody(t, vm);
        return this._renderReplyHeader(vm, [rendered]);
    }

    _renderMediaPreview(t, vm) {
        const view = this._viewFromShape(vm);
        const rendered = view.renderMedia(t, vm);
        return this._renderReplyHeader(vm, [rendered]);
    }

    _viewFromShape(vm) {
        const shape = vm.shape;
        switch (shape) {
            case "image":
                return new ImageView(vm);
            case "video":
                return new VideoView(vm);
            case "file":
                return new FileView(vm);
            case "message":
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
