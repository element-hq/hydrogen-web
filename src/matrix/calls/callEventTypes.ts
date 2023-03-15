// allow non-camelcase as these are events type that go onto the wire
/* eslint-disable camelcase */
import type {StateEvent} from "../storage/types";
import type {SessionDescription} from "../../platform/types/WebRTC";
export enum EventType {
    GroupCall = "org.matrix.msc3401.call",
    GroupCallMember = "org.matrix.msc3401.call.member",
    Invite = "m.call.invite",
    Candidates = "m.call.candidates",
    Answer = "m.call.answer",
    Hangup = "m.call.hangup",
    Reject = "m.call.reject",
    SelectAnswer = "m.call.select_answer",
    Negotiate = "m.call.negotiate",
    SDPStreamMetadataChanged = "m.call.sdp_stream_metadata_changed",
    SDPStreamMetadataChangedPrefix = "org.matrix.call.sdp_stream_metadata_changed",
    Replaces = "m.call.replaces",
    AssertedIdentity = "m.call.asserted_identity",
    AssertedIdentityPrefix = "org.matrix.call.asserted_identity",
}

// TODO: Change to "sdp_stream_metadata" when MSC3077 is merged
export const SDPStreamMetadataKey = "org.matrix.msc3077.sdp_stream_metadata";

export interface FocusConfig {
    user_id: string,
    device_id: string
}

export interface CallDeviceMembership {
    device_id: string,
    session_id: string,
    ["expires_ts"]?: number,
    feeds?: Array<{purpose: string}>
    ["m.foci.active"]?: Array<FocusConfig>
}

export interface CallMembership {
    ["m.call_id"]: string,
    ["m.devices"]: CallDeviceMembership[]
}

export interface CallMemberContent {
    ["m.calls"]: CallMembership[];
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
    device_id: string;
    sender_session_id: string;
    dest_session_id: string;
    party_id: string; // Should not need this?
    seq: number;
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

export type MCallNegotiate<Base extends MCallBase> = Base & {
    description: SessionDescription;
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

export enum CallErrorCode {
    /** The user chose to end the call */
    UserHangup = 'user_hangup',

    /** An error code when the local client failed to create an offer. */
    LocalOfferFailed = 'local_offer_failed',
    /**
     * An error code when there is no local mic/camera to use. This may be because
     * the hardware isn't plugged in, or the user has explicitly denied access.
     */
    NoUserMedia = 'no_user_media',

    /**
     * Error code used when a call event failed to send
     * because unknown devices were present in the room
     */
    UnknownDevices = 'unknown_devices',

    /**
     * Error code used when we fail to send the invite
     * for some reason other than there being unknown devices
     */
    SendInvite = 'send_invite',

    /**
     * An answer could not be created
     */
    CreateAnswer = 'create_answer',

    /**
     * Error code used when we fail to send the answer
     * for some reason other than there being unknown devices
     */
    SendAnswer = 'send_answer',

    /**
     * The session description from the other side could not be set
     */
    SetRemoteDescription = 'set_remote_description',

    /**
     * The session description from this side could not be set
     */
    SetLocalDescription = 'set_local_description',

    /**
     * A different device answered the call
     */
    AnsweredElsewhere = 'answered_elsewhere',

    /**
     * No media connection could be established to the other party
     */
    IceFailed = 'ice_failed',

    /**
     * The invite timed out whilst waiting for an answer
     */
    InviteTimeout = 'invite_timeout',

    /**
     * The call was replaced by another call
     */
    Replaced = 'replaced',

    /**
     * Signalling for the call could not be sent (other than the initial invite)
     */
    SignallingFailed = 'signalling_timeout',

    /**
     * The remote party is busy
     */
    UserBusy = 'user_busy',

    /**
     * We transferred the call off to somewhere else
     */
    Transfered = 'transferred',

    /**
     * A call from the same user was found with a new session id
     */
    NewSession = 'new_session',
}

export type SignallingMessage<Base extends MCallBase> =
    {type: EventType.Invite, content: MCallInvite<Base>} |
    {type: EventType.Negotiate, content: MCallNegotiate<Base>} |
    {type: EventType.Answer, content: MCallAnswer<Base>} |
    {type: EventType.SDPStreamMetadataChanged | EventType.SDPStreamMetadataChangedPrefix, content: MCallSDPStreamMetadataChanged<Base>} |
    {type: EventType.Candidates, content: MCallCandidates<Base>} |
    {type: EventType.Hangup | EventType.Reject, content: MCallHangupReject<Base>};

export enum CallIntent {
    Ring = "m.ring",
    Prompt = "m.prompt",
    Room = "m.room",
};

export enum CallType {
    Video = "m.video",
    Voice = "m.voice",
}
