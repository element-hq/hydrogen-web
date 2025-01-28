/*
Copyright 2025 New Vector Ltd.
Copyright 2020 Bruno Windels <bruno@windels.cloud>
Copyright 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import {TemplateView} from "../../general/TemplateView";
import {LoadingView} from "../../general/LoadingView";
import {AvatarView} from "../../AvatarView";

export class RoomBeingCreatedView extends TemplateView {
    render(t, vm) {
        return t.main({className: "RoomView middle"}, [
            t.div({className: "RoomHeader middle-header"}, [
                t.a({className: "button-utility close-middle", href: vm.closeUrl, title: vm.i18n`Close room`}),
                t.view(new AvatarView(vm, 32)),
                t.div({className: "room-description"}, [
                    t.h2(vm => vm.name),
                ])
            ]),
            t.div({className: "RoomView_body"}, [
                t.mapView(vm => vm.error, error => {
                    if (error) {
                        return new ErrorView(vm);
                    } else {
                        return new LoadingView(vm.i18n`Setting up the room…`);
                    }
                })
            ])
        ]);
    }
}

class ErrorView extends TemplateView {
    render(t,vm) {
        return t.div({className: "RoomBeingCreated_error centered-column"}, [
            t.h3(vm.i18n`Could not create the room, something went wrong:`),
            t.div({className: "RoomView_error form-group"}, vm.error),
            t.div({className: "button-row"},
                t.button({
                    className: "button-action primary destructive",
                    onClick: () => vm.cancel()
                }, vm.i18n`Cancel`))
        ]);
    }
}
