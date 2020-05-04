// ViewModel should just be an eventemitter, not an ObservableValue
// as in some cases it would really be more convenient to have multiple events (like telling the timeline to scroll down)
// we do need to return a disposable from EventEmitter.on, or at least have a method here to easily track a subscription to an EventEmitter

import {EventEmitter} from "../utils/EventEmitter.js";
import {Disposables} from "../utils/Disposables.js";

export class ViewModel extends EventEmitter {
    constructor(options) {
        super();
        this.disposables = null;
        this._options = options;
    }

    childOptions(explicitOptions) {
        return Object.assign({}, this._options, explicitOptions);
    }

    track(disposable) {
        if (!this.disposables) {
            this.disposables = new Disposables();
        }
        this.disposables.track(disposable);
    }

    dispose() {
        if (this.disposables) {
            this.disposables.dispose();
        }
    }

    // TODO: this will need to support binding
    // if any of the expr is a function, assume the function is a binding, and return a binding function ourselves
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
}
