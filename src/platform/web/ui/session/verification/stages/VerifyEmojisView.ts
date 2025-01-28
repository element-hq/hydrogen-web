/*
Copyright 2025 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import {Builder, TemplateView} from "../../../general/TemplateView";
import {spinner} from "../../../common.js"
import type {VerifyEmojisViewModel} from "../../../../../../domain/session/verification/stages/VerifyEmojisViewModel";

export class VerifyEmojisView extends TemplateView<VerifyEmojisViewModel> {
    render(t: Builder<VerifyEmojisViewModel>, vm: VerifyEmojisViewModel) {
        const emojiList = vm.emojis.reduce((acc, [emoji, name]) => {
            const e = t.div({ className: "EmojiContainer" }, [
                t.div({ className: "EmojiContainer__emoji" }, emoji),
                t.div({ className: "EmojiContainer__name" }, name),
            ]);
            acc.push(e);
            return acc;
        }, [] as any);
        const emojiCollection = t.div({ className: "EmojiCollection" }, emojiList);
        return t.div({ className: "VerifyEmojisView" }, [
            t.div({ className: "VerifyEmojisView__heading" }, [
                t.h2(
                    { className: "VerifyEmojisView__title" },
                    vm.i18n`Do the emojis match?`
                ),
            ]),
            t.p(
                { className: "VerifyEmojisView__description" },
                vm.i18n`Confirm the emoji below are displayed on both devices, in the same order:`
            ),
            t.div({ className: "VerifyEmojisView__emojis" }, emojiCollection),
            t.map(vm => vm.isWaiting, (isWaiting, t, vm) => {
                if (isWaiting) {
                    return t.div({ className: "VerifyEmojisView__waiting" }, [
                        spinner(t),
                        t.span(vm.i18n`Waiting for you to verify on your other device`),
                    ]);
                }
                else {
                    return t.div({ className: "VerifyEmojisView__actions" }, [
                        t.button(
                            {
                                className: {
                                    "button-action": true,
                                    primary: true,
                                    destructive: true,
                                },
                                onclick: () => vm.setEmojiMatch(false),
                            },
                            vm.i18n`They don't match`
                        ),
                        t.button(
                            {
                                className: {
                                    "button-action": true,
                                    primary: true,
                                },
                                onclick: () => vm.setEmojiMatch(true),
                            },
                            vm.i18n`They match`
                        ),
                    ]);
                }
            })
        ]);
    }
}
