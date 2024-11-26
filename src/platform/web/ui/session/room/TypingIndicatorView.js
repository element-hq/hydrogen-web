/*
Copyright 2023 The Matrix.org Foundation C.I.C.

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
import "./TypingIndicatorView.css";

export class TypingIndicatorView extends TemplateView {
    constructor(vm) {
        super(vm);
        this._typingMessage = "";
        if (vm) {
            this._updateTypingMessage(vm);
        }
    }

    async _updateTypingMessage(vm) {
        if (!vm?.typingUsers) {
            console.warn("[TypingIndicatorView] No typing users available");
            if (this._typingMessage) {
                this._typingMessage = "";
                this.update();
            }
            return;
        }
        const users = vm.typingUsers.array || [];
        try {
            const message = users.length ? await vm.getTypingString() : "";
            if (this._typingMessage !== message) {
                this._typingMessage = message;
                this.update();
            }
        } catch (error) {
            console.error("[TypingIndicatorView] Error getting typing string:", error);
            if (this._typingMessage) {
                this._typingMessage = "";
                this.update();
            }
        }
    }

    update(value) {
        super.update(value);
        const vm = value || this._value;
        if (vm) {
            this._updateTypingMessage(vm);
        }
    }

    render(t, vm) {
        if (!vm) {
            console.warn("[TypingIndicatorView] No view model available for render");
            return t.div({className: "room-typing-container"});
        }

        // Create a binding for the typing users array to track changes
        t.mapSideEffect(
            (vm) => {
                const users = vm?.typingUsers?.array || [];
                return users;
            },
            (users) => {
                this._updateTypingMessage(vm);
            },
        );

        // Create the DOM structure with bindings
        return t.div({className: "room-typing-container"}, [
            t.div({className: "TypingIndicator"}, [
                t.div(
                    {
                        className: {
                            typing: true,
                            hidden: () => {
                                const isHidden = !this._typingMessage;
                                return isHidden;
                            },
                        },
                    },
                    () => {
                        return this._typingMessage;
                    },
                ),
            ]),
        ]);
    }
}
