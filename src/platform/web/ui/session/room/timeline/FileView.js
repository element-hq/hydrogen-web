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

import {BaseMessageView} from "./BaseMessageView";

export class FileView extends BaseMessageView {
    renderMessageBody(t, vm) {
        const children = [];
        if (vm.isPending) {
            children.push(vm => vm.label);
        } else {
            children.push(
                t.button({className: "link", onClick: () => vm.download()}, vm => vm.label),
                t.time(vm.date + " " + vm.time)
            );
        }
        return t.p({className: "Timeline_messageBody statusMessage"}, children);
    }
}
