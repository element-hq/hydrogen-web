/*
Copyright 2025 New Vector Ltd.
Copyright 2021 The Matrix.org Foundation C.I.C.
Copyright 2021 Daniel Fedorin <danila.fedorin@gmail.com>

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/
export interface IMountArgs {
    // if true, the parent will call update() rather than the view updating itself by binding to a data source.
    parentProvidesUpdates?: boolean
};

// Comment nodes can be used as temporary placeholders for Elements, like TemplateView does.
export type ViewNode = Element | Comment;

export interface IView {
    mount(args?: IMountArgs): ViewNode;
    root(): ViewNode | undefined; // should only be called between mount() and unmount()
    unmount(): void;
    update(...any); // this isn't really standarized yet
}
