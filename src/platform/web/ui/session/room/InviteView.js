/*
Copyright 2025 New Vector Ltd.
Copyright 2020 Bruno Windels <bruno@windels.cloud>
Copyright 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import {TemplateView} from "../../general/TemplateView";
import {renderStaticAvatar} from "../../avatar";

export class InviteView extends TemplateView {
    render(t, vm) {
        let inviteNodes = [];
        if (vm.isDirectMessage) {
            inviteNodes.push(renderStaticAvatar(vm, 128, "InviteView_dmAvatar"));
        }
        let inviterNodes;
        if (vm.isDirectMessage) {
            inviterNodes = [t.strong(vm.name), ` (${vm.inviter?.id}) wants to chat with you.`];
        } else if (vm.inviter) {
            inviterNodes = [renderStaticAvatar(vm.inviter, 24), t.strong(vm.inviter.name), ` (${vm.inviter.id}) invited you.`];
        } else {
            inviterNodes = `You were invited to join.`;
        }
        inviteNodes.push(t.p({className: "InviteView_inviter"}, inviterNodes));
        if (!vm.isDirectMessage) {
            inviteNodes.push(t.div({className: "InviteView_roomProfile"}, [
                renderStaticAvatar(vm, 64, "InviteView_roomAvatar"),
                t.h3(vm.name),
                t.p({className: "InviteView_roomDescription"}, vm.roomDescription)
            ]));
        }

        return t.main({className: "InviteView middle"}, [
            t.div({className: "RoomHeader middle-header"}, [
                t.a({className: "button-utility close-middle", href: vm.closeUrl, title: vm.i18n`Close invite`}),
                renderStaticAvatar(vm, 32),
                t.div({className: "room-description"}, [
                    t.h2(vm => vm.name),
                ]),
            ]),
            t.if(vm => vm.error, t => t.div({className: "RoomView_error"}, vm => vm.error)),
            t.div({className: "InviteView_body"}, [
                t.div({className: "InviteView_invite"}, [
                    ...inviteNodes,
                    t.div({className: "InviteView_buttonRow"},
                        t.button({
                            className: "button-action primary",
                            disabled: vm => vm.busy,
                            onClick: () => vm.accept()
                        }, vm.i18n`Accept`)
                    ),
                    t.div({className: "InviteView_buttonRow"},
                        t.button({
                            className: "button-action primary destructive",
                            disabled: vm => vm.busy,
                            onClick: () => vm.reject()
                        }, vm.i18n`Reject`)
                    ),
                ])
            ])
        ]);
    }
}
