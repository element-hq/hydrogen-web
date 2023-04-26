/*
Copyright 2023 The Matrix.org Foundation C.I.C.

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

import {TemplateView, TemplateBuilder} from "../../general/TemplateView";
import {ViewNode} from "../../general/types";
import {disableTargetCallback} from "../../general/utils";
import type {FeaturesViewModel, FeatureViewModel} from "../../../../../domain/session/settings/FeaturesViewModel";

export class FeaturesView extends TemplateView<FeaturesViewModel> {
    render(t, vm: FeaturesViewModel): ViewNode {
        return t.div({
            className: "FeaturesView",
        }, [
            t.p("Enable experimental features here that are still in development. These are not yet ready for primetime, so expect bugs."),
            // we don't use a binding/ListView because this is a static list
            t.ul(vm.featureViewModels.map(vm => {
                return t.li(t.view(new FeatureView(vm)));
            }))
        ]);
    }
}

class FeatureView extends TemplateView<FeatureViewModel> {
    render(t, vm): ViewNode {
        let id = `feature_${vm.id}`;
        return t.div({className: "FeatureView"}, [
            t.input({
                type: "checkbox",
                id,
                checked: vm => vm.enabled,
                onChange: evt => vm.enableFeature(evt.target.checked)
            }),
            t.div({class: "FeatureView_container"}, [
                t.h4(t.label({for: id}, vm.name)),
                t.p(vm.description)
            ])
        ]);
    }
}
