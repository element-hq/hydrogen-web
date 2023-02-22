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
import {StartVerificationStage} from "./stages/StartVerificationStage";
import {WaitForIncomingMessageStage} from "./stages/WaitForIncomingMessageStage";
import {AcceptVerificationStage} from "./stages/AcceptVerificationStage";
import {SendKeyStage} from "./stages/SendKeyStage";
import type {ILogItem} from "../../../logging/types";
import type {Room} from "../../room/Room.js";
import type {BaseSASVerificationStage, UserData} from "./stages/BaseSASVerificationStage";
import type * as OlmNamespace from "@matrix-org/olm";

type Olm = typeof OlmNamespace;

export class SASVerification {
    private startStage: BaseSASVerificationStage;
   
    constructor(private room: Room, private olm: Olm, private olmUtil: Olm.Utility, private ourUser: UserData, otherUserId: string, log: ILogItem) {
        const olmSas = new olm.SAS();
        try {
            const options = { room, ourUser, otherUserId, log, olmSas, olmUtil };
            let stage: BaseSASVerificationStage = new StartVerificationStage(options);
            this.startStage = stage;
        
            stage.setNextStage(new WaitForIncomingMessageStage("m.key.verification.ready", options));
            stage = stage.nextStage;

            stage.setNextStage(new WaitForIncomingMessageStage("m.key.verification.start", options));
            stage = stage.nextStage;

            stage.setNextStage(new AcceptVerificationStage(options));
            stage = stage.nextStage;

            stage.setNextStage(new WaitForIncomingMessageStage("m.key.verification.key", options));
            stage = stage.nextStage;

            stage.setNextStage(new SendKeyStage(options));
            stage = stage.nextStage;
            console.log("startStage", this.startStage);
        }
        finally {
            olmSas.free();
        }
    }

    async start() {
        let stage = this.startStage;
        do {
            await stage.completeStage();
            stage = stage.nextStage;
        } while (stage);
    }
}
