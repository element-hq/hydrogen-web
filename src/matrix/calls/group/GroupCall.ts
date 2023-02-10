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

import {ObservableMap} from "../../../observable/map";
import {Member, isMemberExpired, memberExpiresAt} from "./Member";
import {LocalMedia} from "../LocalMedia";
import {MuteSettings, CALL_LOG_TYPE, CALL_MEMBER_VALIDITY_PERIOD_MS, mute} from "../common";
import {MemberChange, RoomMember} from "../../room/members/RoomMember";
import {EventEmitter} from "../../../utils/EventEmitter";
import {EventType, CallIntent, CallType} from "../callEventTypes";
import { ErrorBoundary } from "../../../utils/ErrorBoundary";

import type {Options as MemberOptions} from "./Member";
import type {TurnServerSource} from "../TurnServerSource";
import type {BaseObservableMap} from "../../../observable/map";
import type {Track} from "../../../platform/types/MediaDevices";
import type {SignallingMessage, MGroupCallBase, CallMembership, CallMemberContent, CallDeviceMembership} from "../callEventTypes";
import type {Room} from "../../room/Room";
import type {StateEvent} from "../../storage/types";
import type {Platform} from "../../../platform/web/Platform";
import type {EncryptedMessage} from "../../e2ee/olm/Encryption";
import type {ILogItem, ILogger} from "../../../logging/types";
import type {Storage} from "../../storage/idb/Storage";
import type {BaseObservableValue} from "../../../observable/value";
import type {Clock, Timeout} from "../../../platform/web/dom/Clock";

export enum GroupCallState {
    Fledgling = "fledgling",
    Creating = "creating",
    Created = "created",
    Joining = "joining",
    Joined = "joined",
}

function getMemberKey(userId: string, deviceId: string) {
    return JSON.stringify(userId)+`,`+JSON.stringify(deviceId);
}

function memberKeyIsForUser(key: string, userId: string) {
    return key.startsWith(JSON.stringify(userId)+`,`);
}

function getDeviceFromMemberKey(key: string): string {
    return JSON.parse(`[${key}]`)[1];
}

export type Options = Omit<MemberOptions, "emitUpdate" | "confId" | "encryptDeviceMessage" | "turnServer"> & {
    emitUpdate: (call: GroupCall, params?: any) => void;
    encryptDeviceMessage: (roomId: string, userId: string, deviceId: string, message: SignallingMessage<MGroupCallBase>, log: ILogItem) => Promise<EncryptedMessage | undefined>,
    storage: Storage,
    random: () => number,
    logger: ILogger,
    turnServerSource: TurnServerSource
};

class JoinedData {
    public renewMembershipTimeout?: Timeout;

    constructor(
        public readonly logItem: ILogItem,
        public readonly membersLogItem: ILogItem,
        public localMedia: LocalMedia,
        public localPreviewMedia: LocalMedia,
        public localMuteSettings: MuteSettings,
        public readonly turnServer: BaseObservableValue<RTCIceServer>
    ) {}

    dispose() {
        this.localMedia.dispose();
        this.localPreviewMedia.dispose();
        this.logItem.finish();
        this.renewMembershipTimeout?.dispose();
    }
}

export class GroupCall extends EventEmitter<{change: never}> {
    private readonly _members: ObservableMap<string, Member> = new ObservableMap();
    private _memberOptions: MemberOptions;
    private _state: GroupCallState;
    private bufferedDeviceMessages = new Map<string, Set<SignallingMessage<MGroupCallBase>>>();
    /** Set between calling join and leave. */
    private joinedData?: JoinedData;
    private errorBoundary = new ErrorBoundary(err => {
        this.emitChange();
        if (this.joinedData) {
            // in case the error happens in code that does not log,
            // log it here to make sure it isn't swallowed
            this.joinedData.logItem.log("error at boundary").catch(err);
            console.error(err);
        }
    });

    constructor(
        public readonly id: string,
        public readonly isLoadedFromStorage: boolean,
        newCall: boolean,
        private startTime: number | undefined,
        private callContent: Record<string, any>,
        public readonly roomId: string,
        private readonly options: Options,
    ) {
        super();
        this._state = newCall ? GroupCallState.Fledgling : GroupCallState.Created;
        this._memberOptions = Object.assign({}, options, {
            confId: this.id,
            emitUpdate: member => {
                const memberKey = getMemberKey(member.userId, member.deviceId);
                // only remove expired members to whom we're not already connected
                if (member.isExpired && !member.isConnected) {
                    const logItem = this.options.logger.log({
                        l: "removing expired member from call",
                        memberKey,
                        callId: this.id
                    })
                    member.logItem?.refDetached(logItem);
                    member.dispose();
                    this._members.remove(memberKey);
                } else {
                    this._members.update(memberKey);
                }
            },
            encryptDeviceMessage: (userId: string, deviceId: string, message: SignallingMessage<MGroupCallBase>, log) => {
                return this.options.encryptDeviceMessage(this.roomId, userId, deviceId, message, log);
            }
        });
    }

    get localMedia(): LocalMedia | undefined { return this.joinedData?.localMedia; }
    get localPreviewMedia(): LocalMedia | undefined { return this.joinedData?.localPreviewMedia; }
    get members(): BaseObservableMap<string, Member> { return this._members; }

    get isTerminated(): boolean {
        return !!this.callContent?.["m.terminated"];
    }

    get usesFoci(): boolean {
        for (const member of this._members.values()) {
            if (member.usesFoci) {
                return true;
            }
        }
        return false;
    }

    get duration(): number | undefined {
        if (typeof this.startTime === "number") {
            return (this.options.clock.now() - this.startTime);
        }
    }

    get isRinging(): boolean {
        return this._state === GroupCallState.Created && this.intent === "m.ring" && !this.isMember(this.options.ownUserId);
    }

    get name(): string {
        return this.callContent?.["m.name"];
    }

    get intent(): CallIntent {
        return this.callContent?.["m.intent"];
    }

    get type(): CallType {
        return this.callContent?.["m.type"];
    }

    /**
     * Gives access the log item for this call while joined.
     * Can be used for call diagnostics while in the call.
     **/
    get logItem(): ILogItem | undefined {
        return this.joinedData?.logItem;
    }

    get error(): Error | undefined {
        return this.errorBoundary.error;
    }

    join(localMedia: LocalMedia, log?: ILogItem): Promise<void> {
        return this.options.logger.wrapOrRun(log, "Call.join", async joinLog => {
            if (this._state !== GroupCallState.Created || this.joinedData || this.usesFoci) {
                localMedia.dispose();
                return;
            }
            const logItem = this.options.logger.child({
                l: "Call.connection",
                t: CALL_LOG_TYPE,
                id: this.id,
                ownSessionId: this.options.sessionId
            });
            const turnServer = await this.options.turnServerSource.getSettings(logItem);
            const membersLogItem = logItem.child("member connections");
            const localMuteSettings = new MuteSettings();
            localMuteSettings.updateTrackInfo(localMedia.userMedia);
            const localPreviewMedia = localMedia.asPreview();
            const joinedData = new JoinedData(
                logItem,
                membersLogItem,
                localMedia,
                localPreviewMedia,
                localMuteSettings,
                turnServer
            );
            this.joinedData = joinedData;
            await joinedData.logItem.wrap("join", async log => {
                joinLog.refDetached(log);
                this._state = GroupCallState.Joining;
                this.emitChange();
                await log.wrap("update member state", async log => {
                    const memberContent = await this._createMemberPayload(true);
                    log.set("payload", memberContent);
                    // send m.call.member state event
                    const request = this.options.hsApi.sendState(this.roomId, EventType.GroupCallMember, this.options.ownUserId, memberContent, {log});
                    await request.response();
                    this.emitChange();
                });
                // send invite to all members that are < my userId
                for (const member of this._members.values()) {
                    this.connectToMember(member, joinedData, log);
                }
            });
        });
    }

    async setMedia(localMedia: LocalMedia): Promise<void> {
        if ((this._state === GroupCallState.Joining || this._state === GroupCallState.Joined) && this.joinedData) {
            const oldMedia = this.joinedData.localMedia;
            this.joinedData.localMedia = localMedia;
            this.joinedData.localPreviewMedia?.dispose();
            this.joinedData.localPreviewMedia = localMedia.asPreview();
            // reflect the fact we gained or lost local tracks in the local mute settings
            // and update the track info so PeerCall can use it to send up to date metadata,
            this.joinedData.localMuteSettings.updateTrackInfo(localMedia.userMedia);
            this.emitChange(); //allow listeners to see new media/mute settings
            // TODO: if setMedia fails on one of the members, we should revert to the old media
            // on the members processed so far, and show an error that we could not set the new media
            // for this, we will need to remove the usage of the errorBoundary in member.setMedia.
            await Promise.all(Array.from(this._members.values()).map(m => {
                return m.setMedia(localMedia, oldMedia);
            }));
            oldMedia?.dispose();
        }
    }

    async setMuted(muteSettings: MuteSettings): Promise<void> {
        const {joinedData} = this;
        if (!joinedData) {
            return;
        }
        const prevMuteSettings = joinedData.localMuteSettings;
        // we still update the mute settings if nothing changed because
        // you might be muted because you don't have a track or because
        // you actively chosen to mute
        // (which we want to respect in the future when you add a track)
        muteSettings.updateTrackInfo(joinedData.localMedia.userMedia);
        joinedData.localMuteSettings = muteSettings;
        if (!prevMuteSettings.equals(muteSettings)) {
            // Mute our copies of LocalMedias;
            // otherwise the camera lights will still be on.
            if (this.localPreviewMedia) {
                mute(this.localPreviewMedia, muteSettings, this.joinedData!.logItem);
            }
            if (this.localMedia) {
                mute(this.localMedia, muteSettings, this.joinedData!.logItem);
            }
            // TODO: if setMuted fails on one of the members, we should revert to the old media
            // on the members processed so far, and show an error that we could not set the new media
            // for this, we will need to remove the usage of the errorBoundary in member.setMuted.
            await Promise.all(Array.from(this._members.values()).map(m => {
                return m.setMuted(joinedData.localMuteSettings);
            }));
            this.emitChange();
        }
    }

    get muteSettings(): MuteSettings | undefined {
        return this.joinedData?.localMuteSettings;
    }

    get hasJoined() {
        return this._state === GroupCallState.Joining || this._state === GroupCallState.Joined;
    }

    async leave(log?: ILogItem): Promise<void> {
        await this.options.logger.wrapOrRun(log, "Call.leave", async log => {
            const {joinedData} = this;
            if (!joinedData) {
                return;
            }
            try {
                joinedData.renewMembershipTimeout?.dispose();
                joinedData.renewMembershipTimeout = undefined;
                const memberContent = await this._createMemberPayload(false);
                // send m.call.member state event
                if (memberContent) {
                    const request = this.options.hsApi.sendState(this.roomId, EventType.GroupCallMember, this.options.ownUserId, memberContent, {log});
                    await request.response();
                    // our own user isn't included in members, so not in the count
                    if ((this.intent === CallIntent.Ring || this.intent === CallIntent.Prompt) && this._members.size === 0) {
                        await this.terminate(log);
                    }
                } else {
                    log.set("already_left", true);
                }
            } finally {
                // disconnect is called both from the sync loop and from methods like this one that
                // are called from the view model. We want errors during the sync loop being caught
                // by the errorboundary, but since leave is called from the view model, we want
                // the error to be thrown. So here we check if disconnect succeeded, and if not
                // we rethrow the error put into the errorBoundary.
                if(!this.disconnect(log)) {
                    throw this.errorBoundary.error;
                }
            }
        });
    }

    private terminate(log?: ILogItem): Promise<void> {
        return this.options.logger.wrapOrRun(log, {l: "terminate call", t: CALL_LOG_TYPE}, async log => {
            if (this._state === GroupCallState.Fledgling) {
                return;
            }
            const request = this.options.hsApi.sendState(this.roomId, EventType.GroupCall, this.id, Object.assign({}, this.callContent, {
                "m.terminated": true
            }), {log});
            await request.response();
        });
    }

    /** @internal */
    create(type: CallType, log: ILogItem): Promise<void> {
        return log.wrap({l: "create call", t: CALL_LOG_TYPE}, async log => {
            if (this._state !== GroupCallState.Fledgling) {
                return;
            }
            this._state = GroupCallState.Creating;
            this.emitChange();
            this.callContent = Object.assign({
                "m.type": type,
            }, this.callContent);
            const request = this.options.hsApi.sendState(this.roomId, EventType.GroupCall, this.id, this.callContent!, {log});
            await request.response();
            this._state = GroupCallState.Created;
            this.emitChange();
        });
    }

    /** @internal */
    updateCallEvent(event: StateEvent, syncLog: ILogItem) {
        this.errorBoundary.try(() => {
            syncLog.wrap({l: "update call", t: CALL_LOG_TYPE, id: this.id}, log => {

                if (typeof this.startTime !== "number") {
                    this.startTime = event.origin_server_ts;
                }
                this.callContent = event.content;
                if (this._state === GroupCallState.Creating) {
                    this._state = GroupCallState.Created;
                }
                log.set("status", this._state);
                this.emitChange();
            });
        });
    }

    /** @internal */
    updateRoomMembers(memberChanges: Map<string, MemberChange>) {
        this.errorBoundary.try(() => {
            for (const change of memberChanges.values()) {
                const {member} = change;
                for (const callMember of this._members.values()) {
                    // find all call members for a room member (can be multiple, for every device)
                    if (callMember.userId === member.userId) {
                        callMember.updateRoomMember(member);
                    }
                }
            }
        });
    }

    /** @internal */
    updateMembership(userId: string, roomMember: RoomMember, callMembership: CallMembership, syncLog: ILogItem) {
        this.errorBoundary.try(async () => {
            await syncLog.wrap({l: "update call membership", t: CALL_LOG_TYPE, id: this.id, userId}, async log => {
                const now = this.options.clock.now();
                const devices = callMembership["m.devices"];
                const previousDeviceIds = this.getDeviceIdsForUserId(userId);
                for (const device of devices) {
                    const deviceId = device.device_id;
                    const memberKey = getMemberKey(userId, deviceId);
                    if (userId === this.options.ownUserId && deviceId === this.options.ownDeviceId) {
                        log.wrap("update own membership", log => {
                            if (this.hasJoined) {
                                if (this.joinedData) {
                                    this.joinedData.logItem.refDetached(log);
                                }
                                this._setupRenewMembershipTimeout(device, log);
                            }
                            if (this._state === GroupCallState.Joining) {
                                log.set("joined", true);
                                this._state = GroupCallState.Joined;
                                this.emitChange();
                            }
                        });
                    } else {
                        await log.wrap({l: "update device membership", id: memberKey, sessionId: device.session_id}, async log => {
                            if (isMemberExpired(device, now)) {
                                log.set("expired", true);
                                const member = this._members.get(memberKey);
                                if (member) {
                                    member.dispose();
                                    this._members.remove(memberKey);
                                    log.set("removed", true);
                                }
                                return;
                            }
                            let member = this._members.get(memberKey);
                            const sessionIdChanged = member && member.sessionId !== device.session_id;
                            if (member && !sessionIdChanged) {
                                log.set("update", true);
                                member.updateCallInfo(device, log);
                            } else {
                                if (member && sessionIdChanged) {
                                    log.set("removedSessionId", member.sessionId);
                                    const disconnectLogItem = await member.disconnect(false);
                                    if (disconnectLogItem) {
                                        log.refDetached(disconnectLogItem);
                                    }
                                    member.dispose();
                                    this._members.remove(memberKey);
                                    member = undefined;
                                }
                                log.set("add", true);
                                member = new Member(
                                    roomMember,
                                    device, this._memberOptions,
                                    log
                                );
                                this._members.add(memberKey, member);
                                if (this.joinedData) {
                                    this.connectToMember(member, this.joinedData, log);
                                }
                            }
                            // flush pending messages, either after having created the member,
                            // or updated the session id with updateCallInfo
                            this.flushPendingIncomingDeviceMessages(member, log);
                        });
                    }
                }

                const newDeviceIds = new Set<string>(devices.map(call => call.device_id));
                // remove user as member of any calls not present anymore
                for (const previousDeviceId of previousDeviceIds) {
                    if (!newDeviceIds.has(previousDeviceId)) {
                        this.removeMemberDevice(userId, previousDeviceId, log);
                    }
                }
                if (userId === this.options.ownUserId && !newDeviceIds.has(this.options.ownDeviceId)) {
                    this.removeOwnDevice(log);
                }
            });
        });
    }

    /** @internal */
    removeMembership(userId: string, syncLog: ILogItem) {
        this.errorBoundary.try(() => {
            const deviceIds = this.getDeviceIdsForUserId(userId);
            syncLog.wrap({
                l: "remove call member",
                t: CALL_LOG_TYPE,
                id: this.id,
                userId
            }, log => {
                for (const deviceId of deviceIds) {
                    this.removeMemberDevice(userId, deviceId, log);
                }
                if (userId === this.options.ownUserId) {
                    this.removeOwnDevice(log);
                }
            });
        });
    }

    private flushPendingIncomingDeviceMessages(member: Member, log: ILogItem) {
        const memberKey = getMemberKey(member.userId, member.deviceId);
        const bufferedMessages = this.bufferedDeviceMessages.get(memberKey);
        // check if we have any pending message for the member with (userid, deviceid, sessionid)
        if (bufferedMessages) {
            for (const message of bufferedMessages) {
                if (message.content.sender_session_id === member.sessionId) {
                    member.handleDeviceMessage(message, log);
                    bufferedMessages.delete(message);
                }
            }
            if (bufferedMessages.size === 0) {
                this.bufferedDeviceMessages.delete(memberKey);
            }
        }
    }

    private getDeviceIdsForUserId(userId: string): string[] {
        return Array.from(this._members.keys())
            .filter(key => memberKeyIsForUser(key, userId))
            .map(key => getDeviceFromMemberKey(key));
    }

    private isMember(userId: string): boolean {
        return Array.from(this._members.keys()).some(key => memberKeyIsForUser(key, userId));
    }

    private removeOwnDevice(log: ILogItem) {
        log.wrap("remove own membership", log => {
            this.disconnect(log);
        });
    }

    /** @internal */
    disconnect(log: ILogItem): Promise<void> | true {
        return this.errorBoundary.try(async () => {
            if (this.hasJoined) {
                for (const member of this._members.values()) {
                    const disconnectLogItem = await member.disconnect(true);
                    if (disconnectLogItem) {
                        log.refDetached(disconnectLogItem);
                    }
                }
                this._state = GroupCallState.Created;
            }
            this.joinedData?.dispose();
            this.joinedData = undefined;
            this.emitChange();
        }, false) || true;
    }

    /** @internal */
    private async removeMemberDevice(userId: string, deviceId: string, log: ILogItem) {
        const memberKey = getMemberKey(userId, deviceId);
        await log.wrap({l: "remove device member", id: memberKey}, async log => {
            const member = this._members.get(memberKey);
            if (member) {
                log.set("leave", true);
                const disconnectLogItem = await member.disconnect(false);
                if (disconnectLogItem) {
                    log.refDetached(disconnectLogItem);
                }
                member.dispose();
                this._members.remove(memberKey);
            }
        });
    }

    /** @internal */
    handleDeviceMessage(message: SignallingMessage<MGroupCallBase>, userId: string, deviceId: string, syncLog: ILogItem) {
        this.errorBoundary.try(() => {
            // TODO: return if we are not membering to the call
            const key = getMemberKey(userId, deviceId);
            let member = this._members.get(key);
            if (member && message.content.sender_session_id === member.sessionId) {
                member.handleDeviceMessage(message, syncLog);
            } else {
                const item = syncLog.log({
                    l: "call: buffering to_device message, member not found",
                    t: CALL_LOG_TYPE,
                    id: this.id,
                    userId,
                    deviceId,
                    sessionId: message.content.sender_session_id,
                    type: message.type
                });
                // we haven't received the m.call.member yet for this caller (or with this session id).
                // buffer the device messages or create the member/call as it should arrive in a moment
                let messages = this.bufferedDeviceMessages.get(key);
                if (!messages) {
                    messages = new Set();
                    this.bufferedDeviceMessages.set(key, messages);
                }
                messages.add(message);
            }
        });
    }

    private async _createMemberPayload(includeOwn: boolean): Promise<CallMemberContent> {
        const {storage} = this.options;
        const txn = await storage.readTxn([storage.storeNames.roomState]);
        const stateEvent = await txn.roomState.get(this.roomId, EventType.GroupCallMember, this.options.ownUserId);
        const stateContent: CallMemberContent = stateEvent?.event?.content as CallMemberContent ?? {
            ["m.calls"]: []
        };
        let callsInfo = stateContent["m.calls"];
        let callInfo = callsInfo.find(c => c["m.call_id"] === this.id);
        if (!callInfo) {
            callInfo = {
                ["m.call_id"]: this.id,
                ["m.devices"]: []
            };
            callsInfo.push(callInfo);
        }
        const now = this.options.clock.now();
        callInfo["m.devices"] = callInfo["m.devices"].filter(d => {
            // remove our own device (to add it again below)
            if (d["device_id"] === this.options.ownDeviceId) {
                return false;
            }
            // also remove any expired devices (+ the validity period added again)
            if (memberExpiresAt(d) === undefined || isMemberExpired(d, now, CALL_MEMBER_VALIDITY_PERIOD_MS)) {
                return false;
            }
            return true;
        });
        if (includeOwn) {
            callInfo["m.devices"].push({
                ["device_id"]: this.options.ownDeviceId,
                ["session_id"]: this.options.sessionId,
                ["expires_ts"]: now + CALL_MEMBER_VALIDITY_PERIOD_MS,
                feeds: [{purpose: "m.usermedia"}]
            });
        }
        // filter out empty call membership
        stateContent["m.calls"] = callsInfo.filter(c => c["m.devices"].length !== 0);
        return stateContent;
    }

    private async connectToMember(member: Member, joinedData: JoinedData, log: ILogItem) {
        const memberKey = getMemberKey(member.userId, member.deviceId);
        const logItem = joinedData.membersLogItem.child({
            l: "member",
            id: memberKey,
            sessionId: member.sessionId
        });
        await log.wrap({l: "connect", id: memberKey}, async log => {
            const connectItem = await member.connect(
                joinedData.localMedia,
                joinedData.localMuteSettings,
                joinedData.turnServer,
                logItem
            );
            if (connectItem) {
                log.refDetached(connectItem);
            }
        });
    }

    protected emitChange() {
        this.emit("change");
        this.options.emitUpdate(this);
    }

    private _setupRenewMembershipTimeout(callDeviceMembership: CallDeviceMembership, log: ILogItem) {
        const {joinedData} = this;
        if (!joinedData) {
            return;
        }
        joinedData.renewMembershipTimeout?.dispose();
        joinedData.renewMembershipTimeout = undefined;
        const expiresAt = memberExpiresAt(callDeviceMembership);
        if (typeof expiresAt !== "number") {
            return;
        }
        const expiresFromNow = expiresAt - this.options.clock.now();
        // renew 1 to 5 minutes (8.3% of 1h, but min 10s) before expiring
        // do it a bit beforehand and somewhat random to not collide with
        // other clients trying to renew as well
        const timeToRenewBeforeExpiration = Math.max(10000, Math.ceil((0.2 +(this.options.random() * 0.8)) * (0.08333 * CALL_MEMBER_VALIDITY_PERIOD_MS)));
        const renewFromNow = Math.max(0, expiresFromNow - timeToRenewBeforeExpiration);
        log.set("expiresIn", expiresFromNow);
        log.set("renewIn", renewFromNow);
        joinedData.renewMembershipTimeout = this.options.clock.createTimeout(renewFromNow);
        joinedData.renewMembershipTimeout.elapsed().then(
            () => {
                joinedData.logItem.wrap("renew membership", async log => {
                    const memberContent = await this._createMemberPayload(true);
                    log.set("payload", memberContent);
                    // send m.call.member state event
                    const request = this.options.hsApi.sendState(this.roomId, EventType.GroupCallMember, this.options.ownUserId, memberContent, {log});
                    await request.response();
                });
            },
            () => { /* assume we're swallowing AbortError from dispose above */ }
        );
    }

    dispose() {
        this.joinedData?.dispose();
        for (const member of this._members.values()) {
            member.dispose();
        }
    }
}
