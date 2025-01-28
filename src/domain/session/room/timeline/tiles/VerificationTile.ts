/*
Copyright 2025 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import {SASRequest} from "../../../../../matrix/verification/SAS/SASRequest";
import {TileShape} from "./ITile";
import {SimpleTile} from "./SimpleTile";
import {UpdateAction} from "../UpdateAction.js"
import {VerificationEventType} from "../../../../../matrix/verification/SAS/channel/types";
import type {EventEntry} from "../../../../../matrix/room/timeline/entries/EventEntry.js";
import type {Options} from "./SimpleTile";

export const enum Status {
    Ready,
    InProgress,
    Completed,
    Cancelled,
};

export class VerificationTile extends SimpleTile {
    private request: SASRequest;
    public isCancelledByUs: boolean;
    public status: Status = Status.Ready;

    constructor(entry: EventEntry, options: Options) {
        super(entry, options);
        this.request = new SASRequest(this.lowerEntry);
        // Calculate status based on available context-for entries
        // Needed so that tiles reflect their final status when
        // events are loaded from storage i.e after a reload.
        this.updateStatusFromAvailableContextForEntries();
    }

    get shape(): TileShape {
        return TileShape.Verification;
    }

    get description(): string {
        return this.i18n`${this.sender} wants to verify`;
    }

    accept(): void {
        const crossSigning = this.getOption("session").crossSigning.get();
        crossSigning.receivedSASVerifications.set(this.eventId, this.request);
        this.openVerificationPanel(this.eventId);
    }

    async reject(): Promise<void> {
        await this.logAndCatch("VerificationTile.reject", async (log) => {
            const crossSigning = this.getOption("session").crossSigning.get();
            await this.request.reject(crossSigning, this._room, log);
        });
    }

    private openVerificationPanel(eventId: string): void {
        let path = this.navigation.path.until("room");
        path = path.with(this.navigation.segment("right-panel", true))!;
        path = path.with(this.navigation.segment("verification", eventId))!;
        this.navigation.applyPath(path);
    }

    updateEntry(entry: EventEntry, param: any) {
        if (param === "context-added") {
            /**
             * We received a new contextForEntry, maybe it tells us that
             * this request was cancelled or that the verification is completed?
             * Let's check.
             */
            if (this.updateStatusFromAvailableContextForEntries()) {
                return UpdateAction.Update(param);
            }
            return UpdateAction.Nothing();
        } 
        return super.updateEntry(entry, param);
    }

    private updateStatusFromAvailableContextForEntries(): boolean {
        let needsUpdate = false;
        for (const e of this.lowerEntry.contextForEntries ?? []) {
            switch (e.eventType) {
                case VerificationEventType.Cancel:
                    this.status = Status.Cancelled;
                    this.isCancelledByUs = e.sender === this.getOption("session").userId;
                    return true;
                case VerificationEventType.Done:
                    this.status = Status.Completed;
                    return true;
                default:
                    this.status = Status.InProgress;
                    needsUpdate = true;
            }
        }
        return needsUpdate;
    }
}
