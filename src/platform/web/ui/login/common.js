/*
Copyright 2025 New Vector Ltd.
Copyright 2020 Bruno Windels <bruno@windels.cloud>

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

export function hydrogenGithubLink(t) {
    if (DEFINE_VERSION === "develop") {
        return t.a(
            {
                target: "_blank",
                href: `https://github.com/vector-im/hydrogen-web`,
            },
            `Hydrogen develop, ${DEFINE_GLOBAL_HASH}`
        );
    } else if (DEFINE_VERSION && DEFINE_GLOBAL_HASH) {
        return t.a(
            {
                target: "_blank",
                href: `https://github.com/vector-im/hydrogen-web/releases/tag/v${DEFINE_VERSION}`,
            },
            `Hydrogen v${DEFINE_VERSION} (${DEFINE_GLOBAL_HASH}) on Github`
        );
    } else {
        return t.a(
            {
                target: "_blank",
                href: "https://github.com/vector-im/hydrogen-web",
            },
            "Hydrogen on Github"
        );
    }
}
