// ViewModel should just be an eventemitter, not an ObservableValue
// as in some cases it would really be more convenient to have multiple events (like telling the timeline to scroll down)
// we do need to return a disposable from EventEmitter.on, or at least have a method here to easily track a subscription to an EventEmitter

import {EventEmitter} from "../utils/EventEmitter.js";
import {Disposables} from "../utils/Disposables.js";

export class ViewModel extends EventEmitter {
    constructor({clock} = {}) {
        super();
        this.disposables = null;
        this._options = {clock};
    }

    childOptions(explicitOptions) {
        return Object.assign({}, this._options, explicitOptions);
    }

    track(disposable) {
        if (!this.disposables) {
            this.disposables = new Disposables();
        }
        this.disposables.track(disposable);
        return disposable;
    }

    dispose() {
        if (this.disposables) {
            this.disposables.dispose();
        }
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

    emitChange(changedProps) {
        this.emit("change", changedProps);
    }

    get clock() {
        return this._options.clock;
    }
}
