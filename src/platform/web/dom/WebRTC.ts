/*
Copyright 2021 Šimon Brandner <simon.bra.ag@gmail.com>

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

import {Stream, Track, TrackKind} from "../../types/MediaDevices";
import {WebRTC, Sender, PeerConnection} from "../../types/WebRTC";
import {SDPStreamMetadataPurpose} from "../../../matrix/calls/callEventTypes";

const POLLING_INTERVAL = 200; // ms
export const SPEAKING_THRESHOLD = -60; // dB
const SPEAKING_SAMPLE_COUNT = 8; // samples

export class DOMWebRTC implements WebRTC {
    createPeerConnection(forceTURN: boolean, turnServers: RTCIceServer[], iceCandidatePoolSize): PeerConnection {
        const peerConn = new RTCPeerConnection({
            iceTransportPolicy: forceTURN ? 'relay' : undefined,
            iceServers: turnServers,
            iceCandidatePoolSize: iceCandidatePoolSize,
        }) as PeerConnection;
        return new Proxy(peerConn, {
            get(target, prop, receiver) {
                if (prop === "close") {
                    console.trace("calling peerConnection.close");
                }
                const value = target[prop];
                if (typeof value === "function") {
                    return value.bind(target);
                } else {
                    return value;
                }
            }
        });
    }

    prepareSenderForPurpose(peerConnection: PeerConnection, sender: Sender, purpose: SDPStreamMetadataPurpose): void {
        if (purpose === SDPStreamMetadataPurpose.Screenshare) {
            this.getRidOfRTXCodecs(peerConnection as RTCPeerConnection, sender as RTCRtpSender);
        }
    }

    private getRidOfRTXCodecs(peerConnection: RTCPeerConnection, sender: RTCRtpSender): void {
        // RTCRtpReceiver.getCapabilities and RTCRtpSender.getCapabilities don't seem to be supported on FF
        if (!RTCRtpReceiver.getCapabilities || !RTCRtpSender.getCapabilities) return;

        const recvCodecs = RTCRtpReceiver.getCapabilities("video")?.codecs ?? [];
        const sendCodecs = RTCRtpSender.getCapabilities("video")?.codecs ?? [];
        const codecs = [...sendCodecs, ...recvCodecs];

        for (const codec of codecs) {
            if (codec.mimeType === "video/rtx") {
                const rtxCodecIndex = codecs.indexOf(codec);
                codecs.splice(rtxCodecIndex, 1);
            }
        }

        const transceiver = peerConnection.getTransceivers().find(t => t.sender === sender);
        if (transceiver && (
                transceiver.sender.track?.kind === "video" ||
                transceiver.receiver.track?.kind === "video"
            )
        ) {
            transceiver.setCodecPreferences(codecs);
        }
    }
}
