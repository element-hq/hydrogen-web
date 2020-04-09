function disposeValue(value) {
    if (typeof d === "function") {
        value();
    } else {
        value.dispose();
    }
}

export class Disposables {
    constructor() {
        this._disposables = [];
    }

    track(disposable) {
        this._disposables.push(disposable);
    }

    dispose() {
        if (this._disposables) {
            for (const d of this._disposables) {
                disposeValue(d);
            }
            this._disposables = null;
        }
    }


    disposeTracked(value) {
        const idx = this._disposables.indexOf(value);
        if (idx !== -1) {
            const [foundValue] = this._disposables.splice(idx, 1);
            disposeValue(foundValue);
            return true;
        }
        return false;
    }
}
