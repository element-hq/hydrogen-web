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

import {txnAsPromise} from "./utils";
import {StorageError} from "../common";
import {Store} from "./Store";
import {SessionStore} from "./stores/SessionStore";
import {RoomSummaryStore} from "./stores/RoomSummaryStore";
import {InviteStore} from "./stores/InviteStore";
import {TimelineEventStore} from "./stores/TimelineEventStore";
import {TimelineRelationStore} from "./stores/TimelineRelationStore";
import {RoomStateStore} from "./stores/RoomStateStore";
import {RoomMemberStore} from "./stores/RoomMemberStore";
import {TimelineFragmentStore} from "./stores/TimelineFragmentStore";
import {PendingEventStore} from "./stores/PendingEventStore";
import {UserIdentityStore} from "./stores/UserIdentityStore";
import {DeviceIdentityStore} from "./stores/DeviceIdentityStore";
import {OlmSessionStore} from "./stores/OlmSessionStore";
import {InboundGroupSessionStore} from "./stores/InboundGroupSessionStore";
import {OutboundGroupSessionStore} from "./stores/OutboundGroupSessionStore";
import {GroupSessionDecryptionStore} from "./stores/GroupSessionDecryptionStore";
import {OperationStore} from "./stores/OperationStore";
import {AccountDataStore} from "./stores/AccountDataStore";

export class Transaction {
    private _txn: IDBTransaction
    private _allowedStoreNames: string[]
    private _stores: { [storeName : string] : any }

    constructor(txn: IDBTransaction, allowedStoreNames: string[], IDBKeyRange) {
        this._txn = txn;
        this._allowedStoreNames = allowedStoreNames;
        this._stores = {};
        // @ts-ignore
        this.IDBKeyRange = IDBKeyRange;
    }

    _idbStore(name: string): Store<any> {
        if (!this._allowedStoreNames.includes(name)) {
            // more specific error? this is a bug, so maybe not ...
            throw new StorageError(`Invalid store for transaction: ${name}, only ${this._allowedStoreNames.join(", ")} are allowed.`);
        }
        return new Store(this._txn.objectStore(name), this);
    }

    _store<R>(name: string, mapStore: (idbStore: Store<any>) => R): R {
        if (!this._stores[name]) {
            const idbStore = this._idbStore(name);
            this._stores[name] = mapStore(idbStore);
        }
        return this._stores[name];
    }

    get session(): SessionStore {
        return this._store("session", idbStore => new SessionStore(idbStore));
    }

    get roomSummary(): RoomSummaryStore {
        return this._store("roomSummary", idbStore => new RoomSummaryStore(idbStore));
    }
    
    get archivedRoomSummary(): RoomSummaryStore {
        return this._store("archivedRoomSummary", idbStore => new RoomSummaryStore(idbStore));
    }

    get invites(): InviteStore {
        return this._store("invites", idbStore => new InviteStore(idbStore));
    }

    get timelineFragments(): TimelineFragmentStore {
        return this._store("timelineFragments", idbStore => new TimelineFragmentStore(idbStore));
    }

    get timelineEvents(): TimelineEventStore {
        return this._store("timelineEvents", idbStore => new TimelineEventStore(idbStore));
    }

    get timelineRelations(): TimelineRelationStore {
        return this._store("timelineRelations", idbStore => new TimelineRelationStore(idbStore));
    }

    get roomState(): RoomStateStore {
        return this._store("roomState", idbStore => new RoomStateStore(idbStore));
    }

    get roomMembers(): RoomMemberStore {
        return this._store("roomMembers", idbStore => new RoomMemberStore(idbStore));
    }

    get pendingEvents(): PendingEventStore {
        return this._store("pendingEvents", idbStore => new PendingEventStore(idbStore));
    }

    get userIdentities(): UserIdentityStore {
        return this._store("userIdentities", idbStore => new UserIdentityStore(idbStore));
    }

    get deviceIdentities(): DeviceIdentityStore {
        return this._store("deviceIdentities", idbStore => new DeviceIdentityStore(idbStore));
    }
    
    get olmSessions(): OlmSessionStore {
        return this._store("olmSessions", idbStore => new OlmSessionStore(idbStore));
    }
    
    get inboundGroupSessions(): InboundGroupSessionStore {
        return this._store("inboundGroupSessions", idbStore => new InboundGroupSessionStore(idbStore));
    }
    
    get outboundGroupSessions(): OutboundGroupSessionStore {
        return this._store("outboundGroupSessions", idbStore => new OutboundGroupSessionStore(idbStore));
    }

    get groupSessionDecryptions(): GroupSessionDecryptionStore {
        return this._store("groupSessionDecryptions", idbStore => new GroupSessionDecryptionStore(idbStore));
    }

    get operations(): OperationStore {
        return this._store("operations", idbStore => new OperationStore(idbStore));
    }

    get accountData(): AccountDataStore {
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
