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

import {TemplateView} from "../../general/TemplateView";
import {Popup} from "../../general/Popup.js";
import {Menu} from "../../general/Menu.js";
import {viewClassForEntry} from "./common"

export class MessageComposer extends TemplateView {
    constructor(viewModel) {
        super(viewModel);
        this._input = null;
        this._attachmentPopup = null;
        this._focusInput = null;
        this._rafResizeHandle = undefined;
    }

    render(t, vm) {
        this._input = t.textarea({
            onKeydown: e => this._onKeyDown(e),
            onInput: () => {
                vm.setInput(this._input.value);
                if (this._input.value) {
                    this._adjustHeight();
                } else {
                    this._clearHeight();
                }
            },
            placeholder: vm => vm.isEncrypted ? "Send an encrypted message…" : "Send a message…",
            rows: "1"
        });
        this._focusInput = () => this._input.focus();
        this.value.on("focus", this._focusInput);
        const replyPreview = t.map(vm => vm.replyViewModel, (rvm, t) => {
            const View = rvm && viewClassForEntry(rvm);
            if (!View) { return null; }
            return t.div({
                    className: "MessageComposer_replyPreview"
                }, [
                    t.span({ className: "replying" }, "Replying"),
                    t.button({
                        className: "cancel",
                        onClick: () => this._clearReplyingTo()
                    }, "Close"),
                t.view(new View(rvm, { interactive: false }, "div"))
                ])
        });
        const input = t.div({className: "MessageComposer_input"}, [
            this._input,
            t.button({
                className: "sendFile",
                title: vm.i18n`Pick attachment`,
                onClick: evt => this._toggleAttachmentMenu(evt),
            }, vm.i18n`Send file`),
            t.button({
                className: "send",
                title: vm.i18n`Send`,
                onClick: () => this._trySend(),
            }, vm.i18n`Send`),
        ]);
        return t.div({ className: {
            MessageComposer: true,
            MessageComposer_canSend: vm => vm.canSend
        } }, [replyPreview, input]);
    }

    unmount() {
        if (this._focusInput) {
            this.value.off("focus", this._focusInput);
        }
        super.unmount();
    }

    _clearReplyingTo() {
        this.value.clearReplyingTo();
    }

    async _trySend() {
        this._input.focus();
        // we clear the composer while enqueuing
        // and restore it when that didn't work somehow
        // to prevent the user from sending the message
        // every time they hit enter while it's still enqueuing.
        const {value} = this._input;
        const restoreValue = () => {
            this._input.value = value;
            this._adjustHeight();
        };
        this._input.value = "";
        this._clearHeight();
        try {
            if (!await this.value.sendMessage(value)) {
                restoreValue();
            }
        } catch (err) {
            restoreValue();
            console.error(err);
        }
    }

    _onKeyDown(event) {
        if (event.key === "Enter" && !event.shiftKey) {
            // don't insert newline into composer
            event.preventDefault();
            this._trySend();
        }
    }

    _toggleAttachmentMenu(evt) {
        if (this._attachmentPopup && this._attachmentPopup.isOpen) {
            this._attachmentPopup.close();
        } else {
            const vm = this.value;
            this._attachmentPopup = new Popup(new Menu([
                Menu.option(vm.i18n`Send video`, () => vm.sendVideo()).setIcon("video"),
                Menu.option(vm.i18n`Send picture`, () => vm.sendPicture()).setIcon("picture"),
                Menu.option(vm.i18n`Send file`, () => vm.sendFile()).setIcon("file"),
            ]));
            this._attachmentPopup.trackInTemplateView(this);
            this._attachmentPopup.showRelativeTo(evt.target, 12);
        }
    }

    _adjustHeight() {
        if (this._rafResizeHandle) {
            return;
        }
        this._rafResizeHandle = window.requestAnimationFrame(() => {
            const scrollHeight = this._input.scrollHeight;
            this._input.style.height = `${scrollHeight}px`;
            this._rafResizeHandle = undefined;
        });
    }

    _clearHeight() {
        this._input.style.removeProperty("height");
    }

}
