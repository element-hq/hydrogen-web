export default class SwitchView {
    constructor(defaultView) {
        this._childView = defaultView;
    }

    mount() {
        return this._childView.mount();
    }

    unmount() {
        return this._childView.unmount();
    }

    root() {
        return this._childView.root();
    }

    update() {
        return this._childView.update();
    }

    switch(newView) {
        const oldRoot = this.root();
        this._childView.unmount();
        this._childView = newView;
        const newRoot = this._childView.mount();
        const parent = oldRoot.parentElement;
        if (parent) {
            parent.replaceChild(newRoot, oldRoot);
        }
    }

    get childView() {
        return this._childView;
    }
}
