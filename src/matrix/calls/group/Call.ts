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

import {ObservableMap} from "../../../observable/map/ObservableMap";

function participantId(senderUserId: string, senderDeviceId: string | null) {
    return JSON.stringify(senderUserId) + JSON.stringify(senderDeviceId);
}

class Call {
    private readonly participants: ObservableMap<string, Participant> = new ObservableMap();
    private localMedia?: LocalMedia;

    constructor(private readonly ownUserId: string, private callEvent: StateEvent, private readonly room: Room, private readonly webRTC: WebRTC) {

    }

    get id(): string { return this.callEvent.state_key; }

    async participate(tracks: Track[]) {
        this.localMedia = LocalMedia.fromTracks(tracks);
        for (const [,participant] of this.participants) {
            participant.setLocalMedia(this.localMedia.clone());
        }
        // send m.call.member state event

        // send invite to all participants that are < my userId
        for (const [,participant] of this.participants) {
            if (participant.userId < this.ownUserId) {
                participant.sendInvite();
            }
        }
    }

    updateCallEvent(callEvent: StateEvent) {
        this.callEvent = callEvent;
    }

    addParticipant(userId, source) {
        const participantId = getParticipantId(userId, source.device_id);
        const participant = this.participants.get(participantId);
        if (participant) {
            participant.updateSource(source);
        } else {
            participant.add(participantId, new Participant(userId, source.device_id, this.localMedia?.clone(), this.webRTC));
        }
    }

    handleDeviceMessage(senderUserId: string, senderDeviceId: string, eventType: string, content: Record<string, any>, log: ILogItem) {
        const participantId = getParticipantId(senderUserId, senderDeviceId);
        let peerCall = this.participants.get(participantId);
        let hasDeviceInKey = true;
        if (!peerCall) {
            hasDeviceInKey = false;
            peerCall = this.participants.get(getParticipantId(senderUserId, null))
        }
        if (peerCall) {
            peerCall.handleIncomingSignallingMessage(eventType, content, senderDeviceId);
            if (!hasDeviceInKey && peerCall.opponentPartyId) {
                this.participants.delete(getParticipantId(senderUserId, null));
                this.participants.add(getParticipantId(senderUserId, peerCall.opponentPartyId));
            }
        } else {
            // create peerCall
        }
    }

    get id(): string {
        return this.callEvent.state_key;
    }

    get isTerminated(): boolean {
        return !!this.callEvent.content[CALL_TERMINATED];
    }
}
