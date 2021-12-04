/*
Copyright 2020 The Matrix.org Foundation C.I.C.

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

import {TemplateView} from "../../general/TemplateView";
import {StaticView} from "../../general/StaticView.ts";

export class SessionBackupSettingsView extends TemplateView {
    render(t, vm) {
        return t.mapView(vm => vm.status, status => {
            switch (status) {
                case "Enabled": return new TemplateView(vm, renderEnabled)
                case "SetupKey": return new TemplateView(vm, renderEnableFromKey)
                case "SetupPhrase": return new TemplateView(vm, renderEnableFromPhrase)
                case "Pending": return new StaticView(vm, t => t.p(vm.i18n`Waiting to go online…`))
            }
        });
    }
}

function renderEnabled(t, vm) {
    const items = [
        t.p([vm.i18n`Session backup is enabled, using backup version ${vm.backupVersion}. `, t.button({onClick: () => vm.disable()}, vm.i18n`Disable`)])
    ];
    if (vm.dehydratedDeviceId) {
        items.push(t.p(vm.i18n`A dehydrated device id was set up with id ${vm.dehydratedDeviceId} which you can use during your next login with your secret storage key.`));
    }
    return t.div(items);
}

function renderEnableFromKey(t, vm) {
    const useASecurityPhrase = t.button({className: "link", onClick: () => vm.showPhraseSetup()}, vm.i18n`use a security phrase`);
    return t.div([
        t.p(vm.i18n`Enter your secret storage security key below to ${vm.purpose}, which will enable you to decrypt messages received before you logged into this session. The security key is a code of 12 groups of 4 characters separated by a space that Element created for you when setting up security.`),
        renderError(t),
        renderEnableFieldRow(t, vm, vm.i18n`Security key`, (key, setupDehydratedDevice) => vm.enterSecurityKey(key, setupDehydratedDevice)),
        t.p([vm.i18n`Alternatively, you can `, useASecurityPhrase, vm.i18n` if you have one.`]),
    ]);
}

function renderEnableFromPhrase(t, vm) {
    const useASecurityKey = t.button({className: "link", onClick: () => vm.showKeySetup()}, vm.i18n`use your security key`);
    return t.div([
        t.p(vm.i18n`Enter your secret storage security phrase below to ${vm.purpose}, which will enable you to decrypt messages received before you logged into this session. The security phrase is a freeform secret phrase you optionally chose when setting up security in Element. It is different from your password to login, unless you chose to set them to the same value.`),
        renderError(t),
        renderEnableFieldRow(t, vm, vm.i18n`Security phrase`, (phrase, setupDehydratedDevice) => vm.enterSecurityPhrase(phrase, setupDehydratedDevice)),
        t.p([vm.i18n`You can also `, useASecurityKey, vm.i18n`.`]),
    ]);
}

function renderEnableFieldRow(t, vm, label, callback) {
    let setupDehydrationCheck;
    const eventHandler = () => callback(input.value, setupDehydrationCheck?.checked || false);
    const input = t.input({type: "password", disabled: vm => vm.isBusy, placeholder: label});
    const children = [
        t.p([
            input,
            t.button({disabled: vm => vm.isBusy, onClick: eventHandler}, vm.decryptAction),
        ]),
    ];
    if (vm.offerDehydratedDeviceSetup) {
        setupDehydrationCheck = t.input({type: "checkbox", id:"enable-dehydrated-device"});
        const moreInfo = t.a({href: "https://github.com/uhoreg/matrix-doc/blob/dehydration/proposals/2697-device-dehydration.md", target: "_blank", rel: "noopener"}, "more info");
        children.push(t.p([
            setupDehydrationCheck,
            t.label({for: setupDehydrationCheck.id}, [vm.i18n`Back up my device as well (`, moreInfo, ")"])
        ]));
    }
    return t.div({className: `row`}, [
        t.div({className: "label"}, label),
        t.div({className: "content"}, children),
    ]);
}

function renderError(t) {
    return t.if(vm => vm.error, (t, vm) => {
        return t.div([
            t.p({className: "error"}, vm => vm.i18n`Could not enable session backup: ${vm.error}.`),
            t.p(vm.i18n`Try double checking that you did not mix up your security key, security phrase and login password as explained above.`)
        ])
    });
}

