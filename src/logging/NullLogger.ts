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
import type {ILogItem, LabelOrValues, LogCallback, LogItemValues} from "./LogItem";

function noop (): void {}


export class NullLogger {
    public readonly item: ILogItem = new NullLogItem(this);

    log(): void {}

    run(_: null, callback) {
        return callback(this.item);    
    }

    wrapOrRun(item, _, callback) {
        if (item) {
            return item.wrap(null, callback);
        } else {
            return this.run(null, callback);
        }
    }

    runDetached(_, callback) {
        new Promise(r => r(callback(this.item))).then(noop, noop);
    }

    async export() {
        return null;
    }

    get level() {
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

    wrap<T>(_: LabelOrValues, callback: LogCallback<T>): T | Promise<T> {
        return callback(this);
    }
    log(): void {}
    set(): void {}

    runDetached(_: LabelOrValues, callback: LogCallback<unknown>): ILogItem {
        new Promise(r => r(callback(this))).then(noop, noop);
        return this;
    }

    wrapDetached(_: LabelOrValues, _callback: LogCallback<unknown>): void {
        return this.refDetached();
    }

    run<T>(callback: LogCallback<T>): T | Promise<T> {
        return callback(this);
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

    child()  {
        return this;
    }

    finish(): void {}

    serialize() {
        return undefined;
    }
}

export const Instance = new NullLogger(); 
