/*
Copyright 2025 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/
import type {IChannel} from "./channel/IChannel";
import type {CalculateSASStage} from "./stages/CalculateSASStage";
import type {SelectVerificationMethodStage} from "./stages/SelectVerificationMethodStage";

export type SASProgressEvents = {
    SelectVerificationStage: SelectVerificationMethodStage;
    EmojiGenerated: CalculateSASStage;
    VerificationCompleted: string;
    VerificationCancelled: IChannel["cancellation"];
}
