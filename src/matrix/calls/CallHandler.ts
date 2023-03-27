/*
Copyright 2022 The Matrix.org Foundation C.I.C.

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

import {ObservableMap} from "../../observable/map";
import {WebRTC, PeerConnection} from "../../platform/types/WebRTC";
import {MediaDevices, Track} from "../../platform/types/MediaDevices";
import {handlesEventType} from "./PeerCall";
import {EventType, CallIntent, CallType} from "./callEventTypes";
import {GroupCall} from "./group/GroupCall";
import {makeId} from "../common";
import {CALL_LOG_TYPE} from "./common";
import {EVENT_TYPE as MEMBER_EVENT_TYPE, RoomMember} from "../room/members/RoomMember";
import {TurnServerSource} from "./TurnServerSource";

import type {LocalMedia} from "./LocalMedia";
import type {Room} from "../room/Room";
import type {MemberChange} from "../room/members/RoomMember";
import type {StateEvent} from "../storage/types";
import type {ILogItem, ILogger} from "../../logging/types";
import type {Platform} from "../../platform/web/Platform";
import type {BaseObservableMap} from "../../observable/map";
import type {SignallingMessage, MGroupCallBase} from "./callEventTypes";
import type {Options as GroupCallOptions} from "./group/GroupCall";
import type {Transaction} from "../storage/idb/Transaction";
import type {CallEntry} from "../storage/idb/stores/CallStore";
import type {Clock} from "../../platform/web/dom/Clock";
import type {RoomStateHandler} from "../room/state/types";
import type {MemberSync} from "../room/timeline/persistence/MemberWriter";

export type Options = Omit<GroupCallOptions, "emitUpdate" | "createTimeout" | "turnServerSource"> & {
    clock: Clock
};

function getRoomMemberKey(roomId: string, userId: string): string {
    return JSON.stringify(roomId)+`,`+JSON.stringify(userId);
}

export class CallHandler implements RoomStateHandler {
    // group calls by call id
    private readonly _calls: ObservableMap<string, GroupCall> = new ObservableMap<string, GroupCall>();
    // map of `"roomId","userId"` to set of conf_id's they are in
    private roomMemberToCallIds: Map<string, Set<string>> = new Map();
    private groupCallOptions: GroupCallOptions;
    private sessionId = makeId("s");

    constructor(private readonly options: Options) {
        this.groupCallOptions = Object.assign({}, this.options, {
            turnServerSource: new TurnServerSource(this.options.hsApi, this.options.clock),
            emitUpdate: (groupCall, params) => this._calls.update(groupCall.id, params),
            createTimeout: this.options.clock.createTimeout,
            sessionId: this.sessionId
        });
    }

    loadCalls(intent?: CallIntent, log?: ILogItem) {
        return this.options.logger.wrapOrRun(log, "CallHandler.loadCalls", async log => {
            if (!intent) {
                intent = CallIntent.Ring;
            }
            log.set("intent", intent);
            const txn = await this._getLoadTxn();
            const callEntries = await txn.calls.getByIntent(intent);
            await this._loadCallEntries(callEntries, txn, log);
        });
    }

    loadCallsForRoom(intent: CallIntent, roomId: string, log?: ILogItem) {
        return this.options.logger.wrapOrRun(log, "CallHandler.loadCallsForRoom", async log => {
            log.set("intent", intent);
            log.set("roomId", roomId);
            const txn = await this._getLoadTxn();
            const callEntries = await txn.calls.getByIntentAndRoom(intent, roomId);
            await this._loadCallEntries(callEntries, txn, log);
        });
    }

    private async _getLoadTxn(): Promise<Transaction> {
        const names = this.options.storage.storeNames;
        const txn = await this.options.storage.readTxn([
            names.calls,
            names.roomState,
        ]);
        return txn;
    }

    private async _loadCallEntries(callEntries: CallEntry[], txn: Transaction, log: ILogItem): Promise<void> {
        log.set("entries", callEntries.length);
        await Promise.all(callEntries.map(async callEntry => {
            if (this._calls.get(callEntry.callId)) {
                return;
            }
            const event = await txn.roomState.get(callEntry.roomId, EventType.GroupCall, callEntry.callId);
            if (event) {
                const call = new GroupCall(
                    event.event.state_key, // id
                    true, // isLoadedFromStorage
                    false, // newCall
                    callEntry.timestamp, // startTime
                    event.event.content, // callContent
                    event.roomId, // roomId
                    this.groupCallOptions // options
                );
                this._calls.set(call.id, call);
            }
        }));
        const roomIds = Array.from(new Set(callEntries.map(e => e.roomId)));
        await Promise.all(roomIds.map(async roomId => {
            // TODO: don't load all members until we need them
            const callsMemberEvents = await txn.roomState.getAllForType(roomId, EventType.GroupCallMember);
            await Promise.all(callsMemberEvents.map(async entry => {
                const userId = entry.event.sender;
                const roomMemberState = await txn.roomState.get(roomId, MEMBER_EVENT_TYPE, userId);
                let roomMember;
                if (roomMemberState) {
                    roomMember = RoomMember.fromMemberEvent(roomMemberState.event);
                }
                if (!roomMember) {
                    // we'll be missing the member here if we received a call and it's members
                    // as pre-gap state and the members weren't active in the timeline we got.
                    roomMember = RoomMember.fromUserId(roomId, userId, "join");
                }
                this.handleCallMemberEvent(entry.event, roomMember, roomId, log);
            }));
        }));
        log.set("newSize", this._calls.size);
    }

    createCall(roomId: string, type: CallType, name: string, intent?: CallIntent, log?: ILogItem): Promise<GroupCall> {
        return this.options.logger.wrapOrRun(log, "CallHandler.createCall", async log => {
            if (!intent) {
                intent = CallIntent.Ring;
            }
            const call = new GroupCall(
                makeId("conf-"), // id
                false, // isLoadedFromStorage
                true, // newCall
                undefined, // startTime
                {"m.name": name, "m.intent": intent}, // callContent
                roomId, // roomId
                this.groupCallOptions // options
            );
            this._calls.set(call.id, call);

            try {
                await call.create(type, log);
                // store call info so it will ring again when reopening the app
                const txn = await this.options.storage.readWriteTxn([this.options.storage.storeNames.calls]);
                txn.calls.add({
                    intent: call.intent,
                    callId: call.id,
                    timestamp: this.options.clock.now(),
                    roomId: roomId
                });
                await txn.complete();
            } catch (err) {
                //if (err.name === "ConnectionError") {
                    // if we're offline, give up and remove the call again
                    this._calls.remove(call.id);
                //}
                throw err;
            }
            return call;
        });
    }

    get calls(): BaseObservableMap<string, GroupCall> { return this._calls; }

    // TODO: check and poll turn server credentials here

    /** @internal */
    async handleRoomState(room: Room, event: StateEvent, memberSync: MemberSync, txn: Transaction, log: ILogItem) {
        if (event.type === EventType.GroupCall) {
            this.handleCallEvent(event, room.id, txn, log);
        }
        if (event.type === EventType.GroupCallMember) {
            let member = await memberSync.lookupMemberAtEvent(event.sender, event, txn);
            if (!member) {
                // we'll be missing the member here if we received a call and it's members
                // as pre-gap state and the members weren't active in the timeline we got.
                member = RoomMember.fromUserId(room.id, event.sender, "join");
            }
            this.handleCallMemberEvent(event, member, room.id, log);
        }
    }

    /** @internal */
    updateRoomMembers(room: Room, memberChanges: Map<string, MemberChange>) {
        // TODO: also have map for roomId to calls, so we can easily update members
        // we will also need this to get the call for a room
        for (const call of this._calls.values()) {
            if (call.roomId === room.id) {
                call.updateRoomMembers(memberChanges);
            }
        }
    }

    /** @internal */
    handlesDeviceMessageEventType(eventType: string): boolean {
        return handlesEventType(eventType);
    }

    /** @internal */
    handleDeviceMessage(message: SignallingMessage<MGroupCallBase>, userId: string, deviceId: string, log: ILogItem) {
        // TODO: buffer messages for calls we haven't received the state event for yet?
        const call = this._calls.get(message.content.conf_id);
        call?.handleDeviceMessage(message, userId, deviceId, log);
    }

    private handleCallEvent(event: StateEvent, roomId: string, txn: Transaction, log: ILogItem) {
        const callId = event.state_key;
        let call = this._calls.get(callId);
        if (call) {
            call.updateCallEvent(event, log);
            if (call.isTerminated) {
                call.disconnect(log);
                this._calls.remove(call.id);
                txn.calls.remove(call.intent, roomId, call.id);
            }
        } else if(!event.content["m.terminated"]) {
            // We don't have this call already and it isn't terminated, so create the call:
            call = new GroupCall(
                event.state_key, // id
                false, // isLoadedFromStorage
                false, // newCall
                event.origin_server_ts, // startTime
                event.content, // callContent
                roomId, // roomId
                this.groupCallOptions // options
            );
            this._calls.set(call.id, call);
            txn.calls.add({
                intent: call.intent,
                callId: call.id,
                timestamp: event.origin_server_ts,
                roomId: roomId
            });
        }
    }

    private handleCallMemberEvent(event: StateEvent, member: RoomMember, roomId: string, log: ILogItem) {
        const userId = event.state_key;
        const roomMemberKey = getRoomMemberKey(roomId, userId)
        const calls = event.content["m.calls"] ?? [];
        for (const call of calls) {
            const callId = call["m.call_id"];
            const groupCall = this._calls.get(callId);
            // TODO: also check the member when receiving the m.call event
            groupCall?.updateMembership(userId, member, call, log);
        };
        const newCallIdsMemberOf = new Set<string>(calls.map(call => call["m.call_id"]));
        let previousCallIdsMemberOf = this.roomMemberToCallIds.get(roomMemberKey);

        // remove user as member of any calls not present anymore
        if (previousCallIdsMemberOf) {
            for (const previousCallId of previousCallIdsMemberOf) {
                if (!newCallIdsMemberOf.has(previousCallId)) {
                    const groupCall = this._calls.get(previousCallId);
                    groupCall?.removeMembership(userId, log);
                }
            }
        }
        if (newCallIdsMemberOf.size === 0) {
            this.roomMemberToCallIds.delete(roomMemberKey);
        } else {
            this.roomMemberToCallIds.set(roomMemberKey, newCallIdsMemberOf);
        }
    }

    dispose() {
        this.groupCallOptions.turnServerSource.dispose();
        for(const call of this._calls.values()) {
            call.dispose();
        }
    }
}

