/*
Copyright 2025 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
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
