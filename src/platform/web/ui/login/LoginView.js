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

import {TemplateView} from "../general/TemplateView.js";
import {hydrogenGithubLink} from "./common.js";
import {PasswordLoginView} from "./PasswordLoginView.js";
import {CompleteSSOView} from "./CompleteSSOView.js";

export class LoginView extends TemplateView {
    render(t) {
        return t.div({ className: "PreSessionScreen" }, [
            t.div({ className: "logo" }),
            t.mapView(vm => vm.completeSSOLoginViewModel, vm => vm? new CompleteSSOView(vm): null),
            t.mapView(vm => vm.passwordLoginViewModel, vm => vm? new PasswordLoginView(vm): null),
            t.mapView(vm => vm.startSSOLoginViewModel, vm => vm? new StartSSOLoginView(vm): null),
            // use t.mapView rather than t.if to create a new view when the view model changes too
            t.p(hydrogenGithubLink(t))
        ]);
    }
}

class StartSSOLoginView extends TemplateView {
    render(t, vm) {
        return t.div({ className: "StartSSOLoginView" },
            [
                t.p({ className: "StartSSOLoginView_separator" }, "or"),
                t.button({ className: "StartSSOLoginView_button button-action secondary", type: "button", onClick: () => vm.startSSOLogin() }, "Log in with SSO")
            ]
        );
    }
}
