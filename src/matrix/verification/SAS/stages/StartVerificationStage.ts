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
import {BaseSASVerificationStage} from "./BaseSASVerificationStage";
import {FragmentBoundaryEntry} from "../../../room/timeline/entries/FragmentBoundaryEntry.js";

export class StartVerificationStage extends BaseSASVerificationStage {

    async completeStage() {
        await this.log.wrap("StartVerificationStage.completeStage", async (log) => {
            const content = {
                // "body": `${this.ourUser.userId} is requesting to verify your device, but your client does not support verification, so you may need to use a different verification method.`,
                "from_device": this.ourUser.deviceId,
                "methods": ["m.sas.v1"],
                // "msgtype": "m.key.verification.request",
                // "to": this.otherUserId,
            };
            const promise = this.trackEventId();
           // await this.room.sendEvent("m.room.message", content, null, log);
            await this.channel.send("m.key.verification.request", content, log);
            const c = await this.channel.waitForEvent("m.key.verification.ready");
            const eventId = await promise;
            console.log("eventId", eventId);
            this.setRequestEventId(eventId);
            this.dispose();
        });
    }

    private trackEventId(): Promise<string> {
        return new Promise(resolve => {
            this.track(
                this.room._timeline.entries.subscribe({
                    onAdd: (_, entry) => {
                        if (entry instanceof FragmentBoundaryEntry) {
                            return;
                        }
                        if (!entry.isPending &&
                            entry.content["msgtype"] === "m.key.verification.request" &&
                            entry.content["from_device"] === this.ourUser.deviceId) {
                                console.log("found event", entry);
                            resolve(entry.id);
                        }
                    },
                    onRemove: () => { /**noop*/ },
                    onUpdate: () => { /**noop*/ },
                })
            );
        });
    }

    get type() {
        return "m.key.verification.request";
    }
}
