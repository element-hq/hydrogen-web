/*
Copyright 2021 The Matrix.org Foundation C.I.C.

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

import {ListView} from "../../../general/ListView";
import {TemplateView} from "../../../general/TemplateView";

export class ReactionsView extends ListView {
    constructor(reactionsViewModel) {
        const options = {
            className: "Timeline_messageReactions",
            tagName: "div",
            list: reactionsViewModel.reactions,
            onItemClick: reactionView => reactionView.onClick(),
        }
        super(options, reactionVM => new ReactionView(reactionVM));
    }
}

class ReactionView extends TemplateView {
    render(t, vm) {
        return t.button({
            className: {
                active: vm => vm.isActive,
                pending: vm => vm.isPending
            },
        }, [vm.key, " ", vm => `${vm.count}`]);
    }

    onClick() {
        this.value.toggle();
    }
}
