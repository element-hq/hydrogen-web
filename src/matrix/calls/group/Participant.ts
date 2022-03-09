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

import {EventType, PeerCall, SignallingMessage} from "../PeerCall";
import {makeTxnId} from "../../common";

import type {PeerCallHandler} from "../PeerCall";
import type {LocalMedia} from "../LocalMedia";
import type {HomeServerApi} from "../../net/HomeServerApi";
import type {Track} from "../../../platform/types/MediaDevices";
import type {MCallBase, MGroupCallBase} from "../callEventTypes";
import type {GroupCall} from "./GroupCall";
import type {RoomMember} from "../../room/members/RoomMember";

export class Participant implements PeerCallHandler {
    constructor(
        public readonly member: RoomMember,
        private readonly deviceId: string | undefined,
        private readonly peerCall: PeerCall,
        private readonly hsApi: HomeServerApi,
        private readonly groupCall: GroupCall
    ) {}

    /* @internal */
    call(localMedia: Promise<LocalMedia>) {
        this.peerCall.call(localMedia);
    }

    get remoteTracks(): Track[] {
        return this.peerCall.remoteTracks;
    }

    /** From PeerCallHandler
     * @internal */
    emitUpdate(params: any) {
        this.groupCall.emitParticipantUpdate(this, params);
    }

    /** From PeerCallHandler
     * @internal */
    async sendSignallingMessage(message: SignallingMessage<MCallBase>) {
        const groupMessage = message as SignallingMessage<MGroupCallBase>;
        groupMessage.content.conf_id = this.groupCall.id;
        // TODO: this needs to be encrypted with olm first

        const request = this.hsApi.sendToDevice(
            groupMessage.type,
            {[this.member.userId]: {
                [this.deviceId ?? "*"]: groupMessage.content
            }
        }, makeTxnId());
        await request.response();
    }
}
