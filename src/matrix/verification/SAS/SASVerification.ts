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
import {RequestVerificationStage} from "./stages/RequestVerificationStage";
import type {ILogItem} from "../../../logging/types";
import type {Room} from "../../room/Room.js";
import type {Platform} from "../../../platform/web/Platform.js";
import type {BaseSASVerificationStage, UserData} from "./stages/BaseSASVerificationStage";
import type * as OlmNamespace from "@matrix-org/olm";
import {IChannel} from "./channel/Channel";

type Olm = typeof OlmNamespace;

type Options = {
    room: Room;
    platform: Platform;
    olm: Olm;
    olmUtil: Olm.Utility;
    ourUser: UserData;
    otherUserId: string;
    channel: IChannel;
    log: ILogItem;
}

export class SASVerification {
    private startStage: BaseSASVerificationStage;
    private olmSas: Olm.SAS;
   
    constructor(options: Options) {
        const { room, ourUser, otherUserId, log, olmUtil, olm, channel } = options;
        const olmSas = new olm.SAS();
        this.olmSas = olmSas;
        // channel.send("m.key.verification.request", {}, log);
        try {
            const options = { room, ourUser, otherUserId, log, olmSas, olmUtil, channel };
            let stage: BaseSASVerificationStage = new RequestVerificationStage(options);
            this.startStage = stage;
        
            // stage.setNextStage(new WaitForIncomingMessageStage("m.key.verification.ready", options));
            // stage = stage.nextStage;

            // stage.setNextStage(new WaitForIncomingMessageStage("m.key.verification.start", options));
            // stage = stage.nextStage;

            // stage.setNextStage(new AcceptVerificationStage(options));
            // stage = stage.nextStage;

            // stage.setNextStage(new WaitForIncomingMessageStage("m.key.verification.key", options));
            // stage = stage.nextStage;

            // stage.setNextStage(new SendKeyStage(options));
            // stage = stage.nextStage;
            console.log("startStage", this.startStage);
        }
        finally {
        }
    }

    async start() {
        try {
            let stage = this.startStage;
            do {
                await stage.completeStage();
                stage = stage.nextStage;
            } while (stage);
        }
        finally {
            this.olmSas.free();
        }
    }
}
