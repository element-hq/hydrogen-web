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

import {openDatabase, txnAsPromise, reqAsPromise, iterateCursor, fetchResults} from "../matrix/storage/idb/utils.js";
import {LogItem} from "./LogItem.js";

class Logger {
    constructor(clock) {
        this._openItems = new Set();
        this._clock = clock;
    }

    decend(label, callback, logLevel) {
        const item = new LogItem(label, this, logLevel, this._clock);

        const failItem = (err) => {
            item.catch(err);
            finishItem();
            throw err;
        };

        const finishItem = () => {
            item.finish();
            this._persistItem(item);
            this._openItems.remove(item);
        };

        let result;
        try {
            result = callback(item);
            if (result instanceof Promise) {
                result = result.then(promiseResult => {
                    finishItem();
                    return promiseResult;
                }, failItem);
            }
        } catch (err) {
            failItem(err);
        }
    }

    _persistItem(item) {
        throw new Error("not implemented");
    }

    async extractItems() {
        throw new Error("not implemented");
    }
}

export function encodeUint64(n) {
    const hex = n.toString(16);
    return "0".repeat(16 - hex.length) + hex;
}

export default class IDBLogger extends Logger {
    constructor({name, clock, utf8, flushInterval = 2 * 60 * 1000, limit = 1000}) {
        super(clock);
        this._utf8 = utf8;
        this._name = name;
        this._limit = limit;
        // does not get loaded from idb on startup as we only use it to
        // differentiate between two items with the same start time
        this._itemCounter = 0;
        this._queuedItems = this._loadQueuedItems();
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
        const json = window.localStorage.getItem(key);
        if (json) {
            window.localStorage.removeItem(key);
            return JSON.parse(json);
        }
        return [];
    }

    _openDB() {
        return openDatabase(this._name, db => db.createObjectStore("logs", {keyPath: "id"}), 1);
    }
    
    _persistItem(item) {
        this._itemCounter += 1;
        this._queuedItems.push({
            id: `${encodeUint64(item.start)}:${this._itemCounter}`,
            // store as buffer so parsing overhead is lower
            content: this._utf8.encode(JSON.stringify(item.serialize()))
        });
    }

    _persistQueuedItems(items) {
        window.localStorage.setItem(`${this._name}_queuedItems`, JSON.stringify(items));
    }

    // should we actually delete items and just not rely on trimming for it not to grow too large?
    // just worried that people will create a file, not do anything with it, hit export logs again and then
    // send a mostly empty file. we could just not delete but in _tryFlush (and perhaps make trimming delete a few more than needed to be below limit)
    // how does eleweb handle this?
    // 
    // both deletes and reads items from store
    async extractItems() {
        const db = this._openDB();
        try {
            const queuedItems = this._queuedItems.slice();
            const txn = this.db.transaction(["logs"], "readwrite");
            const logs = txn.objectStore("logs");
            const items = await fetchResults(logs.openCursor(), () => false);
            // we know we have read all the items as we're doing this in a txn
            logs.clear();
            await txnAsPromise(txn);
            // once the transaction is complete, remove the queued items
            this._queuedItems.splice(0, queuedItems.length);
            const sortedItems = items.concat(queuedItems).sort((a, b) => {
                return a.id > b.id;
            }).map(i => {

            });
            return sortedItems;
        } finally {
            try {
                db.close();
            } catch (e) {}
        }
    }
}
