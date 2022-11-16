/*
Copyright 2020 Bruno Windels <bruno@windels.cloud>
Copyright 2020, 2021 The Matrix.org Foundation C.I.C.

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

import {ObservableValue} from "../observable/ObservableValue";

import type {EventEntry} from "./room/timeline/entries/EventEntry";
import type {RoomEncryption, SummaryData, DecryptionPreparation} from "./e2ee/RoomEncryption";
import type {Room} from "./room/Room";
import type {LogItem} from "../logging/LogItem";
import type {ILogger, ILogItem} from "../logging/types";
import type {HomeServerApi} from "./net/HomeServerApi";
import type {IHomeServerRequest} from "./net/HomeServerRequest";
import type {JoinedRoom, LeftRoom, InvitedRoom, Rooms, SyncResponse} from "./net/types/sync";
import type {Session, Changes} from "./Session";
import type {Storage} from "./storage/idb/Storage";
import type {ILock} from "../utils/Lock";
import type {SyncPreparation} from "./DeviceMessageHandler";
import type {EventKey} from "./room/timeline/EventKey";
import type {MemberChange, MemberData} from "./room/members/RoomMember";
import type {PendingEvent} from "./room/sending/PendingEvent";
import type {HeroChanges} from "./room/members/Heroes";
import type {HistoryVisibility, PowerLevelsStateEvent} from "./net/types/roomEvents";
import type {ArchivedRoom} from "./room/ArchivedRoom";
import type {Invite} from "./room/Invite";
import type {Transaction} from "./storage/idb/Transaction";

const INCREMENTAL_TIMEOUT = 30000;

export enum SyncStatus {
    InitialSync = "InitialSync",
    CatchupSync = "CatchupSync",
    Syncing = "Syncing",
    Stopped = "Stopped"
}

function timelineIsEmpty(roomResponse: JoinedRoom | LeftRoom): boolean {
    try {
        const events = roomResponse?.timeline?.events;
        return Array.isArray(events) && events.length === 0;
    } catch (err) {
        return true;
    }
}

type Options = {
    hsApi: HomeServerApi,
    session: Session,
    storage: Storage,
    logger: ILogger
}

/**
 * Sync steps in js-pseudocode:
 * ```js
 * // can only read some stores
 * const preparation = await room.prepareSync(roomResponse, membership, newRoomKeys, prepareTxn);
 * // can do async work that is not related to storage (such as decryption)
 * await room.afterPrepareSync(preparation);
 * // writes and calculates changes
 * const changes = await room.writeSync(roomResponse, isInitialSync, preparation, syncTxn);
 * // applies and emits changes once syncTxn is committed
 * room.afterSync(changes);
 * // can do network requests
 * await room.afterSyncCompleted(changes);
 * ```
 */
export class Sync {
    private _hsApi: HomeServerApi;
    private _logger: ILogger;
    private _session: Session;
    private _storage: Storage;
    private _currentRequest?: IHomeServerRequest<any> | IHomeServerRequest<SyncResponse>
    private _status = new ObservableValue(SyncStatus.Stopped);
    private _error?: any;

    constructor({hsApi, session, storage, logger}: Options) {
        this._hsApi = hsApi;
        this._logger = logger;
        this._session = session;
        this._storage = storage;
    }

    get status(): ObservableValue<SyncStatus> {
        return this._status;
    }

    /** the error that made the sync stop */
    get error(): any {
        return this._error;
    }

    start() {
        // not already syncing?
        if (this._status.get() !== SyncStatus.Stopped) {
            return;
        }
        this._error = null;
        let syncToken = this._session.syncToken;
        if (syncToken) {
            this._status.set(SyncStatus.CatchupSync);
        } else {
            this._status.set(SyncStatus.InitialSync);
        }
        void this._syncLoop(syncToken);
    }

    async _syncLoop(syncToken: string): Promise<void> {
        // if syncToken is falsy, it will first do an initial sync ...
        while(this._status.get() !== SyncStatus.Stopped) {
            let roomStates: RoomSyncProcessState[];
            let sessionChanges: Changes | undefined;
            let wasCatchupOrInitial = this._status.get() === SyncStatus.CatchupSync || this._status.get() === SyncStatus.InitialSync;
            await this._logger.run("sync", async log => {
                log.set("token", syncToken);
                log.set("status", this._status.get());
                try {
                    // unless we are happily syncing already, we want the server to return
                    // as quickly as possible, even if there are no events queued. This
                    // serves two purposes:
                    //
                    // * When the connection dies, we want to know asap when it comes back,
                    //   so that we can hide the error from the user. (We don't want to
                    //   have to wait for an event or a timeout).
                    //
                    // * We want to know if the server has any to_device messages queued up
                    //   for us. We do that by calling it with a zero timeout until it
                    //   doesn't give us any more to_device messages.
                    const timeout = this._status.get() === SyncStatus.Syncing ? INCREMENTAL_TIMEOUT : 0;
                    const syncResult = await this._syncRequest(syncToken, timeout, log);
                    syncToken = syncResult.syncToken;
                    roomStates = syncResult.roomStates;
                    sessionChanges = syncResult.sessionChanges;
                    // initial sync or catchup sync
                    if (this._status.get() !== SyncStatus.Syncing && syncResult.hadToDeviceMessages) {
                        this._status.set(SyncStatus.CatchupSync);
                    } else {
                        this._status.set(SyncStatus.Syncing);
                    }
                } catch (err) {
                    // retry same request on timeout
                    if (err.name === "ConnectionError" && err.isTimeout) {
                        // don't run afterSyncCompleted
                        return;
                    }
                    this._error = err;
                    if (err.name !== "AbortError") {
                        // sync wasn't asked to stop, but is stopping
                        // because of the error.
                        log.error = err;
                        log.logLevel = log.level.Fatal;
                    }
                    log.set("stopping", true);
                    this._status.set(SyncStatus.Stopped);
                }
                if (this._status.get() !== SyncStatus.Stopped) {
                    // TODO: if we're not going to run this phase in parallel with the next
                    // sync request (because this causes OTKs to be uploaded twice)
                    // should we move this inside _syncRequest?
                    // Alternatively, we can try to fix the OTK upload issue while still
                    // running in parallel.
                    await log.wrap("afterSyncCompleted", log => this._runAfterSyncCompleted(sessionChanges, roomStates, log));
                }
            },
            this._logger.level.Info,
            (filter, log: LogItem) => {
                if (log.durationWithoutType("network") || 0 >= 2000 || log.error || wasCatchupOrInitial) {
                    return filter.minLevel(log.level.Detail);
                } else {
                    return filter.minLevel(log.level.Info);
                }
            });
        }
    }

    async _runAfterSyncCompleted(sessionChanges: Changes | undefined, roomStates: RoomSyncProcessState[], log: ILogItem): Promise<void> {
        const isCatchupSync = this._status.get() === SyncStatus.CatchupSync;
        const sessionPromise = (async () => {
            try {
                await log.wrap("session", log => this._session.afterSyncCompleted(sessionChanges, isCatchupSync, log));
            } catch (err) {} // error is logged, but don't fail sessionPromise
        })();
        const roomsPromises = roomStates.map(async rs => {
            try {
                await rs.room.afterSyncCompleted(rs.changes, log);
            } catch (err) {} // error is logged, but don't fail roomsPromises
        });
        // run everything in parallel,
        // we don't want to delay the next sync too much
        // Also, since all promises won't reject (as they have a try/catch)
        // it's fine to use Promise.all
        await Promise.all(roomsPromises.concat(sessionPromise));
    }

    async _syncRequest(
        syncToken: string,
        timeout: number,
        log: ILogItem
      ): Promise<{
        syncToken: string;
        roomStates: RoomSyncProcessState[];
        sessionChanges?: Changes;
        hadToDeviceMessages: boolean;
      }> {
        let {syncFilterId} = this._session;
        if (typeof syncFilterId !== "string") {
            this._currentRequest = this._hsApi.createFilter(this._session.user.id, {room: {state: {lazy_load_members: true}}}, {log});
            syncFilterId = (await this._currentRequest.response()).filter_id;
        }
        const totalRequestTimeout = timeout + (80 * 1000);  // same as riot-web, don't get stuck on wedged long requests
        this._currentRequest = this._hsApi.sync(syncToken, syncFilterId, timeout, {timeout: totalRequestTimeout, log});
        const response = await (this._currentRequest as IHomeServerRequest<SyncResponse>).response();

        const isInitialSync = !syncToken;
        const sessionState = new SessionSyncProcessState();
        const inviteStates = this._parseInvites(response.rooms);
        const {roomStates, archivedRoomStates} = await this._parseRoomsResponse(
            response.rooms, inviteStates, isInitialSync, log);

        try {
            // take a lock on olm sessions used in this sync so sending a message doesn't change them while syncing
            sessionState.lock = await log.wrap("obtainSyncLock", () => this._session.obtainSyncLock(response));
            await log.wrap("prepare", log => this._prepareSync(sessionState, roomStates, response, log));
            await log.wrap("afterPrepareSync", log => Promise.all(roomStates.map(rs => {
                return rs.room.afterPrepareSync(rs.preparation, log);
            })));
            await log.wrap("write", async log => this._writeSync(
                sessionState, inviteStates, roomStates, archivedRoomStates,
                response, syncFilterId, isInitialSync, log));
        } finally {
            sessionState.dispose();
        }
        // sync txn comitted, emit updates and apply changes to in-memory state
        log.wrap("after", log => this._afterSync(
            sessionState, inviteStates, roomStates, archivedRoomStates, log));

        const toDeviceEvents = response.to_device?.events;
        return {
            syncToken: response.next_batch,
            roomStates,
            sessionChanges: sessionState.changes,
            hadToDeviceMessages: Array.isArray(toDeviceEvents) && toDeviceEvents.length > 0,
        };
    }

    _openPrepareSyncTxn(): Promise<Transaction> {
        const storeNames = this._storage.storeNames;
        return this._storage.readTxn([
            storeNames.olmSessions,
            storeNames.inboundGroupSessions,
            // to read fragments when loading sync writer when rejoining archived room
            storeNames.timelineFragments,
            // to read fragments when loading sync writer when rejoining archived room
            // to read events that can now be decrypted
            storeNames.timelineEvents,
        ]);
    }

    async _prepareSync(sessionState: SessionSyncProcessState, roomStates: RoomSyncProcessState[], response: SyncResponse, log: ILogItem): Promise<void> {
        const prepareTxn = await this._openPrepareSyncTxn();
        sessionState.preparation = await log.wrap("session", log => this._session.prepareSync(
            response, sessionState.lock, prepareTxn, log));

        const newKeysByRoom = sessionState.preparation?.newKeysByRoom;

        // add any rooms with new keys but no sync response to the list of rooms to be synced
        if (newKeysByRoom) {
            const {hasOwnProperty} = Object.prototype;
            for (const roomId of newKeysByRoom.keys()) {
                const isRoomInResponse = response.rooms?.join && hasOwnProperty.call(response.rooms.join, roomId);
                if (!isRoomInResponse) {
                    let room = this._session.rooms?.get(roomId);
                    if (room) {
                        roomStates.push(new RoomSyncProcessState(room, false, {}, room.membership));
                    }
                }
            }
        }

        await Promise.all(roomStates.map(async rs => {
            const newKeys = newKeysByRoom?.get(rs.room.id);
            rs.preparation = await log.wrap("room", async log => {
                // if previously joined and we still have the timeline for it,
                // this loads the syncWriter at the correct position to continue writing the timeline
                if (rs.isNewRoom) {
                    await rs.room.load(null, prepareTxn, log);
                }
                return rs.room.prepareSync(
                    rs.roomResponse, rs.membership, newKeys, prepareTxn, log);
            }, log.level.Detail);
        }));

        // This is needed for safari to not throw TransactionInactiveErrors on the syncTxn. See docs/INDEXEDDB.md
        await prepareTxn.complete();
    }

    async _writeSync(
        sessionState: SessionSyncProcessState,
        inviteStates: InviteSyncProcessState[],
        roomStates: RoomSyncProcessState[],
        archivedRoomStates: ArchivedRoomSyncProcessState[],
        response: SyncResponse,
        syncFilterId: number,
        isInitialSync: boolean,
        log: ILogItem,
      ): Promise<void> {
        const syncTxn = await this._openSyncTxn();
        try {
            sessionState.changes = await log.wrap("session", log => this._session.writeSync(
                response, syncFilterId, sessionState.preparation, syncTxn, log));
            await Promise.all(inviteStates.map(async is => {
                is.changes = await log.wrap("invite", log => is.invite.writeSync(
                    is.membership, is.roomResponse, syncTxn, log));
            }));
            await Promise.all(roomStates.map(async rs => {
                rs.changes = await log.wrap("room", log => rs.room.writeSync(
                    rs.roomResponse, isInitialSync, rs.preparation, syncTxn, log));
            }));
            // important to do this after roomStates,
            // as we're referring to the roomState to get the summaryChanges
            await Promise.all(archivedRoomStates.map(async ars => {
                const summaryChanges = ars.roomState?.summaryChanges;
                ars.changes = await log.wrap("archivedRoom", log => ars.archivedRoom.writeSync(
                    summaryChanges, ars.roomResponse, ars.membership, syncTxn, log));
            }));
        } catch(err) {
            // avoid corrupting state by only
            // storing the sync up till the point
            // the exception occurred
            syncTxn.abort(log);
            throw syncTxn.getCause(err);
        }
        await syncTxn.complete(log);
    }

    _afterSync(
        sessionState: SessionSyncProcessState,
        inviteStates: InviteSyncProcessState[],
        roomStates: RoomSyncProcessState[],
        archivedRoomStates: ArchivedRoomSyncProcessState[],
        log: ILogItem
      ): void {
        log.wrap("session", log => this._session.afterSync(sessionState.changes), log.level.Detail);
        for(let ars of archivedRoomStates) {
            log.wrap("archivedRoom", log => {
                ars.archivedRoom.afterSync(ars.changes, log);
                ars.archivedRoom.release();
            }, log.level.Detail);
        }
        for(let rs of roomStates) {
            log.wrap("room", log => rs.room.afterSync(rs.changes, log), log.level.Detail);
        }
        for(let is of inviteStates) {
            log.wrap("invite", log => is.invite.afterSync(is.changes, log), log.level.Detail);
        }
        this._session.applyRoomCollectionChangesAfterSync(inviteStates, roomStates, archivedRoomStates, log);
    }

    _openSyncTxn(): Promise<Transaction> {
        const storeNames = this._storage.storeNames;
        return this._storage.readWriteTxn([
            storeNames.session,
            storeNames.roomSummary,
            storeNames.archivedRoomSummary,
            storeNames.invites,
            storeNames.roomState,
            storeNames.roomMembers,
            storeNames.timelineEvents,
            storeNames.timelineRelations,
            storeNames.timelineFragments,
            storeNames.pendingEvents,
            storeNames.userIdentities,
            storeNames.groupSessionDecryptions,
            storeNames.deviceIdentities,
            // to discard outbound session when somebody leaves a room
            // and to create room key messages when somebody joins
            storeNames.outboundGroupSessions,
            storeNames.operations,
            storeNames.accountData,
            // to decrypt and store new room keys
            storeNames.olmSessions,
            storeNames.inboundGroupSessions,
        ]);
    }

     async _parseRoomsResponse(
        roomsSection: Rooms | undefined,
        inviteStates: InviteSyncProcessState[],
        isInitialSync: boolean,
        log: ILogItem
      ): Promise<{ roomStates: RoomSyncProcessState[]; archivedRoomStates: ArchivedRoomSyncProcessState[] }> {
        const roomStates: RoomSyncProcessState[] = [];
        const archivedRoomStates: ArchivedRoomSyncProcessState[] = [];
        if (roomsSection) {
            const allMemberships: ("join" | "leave")[] = ["join", "leave"];
            for(const membership of allMemberships) {
                const membershipSection = roomsSection[membership];
                if (membershipSection) {
                    for (const [roomId, _roomResponse] of Object.entries(membershipSection)) {
                        const roomResponse: JoinedRoom | LeftRoom = _roomResponse;
                        // ignore rooms with empty timelines during initial sync,
                        // see https://github.com/vector-im/hydrogen-web/issues/15
                        if (isInitialSync && timelineIsEmpty(roomResponse)) {
                            continue;
                        }
                        const invite = this._session.invites.get(roomId);
                        // if there is an existing invite, add a process state for it
                        // so its writeSync and afterSync will run and remove the invite
                        if (invite) {
                            inviteStates.push(new InviteSyncProcessState(invite, false, undefined, membership));
                        }
                        const roomState = this._createRoomSyncState(roomId, roomResponse, membership, isInitialSync);
                        if (roomState) {
                            roomStates.push(roomState);
                        }
                        const ars = await this._createArchivedRoomSyncState(roomId, roomState, roomResponse, membership, isInitialSync, log);
                        if (ars) {
                            archivedRoomStates.push(ars);
                        }
                    }
                }
            }
        }
        return {roomStates, archivedRoomStates};
    }

    _createRoomSyncState(roomId: string, roomResponse: JoinedRoom | LeftRoom, membership: "join" | "leave", isInitialSync: boolean): RoomSyncProcessState | undefined {
        let isNewRoom = false;
        let room = this._session.rooms?.get(roomId);
        // create room only either on new join,
        // or for an archived room during initial sync,
        // where we create the summaryChanges with a joined
        // room to then adopt by the archived room.
        // This way the limited timeline, members, ...
        // we receive also gets written.
        // In any case, don't create a room for a rejected invite
        if (!room && (membership === "join" || (isInitialSync && membership === "leave"))) {
            room = this._session.createJoinedRoom(roomId);
            isNewRoom = true;
        }
        if (room) {
            return new RoomSyncProcessState(
                room, isNewRoom, roomResponse, membership);
        }
    }

    async _createArchivedRoomSyncState(
        roomId: string,
        roomState: RoomSyncProcessState | undefined,
        roomResponse: JoinedRoom | LeftRoom,
        membership: 'join' | 'leave',
        isInitialSync: boolean,
        log: ILogItem
      ): Promise<ArchivedRoomSyncProcessState | undefined> {
        let archivedRoom: ArchivedRoom | undefined;
        if (roomState?.shouldAdd && !isInitialSync) {
            // when adding a joined room during incremental sync,
            // always create the archived room to write the removal
            // of the archived summary
            archivedRoom = this._session.createOrGetArchivedRoomForSync(roomId);
        } else if (membership === "leave") {
            if (roomState) {
                // we still have a roomState, so we just left it
                // in this case, create a new archivedRoom
                archivedRoom = this._session.createOrGetArchivedRoomForSync(roomId);
            } else {
                // this is an update of an already left room, restore
                // it from storage first, so we can increment it.
                // this happens for example when our membership changes
                // after leaving (e.g. being (un)banned, possibly after being kicked), etc
                archivedRoom = await this._session.loadArchivedRoom(roomId, log);
            }
        }
        if (archivedRoom) {
            return new ArchivedRoomSyncProcessState(
                archivedRoom, roomState, roomResponse, membership);
        }
    }

    _parseInvites(roomsSection?: Rooms): InviteSyncProcessState[] {
        const inviteStates: InviteSyncProcessState[] = [];
        if (roomsSection?.invite) {
            for (const [roomId, _roomResponse] of Object.entries(roomsSection.invite)) {
                const roomResponse = _roomResponse as InvitedRoom;
                let invite = this._session.invites.get(roomId);
                let isNewInvite = false;
                if (!invite) {
                    invite = this._session.createInvite(roomId);
                    isNewInvite = true;
                }
                inviteStates.push(new InviteSyncProcessState(invite, isNewInvite, roomResponse, "invite"));
            }
        }
        return inviteStates;
    }

    stop() {
        if (this._status.get() === SyncStatus.Stopped) {
            return;
        }
        this._status.set(SyncStatus.Stopped);
        if (this._currentRequest) {
            this._currentRequest.abort();
            this._currentRequest = undefined;
        }
    }
}

class SessionSyncProcessState {
    lock?: ILock;
    preparation?: SyncPreparation;
    changes: Changes;

    dispose() {
        this.lock?.release();
    }
}

// TODO: move to Room.js when that gets converted to typescript.
// It's the return value of Room.prepareSync().
type RoomSyncPreparation = {
    roomEncryption: RoomEncryption;
    summaryChanges: SummaryData;
    decryptPreparation: DecryptionPreparation;
    decryptChanges: null;
    retryEntries: EventEntry[];
}

// TODO: move to Room.js when that gets converted to typescript.
// It's the return value of Room.writeSync().
type RoomWriteSyncChanges = {
    summaryChanges: SummaryData;
    roomEncryption: RoomEncryption;
    entries: EventEntry[];
    updatedEntries: EventEntry[];
    newLiveKey: EventKey | undefined;
    memberChanges: Map<string, MemberChange | undefined>;
    removedPendingEvents?: PendingEvent[];
    heroChanges?: HeroChanges;
    powerLevelsEvent?: PowerLevelsStateEvent;
    encryptionChanges?: RoomEncryptionWriteSyncChanges;
}

// TODO: move to RoomEncryption.js when that gets converted to typescript.
// It's the return value of RoomEncryption.writeSync().
type RoomEncryptionWriteSyncChanges = {
    shouldFlush: boolean;
    historyVisibility: HistoryVisibility;
}

export class RoomSyncProcessState {
    /**
     * @param {Object} roomResponse - a matrix Joined Room type or matrix Left Room type
     */
    room: Room;
    isNewRoom: boolean;
    roomResponse: JoinedRoom | LeftRoom;
    membership: string;
    preparation?: RoomSyncPreparation;
    changes?: RoomWriteSyncChanges;

    constructor(room: Room, isNewRoom: boolean, roomResponse: JoinedRoom | LeftRoom, membership: string) {
        this.room = room;
        this.isNewRoom = isNewRoom;
        this.roomResponse = roomResponse;
        this.membership = membership;
    }

    get id() {
        return this.room.id;
    }

    get shouldAdd() {
        return this.isNewRoom && this.membership === "join";
    }

    get shouldRemove() {
        return !this.isNewRoom && this.membership !== "join";
    }

    get summaryChanges() {
        return this.changes?.summaryChanges;
    }
}


export class ArchivedRoomSyncProcessState {
    archivedRoom: ArchivedRoom;
    roomState: RoomSyncProcessState | undefined;
    roomResponse: JoinedRoom | LeftRoom;
    membership: "join" | "leave";
    isInitialSync?: boolean;
    changes?: {};

    constructor(archivedRoom: ArchivedRoom, roomState: RoomSyncProcessState | undefined, roomResponse: JoinedRoom | LeftRoom, membership: "join" | "leave", isInitialSync?: boolean) {
        this.archivedRoom = archivedRoom;
        this.roomState = roomState;
        this.roomResponse = roomResponse;
        this.membership = membership;
        this.isInitialSync = isInitialSync;
    }

    get id(): string {
        return this.archivedRoom.id;
    }

    get shouldAdd(): boolean | undefined {
        return (this.roomState || this.isInitialSync) && this.membership === "leave";
    }

    get shouldRemove(): boolean {
        return this.membership === "join";
    }
}

// TODO: move this to a more appropriate file
// https://spec.matrix.org/v1.4/client-server-api/#mroomjoin_rules
type JoinRule = "public" | "knock" | "invite" | "private" | "restricted"

// TODO: move to Invite.js when that gets converted to typescript.
// It's the return value of Invite._createData().
type InviteData = {
    roomId: string,
    isEncrypted: boolean,
    isDirectMessage: boolean,
    name?: string,
    avatarUrl?: string,
    avatarColorId: string | null,
    canonicalAlias: string | null,
    timestamp: number,
    joinRule: JoinRule | null,
    inviter?: MemberData,
}

// TODO: move to Invite.js when that gets converted to typescript.
// It's the return value of Invite.writeSync().
type InviteWriteSyncChanges =
  | { removed: true; membership: "join" | "leave" | "invite" }
  | { inviteData: InviteData; inviter?: MemberData };

export class InviteSyncProcessState {
    invite: Invite;
    isNewInvite: boolean;
    roomResponse: InvitedRoom | undefined;
    membership: "join" | "leave" | "invite";
    changes?: InviteWriteSyncChanges;

    constructor(invite: Invite, isNewInvite: boolean, roomResponse: InvitedRoom | undefined, membership: "join" | "leave" | "invite") {
        this.invite = invite;
        this.isNewInvite = isNewInvite;
        this.membership = membership;
        this.roomResponse = roomResponse;
    }

    get id(): string {
        return this.invite.id;
    }

    get shouldAdd(): boolean {
        return this.isNewInvite;
    }

    get shouldRemove(): boolean {
        return this.membership !== "invite";
    }
}

