/*
Copyright 2025 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import {TemplateView} from "../general/TemplateView";
import {KeyBackupSettingsView} from "../session/settings/KeyBackupSettingsView";

export class AccountSetupView extends TemplateView {
    render(t, vm) {
        return t.div({className: "Settings" /* hack for now to get the layout right*/}, [
            t.h3(vm.i18n`Restore your encrypted history?`),
            t.ifView(vm => vm.decryptDehydratedDeviceViewModel, vm => new KeyBackupSettingsView(vm.decryptDehydratedDeviceViewModel)),
            t.map(vm => vm.deviceDecrypted, (decrypted, t) => {
                if (decrypted) {
                    return t.p(vm.i18n`That worked out, you're good to go!`);
                } else {
                    return t.p(vm.i18n`This will claim the dehydrated device ${vm.dehydratedDeviceId}, and will set up a new one.`);
                }
            }),
            t.div({ className: "button-row" }, [
                t.button({
                    className: "button-action primary",
                    onClick: () => { vm.finish(); },
                    type: "button",
                }, vm => vm.deviceDecrypted ? vm.i18n`Continue` : vm.i18n`Continue without restoring`),
            ]),
        ]);
    }
}
