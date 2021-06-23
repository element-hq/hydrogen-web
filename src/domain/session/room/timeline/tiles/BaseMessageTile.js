/*
Copyright 2020 Bruno Windels <bruno@windels.cloud>

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

import {SimpleTile} from "./SimpleTile.js";
import {ReactionsViewModel} from "../ReactionsViewModel.js";
import {getIdentifierColorNumber, avatarInitials, getAvatarHttpUrl} from "../../../../avatar.js";

export class BaseMessageTile extends SimpleTile {
    constructor(options) {
        super(options);
        this._date = this._entry.timestamp ? new Date(this._entry.timestamp) : null;
        this._isContinuation = false;
        this._reactions = null;
        if (this._entry.annotations || this._entry.pendingAnnotations) {
            this._updateReactions();
        }
        this._pendingReactionChangeCallback = null;
    }

    get _mediaRepository() {
        return this._room.mediaRepository;
    }

    get displayName() {
        return this._entry.displayName || this.sender;
    }

    get sender() {
        return this._entry.sender;
    }

    // Avatar view model contract
    get avatarColorNumber() {
        return getIdentifierColorNumber(this._entry.sender);
    }

    avatarUrl(size) {
        return getAvatarHttpUrl(this._entry.avatarUrl, size, this.platform, this._mediaRepository);
    }

    get avatarLetter() {
        return avatarInitials(this.sender);
    }

    get avatarTitle() {
        return this.displayName;
    }

    get date() {
        return this._date && this._date.toLocaleDateString({}, {month: "numeric", day: "numeric"});
    }

    get time() {
        return this._date && this._date.toLocaleTimeString({}, {hour: "numeric", minute: "2-digit"});
    }

    get isOwn() {
        return this._entry.sender === this._ownMember.userId;
    }

    get isContinuation() {
        return this._isContinuation;
    }

    get isUnverified() {
        return this._entry.isUnverified;
    }

    _getContent() {
        return this._entry.content;
    }

    updatePreviousSibling(prev) {
        super.updatePreviousSibling(prev);
        let isContinuation = false;
        if (prev && prev instanceof BaseMessageTile && prev.sender === this.sender) {
            // timestamp is null for pending events
            const myTimestamp = this._entry.timestamp;
            const otherTimestamp = prev._entry.timestamp;
            // other message was sent less than 5min ago
            isContinuation = (myTimestamp - otherTimestamp) < (5 * 60 * 1000);
        }
        if (isContinuation !== this._isContinuation) {
            this._isContinuation = isContinuation;
            this.emitChange("isContinuation");
        }
    }

    updateEntry(entry, param) {
        const action = super.updateEntry(entry, param);
        if (action.shouldUpdate) {
            this._updateReactions();
        }
        return action;
    }

    redact(reason, log) {
        return this._room.sendRedaction(this._entry.id, reason, log);
    }

    get canRedact() {
        return this._powerLevels.canRedactFromSender(this._entry.sender);
    }

    get reactions() {
        return this._reactions;
    }

    get canReact() {
        return this._powerLevels.canSendType("m.reaction");
    }

    react(key, log = null) {
        return this.logger.wrapOrRun(log, "react", log => {
            const keyVM = this.reactions?.getReaction(key);
            if (keyVM?.haveReacted) {
                log.set("already_reacted", true);
                return;
            }
            return this._react(key, log);
        });
    }

    async _react(key, log) {
        // This will also block concurently adding multiple reactions,
        // but in practice it happens fast enough.
        if (this._pendingReactionChangeCallback) {
            log.set("ongoing", true);
            return;
        }
        const redaction = this._entry.getAnnotationPendingRedaction(key);
        const updatePromise = new Promise(resolve => this._pendingReactionChangeCallback = resolve);
        if (redaction && !redaction.pendingEvent.hasStartedSending) {
            log.set("abort_redaction", true);
            await redaction.pendingEvent.abort();
        } else {
            await this._room.sendEvent("m.reaction", this._entry.annotate(key), null, log);
        }
        await updatePromise;
        this._pendingReactionChangeCallback = null;
    }

    redactReaction(key, log = null) {
        return this.logger.wrapOrRun(log, "redactReaction", log => {
            const keyVM = this.reactions?.getReaction(key);
            if (!keyVM?.haveReacted) {
                log.set("not_yet_reacted", true);
                return;
            }
            return this._redactReaction(key, log);
        });
    }

    async _redactReaction(key, log) {
        // This will also block concurently removing multiple reactions,
        // but in practice it happens fast enough.
        if (this._pendingReactionChangeCallback) {
            log.set("ongoing", true);
            return;
        }
        return this.logger.wrapOrRun(log, "redactReaction", async log => {
            const entry = await this._entry.getOwnAnnotationEntry(this._timeline, key);
            if (entry) {
                const updatePromise = new Promise(resolve => this._pendingReactionChangeCallback = resolve);
                await this._room.sendRedaction(entry.id, null, log);
                await updatePromise;
                this._pendingReactionChangeCallback = null;
            } else {
                log.set("no_reaction", true);
            }
        });
    }

    _updateReactions() {
        const {annotations, pendingAnnotations} = this._entry;
        if (!annotations && !pendingAnnotations) {
            if (this._reactions) {
                this._reactions = null;
                // The update comes in async because pending events are mapped in the timeline
                // to pending event entries using an AsyncMappedMap, because in rare cases, the target
                // of a redaction needs to be loaded from storage in order to know for which message
                // the reaction needs to be removed. The SendQueue also only adds pending events after
                // storing them first.
                // This makes that if we want to know the local echo for either react or redactReaction is available,
                // we need to async wait for the update call. In theory the update can also be triggered
                // by something else than the reaction local echo changing (e.g. from sync),
                // but this is very unlikely and deemed good enough for now.
                this._pendingReactionChangeCallback && this._pendingReactionChangeCallback();
            }
        } else {
            if (!this._reactions) {
                this._reactions = new ReactionsViewModel(this);
            }
            this._reactions.update(annotations, pendingAnnotations);
            this._pendingReactionChangeCallback && this._pendingReactionChangeCallback();
        }
    }
}
