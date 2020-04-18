// ViewModel should just be an eventemitter, not an ObservableValue
// as in some cases it would really be more convenient to have multiple events (like telling the timeline to scroll down)
// we do need to return a disposable from EventEmitter.on, or at least have a method here to easily track a subscription to an EventEmitter

export class ViewModel extends ObservableValue {
    constructor(options) {
        super();
        this.disposables = new Disposables();
        this._options = options;
    }

    childOptions(explicitOptions) {
        return Object.assign({}, this._options, explicitOptions);
    }

    track(disposable) {
        this.disposables.track(disposable);
    }

    dispose() {
        this.disposables.dispose();
    }
}
