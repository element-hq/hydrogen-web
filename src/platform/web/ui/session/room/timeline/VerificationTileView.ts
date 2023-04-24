/*
Copyright 2022 The Matrix.org Foundation C.I.C.

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

import {Builder, TemplateView} from "../../../general/TemplateView";
import type {VerificationTile} from "../../../../../../domain/session/room/timeline/tiles/VerificationTile";

export class VerificationTileView extends TemplateView<VerificationTile> {
    render(t: Builder<VerificationTile>, vm: VerificationTile) {
        return t.div( { className: "VerificationTileContainer" }, 
            t.div({ className: "VerificationTileView" }, [
                t.div({className: "VerificationTileView__shield"}),
                t.div({ className: "VerificationTileView__description" }, vm.description),
                t.div({ className: "VerificationTileView__actions" }, [
                    t.button({ className: "VerificationTileView__accept button-action primary" }, "Accept"),
                    t.button({ className: "VerificationTileView__reject button-action secondary" }, "Reject"),
                ]),
            ])
        );
    }
    
    /* This is called by the parent ListView, which just has 1 listener for the whole list */
    onClick(evt) {
        if (evt.target.classList.contains("VerificationTileView__accept")) {
            this.value.accept();
        } else if (evt.target.classList.contains("VerificationTileView__reject")) {
            this.value.reject();
        }
    }
}
