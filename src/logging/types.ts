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

import {LogLevel, LogFilter} from "./LogFilter";
import type {BlobHandle} from "../platform/web/dom/BlobHandle.js";

export interface ISerializedItem {
    s: number;
    d?: number;
    v: LogItemValues;
    l: LogLevel;
    e?: {
        stack?: string;
        name: string;
        message: string;
    };
    f?: boolean;
    c?: Array<ISerializedItem>;
};

export interface ILogItem {
    logLevel: LogLevel;
    error?: Error;
    readonly logger: ILogger;
    readonly level: typeof LogLevel;
    readonly end?: number;
    readonly start?: number;
    readonly values: Readonly<LogItemValues>;
    wrap<T>(labelOrValues: LabelOrValues, callback: LogCallback<T>, logLevel?: LogLevel, filterCreator?: FilterCreator): T;
    /*** This is sort of low-level, you probably want to use wrap. If you do use it, it should only be called once. */
    run<T>(callback: LogCallback<T>): T;
    log(labelOrValues: LabelOrValues, logLevel?: LogLevel): ILogItem;
    set(key: string, value: unknown): ILogItem;
    set(key: object): ILogItem;
    runDetached(labelOrValues: LabelOrValues, callback: LogCallback<unknown>, logLevel?: LogLevel, filterCreator?: FilterCreator): ILogItem;
    wrapDetached(labelOrValues: LabelOrValues, callback: LogCallback<unknown>, logLevel?: LogLevel, filterCreator?: FilterCreator): void;
    refDetached(logItem: ILogItem, logLevel?: LogLevel): void;
    ensureRefId(): void;
    catch(err: Error): Error;
    serialize(filter: LogFilter, parentStartTime: number | undefined, forced: boolean): ISerializedItem | undefined;
    finish(): void;
    forceFinish(): void;
    child(labelOrValues: LabelOrValues, logLevel?: LogLevel, filterCreator?: FilterCreator): ILogItem;
    discard(): void;
}
/*
extend both ILogger and ILogItem from this interface, but need to rename ILogger.run => wrap then. Or both to `span`?

export interface ILogItemCreator {
    child(labelOrValues: LabelOrValues, logLevel?: LogLevel, filterCreator?: FilterCreator): ILogItem;
    refDetached(logItem: ILogItem, logLevel?: LogLevel): void;
    log(labelOrValues: LabelOrValues, logLevel?: LogLevel): ILogItem;
    wrap<T>(labelOrValues: LabelOrValues, callback: LogCallback<T>, logLevel?: LogLevel, filterCreator?: FilterCreator): T;
    get level(): typeof LogLevel;
}
*/

export interface ILogger {
    log(labelOrValues: LabelOrValues, logLevel?: LogLevel): ILogItem;
    child(labelOrValues: LabelOrValues, logLevel?: LogLevel, filterCreator?: FilterCreator): ILogItem;
    wrapOrRun<T>(item: ILogItem | undefined, labelOrValues: LabelOrValues, callback: LogCallback<T>, logLevel?: LogLevel, filterCreator?: FilterCreator): T;
    runDetached<T>(labelOrValues: LabelOrValues, callback: LogCallback<T>, logLevel?: LogLevel, filterCreator?: FilterCreator): ILogItem;
    run<T>(labelOrValues: LabelOrValues, callback: LogCallback<T>, logLevel?: LogLevel, filterCreator?: FilterCreator): T;
    get level(): typeof LogLevel;
    getOpenRootItems(): Iterable<ILogItem>;
    addReporter(reporter: ILogReporter): void;
    get reporters(): ReadonlyArray<ILogReporter>;
    /**
     * force-finishes any open items and passes them to the reporter, with the forced flag set.
     * Good think to do when the page is being closed to not lose any logs.
     **/
    forceFinish(): void;
}

export interface ILogReporter {
    setLogger(logger: ILogger): void;
    reportItem(item: ILogItem, filter?: LogFilter, forced?: boolean): void;
}

export type LogItemValues = {
    l?: string;
    t?: string;
    id?: unknown;
    status?: string | number;
    refId?: number;
    ref?: number;
    [key: string]: any
}

export type LabelOrValues = string | LogItemValues;
export type FilterCreator = ((filter: LogFilter, item: ILogItem) => LogFilter);
export type LogCallback<T> = (item: ILogItem) => T;
