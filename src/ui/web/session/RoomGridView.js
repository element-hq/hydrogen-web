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
        const children = [];
        for (let y = 0; y < vm.height; y+=1) {
            for (let x = 0; x < vm.width; x+=1) {
                children.push(t.div({
                    onClick: () => vm.setFocusAt(x, y),
                    onFocusin: () => vm.setFocusAt(x, y),
                    className: "container",
                    style: `--column: ${x + 1}; --row: ${y + 1}`
                },t.mapView(vm => vm.roomViewModelAt(x, y), roomVM => {
                    if (roomVM) {
                        return new RoomView(roomVM);
                    } else {
                        return new RoomPlaceholderView();
                    }
                })));
            }
        }
        children.push(t.div({className: "focus-ring", style: vm => `--column: ${vm.focusX + 1}; --row: ${vm.focusY + 1}`}));
        return t.div({
            className: "RoomGridView",
            style: `--columns: ${vm.width}; --rows: ${vm.height}`
        }, children);
    }
}
