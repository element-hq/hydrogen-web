/*
Copyright 2025 New Vector Ltd.
Copyright 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import {AvatarView} from "../../AvatarView.js";
import {TemplateView} from "../../general/TemplateView";

export class MemberDetailsView extends TemplateView {
    render(t, vm) {
        const securityNodes = [
            t.p(vm.isEncrypted ?
                vm.i18n`Messages in this room are end-to-end encrypted.` :
                vm.i18n`Messages in this room are not end-to-end encrypted.`),
        ]

        if (vm.features.crossSigning) {
            securityNodes.push(t.div({className: "MemberDetailsView_shield_container"}, [
                t.span({className: vm => `MemberDetailsView_shield_${vm.trustShieldColor}`}),
                t.p({className: "MemberDetailsView_shield_description"}, vm => vm.trustDescription)
            ]));
        }

        return t.div({className: "MemberDetailsView"},
            [   t.view(new AvatarView(vm, 128)),
                t.div({className: "MemberDetailsView_name"}, t.h2(vm => vm.name)),
                t.div({className: "MemberDetailsView_id"}, vm.userId),
                this._createSection(t, vm.i18n`Role`, vm => vm.role),
                this._createSection(t, vm.i18n`Security`, securityNodes),
                this._createOptions(t, vm)
            ]);
    }

    _createSection(t, label, value) {
        return t.div({ className: "MemberDetailsView_section" },
            [
                t.div({className: "MemberDetailsView_label"}, label),
                t.div({className: "MemberDetailsView_value"}, value)
            ]);
    }

    _createOptions(t, vm) {
        const options = [
            t.a({href: vm.linkToUser, target: "_blank", rel: "noopener"}, vm.i18n`Open Link to User`),
            t.button({className: "text", onClick: () => vm.openDirectMessage()}, vm.i18n`Open direct message`)
        ];
        if (vm.features.crossSigning) {
            if (vm.canVerifyUser) {
                options.push(t.button({ className: "text", onClick: () => vm.verifyUser() }, vm.i18n`Verify`));
            }
            const onClick = () => {
                if (confirm("You don't want to do this with any account but a test account. This will cross-sign this user without verifying their keys first. You won't be able to undo this apart from resetting your cross-signing keys.")) {
                    vm.signUser();
                }
            };
            options.push(t.button({className: "text", onClick}, vm.i18n`Cross-sign user (DO NOT USE, TESTING ONLY)`))
        }
        return t.div({ className: "MemberDetailsView_section" },
            [
                t.div({className: "MemberDetailsView_label"}, vm.i18n`Options`),
                t.div({className: "MemberDetailsView_options"}, options)
            ]);
    }
}
