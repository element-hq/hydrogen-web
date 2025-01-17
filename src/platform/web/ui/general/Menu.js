/*
Copyright 2025 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import {TemplateView} from "./TemplateView";

export class Menu extends TemplateView {
    static option(label, callback) {
        return new MenuOption(label, callback);
    }

    constructor(options) {
        super();
        this._options = options;
    }

    render(t) {
        return t.ul({className: "menu", role: "menu"}, this._options.map(o => o.toDOM(t)));
    }
}

class MenuOption {
    constructor(label, callback) {
        this.label = label;
        this.callback = callback;
        this.icon = null;
        this.destructive = false;
    }

    setIcon(className) {
        this.icon = className;
        return this;
    }

    setDestructive() {
        this.destructive = true;
        return this;
    }

    toDOM(t) {
        const className = {
            destructive: this.destructive,
        };
        if (this.icon) {
            className.icon = true;
            className[this.icon] = true;
        }
        return t.li({
            className,
        }, t.button({className:"menu-item", onClick: this.callback}, this.label));
    }
}
