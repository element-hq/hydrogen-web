/*
Copyright 2025 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import type {ILogItem} from "../../../../logging/types";
import {CancelReason, VerificationEventType} from "./types";

export const messageFromErrorType = {
    [CancelReason.UserCancelled]: "User declined",
    [CancelReason.InvalidMessage]: "Invalid Message.",
    [CancelReason.KeyMismatch]: "Key Mismatch.",
    [CancelReason.OtherDeviceAccepted]: "Another device has accepted this request.",
    [CancelReason.TimedOut]: "Timed Out",
    [CancelReason.UnexpectedMessage]: "Unexpected Message.",
    [CancelReason.UnknownMethod]: "Unknown method.",
    [CancelReason.UnknownTransaction]: "Unknown Transaction.",
    [CancelReason.UserMismatch]: "User Mismatch",
    [CancelReason.MismatchedCommitment]: "Hash commitment does not match.",
    [CancelReason.MismatchedSAS]: "Emoji/decimal does not match.",
}

export interface IChannel {
    send(eventType: VerificationEventType, content: any, log: ILogItem): Promise<void>;
    waitForEvent(eventType: VerificationEventType): Promise<any>;
    getSentMessage(event: VerificationEventType): any;
    getReceivedMessage(event: VerificationEventType): any;
    setStartMessage(content: any): void;
    cancelVerification(cancellationType: CancelReason): Promise<void>;
    acceptMessage: any;
    startMessage: any;
    initiatedByUs: boolean;
    isCancelled: boolean;
    cancellation?: { code: CancelReason, cancelledByUs: boolean };
    id: string;
    otherUserDeviceId: string;
} 
