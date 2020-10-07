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

import {RoomView} from "./room/RoomView.js";
import {RoomPlaceholderView} from "./RoomPlaceholderView.js";
import {TemplateView} from "../general/TemplateView.js";

export class RoomGridView extends TemplateView {
    render(t, vm) {
        const roomViews = [];
        const len = vm.width * vm.height;
        for (let i = 0; i < len; i+=1) {
            roomViews[i] = t.div({
                onClick: () => vm.setFocusedIndex(i),
                onFocusin: () => vm.setFocusedIndex(i),
                className: {focused: vm => vm.focusedIndex === i},
            },t.mapView(vm => vm.roomViewModelAt(i), roomVM => {
                if (roomVM) {
                    return new RoomView(roomVM);
                } else {
                    return new RoomPlaceholderView();
                }
            }))
        }
        return t.div({
            className: "RoomGridView",
            style: `--columns: ${vm.width}; --rows: ${vm.height}`
        }, roomViews);
    }
}
