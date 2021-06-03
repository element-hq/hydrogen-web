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

import {TemplateView} from "./TemplateView.js";

export class Menu extends TemplateView {

    constructor(options) {
        super();
        this._options = options;
    }

    static optionWithButton(label, callback) {
        const option = new MenuOption(label);
        option.setCallback(callback);
        return option;
    }

    static optionWithLink(label, link) {
        const option = new MenuOption(label);
        option.setLink(link);
        return option;
    }

    _convertToDOM(t, option) {
        if (option.callback) {
            return t.button({ className: "menu-item", onClick: option.callback }, option.label);
        }
        else if (option.link) {
            return t.a({ className: "menu-item", href: option.link }, option.label);
        }
    }

    render(t) {
        return t.ul({className: "menu", role: "menu"}, this._options.map(o => {
            const className = {
                destructive: o.destructive,
            };
            if (o.icon) {
                className.icon = true;
                className[o.icon] = true;
            }
            return t.li({
                className,
            }, this._convertToDOM(t, o));
        }));
    }
}

class MenuOption {
    constructor(label) {
        this.label = label;
        this.icon = null;
        this.destructive = false;
    }

    setCallback(callback) {
        this.callback = callback;
    }

    setLink(link) {
        this.link = link;
    }

    setIcon(className) {
        this.icon = className;
        return this;
    }

    setDestructive() {
        this.destructive = true;
        return this;
    }
}
