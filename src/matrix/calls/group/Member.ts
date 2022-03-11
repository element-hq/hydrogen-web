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
import {EventType} from "../callEventTypes";

import type {Options as PeerCallOptions} from "../PeerCall";
import type {LocalMedia} from "../LocalMedia";
import type {HomeServerApi} from "../../net/HomeServerApi";
import type {Track} from "../../../platform/types/MediaDevices";
import type {MCallBase, MGroupCallBase, SignallingMessage} from "../callEventTypes";
import type {GroupCall} from "./GroupCall";
import type {RoomMember} from "../../room/members/RoomMember";
import type {EncryptedMessage} from "../../e2ee/olm/Encryption";
import type {ILogItem} from "../../../logging/types";

export type Options = Omit<PeerCallOptions, "emitUpdate" | "sendSignallingMessage"> & {
    confId: string,
    ownUserId: string,
    hsApi: HomeServerApi,
    encryptDeviceMessage: (message: SignallingMessage<MGroupCallBase>, log: ILogItem) => Promise<EncryptedMessage>,
    emitUpdate: (participant: Member, params?: any) => void,
}

export class Member {
    private peerCall?: PeerCall;
    private localMedia?: LocalMedia;

    constructor(
        public readonly member: RoomMember,
        private memberCallInfo: Record<string, any>,
        private readonly options: Options
    ) {}

    get remoteTracks(): Track[] {
        return this.peerCall?.remoteTracks ?? [];
    }

    get isConnected(): boolean {
        return this.peerCall?.state === CallState.Connected;
    }

    /** @internal */
    connect(localMedia: LocalMedia) {
        this.localMedia = localMedia;
        // otherwise wait for it to connect
        if (this.member.userId < this.options.ownUserId) {
            this.peerCall = this._createPeerCall(makeId("c"));
            this.peerCall.call(Promise.resolve(localMedia.clone()));
        }
    }

    /** @internal */
    updateCallInfo(memberCallInfo) {
        // m.calls object from the m.call.member event
    }

    /** @internal */
    emitUpdate = (peerCall: PeerCall, params: any) => {
        if (peerCall.state === CallState.Ringing) {
            peerCall.answer(Promise.resolve(this.localMedia!));
        }
        this.options.emitUpdate(this, params);
    }

    /** @internal */
    sendSignallingMessage = async (message: SignallingMessage<MCallBase>, log: ILogItem) => {
        const groupMessage = message as SignallingMessage<MGroupCallBase>;
        groupMessage.content.conf_id = this.options.confId;
        const encryptedMessage = await this.options.encryptDeviceMessage(groupMessage, log);
        const request = this.options.hsApi.sendToDevice(
            "m.room.encrypted",
            {[this.member.userId]: {
                ["*"]: encryptedMessage.content
            }
        }, makeTxnId(), {log});
        await request.response();
    }

    /** @internal */
    handleDeviceMessage(message: SignallingMessage<MGroupCallBase>, deviceId: string, log: ILogItem) {
        if (message.type === EventType.Invite && !this.peerCall) {
            this.peerCall = this._createPeerCall(message.content.call_id);
        }
        if (this.peerCall) {
            this.peerCall.handleIncomingSignallingMessage(message, deviceId, log);
        } else {
            // TODO: need to buffer events until invite comes?
        }
    }

    private _createPeerCall(callId: string): PeerCall {
        return new PeerCall(callId, Object.assign({}, this.options, {
            emitUpdate: this.emitUpdate,
            sendSignallingMessage: this.sendSignallingMessage
        }));
    }
}
