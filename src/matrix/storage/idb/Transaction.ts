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

import {StoreNames} from "../common";
import {txnAsPromise} from "./utils";
import {StorageError} from "../common";
import {Store} from "./Store";
import {Storage} from "./Storage";
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
import {DeviceKeyStore} from "./stores/DeviceKeyStore";
import {CrossSigningKeyStore} from "./stores/CrossSigningKeyStore";
import {OlmSessionStore} from "./stores/OlmSessionStore";
import {InboundGroupSessionStore} from "./stores/InboundGroupSessionStore";
import {OutboundGroupSessionStore} from "./stores/OutboundGroupSessionStore";
import {GroupSessionDecryptionStore} from "./stores/GroupSessionDecryptionStore";
import {OperationStore} from "./stores/OperationStore";
import {AccountDataStore} from "./stores/AccountDataStore";
import {CallStore} from "./stores/CallStore";
import {SharedSecretStore} from "./stores/SharedSecretStore";
import type {ILogger, ILogItem} from "../../../logging/types";

export type IDBKey = IDBValidKey | IDBKeyRange;

class WriteErrorInfo {
    constructor(
        public readonly error: StorageError,
        public readonly refItem: ILogItem | undefined,
        public readonly operationName: string,
        public readonly keys: IDBKey[] | undefined,
    ) {}
}

export class Transaction {
    private _txn: IDBTransaction;
    private _allowedStoreNames: StoreNames[];
    private _stores: { [storeName in StoreNames]?: any };
    private _storage: Storage;
    private _writeErrors: WriteErrorInfo[];

    constructor(txn: IDBTransaction, allowedStoreNames: StoreNames[], storage: Storage) {
        this._txn = txn;
        this._allowedStoreNames = allowedStoreNames;
        this._stores = {};
        this._storage = storage;
        this._writeErrors = [];
    }

    get idbFactory(): IDBFactory {
        return this._storage.idbFactory;
    }

    get IDBKeyRange(): typeof IDBKeyRange {
        return this._storage.IDBKeyRange;
    }

    get databaseName(): string {
        return this._storage.databaseName;
    }

    get logger(): ILogger {
        return this._storage.logger;
    }

    _idbStore(name: StoreNames): Store<any> {
        if (!this._allowedStoreNames.includes(name)) {
            // more specific error? this is a bug, so maybe not ...
            throw new StorageError(`Invalid store for transaction: ${name}, only ${this._allowedStoreNames.join(", ")} are allowed.`);
        }
        return new Store(this._txn.objectStore(name), this);
    }

    _store<T>(name: StoreNames, mapStore: (idbStore: Store<any>) => T): T {
        if (!this._stores[name]) {
            const idbStore = this._idbStore(name);
            this._stores[name] = mapStore(idbStore);
        }
        return this._stores[name];
    }

    get session(): SessionStore {
        return this._store(StoreNames.session, idbStore => new SessionStore(idbStore, this._storage.localStorage));
    }

    get roomSummary(): RoomSummaryStore {
        return this._store(StoreNames.roomSummary, idbStore => new RoomSummaryStore(idbStore));
    }
    
    get archivedRoomSummary(): RoomSummaryStore {
        return this._store(StoreNames.archivedRoomSummary, idbStore => new RoomSummaryStore(idbStore));
    }

    get invites(): InviteStore {
        return this._store(StoreNames.invites, idbStore => new InviteStore(idbStore));
    }

    get timelineFragments(): TimelineFragmentStore {
        return this._store(StoreNames.timelineFragments, idbStore => new TimelineFragmentStore(idbStore));
    }

    get timelineEvents(): TimelineEventStore {
        return this._store(StoreNames.timelineEvents, idbStore => new TimelineEventStore(idbStore));
    }

    get timelineRelations(): TimelineRelationStore {
        return this._store(StoreNames.timelineRelations, idbStore => new TimelineRelationStore(idbStore));
    }

    get roomState(): RoomStateStore {
        return this._store(StoreNames.roomState, idbStore => new RoomStateStore(idbStore));
    }

    get roomMembers(): RoomMemberStore {
        return this._store(StoreNames.roomMembers, idbStore => new RoomMemberStore(idbStore));
    }

    get pendingEvents(): PendingEventStore {
        return this._store(StoreNames.pendingEvents, idbStore => new PendingEventStore(idbStore));
    }

    get userIdentities(): UserIdentityStore {
        return this._store(StoreNames.userIdentities, idbStore => new UserIdentityStore(idbStore));
    }

    get deviceKeys(): DeviceKeyStore {
        return this._store(StoreNames.deviceKeys, idbStore => new DeviceKeyStore(idbStore));
    }
    
    get crossSigningKeys(): CrossSigningKeyStore {
        return this._store(StoreNames.crossSigningKeys, idbStore => new CrossSigningKeyStore(idbStore));
    }
    
    get olmSessions(): OlmSessionStore {
        return this._store(StoreNames.olmSessions, idbStore => new OlmSessionStore(idbStore));
    }
    
    get inboundGroupSessions(): InboundGroupSessionStore {
        return this._store(StoreNames.inboundGroupSessions, idbStore => new InboundGroupSessionStore(idbStore));
    }
    
    get outboundGroupSessions(): OutboundGroupSessionStore {
        return this._store(StoreNames.outboundGroupSessions, idbStore => new OutboundGroupSessionStore(idbStore));
    }

    get groupSessionDecryptions(): GroupSessionDecryptionStore {
        return this._store(StoreNames.groupSessionDecryptions, idbStore => new GroupSessionDecryptionStore(idbStore));
    }

    get operations(): OperationStore {
        return this._store(StoreNames.operations, idbStore => new OperationStore(idbStore));
    }

    get accountData(): AccountDataStore {
        return this._store(StoreNames.accountData, idbStore => new AccountDataStore(idbStore));
    }
    
    get calls(): CallStore {
        return this._store(StoreNames.calls, idbStore => new CallStore(idbStore));
    }

    get sharedSecrets(): SharedSecretStore {
        return this._store(StoreNames.sharedSecrets, idbStore => new SharedSecretStore(idbStore));
    }

    async complete(log?: ILogItem): Promise<void> {
        try {
            await txnAsPromise(this._txn);
        } catch (err) {
            if (this._writeErrors.length) {
                this._logWriteErrors(log);
                throw this._writeErrors[0].error;
            }
            throw err;
        }
    }

    getCause(error: Error) {
        if (error instanceof StorageError) {
            if (error.errcode === "AbortError" && this._writeErrors.length) {
                return this._writeErrors[0].error;
            }
        }
        return error;
    }

    abort(log?: ILogItem): void {
        // TODO: should we wrap the exception in a StorageError?
        try {
            this._txn.abort();
        } catch (abortErr) {
            log?.set("couldNotAbortTxn", true);
        }
        if (this._writeErrors.length) {
            this._logWriteErrors(log);
        }
    }

    addWriteError(error: StorageError, refItem: ILogItem | undefined, operationName: string, keys: IDBKey[] | undefined) {
        // don't log subsequent `AbortError`s
        if (error.errcode !== "AbortError" || this._writeErrors.length === 0) {
            this._writeErrors.push(new WriteErrorInfo(error, refItem, operationName, keys));
        }
    }

    private _logWriteErrors(parentItem: ILogItem | undefined) {
        const callback = errorGroupItem => {
            // we don't have context when there is no parentItem, so at least log stores
            if (!parentItem) {
                errorGroupItem.set("allowedStoreNames", this._allowedStoreNames);
            }
            for (const info of this._writeErrors) {
                errorGroupItem.wrap({l: info.operationName, id: info.keys}, item => {
                    if (info.refItem) {
                        item.refDetached(info.refItem);
                    }
                    item.catch(info.error);
                });
            }
        };
        const label = `${this._writeErrors.length} storage write operation(s) failed`;
        if (parentItem) {
            parentItem.wrap(label, callback);
        } else {
            this.logger.run(label, callback);
        }
    }
}
