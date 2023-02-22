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
import {BaseSASVerificationStage, Options} from "./BaseSASVerificationStage";
import {FragmentBoundaryEntry} from "../../../room/timeline/entries/FragmentBoundaryEntry.js";

export class WaitForIncomingMessageStage extends BaseSASVerificationStage {
    constructor(private messageType: string, options: Options) {
        super(options);
    }

    async completeStage() {
        await this.log.wrap("WaitForIncomingMessageStage.completeStage", async (log) => {
            const entry = await this.fetchMessageEventsFromTimeline();
            console.log("content", entry);
            this.nextStage?.setResultFromPreviousStage({
                ...this.previousResult,
                [this.messageType]: entry
            });
            this.dispose();
        });
    }

    private fetchMessageEventsFromTimeline() {
        // todo: add timeout after 10 mins
        return new Promise(resolve => {
            this.track(
                this.room._timeline.entries.subscribe({
                    onAdd: (_, entry) => {
                        if (entry.eventType === this.messageType &&
                            entry.relatedEventId === this.requestEventId) {
                            resolve(entry);
                        }
                    },
                    onRemove: () => { },
                    onUpdate: () => { },
                })
            );
            const remoteEntries = this.room._timeline.remoteEntries;
            // In case we were slow and the event is already added to the timeline,
            for (const entry of remoteEntries) {
                if (entry instanceof FragmentBoundaryEntry) {
                    return;
                }
                if (entry.eventType === this.messageType &&
                    entry.relatedEventId === this.requestEventId) {
                    resolve(entry);
                }
            }
        });
    }

    get type() {
        return this.messageType;
    }
}

