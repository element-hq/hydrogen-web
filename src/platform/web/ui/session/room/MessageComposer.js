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

import {TemplateView} from "../../general/TemplateView.js";

export class MessageComposer extends TemplateView {
    constructor(viewModel) {
        super(viewModel);
        this._input = null;
    }

    render(t, vm) {
        this._input = t.input({
            placeholder: vm.isEncrypted ? "Send an encrypted message…" : "Send a message…",
            onKeydown: e => this._onKeyDown(e),
            onInput: () => vm.setInput(this._input.value),
        });
        return t.div({className: "MessageComposer"}, [
            this._input,
            t.button({
                className: "sendFile",
                title: vm.i18n`Send file`,
                onClick: () => vm.sendAttachment(),
            }, vm.i18n`Send file`),
            t.button({
                className: "send",
                title: vm.i18n`Send`,
                disabled: vm => !vm.canSend,
                onClick: () => this._trySend(),
            }, vm.i18n`Send`),
        ]);
    }

    _trySend() {
        this._input.focus();
        if (this.value.sendMessage(this._input.value)) {
            this._input.value = "";
        }
    }

    _onKeyDown(event) {
        if (event.key === "Enter") {
            this._trySend();
        }
    }
}
