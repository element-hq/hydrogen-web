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
import {spinner} from "../../common.js";

export class LightboxView extends TemplateView {
    render(t, vm) {
        const close = t.a({href: vm.closeUrl, title: vm.i18n`Close`, className: "close"});
        const image = t.div({
            role: "img",
            "aria-label": vm => vm.name,
            title: vm => vm.name,
            className: {
                picture: true,
                hidden: vm => !vm.imageUrl,
            },
            style: vm => `background-image: url('${vm.imageUrl}'); max-width: ${vm.imageWidth}px; max-height: ${vm.imageHeight}px;`
        });
        const loading = t.div({
            className: {
                loading: true,
                hidden: vm => !!vm.imageUrl
            }
        }, [
            spinner(t),
            t.div(vm.i18n`Loading image…`)
        ]);
        const details = t.div({
            className: "details"
        }, [t.strong(vm => vm.name), t.br(), "uploaded by ", t.strong(vm => vm.sender), vm => ` at ${vm.time} on ${vm.date}.`]);
        const dialog = t.div({
            role: "dialog",
            className: "lightbox",
            onClick: evt => this.clickToClose(evt),
            onKeydown: evt => this.closeOnEscKey(evt)
        }, [image, loading, details, close]);
        trapFocus(t, dialog);
        return dialog;
    }

    clickToClose(evt) {
        if (evt.target === this.root()) {
            this.value.close();
        }
    }

    closeOnEscKey(evt) {
        if (evt.key === "Escape" || evt.key === "Esc") {
            this.value.close();
        }
    }
}

function trapFocus(t, element) {
    const elements = focusables(element);
    const first = elements[0];
    const last = elements[elements.length - 1];

    t.addEventListener(element, "keydown", evt => {
        if (evt.key === "Tab") {
            if (evt.shiftKey) {
                if (document.activeElement === first) {
                    last.focus();
                    evt.preventDefault();
                }
            } else {
                if (document.activeElement === last) {
                    first.focus();
                    evt.preventDefault();
                }
            }
        }
    }, true);
    Promise.resolve().then(() => {
        first.focus();
    });
}

function focusables(element) {
    return element.querySelectorAll('a[href], button, textarea, input, select');
}

