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

import {
    openDatabase,
    txnAsPromise,
    reqAsPromise,
    iterateCursor,
    fetchResults,
    encodeUint64
} from "../matrix/storage/idb/utils.js";
import {BaseLogger} from "./BaseLogger.js";

export class IDBLogger extends BaseLogger {
    constructor({name, platform, flushInterval = 2 * 60 * 1000, limit = 3000}) {
        super(platform);
        this._name = name;
        this._limit = limit;
        // does not get loaded from idb on startup as we only use it to
        // differentiate between two items with the same start time
        this._itemCounter = 0;
        this._queuedItems = this._loadQueuedItems();
        // TODO: add dirty flag when calling descend
        // TODO: also listen for unload just in case sync keeps on running after pagehide is fired?
        window.addEventListener("pagehide", this, false);
        this._flushInterval = this._clock.createInterval(() => this._tryFlush(), flushInterval);
    }

    dispose() {
        window.removeEventListener("pagehide", this, false);
        this._flushInterval.dispose();
    }

    handleEvent(evt) {
        if (evt.type === "pagehide") {
            this._finishAllAndFlush();
        }
    }

    async _tryFlush() {
        const db = await this._openDB();
        try {
            const txn = this.db.transaction(["logs"], "readwrite");
            const logs = txn.objectStore("logs");
            const amount = this._queuedItems.length;
            for(const i of this._queuedItems) {
                logs.add(i);
            }
            // TODO: delete more than needed so we don't delete on every flush?
            // trim logs if needed
            const itemCount = await reqAsPromise(logs.count());
            if (itemCount > this._limit) {
                let currentCount = itemCount;
                await iterateCursor(logs.openCursor(), (_, __, cursor) => {
                    cursor.delete();
                    currentCount -= 1;
                    return {done: currentCount <= this._limit};
                });
            }
            await txnAsPromise(txn);
            this._queuedItems.splice(0, amount);
        } finally {
            try {
                db.close();
            } catch (e) {}
        }
    }

    _finishAllAndFlush() {
        for (const openItem of this._openItems) {
            openItem.finish();
            this._persistItem(openItem);
        }
        this._openItems.clear();
        this._persistQueuedItems(this._queuedItems);
    }

    _loadQueuedItems() {
        const key = `${this._name}_queuedItems`;
        try {
            const json = window.localStorage.getItem(key);
            if (json) {
                window.localStorage.removeItem(key);
                return JSON.parse(json);
            }
        } catch (e) {}
        return [];
    }

    _openDB() {
        return openDatabase(this._name, db => db.createObjectStore("logs", {keyPath: "id"}), 1);
    }
    
    _persistItem(item) {
        this._itemCounter += 1;
        this._queuedItems.push({
            id: `${encodeUint64(item.start)}:${this._itemCounter}`,
            tree: item.serialize()
        });
    }

    _persistQueuedItems(items) {
        try {
            window.localStorage.setItem(`${this._name}_queuedItems`, JSON.stringify(items));
        } catch (e) {
            console.warn("Could not persist queued log items in localStorage, they will likely be lost", e);
        }
    }

    async export() {
        const db = this._openDB();
        try {
            const txn = this.db.transaction(["logs"], "readonly");
            const logs = txn.objectStore("logs");
            const items = await fetchResults(logs.openCursor(), () => false);
            const sortedItems = items.concat(this._queuedItems).sort((a, b) => {
                return a.id > b.id;
            });
            return new IDBLogExport(sortedItems, this, this._platform);
        } finally {
            try {
                db.close();
            } catch (e) {}
        }
    }

    async _removeItems(items) {
        const db = this._openDB();
        try {
            const txn = this.db.transaction(["logs"], "readwrite");
            const logs = txn.objectStore("logs");
            for (const item of items) {
                const queuedIdx = this._queuedItems.findIndex(i => i.id === item.id);
                if (queuedIdx === -1) {
                    logs.delete(item.id);
                } else {
                    this._queuedItems.splice(queuedIdx, 1);
                }
            }
            await txnAsPromise(txn);
        } finally {
            try {
                db.close();
            } catch (e) {}
        }
    }
}

class IDBLogExport {
    constructor(items, logger, platform) {
        this._items = items;
        this._logger = logger;
        this._platform = platform;
    }

    /**
     * @return {Promise}
     */
    removeFromStore() {
        return this._logger._removeItems(this._items);
    }

    asBlob() {
        const log = {
            version: 1,
            items: this._items
        };
        const json = JSON.stringify(log);
        const buffer = this._platform.utf8.encode(json);
        const blob = this._platform.createBlob(buffer, "application/json");
        return blob;
    }
}
