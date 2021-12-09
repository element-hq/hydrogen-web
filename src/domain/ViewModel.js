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

// ViewModel should just be an eventemitter, not an ObservableValue
// as in some cases it would really be more convenient to have multiple events (like telling the timeline to scroll down)
// we do need to return a disposable from EventEmitter.on, or at least have a method here to easily track a subscription to an EventEmitter

import {EventEmitter} from "../utils/EventEmitter";
import {Disposables} from "../utils/Disposables";

export class ViewModel extends EventEmitter {
    constructor(options = {}) {
        super();
        this.disposables = null;
        this._isDisposed = false;
        this._options = options;
    }

    childOptions(explicitOptions) {
        const {navigation, urlCreator, platform} = this._options;
        return Object.assign({navigation, urlCreator, platform}, explicitOptions);
    }

    // makes it easier to pass through dependencies of a sub-view model
    getOption(name) {
        return this._options[name];
    }

    track(disposable) {
        if (!this.disposables) {
            this.disposables = new Disposables();
        }
        return this.disposables.track(disposable);
    }

    untrack(disposable) {
        if (this.disposables) {
            return this.disposables.untrack(disposable);
        }
        return null;
    }

    dispose() {
        if (this.disposables) {
            this.disposables.dispose();
        }
        this._isDisposed = true;
    }

    get isDisposed() {
        return this._isDisposed;
    }

    disposeTracked(disposable) {
        if (this.disposables) {
            return this.disposables.disposeTracked(disposable);
        }
        return null;
    }

    // TODO: this will need to support binding
    // if any of the expr is a function, assume the function is a binding, and return a binding function ourselves
    // 
    // translated string should probably always be bindings, unless we're fine with a refresh when changing the language?
    // we probably are, if we're using routing with a url, we could just refresh.
    i18n(parts, ...expr) {
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

    updateOptions(options) {
        this._options = Object.assign(this._options, options);
    }

    emitChange(changedProps) {
        if (this._options.emitChange) {
            this._options.emitChange(changedProps);
        } else {
            this.emit("change", changedProps);
        }
    }

    get platform() {
        return this._options.platform;
    }

    get clock() {
        return this._options.platform.clock;
    }

    get logger() {
        return this.platform.logger;
    }

    /**
     * The url router, only meant to be used to create urls with from view models.
     * @return {URLRouter}
     */
    get urlCreator() {
        return this._options.urlCreator;
    }

    get navigation() {
        return this._options.navigation;
    }
}
