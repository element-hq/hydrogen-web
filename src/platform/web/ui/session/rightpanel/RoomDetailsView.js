/*
Copyright 2025 New Vector Ltd.
Copyright 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import {TemplateView} from "../../general/TemplateView";
import {classNames, tag} from "../../general/html";
import {AvatarView} from "../../AvatarView.js";

export class RoomDetailsView extends TemplateView {
    render(t, vm) {
        const encryptionString = () => vm.isEncrypted ? vm.i18n`On` : vm.i18n`Off`;
        return t.div({className: "RoomDetailsView"}, [
            t.div({className: "RoomDetailsView_avatar"},
                [
                    t.view(new AvatarView(vm, 52)),
                    t.mapView(vm => vm.isEncrypted, isEncrypted => new EncryptionIconView(isEncrypted))
                ]),
            t.div({className: "RoomDetailsView_name"}, [t.h2(vm => vm.name)]),
            this._createRoomAliasDisplay(vm),
            t.div({className: "RoomDetailsView_rows"},
                [
                    this._createRightPanelButtonRow(t, vm.i18n`People`, { MemberCount: true }, vm => vm.memberCount,
                    () => vm.openPanel("members")),
                    this._createRightPanelRow(t, vm.i18n`Encryption`, {EncryptionStatus: true}, encryptionString)
                ])
        ]);
    }

    _createRoomAliasDisplay(vm) {
        return vm.canonicalAlias ? tag.div({className: "RoomDetailsView_id"}, [vm.canonicalAlias]) :
            "";
    }

    _createRightPanelRow(t, label, labelClass, value) {
        const labelClassString = classNames({RoomDetailsView_label: true, ...labelClass});
        return t.div({className: "RoomDetailsView_row"}, [
            t.div({className: labelClassString}, [label]),
            t.div({className: "RoomDetailsView_value"}, value)
        ]);
    }

    _createRightPanelButtonRow(t, label, labelClass, value, onClick) {
        const labelClassString = classNames({RoomDetailsView_label: true, ...labelClass});
        return t.button({className: "RoomDetailsView_row", onClick}, [
            t.div({className: labelClassString}, [label]),
            t.div({className: "RoomDetailsView_value"}, value)
        ]);
    }

}

class EncryptionIconView extends TemplateView {
    render(t, isEncrypted) {
        return t.div({className: "EncryptionIconView"},
            [t.div({className: isEncrypted ? "EncryptionIconView_encrypted" : "EncryptionIconView_unencrypted"})]);
    }
}
