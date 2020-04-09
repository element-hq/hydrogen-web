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

// SessionLoadView
// should this be the new switch view?
// and the other one be the BasicSwitchView?
new BoundSwitchView(vm, vm => vm.isLoading, (loading, vm) => {
    if (loading) {
        return new InlineTemplateView(vm, t => {
            return t.div({className: "loading"}, [
                t.span({className: "spinner"}),
                t.span(vm => vm.loadingText)
            ]);
        });
    } else {
        return new SessionView(vm.sessionViewModel);
    }
});

class BoundSwitchView extends SwitchView {
    constructor(value, mapper, viewCreator) {
        super(viewCreator(mapper(value), value));
        this._mapper = mapper;
        this._viewCreator = viewCreator;
        this._mappedValue = mapper(value);
    }

    update(value) {
        const mappedValue = this._mapper(value);
        if (mappedValue !== this._mappedValue) {
            this._mappedValue = mappedValue;
            this.switch(this._viewCreator(this._mappedValue, value));
        } else {
            super.update(value);
        }
    }
}
