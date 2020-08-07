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

import {errorToDOM} from "./error.js";

export class SwitchView {
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
        let newRoot;
        try {
            newRoot = this._childView.mount();
        } catch (err) {
            newRoot = errorToDOM(err);
        }
        const parent = oldRoot.parentNode;
        if (parent) {
            parent.replaceChild(newRoot, oldRoot);
        }
    }

    get childView() {
        return this._childView;
    }
}
/*
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
*/
export class BoundSwitchView extends SwitchView {
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
