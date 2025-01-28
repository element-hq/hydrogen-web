/*
Copyright 2025 New Vector Ltd.
Copyright 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/
import {LogLevel} from "./LogFilter";
import type {ILogger, ILogItem, ILogReporter, LabelOrValues, LogCallback, LogItemValues} from "./types";

function noop (): void {}

export class NullLogger implements ILogger {
    public readonly item: ILogItem = new NullLogItem(this);

    log(labelOrValues: LabelOrValues): ILogItem {
        return this.item;
    }

    addReporter() {}

    get reporters(): ReadonlyArray<ILogReporter> {
        return [];
    }

    getOpenRootItems(): Iterable<ILogItem> {
        return [];
    }

    forceFinish(): void {}

    child(labelOrValues: LabelOrValues): ILogItem  {
        return this.item;
    }

    run<T>(_, callback: LogCallback<T>): T {
        return callback(this.item);    
    }

    wrapOrRun<T>(item: ILogItem | undefined, _, callback: LogCallback<T>): T {
        if (item) {
            return item.wrap(_, callback);
        } else {
            return this.run(_, callback);
        }
    }

    runDetached(_, callback): ILogItem {
        new Promise(r => r(callback(this.item))).then(noop, noop);
        return this.item;
    }
    
    get level(): typeof LogLevel {
        return LogLevel;
    }
}

export class NullLogItem implements ILogItem {
    public readonly logger: NullLogger;
    public readonly logLevel: LogLevel;
    public children?: Array<ILogItem>;
    public values: LogItemValues;
    public error?: Error;

    constructor(logger: NullLogger) {
        this.logger = logger;
    }

    discard(): void {
        // noop
    }

    wrap<T>(_: LabelOrValues, callback: LogCallback<T>): T {
        return this.run(callback);
    }

    run<T>(callback: LogCallback<T>): T {
        return callback(this);
    }


    log(labelOrValues: LabelOrValues): ILogItem {
        return this;
    }
    
    set(labelOrValues: LabelOrValues): ILogItem { return this; }

    runDetached(_: LabelOrValues, callback: LogCallback<unknown>): ILogItem {
        new Promise(r => r(callback(this))).then(noop, noop);
        return this;
    }

    wrapDetached(_: LabelOrValues, _callback: LogCallback<unknown>): void {
        return this.refDetached();
    }

    refDetached(): void {}

    ensureRefId(): void {}

    get level(): typeof LogLevel {
        return LogLevel;
    }

    get duration(): 0 {
        return 0;
    }

    catch(err: Error): Error {
        return err;
    }

    child(): ILogItem  {
        return this;
    }

    finish(): void {}
    forceFinish(): void {}

    serialize(): undefined {
        return undefined;
    }
}

export const Instance = new NullLogger(); 
