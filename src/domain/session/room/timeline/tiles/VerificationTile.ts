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

import {SASRequest} from "../../../../../matrix/verification/SAS/SASRequest";
import {TileShape} from "./ITile";
import {SimpleTile} from "./SimpleTile";
import type {EventEntry} from "../../../../../matrix/room/timeline/entries/EventEntry.js";
import type {Options} from "./SimpleTile";

export class VerificationTile extends SimpleTile {
    private request: SASRequest;

    constructor(entry: EventEntry, options: Options) {
        super(entry, options);
        this.request = new SASRequest(this.lowerEntry);
    }

    get shape(): TileShape {
        return TileShape.Verification;
    }

    get description(): string {
        return this.i18n`${this.sender} wants to verify`;
    }

    accept(): void {
        const crossSigning = this.getOption("session").crossSigning.get()
        crossSigning.receivedSASVerifications.set(this.eventId, this.request);
        this.openVerificationPanel(this.eventId);
    }

    async reject(): Promise<void> {
        // create the SasVerification object and call abort() on it
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
}
