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

import {TemplateView} from "../../../general/TemplateView";

export class BaseTileView extends TemplateView {
    // ignore other arguments
    constructor(vm, viewClassForTile) {
        super(vm);
        this._viewClassForTile = viewClassForTile;
        this._root = undefined;
    }

    root() {
        return this._root;
    }

    render(t, vm) {
        const tile = this.renderTile(t, vm);
        const swapRoot = newRoot => {
            this._root?.replaceWith(newRoot);
            this._root = newRoot;
        }
        t.mapSideEffect(vm => vm.hasDateSeparator, hasDateSeparator => {
            if (hasDateSeparator) {
                const container = t.div([this._renderDateSeparator(t, vm)]);
                swapRoot(container);
                container.appendChild(tile);
            } else {
                swapRoot(tile);
            }
        });
        return this._root;
    }

    _renderDateSeparator(t, vm) {
        // if this needs any bindings, we need to use a subview
        return t.div({className: "DateSeparator"}, t.time(vm.date));
    }
    
    /* This is called by the parent ListView, which just has 1 listener for the whole list */
    onClick() {}
}
