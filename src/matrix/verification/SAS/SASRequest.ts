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

import type {CrossSigning} from "../CrossSigning";
import type {Room} from "../../room/Room.js";
import type {ILogItem} from "../../../logging/types";

export class SASRequest {
    constructor(public readonly startingMessage: any) {}

    get deviceId(): string {
        return this.startingMessage.content.from_device;
    }

    get sender(): string {
        return this.startingMessage.sender;
    }

    get id(): string {
        return this.startingMessage.content.transaction_id ?? this.startingMessage.eventId;
    }

    async reject(crossSigning: CrossSigning, room: Room, log: ILogItem): Promise<void> {
        const sas = crossSigning.startVerification(this, room, log);
        await sas?.abort();
    }
}
