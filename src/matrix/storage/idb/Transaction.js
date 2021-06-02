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

import {txnAsPromise} from "./utils.js";
import {StorageError} from "../common.js";
import {Store} from "./Store.js";
import {SessionStore} from "./stores/SessionStore.js";
import {RoomSummaryStore} from "./stores/RoomSummaryStore.js";
import {InviteStore} from "./stores/InviteStore.js";
import {TimelineEventStore} from "./stores/TimelineEventStore.js";
import {RoomStateStore} from "./stores/RoomStateStore.js";
import {RoomMemberStore} from "./stores/RoomMemberStore.js";
import {TimelineFragmentStore} from "./stores/TimelineFragmentStore.js";
import {PendingEventStore} from "./stores/PendingEventStore.js";
import {UserIdentityStore} from "./stores/UserIdentityStore.js";
import {DeviceIdentityStore} from "./stores/DeviceIdentityStore.js";
import {OlmSessionStore} from "./stores/OlmSessionStore.js";
import {InboundGroupSessionStore} from "./stores/InboundGroupSessionStore.js";
import {OutboundGroupSessionStore} from "./stores/OutboundGroupSessionStore.js";
import {GroupSessionDecryptionStore} from "./stores/GroupSessionDecryptionStore.js";
import {OperationStore} from "./stores/OperationStore.js";
import {AccountDataStore} from "./stores/AccountDataStore.js";

export class Transaction {
    constructor(txn, allowedStoreNames, IDBKeyRange) {
        this._txn = txn;
        this._allowedStoreNames = allowedStoreNames;
        this._stores = {};
        this.IDBKeyRange = IDBKeyRange;
    }

    _idbStore(name) {
        if (!this._allowedStoreNames.includes(name)) {
            // more specific error? this is a bug, so maybe not ...
            throw new StorageError(`Invalid store for transaction: ${name}, only ${this._allowedStoreNames.join(", ")} are allowed.`);
        }
        return new Store(this._txn.objectStore(name), this);
    }

    _store(name, mapStore) {
        if (!this._stores[name]) {
            const idbStore = this._idbStore(name);
            this._stores[name] = mapStore(idbStore);
        }
        return this._stores[name];
    }

    get session() {
        return this._store("session", idbStore => new SessionStore(idbStore));
    }

    get roomSummary() {
        return this._store("roomSummary", idbStore => new RoomSummaryStore(idbStore));
    }
    
    get archivedRoomSummary() {
        return this._store("archivedRoomSummary", idbStore => new RoomSummaryStore(idbStore));
    }

    get invites() {
        return this._store("invites", idbStore => new InviteStore(idbStore));
    }

    get timelineFragments() {
        return this._store("timelineFragments", idbStore => new TimelineFragmentStore(idbStore));
    }

    get timelineEvents() {
        return this._store("timelineEvents", idbStore => new TimelineEventStore(idbStore));
    }

    get roomState() {
        return this._store("roomState", idbStore => new RoomStateStore(idbStore));
    }

    get roomMembers() {
        return this._store("roomMembers", idbStore => new RoomMemberStore(idbStore));
    }

    get pendingEvents() {
        return this._store("pendingEvents", idbStore => new PendingEventStore(idbStore));
    }

    get userIdentities() {
        return this._store("userIdentities", idbStore => new UserIdentityStore(idbStore));
    }

    get deviceIdentities() {
        return this._store("deviceIdentities", idbStore => new DeviceIdentityStore(idbStore));
    }
    
    get olmSessions() {
        return this._store("olmSessions", idbStore => new OlmSessionStore(idbStore));
    }
    
    get inboundGroupSessions() {
        return this._store("inboundGroupSessions", idbStore => new InboundGroupSessionStore(idbStore));
    }
    
    get outboundGroupSessions() {
        return this._store("outboundGroupSessions", idbStore => new OutboundGroupSessionStore(idbStore));
    }

    get groupSessionDecryptions() {
        return this._store("groupSessionDecryptions", idbStore => new GroupSessionDecryptionStore(idbStore));
    }

    get operations() {
        return this._store("operations", idbStore => new OperationStore(idbStore));
    }

    get accountData() {
        return this._store("accountData", idbStore => new AccountDataStore(idbStore));
    }

    complete() {
        return txnAsPromise(this._txn);
    }

    abort() {
        // TODO: should we wrap the exception in a StorageError?
        this._txn.abort();
    }
}
