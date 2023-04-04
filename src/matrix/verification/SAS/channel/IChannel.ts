/*
Copyright 2023 The Matrix.org Foundation C.I.C.

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
