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
import {renderPart} from "./TextMessageView.js";

export class ReplyPreviewView extends TemplateView {
    render(t, vm) {
        const replyContainer = t.div({className: "ReplyPreviewView"});
        t.mapSideEffect(vm => vm.body, () => {
            while (replyContainer.lastChild) {
                replyContainer.removeChild(replyContainer.lastChild);
            }
            replyContainer.appendChild(vm.error? this._renderError(vm) : this._renderReplyPreview(vm));
        })
        return replyContainer;
    }

    _renderError({ error, avatar, senderName }) {
        const errorMessage = this._getErrorMessage(error);
        const children = [tag.span({ className: "statusMessage" }, errorMessage), tag.br()];
        const reply = avatar && senderName ? this._renderReplyHeader(avatar, senderName, children) :
                                             tag.blockquote(children);
        return reply;
    }

    _getErrorMessage(error) {
        switch (error.name) {
            case "ContextEntryNotFound":
            case "MissingBody":
                return "This message could not be fetched.";
            case "MessageRedacted":
                return "This message has been deleted.";
            default:
                return error.message;
        }
    }

    _renderReplyPreview(vm) {
        const reply = this._renderReplyHeader(vm);
        const body = vm.body;
        for (const part of body.parts) {
            reply.appendChild(renderPart(part));
        }
        return reply;
    }

    _renderReplyHeader(vm, children = []) {
        return tag.blockquote(
            [
            tag.a({ className: "link", href: "#" }, "In reply to"),
            tag.a({ className: "pill", href: "#" }, [renderStaticAvatar(vm, 12, undefined, true), vm.displayName]),
            tag.br(),
            ...children
        ]);
    }
}
