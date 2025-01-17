/*
Copyright 2025 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import {Builder, TemplateView} from "../../../general/TemplateView";
import type {CallTile} from "../../../../../../domain/session/room/timeline/tiles/CallTile";
import {ErrorView} from "../../../general/ErrorView";
import {ListView} from "../../../general/ListView";
import {AvatarView} from "../../../AvatarView";

export class CallTileView extends TemplateView<CallTile> {
    render(t: Builder<CallTile>, vm: CallTile) {
        return t.li(
            {className: "CallTileView AnnouncementView"},
            t.div(
            [
                t.if(vm => vm.errorViewModel, t => {
                    return t.div({className: "CallTileView_error"}, t.view(new ErrorView(vm.errorViewModel, {inline: true})));
                }),
                t.div([
                    t.div({className: "CallTileView_title"}, vm => vm.title),
                    t.div({className: "CallTileView_subtitle"}, [
                        vm.typeLabel, " • ",
                        t.span({className: "CallTileView_memberCount"}, vm => vm.memberCount)
                    ]),
                    t.view(new ListView({className: "CallTileView_members", tagName: "div", list: vm.memberViewModels}, vm => {
                        return new AvatarView(vm, 24);
                    })),
                    t.div(vm => vm.duration),
                    t.div([
                        t.button({className: "CallTileView_join button-action primary", hidden: vm => !vm.canJoin}, "Join"),
                        t.button({className: "CallTileView_leave button-action primary destructive", hidden: vm => !vm.canLeave}, "Leave")
                    ])
                ])
            ])
        );
    }
    
    /* This is called by the parent ListView, which just has 1 listener for the whole list */
    onClick(evt) {
        if (evt.target.classList.contains("CallTileView_join")) {
            this.value.join();
        } else if (evt.target.classList.contains("CallTileView_leave")) {
            this.value.leave();
        }
    }
}
