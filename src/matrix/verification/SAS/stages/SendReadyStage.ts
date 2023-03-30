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
import {VerificationEventType} from "../channel/types";
import {SelectVerificationMethodStage} from "./SelectVerificationMethodStage";

export class SendReadyStage extends BaseSASVerificationStage {
    async completeStage() {
        await this.log.wrap("SendReadyStage.completeStage", async (log) => {
            const content = {
                "from_device": this.ourUserDeviceId,
                "methods": ["m.sas.v1"],
            };
            await this.channel.send(VerificationEventType.Ready, content, log);
            this.setNextStage(new SelectVerificationMethodStage(this.options));
        });
    }
}
