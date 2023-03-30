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
