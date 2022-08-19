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
import {spinner} from "../../../common.js";

export class GapView extends TemplateView {
    // ignore other argument
    constructor(vm) {
        super(vm);
    }

    render(t) {
        const className = {
            GapView: true,
            isLoading: vm => vm.isLoading,
            isAtTop: vm => vm.isAtTop,
        };
        return t.li({ className }, [
            t.if(vm => vm.showSpinner, (t) => spinner(t)),
            t.span(vm => vm.currentAction)
        ]);
    }

    /* This is called by the parent ListView, which just has 1 listener for the whole list */
    onClick() {}
}
