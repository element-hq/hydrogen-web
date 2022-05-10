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

import {PeerCall, CallState} from "../PeerCall";
import {makeTxnId, makeId} from "../../common";
import {EventType, CallErrorCode} from "../callEventTypes";
import {formatToDeviceMessagesPayload} from "../../common";

import type {MuteSettings} from "../common";
import type {Options as PeerCallOptions, RemoteMedia} from "../PeerCall";
import type {LocalMedia} from "../LocalMedia";
import type {HomeServerApi} from "../../net/HomeServerApi";
import type {MCallBase, MGroupCallBase, SignallingMessage, CallDeviceMembership} from "../callEventTypes";
import type {GroupCall} from "./GroupCall";
import type {RoomMember} from "../../room/members/RoomMember";
import type {EncryptedMessage} from "../../e2ee/olm/Encryption";
import type {ILogItem} from "../../../logging/types";

export type Options = Omit<PeerCallOptions, "emitUpdate" | "sendSignallingMessage"> & {
    confId: string,
    ownUserId: string,
    ownDeviceId: string,
    // local session id of our client
    sessionId: string,
    hsApi: HomeServerApi,
    encryptDeviceMessage: (userId: string, message: SignallingMessage<MGroupCallBase>, log: ILogItem) => Promise<EncryptedMessage>,
    emitUpdate: (participant: Member, params?: any) => void,
}

const errorCodesWithoutRetry = [
    CallErrorCode.UserHangup,
    CallErrorCode.AnsweredElsewhere,
    CallErrorCode.Replaced,
    CallErrorCode.UserBusy,
    CallErrorCode.Transfered,
    CallErrorCode.NewSession
];

/** @internal */
class MemberConnection {
    public retryCount: number = 0;
    public peerCall?: PeerCall;

    constructor(
        public localMedia: LocalMedia,
        public localMuteSettings: MuteSettings,
        public readonly logItem: ILogItem
    ) {}
}

export class Member {
    private connection?: MemberConnection;

    constructor(
        public readonly member: RoomMember,
        private callDeviceMembership: CallDeviceMembership,
        private readonly options: Options,
    ) {}

    /**
     * Gives access the log item for this item once joined to the group call.
     * The signalling for this member will be log in this item.
     * Can be used for call diagnostics while in the call.
     **/
    get logItem(): ILogItem | undefined {
        return this.connection?.logItem;
    }

    get remoteMedia(): RemoteMedia | undefined {
        return this.connection?.peerCall?.remoteMedia;
    }

    get remoteMuteSettings(): MuteSettings | undefined {
        return this.connection?.peerCall?.remoteMuteSettings;
    }

    get isConnected(): boolean {
        return this.connection?.peerCall?.state === CallState.Connected;
    }

    get userId(): string {
        return this.member.userId;
    }

    get deviceId(): string {
        return this.callDeviceMembership.device_id;
    }

    /** session id of the member */
    get sessionId(): string {
        return this.callDeviceMembership.session_id;
    }

    get dataChannel(): any | undefined {
        return this.connection?.peerCall?.dataChannel;
    }

    /** @internal */
    connect(localMedia: LocalMedia, localMuteSettings: MuteSettings, memberLogItem: ILogItem): ILogItem | undefined {
        if (this.connection) {
            return;
        }
        const connection = new MemberConnection(localMedia, localMuteSettings, memberLogItem);
        this.connection = connection;
        let connectLogItem;
        connection.logItem.wrap("connect", async log => {
            connectLogItem = log;
            await this.callIfNeeded(log);
        });
        return connectLogItem;
    }

    private callIfNeeded(log: ILogItem): Promise<void> {
        return log.wrap("callIfNeeded", async log => {
            // otherwise wait for it to connect
            let shouldInitiateCall;
            // the lexicographically lower side initiates the call
            if (this.member.userId === this.options.ownUserId) {
                shouldInitiateCall = this.deviceId > this.options.ownDeviceId;
            } else {
                shouldInitiateCall = this.member.userId > this.options.ownUserId;
            }
            if (shouldInitiateCall) {
                const connection = this.connection!;
                connection.peerCall = this._createPeerCall(makeId("c"));
                await connection.peerCall.call(
                    connection.localMedia,
                    connection.localMuteSettings,
                    log
                );
            } else {
                log.set("wait_for_invite", true);
            }
        });
    }

    /** @internal */
    disconnect(hangup: boolean): ILogItem | undefined {
        const {connection} = this;
        if (!connection) {
            return;
        }
        let disconnectLogItem;
        connection.logItem.wrap("disconnect", async log => {
            disconnectLogItem = log;
            if (hangup) {
                connection.peerCall?.hangup(CallErrorCode.UserHangup, log);
            } else {
                await connection.peerCall?.close(undefined, log);
            }
            connection.peerCall?.dispose();
            connection.localMedia?.dispose();
            this.connection = undefined;
        });
        connection.logItem.finish();
        return disconnectLogItem;
    }

    /** @internal */
    updateCallInfo(callDeviceMembership: CallDeviceMembership, causeItem: ILogItem) {
        this.callDeviceMembership = callDeviceMembership;
        if (this.connection) {
            this.connection.logItem.refDetached(causeItem);
        }
    }

    /** @internal */
    emitUpdateFromPeerCall = (peerCall: PeerCall, params: any, log: ILogItem): void => {
        const connection = this.connection!;
        if (peerCall.state === CallState.Ringing) {
            connection.logItem.wrap("ringing, answer peercall", answerLog => {
                log.refDetached(answerLog);
                return peerCall.answer(connection.localMedia, connection.localMuteSettings, answerLog);
            });
        }
        else if (peerCall.state === CallState.Ended) {
            const hangupReason = peerCall.hangupReason;
            peerCall.dispose();
            connection.peerCall = undefined;
            if (hangupReason && !errorCodesWithoutRetry.includes(hangupReason)) {
                connection.retryCount += 1;
                const {retryCount} = connection;
                connection.logItem.wrap({l: "retry connection", retryCount}, async retryLog => {
                    log.refDetached(retryLog);
                    if (retryCount <= 3) {
                        await this.callIfNeeded(retryLog);
                    } else {
                        const disconnectLogItem = this.disconnect(false);
                        if (disconnectLogItem) {
                            retryLog.refDetached(disconnectLogItem);
                        }
                    }
                });
            }
        }
        this.options.emitUpdate(this, params);
    }

    /** @internal */
    sendSignallingMessage = async (message: SignallingMessage<MCallBase>, log: ILogItem): Promise<void> => {
        const groupMessage = message as SignallingMessage<MGroupCallBase>;
        groupMessage.content.conf_id = this.options.confId;
        groupMessage.content.device_id = this.options.ownDeviceId;
        groupMessage.content.party_id = this.options.ownDeviceId;
        groupMessage.content.sender_session_id = this.options.sessionId;
        groupMessage.content.dest_session_id = this.sessionId;
        // const encryptedMessages = await this.options.encryptDeviceMessage(this.member.userId, groupMessage, log);
        // const payload = formatToDeviceMessagesPayload(encryptedMessages);
        const payload = {
            messages: {
                [this.member.userId]: {
                    [this.deviceId]: groupMessage.content
                }
            }
        };
        // TODO: remove this for release
        log.set("payload", groupMessage.content);
        const request = this.options.hsApi.sendToDevice(
            message.type,
            //"m.room.encrypted",
            payload,
            makeTxnId(),
            {log}
        );
        await request.response();
    }

    /** @internal */
    handleDeviceMessage(message: SignallingMessage<MGroupCallBase>, syncLog: ILogItem): void{
        const {connection} = this;
        if (connection) {
            const destSessionId = message.content.dest_session_id;
            if (destSessionId !== this.options.sessionId) {
                const logItem = connection.logItem.log({l: "ignoring to_device event with wrong session_id", destSessionId, type: message.type});
                syncLog.refDetached(logItem);
                return;
            }
            if (message.type === EventType.Invite && !connection.peerCall) {
                connection.peerCall = this._createPeerCall(message.content.call_id);
            }
            if (connection.peerCall) {
                const item = connection.peerCall.handleIncomingSignallingMessage(message, this.deviceId, connection.logItem);
                syncLog.refDetached(item);
            } else {
                // TODO: need to buffer events until invite comes?
            }
        } else {
            syncLog.log({l: "member not connected", userId: this.userId, deviceId: this.deviceId});
        }
    }

    /** @internal */
    async setMedia(localMedia: LocalMedia, previousMedia: LocalMedia): Promise<void> {
        const {connection} = this;
        if (connection) {
            connection.localMedia = connection.localMedia.replaceClone(connection.localMedia, previousMedia);
            await connection.peerCall?.setMedia(connection.localMedia, connection.logItem);
        }
    }

    async setMuted(muteSettings: MuteSettings): Promise<void> {
        const {connection} = this;
        if (connection) {
            connection.localMuteSettings = muteSettings;
            await connection.peerCall?.setMuted(muteSettings, connection.logItem);
        }
    }

    private _createPeerCall(callId: string): PeerCall {
        return new PeerCall(callId, Object.assign({}, this.options, {
            emitUpdate: this.emitUpdateFromPeerCall,
            sendSignallingMessage: this.sendSignallingMessage
        }), this.connection!.logItem);
    }
}