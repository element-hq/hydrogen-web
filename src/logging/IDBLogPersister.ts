/*
Copyright 2020 Bruno Windels <bruno@windels.cloud>
Copyright 2021 The Matrix.org Foundation C.I.C.

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
} from "../matrix/storage/idb/utils";
import type {Interval} from "../platform/web/dom/Clock";
import type {Platform} from "../platform/web/Platform.js";
import type {BlobHandle} from "../platform/web/dom/BlobHandle.js";
import type {ILogItem, ILogger, ILogReporter, ISerializedItem} from "./types";
import {LogFilter} from "./LogFilter";

type QueuedItem = {
    json: string;
    id?: number;
}

type Options = {
    name: string,
    flushInterval?: number,
    limit?: number,
    platform: Platform,
    serializedTransformer?: (item: ISerializedItem) => ISerializedItem
}

export class IDBLogPersister implements ILogReporter {
    private readonly _flushInterval: Interval;
    private _queuedItems: QueuedItem[];
    private readonly options: Options;
    private logger?: ILogger;

    constructor(options: Options) {
        this.options = options;
        this._queuedItems = this._loadQueuedItems();
        // TODO: also listen for unload just in case sync keeps on running after pagehide is fired?
        window.addEventListener("pagehide", this, false);
        this._flushInterval = this.options.platform.clock.createInterval(
            () => this._tryFlush(),
            this.options.flushInterval ?? 60 * 1000
        );
    }

    setLogger(logger: ILogger): void {
        this.logger = logger;
    }

    reportItem(logItem: ILogItem, filter: LogFilter, forced: boolean): void {
        const queuedItem = this.prepareItemForQueue(logItem, filter, forced);
        if (queuedItem) {
            this._queuedItems.push(queuedItem);
        }
    }

    async export(): Promise<IDBLogExport> {
        const db = await this._openDB();
        try {
            const txn = db.transaction(["logs"], "readonly");
            const logs = txn.objectStore("logs");
            const storedItems: QueuedItem[] = await fetchResults(logs.openCursor(), () => false);
            const openItems = this.getSerializedOpenItems();
            const allItems = storedItems.concat(this._queuedItems).concat(openItems);
            return new IDBLogExport(allItems, this, this.options.platform);
        } finally {
            try {
                db.close();
            } catch (e) {}
        }
    }
    
    dispose(): void {
        window.removeEventListener("pagehide", this, false);
        this._flushInterval.dispose();
    }

    handleEvent(evt: Event): void {
        if (evt.type === "pagehide") {
            this._finishAllAndFlush();
        }
    }

    private async _tryFlush(): Promise<void> {
        const db = await this._openDB();
        try {
            const txn = db.transaction(["logs"], "readwrite");
            const logs = txn.objectStore("logs");
            const amount = this._queuedItems.length;
            for(const i of this._queuedItems) {
                logs.add(i);
            }
            const itemCount = await reqAsPromise(logs.count());
            const limit = this.options.limit ?? 3000;
            if (itemCount > limit) {
                // delete an extra 10% so we don't need to delete every time we flush
                let deleteAmount = (itemCount - limit) + Math.round(0.1 * limit);
                await iterateCursor(logs.openCursor(), (_, __, cursor) => {
                    cursor.delete();
                    deleteAmount -= 1;
                    return {done: deleteAmount === 0};
                });
            }
            await txnAsPromise(txn);
            this._queuedItems.splice(0, amount);
        } catch (err) {
            console.error("Could not flush logs", err);
        } finally {
            try {
                db.close();
            } catch (e) {}
        }
    }

    private _finishAllAndFlush(): void {
        if (this.logger) {
            this.logger.log({l: "pagehide, closing logs", t: "navigation"});
            this.logger.forceFinish();
        }
        this._persistQueuedItems(this._queuedItems);
    }

    private _loadQueuedItems(): QueuedItem[] {
        const key = `${this.options.name}_queuedItems`;
        try {
            const json = window.localStorage.getItem(key);
            if (json) {
                window.localStorage.removeItem(key);
                return JSON.parse(json);
            }
        } catch (err) {
            console.error("Could not load queued log items", err);
        }
        return [];
    }

    private _openDB(): Promise<IDBDatabase> {
        return openDatabase(this.options.name, db => db.createObjectStore("logs", {keyPath: "id", autoIncrement: true}), 1);
    }

    private prepareItemForQueue(logItem: ILogItem, filter: LogFilter, forced: boolean): QueuedItem | undefined {
        let serializedItem = logItem.serialize(filter, undefined, forced);
        if (serializedItem) {
            if (this.options.serializedTransformer) {
                serializedItem = this.options.serializedTransformer(serializedItem);
            }
            return {
                json: JSON.stringify(serializedItem)
            };
        }
    }

    private _persistQueuedItems(items: QueuedItem[]): void {
        try {
            window.localStorage.setItem(`${this.options.name}_queuedItems`, JSON.stringify(items));
        } catch (e) {
            console.error("Could not persist queued log items in localStorage, they will likely be lost", e);
        }
    }

    /** @internal called by ILogExport.removeFromStore */
    async removeItems(items: QueuedItem[]): Promise<void> {
        const db = await this._openDB();
        try {
            const txn = db.transaction(["logs"], "readwrite");
            const logs = txn.objectStore("logs");
            for (const item of items) {
                if (typeof item.id === "number") {
                    logs.delete(item.id);
                } else {
                    // assume the (non-persisted) object in each array will be the same
                    const queuedIdx = this._queuedItems.indexOf(item);
                    if (queuedIdx === -1) {
                        this._queuedItems.splice(queuedIdx, 1);
                    }
                }
            }
            await txnAsPromise(txn);
        } finally {
            try {
                db.close();
            } catch (e) {}
        }
    }

    private getSerializedOpenItems(): QueuedItem[] {
        const openItems: QueuedItem[] = [];
        if (!this.logger) {
            return openItems;
        }
        const filter = new LogFilter();
        for(const item of this.logger!.getOpenRootItems()) {
            const openItem = this.prepareItemForQueue(item, filter, false);
            if (openItem) {
                openItems.push(openItem);
            }
        }
        return openItems;
    }
}

export class IDBLogExport {
    private readonly _items: QueuedItem[];
    private readonly _logger: IDBLogPersister;
    private readonly _platform: Platform;

    constructor(items: QueuedItem[], logger: IDBLogPersister, platform: Platform) {
        this._items = items;
        this._logger = logger;
        this._platform = platform;
    }
    
    get count(): number {
        return this._items.length;
    }

    /**
     * @return {Promise}
     */
    removeFromStore(): Promise<void> {
        return this._logger.removeItems(this._items);
    }

    asBlob(): BlobHandle {
        const json = this.toJSON();
        const buffer: Uint8Array = this._platform.encoding.utf8.encode(json);
        const blob: BlobHandle = this._platform.createBlob(buffer, "application/json");
        return blob;
    }

    toJSON(): string {
        const log = {
            formatVersion: 1,
            appVersion: this._platform.updateService?.version,
            platform: this._platform.description,
            items: this._items.map(i => JSON.parse(i.json))
        };
        const json = JSON.stringify(log);
        return json;
    }
}
