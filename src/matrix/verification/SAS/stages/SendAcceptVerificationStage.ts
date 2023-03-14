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
import anotherjson from "another-json";
import {HASHES_LIST, MAC_LIST, SAS_SET, KEY_AGREEMENT_LIST} from "./constants";
import {CancelTypes, VerificationEventTypes} from "../channel/types";
import {SendKeyStage} from "./SendKeyStage";
export class SendAcceptVerificationStage extends BaseSASVerificationStage {

    async completeStage() {
        await this.log.wrap("SendAcceptVerificationStage.completeStage", async (log) => {
            const { content } = this.channel.startMessage;
            const keyAgreement = intersection(KEY_AGREEMENT_LIST, new Set(content.key_agreement_protocols))[0];
            const hashMethod = intersection(HASHES_LIST, new Set(content.hashes))[0];
            const macMethod = intersection(MAC_LIST, new Set(content.message_authentication_codes))[0];
            const sasMethods = intersection(content.short_authentication_string, SAS_SET);
            if (!(keyAgreement !== undefined && hashMethod !== undefined && macMethod !== undefined && sasMethods.length)) {
                await this.channel.cancelVerification(CancelTypes.UnknownMethod);
                return;
            }
            const ourPubKey = this.olmSAS.get_pubkey();
            const commitmentStr = ourPubKey + anotherjson.stringify(content);
            const contentToSend = {
                key_agreement_protocol: keyAgreement,
                hash: hashMethod,
                message_authentication_code: macMethod,
                short_authentication_string: sasMethods,
                commitment: this.olmUtil.sha256(commitmentStr),
            };
            await this.channel.send(VerificationEventTypes.Accept, contentToSend, log);
            await this.channel.waitForEvent(VerificationEventTypes.Key);
            this.setNextStage(new SendKeyStage(this.options));
        });
    }
}

function intersection<T>(anArray: T[], aSet: Set<T>): T[] {
    return Array.isArray(anArray) ? anArray.filter((x) => aSet.has(x)) : [];
}
