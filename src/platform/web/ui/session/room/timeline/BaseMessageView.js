/*
Copyright 2025 New Vector Ltd.
Copyright 2020 Bruno Windels <bruno@windels.cloud>
Copyright 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import {renderStaticAvatar} from "../../../avatar";
import {tag} from "../../../general/html";
import {mountView} from "../../../general/utils";
import {TemplateView} from "../../../general/TemplateView";
import {Popup} from "../../../general/Popup.js";
import {Menu} from "../../../general/Menu.js";
import {ReactionsView} from "./ReactionsView.js";

export class BaseMessageView extends TemplateView {
    constructor(value, viewClassForTile, renderFlags, tagName = "li") {
        super(value);
        this._menuPopup = null;
        this._tagName = tagName;
        this._viewClassForTile = viewClassForTile;
        // TODO An enum could be nice to make code easier to read at call sites.
        this._renderFlags = renderFlags;
    }

    get _interactive() { return this._renderFlags?.interactive ?? true; }
    get _isReplyPreview() { return this._renderFlags?.reply; }

    render(t, vm) {
        const children = [this.renderMessageBody(t, vm)];
        if (this._interactive) {
            children.push(t.button({className: "Timeline_messageOptions"}, "⋯"));
        }
        const li = t.el(this._tagName, {
            className: {
                "Timeline_message": true,
                own: vm.isOwn,
                unsent: vm.isUnsent,
                unverified: vm => vm.isUnverified,
                disabled: !this._interactive,
                continuation: vm => vm.isContinuation,
            },
            'data-event-id': vm.eventId
        }, children);
        // given that there can be many tiles, we don't add
        // unneeded DOM nodes in case of a continuation, and we add it
        // with a side-effect binding to not have to create sub views,
        // as the avatar or sender doesn't need any bindings or event handlers.
        // don't use `t` from within the side-effect callback
        t.mapSideEffect(vm => vm.isContinuation, (isContinuation, wasContinuation) => {
            if (isContinuation && wasContinuation === false) {
                li.removeChild(li.querySelector(".Timeline_messageAvatar"));
                li.removeChild(li.querySelector(".Timeline_messageSender"));
            } else if (!isContinuation && !this._isReplyPreview) {
                const avatar = tag.a({href: vm.memberPanelLink, className: "Timeline_messageAvatar"}, [renderStaticAvatar(vm, 30)]);
                const sender = tag.div(
                    {
                        className: `Timeline_messageSender usercolor${vm.avatarColorNumber}`,
                        title: vm.sender,
                    },
                    vm.displayName,
                );
                li.insertBefore(avatar, li.firstChild);
                li.insertBefore(sender, li.firstChild);
            }
        });
        // similarly, we could do this with a simple ifView,
        // but that adds a comment node to all messages without reactions
        let reactionsView = null;
        t.mapSideEffect(vm => vm.reactions, reactions => {
            if (reactions && this._interactive && !reactionsView) {
                reactionsView = new ReactionsView(reactions);
                this.addSubView(reactionsView);
                li.appendChild(mountView(reactionsView));
            } else if (!reactions && reactionsView) {
                li.removeChild(reactionsView.root());
                reactionsView.unmount();
                this.removeSubView(reactionsView);
                reactionsView = null;
            }
        });
        return li;
    }

    /* This is called by the parent ListView, which just has 1 listener for the whole list */
    onClick(evt) {
        if (evt.target.className === "Timeline_messageOptions") {
            this._toggleMenu(evt.target);
        }
    }

    _toggleMenu(button) {
        if (this._menuPopup && this._menuPopup.isOpen) {
            this._menuPopup.close();
        } else {
            const options = this.createMenuOptions(this.value);
            if (!options.length) {
                return;
            }
            this.root().classList.add("menuOpen");
            const onClose = () => this.root().classList.remove("menuOpen");
            this._menuPopup = new Popup(new Menu(options), onClose);
            this._menuPopup.trackInTemplateView(this);
            this._menuPopup.showRelativeTo(button, 2);
        }
    }

    createMenuOptions(vm) {
        const options = [];
        if (vm.canReact && vm.shape !== "redacted" && !vm.isPending) {
            options.push(new QuickReactionsMenuOption(vm));
            options.push(Menu.option(vm.i18n`Reply`, () => vm.startReply()));
        }
        if (vm.canAbortSending) {
            options.push(Menu.option(vm.i18n`Cancel`, () => vm.abortSending()));
        } else if (vm.canRedact) {
            options.push(Menu.option(vm.i18n`Delete`, () => vm.redact()).setDestructive());
        }
        options.push(Menu.option(vm.i18n`Copy matrix.to permalink`, () => vm.copyPermalink()));
        return options;
    }

    renderMessageBody() {}
}

class QuickReactionsMenuOption {
    constructor(vm) {
        this._vm = vm;
    }
    toDOM(t) {
        const emojiButtons = ["👍", "👎", "😂", "🎉", "😄", "😕", "❤️", "🚀", "👀"].map(emoji => {
            return t.button({onClick: () => this._vm.react(emoji)}, emoji);
        });
        const customButton = t.button({onClick: () => {
            const key = prompt("Enter your reaction (emoji)");
            if (key) {
                this._vm.react(key);
            }
        }}, "…");
        return t.li({className: "quick-reactions"}, [...emojiButtons, customButton]);
    }
}
