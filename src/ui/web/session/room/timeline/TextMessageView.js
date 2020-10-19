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

import {TemplateView} from "../../../general/TemplateView.js";
import {StaticView} from "../../../general/StaticView.js";
import {renderMessage} from "./common.js";

export class TextMessageView extends TemplateView {
    render(t, vm) {
        const bodyView = t.mapView(vm => vm.text, text => new BodyView(text));
        return renderMessage(t, vm,
            [t.p([bodyView, t.time({className: {hidden: !vm.date}}, vm.date + " " + vm.time)])]
        );
    }
}

class BodyView extends StaticView {
    render(t, value) {
        const lines = value.split("\n");
        if (lines.length === 1) {
            return lines[0];
        }
        const elements = [];
        for (const line of lines) {
            if (elements.length) {
                elements.push(t.br());
            }
            if (line.length) {
                elements.push(t.span(line));
            }
        }
        return t.span(elements);
    }
}
