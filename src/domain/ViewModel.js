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
