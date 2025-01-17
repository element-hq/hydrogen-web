/*
Copyright 2025 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
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

