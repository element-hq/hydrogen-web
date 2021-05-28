/*
Copyright 2020 Bruno Windels <bruno@windels.cloud>
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

import {renderStaticAvatar} from "../../../avatar.js";
import {TemplateView} from "../../../general/TemplateView.js";
import {Popup} from "../../../general/Popup.js";
import {Menu} from "../../../general/Menu.js";

export class BaseMessageView extends TemplateView {
    constructor(value) {
        super(value);
        this._menuPopup = null;
    }

    render(t, vm) {
        const classes = {
            "Timeline_message": true,
            own: vm.isOwn,
            unsent: vm.isUnsent,
            unverified: vm.isUnverified,
            continuation: vm => vm.isContinuation,
        };
        return t.li({className: classes}, [
            t.if(vm => !vm.isContinuation, () => renderStaticAvatar(vm, 30, "Timeline_messageAvatar")),
            t.if(vm => !vm.isContinuation, t => t.div({className: `Timeline_messageSender usercolor${vm.avatarColorNumber}`}, vm.displayName)),
            this.renderMessageBody(t, vm),
            // should be after body as it is overlayed on top
            t.button({className: "Timeline_messageOptions"}, "⋯"),
        ]);   
    }

    /* This is called by the parent ListView, which just has 1 listener for the whole list */
    onClick(evt) {
        if (evt.target.className === "Timeline_messageOptions") {
            this._toggleMenu(evt.target);
        }
    }

    _toggleMenu(button) {
        if (this._menuPopup && this._menuPopup.isOpen) {
            this._menuPopup.close();
        } else {
            const options = this.createMenuOptions(this.value);
            if (!options.length) {
                return;
            }
            this.root().classList.add("menuOpen");
            const onClose = () => this.root().classList.remove("menuOpen");
            this._menuPopup = new Popup(new Menu(options), onClose);
            this._menuPopup.trackInTemplateView(this);
            this._menuPopup.showRelativeTo(button, {
                horizontal: {
                    relativeTo: "end",
                    align: "start",
                    after: 0
                },
                vertical: {
                    relativeTo: "start",
                    align: "end",
                    before: -24
                }
            });
        }
    }

    createMenuOptions(vm) {
        const options = [];
        if (vm.isPending) {
            options.push(Menu.option(vm.i18n`Cancel`, () => vm.abortSending()));
        } else if (vm.shape !== "redacted") {
            options.push(Menu.option(vm.i18n`Delete`, () => vm.redact()).setDestructive());
        }
        return options;
    }

    renderMessageBody() {}
}
