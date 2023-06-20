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

import {TemplateView} from "../../../general/TemplateView";
import {Status} from "../../../../../../domain/session/room/timeline/tiles/VerificationTile";
import {spinner} from "../../../common.js";
import type {IView} from "../../../general/types";
import type {Builder} from "../../../general/TemplateView";
import type {VerificationTile} from "../../../../../../domain/session/room/timeline/tiles/VerificationTile";

type IClickableView = {
    onClick: (evt) => void;
} & IView; 

export class VerificationTileView extends TemplateView<VerificationTile> {
    render(t: Builder<VerificationTile>, vm: VerificationTile) {
        return t.div({ className: "VerificationTileView" },
            t.mapView(vm => vm.status, (status: Status) => {
                switch (status) {
                    case Status.Ready:
                        return new VerificationReadyTileView(vm);
                    case Status.Cancelled:
                        return new VerificationCancelledTileView(vm);
                    case Status.Completed:
                        return new VerificationCompletedTileView(vm);
                    case Status.InProgress:
                        return new VerificationInProgressTileView(vm);
                }
            })
        );
    }

    onClick(evt) {
        // Propagate click events to the sub-view
        this._subViews?.forEach((s: IClickableView) => s.onClick?.(evt));
    }
}

class VerificationReadyTileView extends TemplateView<VerificationTile> {
    render(t: Builder<VerificationTile>, vm: VerificationTile) {
        return t.div({ className: "VerificationReadyTileView" }, [
            t.div({ className: "VerificationTileView__shield" }),
            t.div({ className: "VerificationTileView__description" }, [
                t.div(vm.description)
            ]),
            t.div({ className: "VerificationTileView__actions" }, [
                t.button({ className: "VerificationTileView__accept button-action primary" }, "Accept"),
                t.button({ className: "VerificationTileView__reject button-action secondary" }, "Reject"),
            ]),
        ]);
    }

    onClick(evt) {
        if (evt.target.classList.contains("VerificationTileView__accept")) {
            this.value.accept();
        } else if (evt.target.classList.contains("VerificationTileView__reject")) {
            this.value.reject();
        }
    }
}


class VerificationCancelledTileView extends TemplateView<VerificationTile> {
    render(t: Builder<VerificationTile>, vm: VerificationTile) {
        return t.div({ className: "VerificationCancelledTileView" }, [
            t.div({ className: "VerificationTileView__description" },
                vm.i18n`${vm.isCancelledByUs? "You": vm.sender} cancelled the verification!`),
        ]);
    }
}

class VerificationCompletedTileView extends TemplateView<VerificationTile> {
    render(t: Builder<VerificationTile>, vm: VerificationTile) {
        return t.div({ className: "VerificationCompletedTileView" }, [
            t.div({ className: "VerificationTileView__description" }, [
                t.div({ className: "VerificationTileView__shield" }),
                t.div(vm.i18n`You verified ${vm.sender}`),
            ]),
        ]);
    }
}

class VerificationInProgressTileView extends TemplateView<VerificationTile> {
    render(t: Builder<VerificationTile>, vm: VerificationTile) {
        return t.div({ className: "VerificationInProgressTileView" }, [
            t.div({ className: "VerificationTileView__description" },
                vm.i18n`Verification in progress`),
            t.div({ className: "VerificationTileView__actions" }, [
                spinner(t)
            ]),
        ]);
    }
}
