/*
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
