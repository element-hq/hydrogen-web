/*
Copyright 2025 New Vector Ltd.
Copyright 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
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
