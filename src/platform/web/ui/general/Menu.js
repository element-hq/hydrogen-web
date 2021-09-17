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
