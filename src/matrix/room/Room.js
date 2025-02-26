/*
Copyright 2025 New Vector Ltd.
Copyright 2020 Bruno Windels <bruno@windels.cloud>

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import {BaseRoom} from "./BaseRoom.js";
import {SyncWriter} from "./timeline/persistence/SyncWriter.js";
import {MemberWriter} from "./timeline/persistence/MemberWriter.js";
import {RelationWriter} from "./timeline/persistence/RelationWriter.js";
import {SendQueue} from "./sending/SendQueue.js";
import {WrappedError} from "../error.js"
import {Heroes} from "./members/Heroes.js";
import {AttachmentUpload} from "./AttachmentUpload.js";
import {DecryptionSource} from "../e2ee/common";
import {iterateResponseStateEvents} from "./common";
import {PowerLevels, EVENT_TYPE as POWERLEVELS_EVENT_TYPE } from "./PowerLevels.js";

const EVENT_ENCRYPTED_TYPE = "m.room.encrypted";

export class Room extends BaseRoom {
    constructor(options) {
        super(options);
        this._roomStateHandler = options.roomStateHandler;
        // TODO: pass pendingEvents to start like pendingOperations?
        const {pendingEvents} = options;
        const relationWriter = new RelationWriter({
            roomId: this.id,
            fragmentIdComparer: this._fragmentIdComparer,
            ownUserId: this._user.id
        });
        this._syncWriter = new SyncWriter({
            roomId: this.id,
            fragmentIdComparer: this._fragmentIdComparer,
            relationWriter,
            memberWriter: new MemberWriter(this.id)
        });
        this._sendQueue = new SendQueue({roomId: this.id, storage: this._storage, hsApi: this._hsApi, pendingEvents});
    }

    _setEncryption(roomEncryption) {
        if (super._setEncryption(roomEncryption)) {
            this._sendQueue.enableEncryption(this._roomEncryption);
            return true;
        }
        return false;
    }

    async prepareSync(roomResponse, membership, newKeys, txn, log) {
        log.set("id", this.id);
        if (newKeys) {
            log.set("newKeys", newKeys.length);
        }
        let summaryChanges = this._summary.data.applySyncResponse(roomResponse, membership, this._user.id);
        let roomEncryption = this._roomEncryption;
        // encryption is enabled in this sync
        if (!roomEncryption && summaryChanges.encryption) {
            log.set("enableEncryption", true);
            roomEncryption = this._createRoomEncryption(this, summaryChanges.encryption);
        }

        let retryEntries;
        let decryptPreparation;
        if (roomEncryption) {
            let eventsToDecrypt = roomResponse?.timeline?.events || [];
            // when new keys arrive, also see if any older events can now be retried to decrypt
            if (newKeys) {
                // TODO: if a key is considered by roomEncryption.prepareDecryptAll to use for decryption,
                // key.eventIds will be set. We could somehow try to reuse that work, but retrying also needs
                // to happen if a key is not needed to decrypt this sync or there are indeed no encrypted messages
                // in this sync at all.
                retryEntries = await this._getSyncRetryDecryptEntries(newKeys, roomEncryption, txn);
                if (retryEntries.length) {
                    log.set("retry", retryEntries.length);
                    eventsToDecrypt = eventsToDecrypt.concat(retryEntries.map(entry => entry.event));
                }
            }
            eventsToDecrypt = eventsToDecrypt.filter(event => {
                return event?.type === EVENT_ENCRYPTED_TYPE;
            });
            if (eventsToDecrypt.length) {
                decryptPreparation = await roomEncryption.prepareDecryptAll(
                    eventsToDecrypt, newKeys, DecryptionSource.Sync, txn);
            }
        }

        return {
            roomEncryption,
            summaryChanges,
            decryptPreparation,
            decryptChanges: null,
            retryEntries
        };
    }

    async afterPrepareSync(preparation, parentLog) {
        if (preparation.decryptPreparation) {
            await parentLog.wrap("decrypt", async log => {
                log.set("id", this.id);
                preparation.decryptChanges = await preparation.decryptPreparation.decrypt();
                preparation.decryptPreparation = null;
            }, parentLog.level.Detail);
        }
    }

    /** @package */
    async writeSync(roomResponse, isInitialSync, {summaryChanges, decryptChanges, roomEncryption, retryEntries}, txn, log) {
        log.set("id", this.id);
        const isRejoin = summaryChanges.isNewJoin(this._summary.data);
        if (isRejoin) {
            // remove all room state before calling syncWriter,
            // so no old state sticks around
            txn.roomState.removeAllForRoom(this.id);
            txn.roomMembers.removeAllForRoom(this.id);
        }
        const {entries: newEntries, updatedEntries, newLiveKey, memberChanges, memberSync} =
            await log.wrap("syncWriter", log => this._syncWriter.writeSync(
                roomResponse, isRejoin, summaryChanges.hasFetchedMembers, txn, log), log.level.Detail);
        let decryption;
        if (decryptChanges) {
            decryption = await log.wrap("decryptChanges", log => decryptChanges.write(txn, log));
            log.set("decryptionResults", decryption.results.size);
            log.set("decryptionErrors", decryption.errors.size);
            if (this._isTimelineOpen) {
                await decryption.verifyKnownSenders(txn);
            }
            decryption.applyToEntries(newEntries);
            if (retryEntries?.length) {
                decryption.applyToEntries(retryEntries);
                updatedEntries.push(...retryEntries);
            }
        }
        log.set("newEntries", newEntries.length);
        log.set("updatedEntries", updatedEntries.length);
        let encryptionChanges;
        // pass member changes to device tracker
        if (roomEncryption) {
            encryptionChanges = await roomEncryption.writeSync(roomResponse, memberChanges, txn, log);
            log.set("shouldFlushKeyShares", encryptionChanges.shouldFlush);
        }
        const allEntries = newEntries.concat(updatedEntries);
        // also apply (decrypted) timeline entries to the summary changes
        summaryChanges = summaryChanges.applyTimelineEntries(
            allEntries, isInitialSync, !this._isTimelineOpen, this._user.id);
        
        // if we've have left the room, remove the summary
        if (summaryChanges.membership !== "join") {
            txn.roomSummary.remove(this.id);
        } else {
            // write summary changes, and unset if nothing was actually changed
            summaryChanges = this._summary.writeData(summaryChanges, txn);
        }
        if (summaryChanges) {
            log.set("summaryChanges", summaryChanges.changedKeys(this._summary.data));
        }
        // fetch new members while we have txn open,
        // but don't make any in-memory changes yet
        let heroChanges;
        // if any hero changes their display name, the summary in the room response
        // is also updated, which will trigger a RoomSummary update
        // and make summaryChanges non-falsy here
        if (summaryChanges?.needsHeroes) {
            // room name disappeared, open heroes
            if (!this._heroes) {
                this._heroes = new Heroes(this._roomId);
            }
            heroChanges = await this._heroes.calculateChanges(summaryChanges.heroes, memberChanges, txn);
        }
        let removedPendingEvents;
        if (Array.isArray(roomResponse.timeline?.events)) {
            removedPendingEvents = await this._sendQueue.removeRemoteEchos(roomResponse.timeline.events, txn, log);
        }
        const powerLevelsEvent = this._getPowerLevelsEvent(roomResponse);
        await this._runRoomStateHandlers(roomResponse, memberSync, txn, log);
        return {
            roomResponse,
            summaryChanges,
            roomEncryption,
            newEntries,
            updatedEntries,
            newLiveKey,
            removedPendingEvents,
            memberChanges,
            heroChanges,
            powerLevelsEvent,
            encryptionChanges,
            decryption
        };
    }

    /**
     * @package
     * Called with the changes returned from `writeSync` to apply them and emit changes.
     * No storage or network operations should be done here.
     */
    afterSync(changes, log) {
        const {
            summaryChanges, newEntries, updatedEntries, newLiveKey,
            removedPendingEvents, memberChanges, powerLevelsEvent,
            heroChanges, roomEncryption, roomResponse, encryptionChanges
        } = changes;
        log.set("id", this.id);
        this._syncWriter.afterSync(newLiveKey);
        this._setEncryption(roomEncryption);
        if (this._roomEncryption) {
            this._roomEncryption.afterSync(encryptionChanges);
        }
        if (memberChanges.size) {
            if (this._changedMembersDuringSync) {
                for (const [userId, memberChange] of memberChanges.entries()) {
                    this._changedMembersDuringSync.set(userId, memberChange.member);
                }
            }
            if (this._memberList) {
                this._memberList.afterSync(memberChanges);
            }
            this._roomStateHandler.updateRoomMembers(this, memberChanges);
            if (this._observedMembers) {
                this._updateObservedMembers(memberChanges);
            }
            if (this._timeline) {
                for (const [userId, memberChange] of memberChanges.entries()) {
                    if (userId === this._user.id) {
                        this._timeline.updateOwnMember(memberChange.member);
                        break;
                    }
                }
            }
        }
        let emitChange = false;
        if (summaryChanges) {
            this._summary.applyChanges(summaryChanges);
            if (!this._summary.data.needsHeroes) {
                this._heroes = null;
            }
            emitChange = true;
        }
        if (this._heroes && heroChanges) {
            const oldName = this.name;
            this._heroes.applyChanges(heroChanges, this._summary.data, log);
            if (oldName !== this.name) {
                emitChange = true;
            }
        }
        if (powerLevelsEvent) {
            this._updatePowerLevels(powerLevelsEvent);
        }
        if (emitChange) {
            this._emitUpdate();
        }
        if (this._timeline) {
            // these should not be added if not already there
            this._timeline.replaceEntries(updatedEntries);
            this._timeline.addEntries(newEntries);
        }
        if (this._observedEvents) {
            this._observedEvents.updateEvents(updatedEntries);
            this._observedEvents.updateEvents(newEntries);
        }
        if (removedPendingEvents) {
            this._sendQueue.emitRemovals(removedPendingEvents);
        }
        this._emitSyncRoomState(roomResponse);
    }

    _updateObservedMembers(memberChanges) {
        for (const [userId, memberChange] of memberChanges) {
            const observableMember = this._observedMembers.get(userId);
            if (observableMember) {
                observableMember.set(memberChange.member);
            }
        }
    }

    _getPowerLevelsEvent(roomResponse) {
        let powerLevelEvent;
        iterateResponseStateEvents(roomResponse, event => {
            if(event.state_key === "" && event.type === POWERLEVELS_EVENT_TYPE) {
                powerLevelEvent = event;
            }

        });
        return powerLevelEvent;
    }

    _updatePowerLevels(powerLevelEvent) {
        if (this._powerLevels) {
            const newPowerLevels = new PowerLevels({
                powerLevelEvent,
                ownUserId: this._user.id,
                membership: this.membership,
            });
            this._powerLevels.set(newPowerLevels);
        }
    }

    /**
     * Only called if the result of writeSync had `needsAfterSyncCompleted` set.
     * Can be used to do longer running operations that resulted from the last sync,
     * like network operations.
     */
    async afterSyncCompleted({encryptionChanges, decryption, newEntries, updatedEntries}, log) {
        const shouldFlushKeys = encryptionChanges?.shouldFlush;
        const shouldFetchUnverifiedSenders = this._isTimelineOpen && decryption?.hasUnverifiedSenders;
        // only log rooms where we actually do something
        if (shouldFlushKeys || shouldFetchUnverifiedSenders) {
            await log.wrap({l: "room", id: this.id}, async log => {
                const promises = [];
                if (shouldFlushKeys) {
                    promises.push(this._roomEncryption.flushPendingRoomKeyShares(this._hsApi, null, log));
                }
                if (shouldFetchUnverifiedSenders) {
                    const promise = log.wrap("verify senders", (async log => {
                        const newlyVerifiedDecryption = await decryption.fetchAndVerifyRemainingSenders(this._hsApi, log);
                        const verifiedEntries = [];
                        const updateCallback = entry => verifiedEntries.push(entry);
                        newlyVerifiedDecryption.applyToEntries(newEntries, updateCallback);
                        newlyVerifiedDecryption.applyToEntries(updatedEntries, updateCallback);
                        log.set("verifiedEntries", verifiedEntries.length);
                        this._timeline?.replaceEntries(verifiedEntries);
                        this._observedEvents?.updateEvents(verifiedEntries);
                    }));
                    promises.push(promise);
                }
                await Promise.all(promises);
            });
        }
    }

    /** @package */
    start(pendingOperations, parentLog) {
        if (this._roomEncryption) {
            const roomKeyShares = pendingOperations?.get("share_room_key");
            if (roomKeyShares) {
                // if we got interrupted last time sending keys to newly joined members
                parentLog.wrapDetached("flush room keys", log => {
                    log.set("id", this.id);
                    return this._roomEncryption.flushPendingRoomKeyShares(this._hsApi, roomKeyShares, log);
                });
            }
        }
        
        this._sendQueue.resumeSending(parentLog);
    }

    /** @package */
    async load(summary, txn, log) {
        try {
            await super.load(summary, txn, log);
            await this._syncWriter.load(txn, log);
        } catch (err) {
            throw new WrappedError(`Could not load room ${this._roomId}`, err);
        }
    }

    async _writeGapFill(gapChunk, txn, log) {
        const removedPendingEvents = await this._sendQueue.removeRemoteEchos(gapChunk, txn, log);
        return removedPendingEvents;
    }

    _applyGapFill(removedPendingEvents) {
        this._sendQueue.emitRemovals(removedPendingEvents);
    }

    /** @public */
    sendEvent(eventType, content, attachments, log = null) {
        return this._platform.logger.wrapOrRun(log, "send", log => {
            log.set("id", this.id);
            return this._sendQueue.enqueueEvent(eventType, content, attachments, log);
        });
    }

    /** @public */
    sendRedaction(eventIdOrTxnId, reason, log = null) {
        return this._platform.logger.wrapOrRun(log, "redact", log => {
            log.set("id", this.id);
            return this._sendQueue.enqueueRedaction(eventIdOrTxnId, reason, log);
        });
    }

    /** @public */
    async ensureMessageKeyIsShared(log = null) {
        if (!this._roomEncryption) {
            return;
        }
        return this._platform.logger.wrapOrRun(log, "ensureMessageKeyIsShared", log => {
            log.set("id", this.id);
            return this._roomEncryption.ensureMessageKeyIsShared(this._hsApi, log);
        });
    }

    get avatarColorId() {
        return this._heroes?.roomAvatarColorId || this._roomId;
    }

    get isUnread() {
        return this._summary.data.isUnread;
    }

    get notificationCount() {
        return this._summary.data.notificationCount;
    }
    
    get highlightCount() {
        return this._summary.data.highlightCount;
    }

    get isTrackingMembers() {
        return this._summary.data.isTrackingMembers;
    }

    async _getLastEventId() {
        const lastKey = this._syncWriter.lastMessageKey;
        if (lastKey) {
            const txn = await this._storage.readTxn([
                this._storage.storeNames.timelineEvents,
            ]);
            const eventEntry = await txn.timelineEvents.get(this._roomId, lastKey);
            return eventEntry?.event?.event_id;
        }
    }

    /**
     * Clear the unreaad count in the room, and optionally send a read receipt
     * @param {*} log Logger
     * @param {boolean} sendReceipt Should a receipt be sent.
     * @returns 
     */
    async clearUnread(log = null, sendReceipt = true) {
        if (this.isUnread || this.notificationCount) {
            return await this._platform.logger.wrapOrRun(log, "clearUnread", async log => {
                log.set("id", this.id);
                const txn = await this._storage.readWriteTxn([
                    this._storage.storeNames.roomSummary,
                ]);
                let data;
                try {
                    data = this._summary.writeClearUnread(txn);
                } catch (err) {
                    txn.abort();
                    throw err;
                }
                await txn.complete();
                this._summary.applyChanges(data);
                this._emitUpdate();
                
                try {
                    const lastEventId = sendReceipt && await this._getLastEventId();
                    if (lastEventId) {
                        await this._hsApi.receipt(this._roomId, "m.read", lastEventId);
                    }
                } catch (err) {
                    // ignore ConnectionError
                    if (err.name !== "ConnectionError") {
                        throw err;
                    }
                }
            });
        }
    }

    leave(log = null) {
        return this._platform.logger.wrapOrRun(log, "leave room", async log => {
            log.set("id", this.id);
            await this._hsApi.leave(this.id, {log}).response();
        });
    }

    async inviteUser(userId, reason) {
        if (!userId) {
            throw new Error("userId is null/undefined");
        }
        await this._hsApi.invite(this.id, userId, reason).response();
    }

    /* called by BaseRoom to pass pendingEvents when opening the timeline */
    _getPendingEvents() {
        return this._sendQueue.pendingEvents;
    }

    /** global room state handlers, run during writeSync step */
    _runRoomStateHandlers(roomResponse, memberSync, txn, log) {
        const promises = [];
        iterateResponseStateEvents(roomResponse, event => {
            promises.push(this._roomStateHandler.handleRoomState(this, event, memberSync, txn, log));
        });
        return Promise.all(promises);
    }

    /** local room state observers, run during afterSync step */
    _emitSyncRoomState(roomResponse) {
        iterateResponseStateEvents(roomResponse, event => {
            for (const handler of this._roomStateObservers) {
                handler.handleStateEvent(event);
            }
        });
    }

    /** @package */
    writeIsTrackingMembers(value, txn) {
        return this._summary.writeIsTrackingMembers(value, txn);
    }

    /** @package */
    applyIsTrackingMembersChanges(changes) {
        this._summary.applyChanges(changes);
    }

    createAttachment(blob, filename) {
        return new AttachmentUpload({blob, filename, platform: this._platform});
    }

    dispose() {
        super.dispose();
        this._sendQueue.dispose();
    }
}
