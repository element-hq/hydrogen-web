/*
Copyright 2020 Bruno Windels <bruno@windels.cloud>
Copyright 2020 The Matrix.org Foundation C.I.C.

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

import {TemplateView} from "../../general/TemplateView.js";
import {Popup} from "../../general/Popup.js";
import {Menu} from "../../general/Menu.js";
import {TimelineList} from "./TimelineList.js";
import {TimelineLoadingView} from "./TimelineLoadingView.js";
import {MessageComposer} from "./MessageComposer.js";
import {RoomArchivedView} from "./RoomArchivedView.js";
import {AvatarView} from "../../avatar.js";

export class RoomView extends TemplateView {
    constructor(options) {
        super(options);
        this._optionsPopup = null;
    }

    render(t, vm) {
        let bottomView;
        if (vm.composerViewModel.kind === "composer") {
            bottomView = new MessageComposer(vm.composerViewModel);
        } else if (vm.composerViewModel.kind === "archived") {
            bottomView = new RoomArchivedView(vm.composerViewModel);
        }
        return t.main({className: "RoomView middle"}, [
            t.div({className: "RoomHeader middle-header"}, [
                t.a({className: "button-utility close-middle", href: vm.closeUrl, title: vm.i18n`Close room`}),
                t.view(new AvatarView(vm, 32)),
                t.div({className: "room-description"}, [
                    t.h2(vm => vm.name),
                ]),
                t.button({
                    className: "button-utility room-options",
                    "aria-label":vm.i18n`Room options`,
                    onClick: evt => this._toggleOptionsMenu(evt)
                })
            ]),
            t.div({className: "RoomView_body"}, [
                t.div({className: "RoomView_error"}, vm => vm.error),
                t.mapView(vm => vm.timelineViewModel, timelineViewModel => {
                    return timelineViewModel ?
                        new TimelineList(timelineViewModel) :
                        new TimelineLoadingView(vm);    // vm is just needed for i18n
                }),
                t.view(bottomView),
            ])
        ]);
    }

    _toggleOptionsMenu(evt) {
        if (this._optionsPopup && this._optionsPopup.isOpen) {
            this._optionsPopup.close();
        } else {
            const vm = this.value;
            const options = [];
            if (vm.canLeave) {
                options.push(Menu.option(vm.i18n`Leave room`, () => vm.leaveRoom()).setDestructive());
            }
            if (vm.canForget) {
                options.push(Menu.option(vm.i18n`Forget room`, () => vm.forgetRoom()).setDestructive());
            }
            if (vm.canRejoin) {
                options.push(Menu.option(vm.i18n`Rejoin room`, () => vm.rejoinRoom()));
            }
            if (!options.length) {
                return;
            }
            this._optionsPopup = new Popup(new Menu(options));
            this._optionsPopup.trackInTemplateView(this);
            this._optionsPopup.showRelativeTo(evt.target, {
                horizontal: {
                    relativeTo: "end",
                    align: "start",
                    after: 0
                },
                vertical: {
                    relativeTo: "start",
                    align: "end",
                    before: -32 - 4
                }
            });
        }
    }
}
