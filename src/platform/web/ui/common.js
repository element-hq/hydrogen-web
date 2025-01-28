/*
Copyright 2025 New Vector Ltd.
Copyright 2020 Bruno Windels <bruno@windels.cloud>

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

let container;

export function spinner(t, extraClasses = undefined) {
    if (container === undefined) {
        container = document.querySelector(".hydrogen");
    }
    const classes = Object.assign({"spinner": true}, extraClasses);
    if (container?.classList.contains("legacy")) {
        return t.div({className: classes}, [
            t.div(),
            t.div(),
            t.div(),
            t.div(),
        ]);
    } else {
        return t.svg({className: classes, viewBox:"0 0 100 100"}, 
            t.circle({cx:"50%", cy:"50%", r:"45%", pathLength:"100"})
        );
    }
}

