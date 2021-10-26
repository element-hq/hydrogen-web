/*
Copyright 2020 The Matrix.org Foundation C.I.C.

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

import type {TimelineEvent} from "../../../storage/types";

export class ReplayDetectionEntry {
    public readonly sessionId: string;
    public readonly messageIndex: number;
    public readonly event: TimelineEvent;

    constructor(sessionId: string, messageIndex: number, event: TimelineEvent) {
        this.sessionId = sessionId;
        this.messageIndex = messageIndex;
        this.event = event;
    }

    get eventId(): string {
        return this.event.event_id;
    }

    get timestamp(): number {
        return this.event.origin_server_ts;
    }
}
