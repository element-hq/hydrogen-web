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

import {LogItem} from "./LogItem.js";

export class Logger {
    constructor(persister) {
        this._openItems = [];
        this._persister = persister;
        this._closing = false;
    }

    restore() {
        const items = this._persister.loadTempItems();
        return this._persister.persistItems(items);
    }

    start(label, logLevel) {
        const item = new LogItem(label, logLevel, this);
        this._openItems.push(item);
        return item;
    }

    _closeChild(item) {
        if (!this._closing) {
            this._persister.persistItems([item.serialize()]);
        }
    }

    close() {
        this._closing = true;
        for(const i of this._openItems) {
            i.finish();
        }
        this._closing = false;
        this._persister.persistTempItems(this._openItems.map(i => i.serialize()));
    }
}
