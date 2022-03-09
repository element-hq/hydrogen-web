// allow non-camelcase as these are events type that go onto the wire
/* eslint-disable camelcase */

// TODO: Change to "sdp_stream_metadata" when MSC3077 is merged
export const SDPStreamMetadataKey = "org.matrix.msc3077.sdp_stream_metadata";

export interface SessionDescription {
    sdp?: string;
    type: RTCSdpType
}

export enum SDPStreamMetadataPurpose {
    Usermedia = "m.usermedia",
    Screenshare = "m.screenshare",
}

export interface SDPStreamMetadataObject {
    purpose: SDPStreamMetadataPurpose;
    audio_muted: boolean;
    video_muted: boolean;
}

export interface SDPStreamMetadata {
    [key: string]: SDPStreamMetadataObject;
}

export interface CallCapabilities {
    'm.call.transferee': boolean;
    'm.call.dtmf': boolean;
}

export interface CallReplacesTarget {
    id: string;
    display_name: string;
    avatar_url: string;
}

export type MCallBase = {
    call_id: string;
    version: string | number;
}

export type MGroupCallBase = MCallBase & {
    conf_id: string;
} 

export type MCallAnswer<Base extends MCallBase> = Base & {
    answer: SessionDescription;
    capabilities?: CallCapabilities;
    [SDPStreamMetadataKey]: SDPStreamMetadata;
}

export type MCallSelectAnswer<Base extends MCallBase> = Base & {
    selected_party_id: string;
}

export type MCallInvite<Base extends MCallBase> = Base & {
    offer: SessionDescription;
    lifetime: number;
    [SDPStreamMetadataKey]: SDPStreamMetadata;
}

export type MCallSDPStreamMetadataChanged<Base extends MCallBase> = Base & {
    [SDPStreamMetadataKey]: SDPStreamMetadata;
}

export type MCallReplacesEvent<Base extends MCallBase> = Base & {
    replacement_id: string;
    target_user: CallReplacesTarget;
    create_call: string;
    await_call: string;
    target_room: string;
}

export type MCAllAssertedIdentity<Base extends MCallBase> = Base & {
    asserted_identity: {
        id: string;
        display_name: string;
        avatar_url: string;
    };
}

export type MCallCandidates<Base extends MCallBase> = Base & {
    candidates: RTCIceCandidate[];
}

export type MCallHangupReject<Base extends MCallBase> = Base & {
    reason?: CallErrorCode;
}

/* eslint-enable camelcase */
