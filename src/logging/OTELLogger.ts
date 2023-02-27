/*
Copyright 2023 The Matrix.org Foundation C.I.C.

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

import { trace, propagation, Tracer, Span, Context, ROOT_CONTEXT, AttributeValue, Attributes, SpanKind } from "@opentelemetry/api";
import { SemanticAttributes } from "@opentelemetry/semantic-conventions";

import { LogFilter, LogLevel } from "./LogFilter";
import { FilterCreator, ILogger, ILogItem, ILogReporter, ISerializedItem, LabelOrValues, LogCallback, LogItemValues } from "./types";
import type { Clock } from "../platform/web/dom/Clock.js";

function itemCaption(values: LogItemValues): string {
    if (values.t === "network") {
        return `HTTP request`;
    } else {
        return values.l || values.t || "Log item";
    }
}

function mapLabelToAttribute(t: string | undefined, key: string): string | null {
    if (key === "l") return null;
    if (key === "t") return null;

    if (t === "network") {
        if (key === "method") return SemanticAttributes.HTTP_METHOD;
        if (key === "url") return SemanticAttributes.HTTP_URL;
        if (key === "status") return SemanticAttributes.HTTP_STATUS_CODE;
    }

    return `hydrogen.${key}`;
}

function labelsToAttributes(labels: object): Attributes {
    return Object.entries(labels)
        .reduce((attrs, [key, value]) => {
            const mapped = mapLabelToAttribute(labels['t'], key);
            if (!mapped) return attrs;
            return { ...attrs, [mapped]: value as AttributeValue };
        }, {
        });
}

export class OTELLogItem implements ILogItem {
    private _span: Span;
    private _context: Context;
    private _logger: OTELLogger;
    private _values: LogItemValues;

    logLevel: LogLevel;
    error?: Error | undefined;
    end?: number | undefined;
    start?: number | undefined;

    constructor(labelOrValues: LabelOrValues, logLevel: LogLevel, logger: OTELLogger, _filterCreator?: FilterCreator, context?: Context) {
        this._logger = logger;
        this.start = logger._now();
        this._values = typeof labelOrValues === "string" ? {l: labelOrValues} : labelOrValues;
        this.logLevel = logLevel;
        // this._filterCreator = filterCreator;

        context = context ?? ROOT_CONTEXT;
        this._span = logger.tracer.startSpan(
            itemCaption(this._values),
            { 
                kind: (this._values.t === "network") ? SpanKind.CLIENT : SpanKind.INTERNAL,
                startTime: this.start, 
                attributes: labelsToAttributes(this._values),
            },
            context
        );
        this._context = trace.setSpan(context, this._span);
    }

    injectHeaders(headers: Headers): void {
        propagation.inject(this._context, headers, {
            set: (h, k, v) => h.set(k, typeof v === 'string' ? v : String(v)),
        });
    }

    wrap<T>(labelOrValues: LabelOrValues, callback: LogCallback<T>, logLevel?: LogLevel | undefined, filterCreator?: FilterCreator | undefined): T {
        const item = this.child(labelOrValues, logLevel, filterCreator);
        return item.run(callback);
    }

    log(labelOrValues: LabelOrValues, logLevel?: LogLevel | undefined): ILogItem {
        // TODO: use this._span.addEvent instead?
        const item = this.child(labelOrValues, logLevel);
        item.finish();
        return item;
    }

    set(key: string | object, value?: unknown): ILogItem {
        if(typeof key === "object") {
            const values = key;
            values['t'] = values['t'] ?? this._values.t;
            this._span.setAttributes(labelsToAttributes(values));
        } else {
            const mapped = mapLabelToAttribute(this._values.t, key);
            if (mapped) {
                this._span.setAttribute(mapped, value as AttributeValue);
            }
        }
        return this;
    }

    runDetached(labelOrValues: LabelOrValues, callback: LogCallback<unknown>, logLevel?: LogLevel | undefined, filterCreator?: FilterCreator | undefined): ILogItem {
        return this._logger.runDetached(labelOrValues, callback, logLevel, filterCreator);
    }

    wrapDetached(labelOrValues: LabelOrValues, callback: LogCallback<unknown>, logLevel?: LogLevel | undefined, filterCreator?: FilterCreator | undefined): void {
        this.refDetached(this.runDetached(labelOrValues, callback, logLevel, filterCreator));
    }

    refDetached(_logItem: ILogItem, _logLevel?: LogLevel | undefined): void {
        // TODO: link spans somehow
    }

    ensureRefId(): void { }

    catch(err: Error): Error {
        this._span.recordException(err);
        this.logLevel = LogLevel.Error;
        this.finish();
        return err;
    }

    serialize(_filter: LogFilter, _parentStartTime: number | undefined, _forced: boolean): ISerializedItem | undefined { return; }

    finish(): void {
        this.end = this._logger._now();
        this._span.end(this.end);
    }

    child(labelOrValues: LabelOrValues, logLevel?: LogLevel, filterCreator?: FilterCreator): OTELLogItem {
        return new OTELLogItem(labelOrValues, logLevel ?? this.logLevel, this._logger, filterCreator, this._context);
    }

    run<T>(callback: LogCallback<T>): T {
        // TODO: is that alright?
        try {
            const result = callback(this);
            if (result instanceof Promise) {
                return result.then(promiseResult => {
                    this.finish();
                    return promiseResult;
                }, err => {
                    throw this.catch(err);
                }) as unknown as T;
            } else {
                this.finish();
                return result;
            }
        } catch (err) {
            throw this.catch(err);
        }
    }

    forceFinish(): void {
        // TODO
    }

    get values(): LogItemValues {
        return this._values;
    }

    get logger(): OTELLogger {
        return this._logger;
    }

    get level(): typeof LogLevel {
        return LogLevel;
    }
}

export class OTELLogger implements ILogger {
    private _tracer: Tracer;
    private _clock: Clock;

    constructor({ clock }: { clock: Clock }) {
        this._tracer = trace.getTracer("hydrogen");
        this._clock = clock;
    }

    get tracer(): Tracer {
        return this._tracer;
    }

    log(labelOrValues: LabelOrValues, logLevel?: LogLevel): OTELLogItem {
        const item = this.child(labelOrValues, logLevel);
        item.finish();
        return item;
    }

    child(labelOrValues: LabelOrValues, logLevel?: LogLevel | undefined, filterCreator?: FilterCreator | undefined): OTELLogItem {
        if (!logLevel) {
            logLevel = LogLevel.Info;
        }

        return new OTELLogItem(labelOrValues, logLevel, this, filterCreator);
    }

    wrapOrRun<T>(item: ILogItem | undefined, labelOrValues: LabelOrValues, callback: LogCallback<T>, logLevel?: LogLevel, filterCreator?: FilterCreator): T {
        if (item) {
            return item.wrap(labelOrValues, callback, logLevel, filterCreator);
        } else {
            return this.run(labelOrValues, callback, logLevel, filterCreator);
        }
    }

    runDetached<T>(labelOrValues: LabelOrValues, callback: LogCallback<T>, logLevel?: LogLevel, _filterCreator?: FilterCreator): ILogItem {
        const item = this.child(labelOrValues, logLevel);
        this._run(item, callback, false /* don't throw, nobody is awaiting */);
        return item;
    }

    run<T>(labelOrValues: LabelOrValues, callback: LogCallback<T>, logLevel?: LogLevel, _filterCreator?: FilterCreator): T {
        const item = this.child(labelOrValues, logLevel);
        return this._run(item, callback, true);
    }

    finish(): void {
        // TODO
    }

    forceFinish(): void {
        // TODO
    }

    get level(): typeof LogLevel {
        return LogLevel;
    }

    addReporter(_reporter: ILogReporter): void {
        // TODO
    }

    get reporters(): readonly ILogReporter[] {
        // TODO
        return [];
    }

    getOpenRootItems(): Iterable<ILogItem> {
        // TODO
        return [];
    }

    _now(): number {
        return this._clock.now();
    }

    _run<T>(item: OTELLogItem, callback: LogCallback<T>, wantResult: true): T;
    // we don't return if we don't throw, as we don't have anything to return when an error is caught but swallowed for the fire-and-forget case.
    _run<T>(item: OTELLogItem, callback: LogCallback<T>, wantResult: false): void;
    _run<T>(item: OTELLogItem, callback: LogCallback<T>, wantResult: boolean): T | void {
        try {
            let result = item.run(callback);
            if (result instanceof Promise) {
                result =  result.then(promiseResult => {
                    return promiseResult;
                }, err => {
                    if (wantResult) {
                        throw err;
                    }
                }) as unknown as T;
                if (wantResult) {
                    return result;
                }
            } else {
                if(wantResult) {
                    return result;
                }
            }
        } catch (err) {
            if (wantResult) {
                throw err;
            }
        }
    }
}
