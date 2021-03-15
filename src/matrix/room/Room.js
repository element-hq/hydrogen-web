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

import {EventEmitter} from "../../utils/EventEmitter.js";
import {RoomSummary} from "./RoomSummary.js";
import {SyncWriter} from "./timeline/persistence/SyncWriter.js";
import {GapWriter} from "./timeline/persistence/GapWriter.js";
import {Timeline} from "./timeline/Timeline.js";
import {FragmentIdComparer} from "./timeline/FragmentIdComparer.js";
import {SendQueue} from "./sending/SendQueue.js";
import {WrappedError} from "../error.js"
import {fetchOrLoadMembers} from "./members/load.js";
import {MemberList} from "./members/MemberList.js";
import {Heroes} from "./members/Heroes.js";
import {EventEntry} from "./timeline/entries/EventEntry.js";
import {ObservedEventMap} from "./ObservedEventMap.js";
import {AttachmentUpload} from "./AttachmentUpload.js";
import {DecryptionSource} from "../e2ee/common.js";
import {ensureLogItem} from "../../logging/utils.js";

const EVENT_ENCRYPTED_TYPE = "m.room.encrypted";

export class Room extends EventEmitter {
    constructor({roomId, storage, hsApi, mediaRepository, emitCollectionChange, pendingEvents, user, createRoomEncryption, getSyncToken, platform}) {
        super();
        this._roomId = roomId;
        this._storage = storage;
        this._hsApi = hsApi;
        this._mediaRepository = mediaRepository;
        this._summary = new RoomSummary(roomId);
        this._fragmentIdComparer = new FragmentIdComparer([]);
        this._syncWriter = new SyncWriter({roomId, fragmentIdComparer: this._fragmentIdComparer});
        this._emitCollectionChange = emitCollectionChange;
        this._sendQueue = new SendQueue({roomId, storage, hsApi, pendingEvents});
        this._timeline = null;
        this._user = user;
        this._changedMembersDuringSync = null;
        this._memberList = null;
        this._createRoomEncryption = createRoomEncryption;
        this._roomEncryption = null;
        this._getSyncToken = getSyncToken;
        this._platform = platform;
        this._observedEvents = null;
    }

    async _eventIdsToEntries(eventIds, txn) {
        const retryEntries = [];
        await Promise.all(eventIds.map(async eventId => {
            const storageEntry = await txn.timelineEvents.getByEventId(this._roomId, eventId);
            if (storageEntry) {
                retryEntries.push(new EventEntry(storageEntry, this._fragmentIdComparer));
            }
        }));
        return retryEntries;
    }

    _getAdditionalTimelineRetryEntries(otherRetryEntries, roomKeys) {
        let retryTimelineEntries = this._roomEncryption.filterUndecryptedEventEntriesForKeys(this._timeline.remoteEntries, roomKeys);
        // filter out any entries already in retryEntries so we don't decrypt them twice
        const existingIds = otherRetryEntries.reduce((ids, e) => {ids.add(e.id); return ids;}, new Set());
        retryTimelineEntries = retryTimelineEntries.filter(e => !existingIds.has(e.id));
        return retryTimelineEntries;
    }

    /**
     * Used for retrying decryption from other sources than sync, like key backup.
     * @internal
     * @param  {RoomKey} roomKey
     * @param  {Array<string>} eventIds any event ids that should be retried. There might be more in the timeline though for this key.
     * @return {Promise}
     */
    async notifyRoomKey(roomKey, eventIds, log) {
        if (!this._roomEncryption) {
            return;
        }
        const txn = await this._storage.readTxn([
            this._storage.storeNames.timelineEvents,
            this._storage.storeNames.inboundGroupSessions,
        ]);
        let retryEntries = await this._eventIdsToEntries(eventIds, txn);
        if (this._timeline) {
            const retryTimelineEntries = this._getAdditionalTimelineRetryEntries(retryEntries, [roomKey]);
            retryEntries = retryEntries.concat(retryTimelineEntries);
        }
        if (retryEntries.length) {
            const decryptRequest = this._decryptEntries(DecryptionSource.Retry, retryEntries, txn, log);
            // this will close txn while awaiting decryption
            await decryptRequest.complete();

            this._timeline?.replaceEntries(retryEntries);
            // we would ideally write the room summary in the same txn as the groupSessionDecryptions in the
            // _decryptEntries entries and could even know which events have been decrypted for the first
            // time from DecryptionChanges.write and only pass those to the summary. As timeline changes
            // are not essential to the room summary, it's fine to write this in a separate txn for now.
            const changes = this._summary.data.applyTimelineEntries(retryEntries, false, false);
            if (await this._summary.writeAndApplyData(changes, this._storage)) {
                this._emitUpdate();
            }
        }
    }

    _setEncryption(roomEncryption) {
        if (roomEncryption && !this._roomEncryption) {
            this._roomEncryption = roomEncryption;
            this._sendQueue.enableEncryption(this._roomEncryption);
            if (this._timeline) {
                this._timeline.enableEncryption(this._decryptEntries.bind(this, DecryptionSource.Timeline));
            }
        }
    }

    /**
     * Used for decrypting when loading/filling the timeline, and retrying decryption,
     * not during sync, where it is split up during the multiple phases.
     */
    _decryptEntries(source, entries, inboundSessionTxn, log = null) {
        const request = new DecryptionRequest(async (r, log) => {
            if (!inboundSessionTxn) {
                inboundSessionTxn = await this._storage.readTxn([this._storage.storeNames.inboundGroupSessions]);
            }
            if (r.cancelled) return;
            const events = entries.filter(entry => {
                return entry.eventType === EVENT_ENCRYPTED_TYPE;
            }).map(entry => entry.event);
            r.preparation = await this._roomEncryption.prepareDecryptAll(events, null, source, inboundSessionTxn);
            if (r.cancelled) return;
            const changes = await r.preparation.decrypt();
            r.preparation = null;
            if (r.cancelled) return;
            const stores = [this._storage.storeNames.groupSessionDecryptions];
            const isTimelineOpen = this._isTimelineOpen;
            if (isTimelineOpen) {
                // read to fetch devices if timeline is open
                stores.push(this._storage.storeNames.deviceIdentities);
            }
            const writeTxn = await this._storage.readWriteTxn(stores);
            let decryption;
            try {
                decryption = await changes.write(writeTxn, log);
                if (isTimelineOpen) {
                    await decryption.verifySenders(writeTxn);
                }
            } catch (err) {
                writeTxn.abort();
                throw err;
            }
            await writeTxn.complete();
            // TODO: log decryption errors here
            decryption.applyToEntries(entries);
            if (this._observedEvents) {
                this._observedEvents.updateEvents(entries);
            }
        }, ensureLogItem(log));
        return request;
    }

    async _getSyncRetryDecryptEntries(newKeys, roomEncryption, txn) {
        const entriesPerKey = await Promise.all(newKeys.map(async key => {
            const retryEventIds = await roomEncryption.getEventIdsForMissingKey(key, txn);
            if (retryEventIds) {
                return this._eventIdsToEntries(retryEventIds, txn);
            }
        }));
        let retryEntries = entriesPerKey.reduce((allEntries, entries) => entries ? allEntries.concat(entries) : allEntries, []);
        // If we have the timeline open, see if there are more entries for the new keys
        // as we only store missing session information for synced events, not backfilled.
        // We want to decrypt all events we can though if the user is looking
        // at them when the timeline is open
        if (this._timeline) {
            const retryTimelineEntries = this._getAdditionalTimelineRetryEntries(retryEntries, newKeys);
            // make copies so we don't modify the original entry in writeSync, before the afterSync stage
            const retryTimelineEntriesCopies = retryTimelineEntries.map(e => e.clone());
            // add to other retry entries
            retryEntries = retryEntries.concat(retryTimelineEntriesCopies);
        }
        return retryEntries;
    }

    async prepareSync(roomResponse, membership, newKeys, txn, log) {
        log.set("id", this.id);
        if (newKeys) {
            log.set("newKeys", newKeys.length);
        }
        const summaryChanges = this._summary.data.applySyncResponse(roomResponse, membership)
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
        const {entries: newEntries, newLiveKey, memberChanges} =
            await log.wrap("syncWriter", log => this._syncWriter.writeSync(roomResponse, txn, log), log.level.Detail);
        let allEntries = newEntries;
        if (decryptChanges) {
            const decryption = await log.wrap("decryptChanges", log => decryptChanges.write(txn, log));
            log.set("decryptionResults", decryption.results.size);
            log.set("decryptionErrors", decryption.errors.size);
            if (this._isTimelineOpen) {
                await decryption.verifySenders(txn);
            }
            decryption.applyToEntries(newEntries);
            if (retryEntries?.length) {
                decryption.applyToEntries(retryEntries);
                allEntries = retryEntries.concat(allEntries);
            }
        }
        log.set("allEntries", allEntries.length);
        let shouldFlushKeyShares = false;
        // pass member changes to device tracker
        if (roomEncryption && this.isTrackingMembers && memberChanges?.size) {
            shouldFlushKeyShares = await roomEncryption.writeMemberChanges(memberChanges, txn, log);
            log.set("shouldFlushKeyShares", shouldFlushKeyShares);
        }
        // also apply (decrypted) timeline entries to the summary changes
        summaryChanges = summaryChanges.applyTimelineEntries(
            allEntries, isInitialSync, !this._isTimelineOpen, this._user.id);
        // write summary changes, and unset if nothing was actually changed
        summaryChanges = this._summary.writeData(summaryChanges, txn);
        if (summaryChanges) {
            log.set("summaryChanges", summaryChanges.diff(this._summary.data));
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
            removedPendingEvents = this._sendQueue.removeRemoteEchos(roomResponse.timeline.events, txn, log);
        }
        return {
            summaryChanges,
            roomEncryption,
            newEntries,
            updatedEntries: retryEntries || [],
            newLiveKey,
            removedPendingEvents,
            memberChanges,
            heroChanges,
            shouldFlushKeyShares,
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
            removedPendingEvents, memberChanges,
            heroChanges, roomEncryption
        } = changes;
        log.set("id", this.id);
        this._syncWriter.afterSync(newLiveKey);
        this._setEncryption(roomEncryption);
        if (memberChanges.size) {
            if (this._changedMembersDuringSync) {
                for (const [userId, memberChange] of memberChanges.entries()) {
                    this._changedMembersDuringSync.set(userId, memberChange.member);
                }
            }
            if (this._memberList) {
                this._memberList.afterSync(memberChanges);
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
            this._heroes.applyChanges(heroChanges, this._summary.data);
            if (oldName !== this.name) {
                emitChange = true;
            }
        }
        if (emitChange) {
            this._emitUpdate();
        }
        if (this._timeline) {
            // these should not be added if not already there
            this._timeline.replaceEntries(updatedEntries);
            this._timeline.addOrReplaceEntries(newEntries);
        }
        if (this._observedEvents) {
            this._observedEvents.updateEvents(updatedEntries);
            this._observedEvents.updateEvents(newEntries);
        }
        if (removedPendingEvents) {
            this._sendQueue.emitRemovals(removedPendingEvents);
        }
    }

    needsAfterSyncCompleted({shouldFlushKeyShares}) {
        return shouldFlushKeyShares;
    }

    /**
     * Only called if the result of writeSync had `needsAfterSyncCompleted` set.
     * Can be used to do longer running operations that resulted from the last sync,
     * like network operations.
     */
    async afterSyncCompleted(changes, log) {
        log.set("id", this.id);
        if (this._roomEncryption) {
            await this._roomEncryption.flushPendingRoomKeyShares(this._hsApi, null, log);
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
        log.set("id", this.id);
        try {
            this._summary.load(summary);
            if (this._summary.data.encryption) {
                const roomEncryption = this._createRoomEncryption(this, this._summary.data.encryption);
                this._setEncryption(roomEncryption);
            }
            // need to load members for name?
            if (this._summary.data.needsHeroes) {
                this._heroes = new Heroes(this._roomId);
                const changes = await this._heroes.calculateChanges(this._summary.data.heroes, [], txn);
                this._heroes.applyChanges(changes, this._summary.data);
            }
            return this._syncWriter.load(txn, log);
        } catch (err) {
            throw new WrappedError(`Could not load room ${this._roomId}`, err);
        }
    }

    /** @public */
    sendEvent(eventType, content, attachments, log = null) {
        this._platform.logger.wrapOrRun(log, "send", log => {
            log.set("id", this.id);
            return this._sendQueue.enqueueEvent(eventType, content, attachments, log);
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

    /** @public */
    async loadMemberList(log = null) {
        if (this._memberList) {
            // TODO: also await fetchOrLoadMembers promise here
            this._memberList.retain();
            return this._memberList;
        } else {
            const members = await fetchOrLoadMembers({
                summary: this._summary,
                roomId: this._roomId,
                hsApi: this._hsApi,
                storage: this._storage,
                syncToken: this._getSyncToken(),
                // to handle race between /members and /sync
                setChangedMembersMap: map => this._changedMembersDuringSync = map,
                log,
            }, this._platform.logger);
            this._memberList = new MemberList({
                members,
                closeCallback: () => { this._memberList = null; }
            });
            return this._memberList;
        }
    } 

    /** @public */
    fillGap(fragmentEntry, amount, log = null) {
        // TODO move some/all of this out of Room
        return this._platform.logger.wrapOrRun(log, "fillGap", async log => {
            log.set("id", this.id);
            log.set("fragment", fragmentEntry.fragmentId);
            log.set("dir", fragmentEntry.direction.asApiString());
            if (fragmentEntry.edgeReached) {
                log.set("edgeReached", true);
                return;
            }
            const response = await this._hsApi.messages(this._roomId, {
                from: fragmentEntry.token,
                dir: fragmentEntry.direction.asApiString(),
                limit: amount,
                filter: {
                    lazy_load_members: true,
                    include_redundant_members: true,
                }
            }, {log}).response();

            const txn = await this._storage.readWriteTxn([
                this._storage.storeNames.pendingEvents,
                this._storage.storeNames.timelineEvents,
                this._storage.storeNames.timelineFragments,
            ]);
            let removedPendingEvents;
            let gapResult;
            try {
                // detect remote echos of pending messages in the gap
                removedPendingEvents = this._sendQueue.removeRemoteEchos(response.chunk, txn, log);
                // write new events into gap
                const gapWriter = new GapWriter({
                    roomId: this._roomId,
                    storage: this._storage,
                    fragmentIdComparer: this._fragmentIdComparer,
                });
                gapResult = await gapWriter.writeFragmentFill(fragmentEntry, response, txn, log);
            } catch (err) {
                txn.abort();
                throw err;
            }
            await txn.complete();
            if (this._roomEncryption) {
                const decryptRequest = this._decryptEntries(DecryptionSource.Timeline, gapResult.entries, null, log);
                await decryptRequest.complete();
            }
            // once txn is committed, update in-memory state & emit events
            for (const fragment of gapResult.fragments) {
                this._fragmentIdComparer.add(fragment);
            }
            if (removedPendingEvents) {
                this._sendQueue.emitRemovals(removedPendingEvents);
            }
            if (this._timeline) {
                this._timeline.addOrReplaceEntries(gapResult.entries);
            }
        });
    }

    /** @public */
    get name() {
        if (this._heroes) {
            return this._heroes.roomName;
        }
        const summaryData = this._summary.data;
        if (summaryData.name) {
            return summaryData.name;
        }
        if (summaryData.canonicalAlias) {
            return summaryData.canonicalAlias;
        }
        return null;
    }

    /** @public */
    get id() {
        return this._roomId;
    }

    get avatarUrl() {
        if (this._summary.data.avatarUrl) {
            return this._summary.data.avatarUrl;
        } else if (this._heroes) {
            return this._heroes.roomAvatarUrl;
        }
        return null;
    }

    get lastMessageTimestamp() {
        return this._summary.data.lastMessageTimestamp;
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

    get isLowPriority() {
        const tags = this._summary.data.tags;
        return !!(tags && tags['m.lowpriority']);
    }

    get isEncrypted() {
        return !!this._summary.data.encryption;
    }

    get membership() {
        return this._summary.data.membership;
    }

    enableSessionBackup(sessionBackup) {
        this._roomEncryption?.enableSessionBackup(sessionBackup);
        // TODO: do we really want to do this every time you open the app?
        if (this._timeline) {
            this._platform.logger.run("enableSessionBackup", log => {
                return this._roomEncryption.restoreMissingSessionsFromBackup(this._timeline.remoteEntries, log);
            });
        }
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

    get _isTimelineOpen() {
        return !!this._timeline;
    }

    _emitUpdate() {
        // once for event emitter listeners
        this.emit("change");
        // and once for collection listeners
        this._emitCollectionChange(this);
    }

    async clearUnread(log = null) {
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
                    const lastEventId = await this._getLastEventId();
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

    /** @public */
    openTimeline(log = null) {
        return this._platform.logger.wrapOrRun(log, "open timeline", async log => {
            log.set("id", this.id);
            if (this._timeline) {
                throw new Error("not dealing with load race here for now");
            }
            this._timeline = new Timeline({
                roomId: this.id,
                storage: this._storage,
                fragmentIdComparer: this._fragmentIdComparer,
                pendingEvents: this._sendQueue.pendingEvents,
                closeCallback: () => {
                    this._timeline = null;
                    if (this._roomEncryption) {
                        this._roomEncryption.notifyTimelineClosed();
                    }
                },
                clock: this._platform.clock,
                logger: this._platform.logger,
            });
            if (this._roomEncryption) {
                this._timeline.enableEncryption(this._decryptEntries.bind(this, DecryptionSource.Timeline));
            }
            await this._timeline.load(this._user, log);
            return this._timeline;
        });
    }

    get mediaRepository() {
        return this._mediaRepository;
    }

    /** @package */
    writeIsTrackingMembers(value, txn) {
        return this._summary.writeIsTrackingMembers(value, txn);
    }

    /** @package */
    applyIsTrackingMembersChanges(changes) {
        this._summary.applyChanges(changes);
    }

    observeEvent(eventId) {
        if (!this._observedEvents) {
            this._observedEvents = new ObservedEventMap(() => {
                this._observedEvents = null;
            });
        }
        let entry = null;
        if (this._timeline) {
            entry = this._timeline.getByEventId(eventId);
        }
        const observable = this._observedEvents.observe(eventId, entry);
        if (!entry) {
            // update in the background
            this._readEventById(eventId).then(entry => {
                observable.update(entry);
            }).catch(err => {
                console.warn(`could not load event ${eventId} from storage`, err);
            });
        }
        return observable;
    }

    async _readEventById(eventId) {
        let stores = [this._storage.storeNames.timelineEvents];
        if (this.isEncrypted) {
            stores.push(this._storage.storeNames.inboundGroupSessions);
        }
        const txn = await this._storage.readTxn(stores);
        const storageEntry = await txn.timelineEvents.getByEventId(this._roomId, eventId);
        if (storageEntry) {
            const entry = new EventEntry(storageEntry, this._fragmentIdComparer);
            if (entry.eventType === EVENT_ENCRYPTED_TYPE) {
                const request = this._decryptEntries(DecryptionSource.Timeline, [entry], txn);
                await request.complete();
            }
            return entry;
        }
    }

    createAttachment(blob, filename) {
        return new AttachmentUpload({blob, filename, platform: this._platform});
    }

    dispose() {
        this._roomEncryption?.dispose();
        this._timeline?.dispose();
        this._sendQueue.dispose();
    }
}

class DecryptionRequest {
    constructor(decryptFn, log) {
        this._cancelled = false;
        this.preparation = null;
        this._promise = log.wrap("decryptEntries", log => decryptFn(this, log));
    }

    complete() {
        return this._promise;
    }

    get cancelled() {
        return this._cancelled;
    }

    dispose() {
        this._cancelled = true;
        if (this.preparation) {
            this.preparation.dispose();
        }
    }
}
