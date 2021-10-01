/*
Copyright 2020 Bruno Windels <bruno@windels.cloud>

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

import {ListView} from "../general/ListView";
import {TemplateView} from "../general/TemplateView";
import {hydrogenGithubLink} from "./common.js";
import {SessionLoadStatusView} from "./SessionLoadStatusView.js";

function selectFileAsText(mimeType) {
    const input = document.createElement("input");
    input.setAttribute("type", "file");
    if (mimeType) {
        input.setAttribute("accept", mimeType);
    }
    const promise = new Promise((resolve, reject) => {
        const checkFile = () => {
            input.removeEventListener("change", checkFile, true);
            const file = input.files[0];
            if (file) {
                resolve(file.text());
            } else {
                reject(new Error("No file selected"));
            }
        }
        input.addEventListener("change", checkFile, true);
    });
    input.click();
    return promise;
}



class SessionPickerItemView extends TemplateView {
    _onDeleteClick() {
        if (confirm("Are you sure?")) {
            this.value.delete();
        }
    }

    _onClearClick() {
        if (confirm("Are you sure?")) {
            this.value.clear();
        }
    }

    render(t, vm) {
        const deleteButton = t.button({
            className: "destructive",
            disabled: vm => vm.isDeleting,
            onClick: this._onDeleteClick.bind(this),
        }, "Sign Out");
        const clearButton = t.button({
            disabled: vm => vm.isClearing,
            onClick: this._onClearClick.bind(this),
        }, "Clear");
        const exportButton = t.button({
            disabled: vm => vm.isClearing,
            onClick: () => vm.export(),
        }, "Export");
        const downloadExport = t.if(vm => vm.exportDataUrl, (t, vm) => {
            return t.a({
                href: vm.exportDataUrl,
                download: `brawl-session-${vm.id}.json`,
                onClick: () => setTimeout(() => vm.clearExport(), 100),
            }, "Download");
        });
        const errorMessage = t.if(vm => vm.error, t => t.p({className: "error"}, vm => vm.error));
        return t.li([
            t.a({className: "session-info", href: vm.openUrl}, [
                t.div({className: `avatar usercolor${vm.avatarColorNumber}`}, vm => vm.avatarInitials),
                t.div({className: "user-id"}, vm => vm.label),
            ]),
            t.div({className: "session-actions"}, [
                deleteButton,
                exportButton,
                downloadExport,
                clearButton,
            ]),
            errorMessage
        ]);
    }
}

export class SessionPickerView extends TemplateView {
    render(t, vm) {
        const sessionList = new ListView({
            list: vm.sessions,
            parentProvidesUpdates: false,
        }, sessionInfo => {
            return new SessionPickerItemView(sessionInfo);
        });

        return t.div({className: "PreSessionScreen"}, [
            t.div({className: "logo"}),
            t.div({className: "SessionPickerView"}, [
                t.h1(["Continue as …"]),
                t.view(sessionList),
                t.div({className: "button-row"}, [
                    t.button({
                        className: "button-action secondary",
                        onClick: async () => vm.import(await selectFileAsText("application/json"))
                    }, vm.i18n`Import a session`),
                    t.a({
                        className: "button-action primary",
                        href: vm.cancelUrl
                    }, vm.i18n`Sign In`)
                ]),
                t.ifView(vm => vm.loadViewModel, () => new SessionLoadStatusView(vm.loadViewModel)),
                t.p(hydrogenGithubLink(t))
            ])
        ]);
    }
}
