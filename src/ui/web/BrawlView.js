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

import {SessionView} from "./session/SessionView.js";
import {LoginView} from "./login/LoginView.js";
import {SessionPickerView} from "./login/SessionPickerView.js";
import {TemplateView} from "./general/TemplateView.js";
import {SwitchView} from "./general/SwitchView.js";

export class BrawlView {
    constructor(vm) {
        this._vm = vm;
        this._switcher = null;
        this._root = null;
        this._onViewModelChange = this._onViewModelChange.bind(this);
    }

    _getView() {
        switch (this._vm.activeSection) {
            case "error":
                return new StatusView({header: "Something went wrong", message: this._vm.errorText});
            case "session":
                return new SessionView(this._vm.sessionViewModel);
            case "login":
                return new LoginView(this._vm.loginViewModel);
            case "picker":
                return new SessionPickerView(this._vm.sessionPickerViewModel);
            default:
                throw new Error(`Unknown section: ${this._vm.activeSection}`);
        }
    }

    _onViewModelChange(prop) {
        if (prop === "activeSection") {
            this._switcher.switch(this._getView());
        }
    }

    mount() {
        this._switcher = new SwitchView(this._getView());
        this._root = this._switcher.mount();
        this._vm.on("change", this._onViewModelChange);
        return this._root;
    }

    unmount() {
        this._vm.off("change", this._onViewModelChange);
        this._switcher.unmount();
    }

    root() {
        return this._root;
    }

    update() {}
}

class StatusView extends TemplateView {
    render(t, vm) {
        return t.div({className: "StatusView"}, [
            t.h1(vm.header),
            t.p(vm.message),
        ]);
    }
}
