/*
Copyright 2020 Bruno Windels <bruno@windels.cloud>
Copyright 2022 The Matrix.org Foundation C.I.C.

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

// ViewModel should just be an eventemitter, not an ObservableValue
// as in some cases it would really be more convenient to have multiple events (like telling the timeline to scroll down)
// we do need to return a disposable from EventEmitter.on, or at least have a method here to easily track a subscription to an EventEmitter

import {EventEmitter} from "../utils/EventEmitter";
import {Disposables} from "../utils/Disposables";

import type {Disposable} from "../utils/Disposables";
import type {Platform} from "../platform/web/Platform";
import type {Clock} from "../platform/web/dom/Clock";
import type {ILogger} from "../logging/types";
import type {Navigation} from "./navigation/Navigation";
import type {SegmentType} from "./navigation/index";
import type {IURLRouter} from "./navigation/URLRouter";

export type Options<T extends object = SegmentType> = {
    platform: Platform;
    logger: ILogger;
    urlCreator: IURLRouter<T>;
    navigation: Navigation<T>;
    emitChange?: (params: any) => void;
}


export class ViewModel<N extends object = SegmentType, O extends Options<N> = Options<N>> extends EventEmitter<{change: never}> {
    private disposables?: Disposables;
    private _isDisposed = false;
    private _options: Readonly<O>;

    constructor(options: Readonly<O>) {
        super();
        this._options = options;
    }

    childOptions<T extends Object>(explicitOptions: T): T & Options<N> {
        return Object.assign({}, this._options, explicitOptions);
    }

    get options(): Readonly<O> { return this._options; }

    // makes it easier to pass through dependencies of a sub-view model
    getOption<N extends keyof O>(name: N): O[N]  {
        return this._options[name];
    }

    observeNavigation<T extends keyof N>(type: T, onChange: (value: N[T], type: T) => void): void {
      const segmentObservable = this.navigation.observe(type);
      const unsubscribe = segmentObservable.subscribe((value: N[T]) => {
        onChange(value, type);
      });
      this.track(unsubscribe);
    }

    track<D extends Disposable>(disposable: D): D {
        if (!this.disposables) {
            this.disposables = new Disposables();
        }
        return this.disposables.track(disposable);
    }

    untrack(disposable: Disposable): undefined {
        if (this.disposables) {
            return this.disposables.untrack(disposable);
        }
        return undefined;
    }

    dispose(): void {
        if (this.disposables) {
            this.disposables.dispose();
        }
        this._isDisposed = true;
    }

    get isDisposed(): boolean {
        return this._isDisposed;
    }

    disposeTracked(disposable: Disposable | undefined): undefined {
        if (this.disposables) {
            return this.disposables.disposeTracked(disposable);
        }
        return undefined;
    }

    // TODO: this will need to support binding
    // if any of the expr is a function, assume the function is a binding, and return a binding function ourselves
    //
    // translated string should probably always be bindings, unless we're fine with a refresh when changing the language?
    // we probably are, if we're using routing with a url, we could just refresh.
    i18n(parts: TemplateStringsArray, ...expr: any[]): string {
        // just concat for now
        let result = "";
        for (let i = 0; i < parts.length; ++i) {
            result = result + parts[i];
            if (i < expr.length) {
                result = result + expr[i];
            }
        }
        return result;
    }

    emitChange(changedProps: any): void {
        if (this._options.emitChange) {
            this._options.emitChange(changedProps);
        } else {
            this.emit("change", changedProps);
        }
    }

    get platform(): Platform {
        return this._options.platform;
    }

    get clock(): Clock {
        return this._options.platform.clock;
    }

    get logger(): ILogger {
        return this.platform.logger;
    }

    get urlCreator(): IURLRouter<N> {
        return this._options.urlCreator;
    }

    get navigation(): Navigation<N> {
        // typescript needs a little help here
        return this._options.navigation as unknown as Navigation<N>;
    }
}
