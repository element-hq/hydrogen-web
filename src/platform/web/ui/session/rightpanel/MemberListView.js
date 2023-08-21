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

import {LazyListView} from "../../general/LazyListView";
import {MemberTileView} from "./MemberTileView.js";
import {TemplateView} from "../../general/TemplateView";

export class MemberListView extends TemplateView {
    render(t, vm) {
        const list = new LazyListView({
            list: vm.memberTileViewModels,
            className: "MemberListView__list",
            itemHeight: 40
        }, tileViewModel => new MemberTileView(tileViewModel));
        return t.div({ className: "MemberListView" }, [
            t.div({ className: "MemberListView__invite-container" }, [
                t.button(
                    {
                        className: "MemberListView__invite-btn button-action primary",
                        onClick: () => vm.openInvitePanel(),
                    },
                    vm.i18n`Invite to this room`
                ),
            ]),
            t.view(list),
        ]);
    }
}
