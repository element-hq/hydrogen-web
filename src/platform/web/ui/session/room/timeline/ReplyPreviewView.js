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
import {TemplateView} from "../../../general/TemplateView";

export class ReplyPreviewView extends TemplateView {
    constructor(vm, viewClassForTile) {
        super(vm);
        this._viewClassForTile = viewClassForTile;
    }
    render(t, vm) {
        const TileView = this._viewClassForTile(vm);
        if (!TileView) {
            throw new Error(`Shape ${vm.shape} is unrecognized.`)
        }
        const view = new TileView(vm, this._viewClassForTile, { reply: true, interactive: false });
        return t.div(
            { className: "ReplyPreviewView" },
            t.blockquote([
                t.a({ className: "link", target: "_blank", href: vm.permaLink }, "In reply to"),
                t.a({ className: "pill", target: "_blank", href: vm.senderProfileLink }, [
                    renderStaticAvatar(vm, 12, undefined, true),
                    vm.displayName,
                ]),
                t.br(),
                t.view(view),
            ])
        );
    }
}

export class ReplyPreviewError extends TemplateView {
    render(t) {
        return t.blockquote({ className: "ReplyPreviewView" }, [
            t.div({ className: "Timeline_messageBody statusMessage" }, "This reply could not be found.")
        ]);
    }
}
