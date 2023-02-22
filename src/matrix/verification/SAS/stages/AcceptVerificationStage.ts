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

// From element-web
type KeyAgreement = "curve25519-hkdf-sha256" | "curve25519";
type MacMethod = "hkdf-hmac-sha256.v2" | "org.matrix.msc3783.hkdf-hmac-sha256" | "hkdf-hmac-sha256" | "hmac-sha256";

const KEY_AGREEMENT_LIST: KeyAgreement[] = ["curve25519-hkdf-sha256", "curve25519"];
const HASHES_LIST = ["sha256"];
const MAC_LIST: MacMethod[] = [
    "hkdf-hmac-sha256.v2",
    "org.matrix.msc3783.hkdf-hmac-sha256",
    "hkdf-hmac-sha256",
    "hmac-sha256",
];
const SAS_LIST = ["decimal", "emoji"];
const SAS_SET = new Set(SAS_LIST);

export class AcceptVerificationStage extends BaseSASVerificationStage {

    async completeStage() {
        await this.log.wrap("AcceptVerificationStage.completeStage", async (log) => {
            const event = this.previousResult["m.key.verification.start"];
            const content = {
                ...event.content,
                "m.relates_to": event.relation,
            };
            console.log("content from event", content);
            const keyAgreement = intersection(KEY_AGREEMENT_LIST, new Set(content.key_agreement_protocols))[0];
            const hashMethod = intersection(HASHES_LIST, new Set(content.hashes))[0];
            const macMethod = intersection(MAC_LIST, new Set(content.message_authentication_codes))[0];
            const sasMethods = intersection(content.short_authentication_string, SAS_SET);
            if (!(keyAgreement !== undefined && hashMethod !== undefined && macMethod !== undefined && sasMethods.length)) {
                // todo: ensure this cancels the verification
                throw new Error("Descriptive error here!");
            }
            const ourPubKey = this.olmSAS.get_pubkey();
            const commitmentStr = ourPubKey + anotherjson.stringify(content);
            const contentToSend = {
                key_agreement_protocol: keyAgreement,
                hash: hashMethod,
                message_authentication_code: macMethod,
                short_authentication_string: sasMethods,
                // TODO: use selected hash function (when we support multiple)
                commitment: this.olmUtil.sha256(commitmentStr),
                "m.relates_to": {
                    event_id: this.requestEventId,
                    rel_type: "m.reference",
                }
            };
            await this.room.sendEvent("m.key.verification.accept", contentToSend, null, log);
            this.nextStage?.setResultFromPreviousStage({
                ...this.previousResult,
                [this.type]: contentToSend,
                "our_pub_key": ourPubKey, 
            });
            this.dispose();
        });
    }


    get type() {
        return "m.key.verification.accept";
    }
}

function intersection<T>(anArray: T[], aSet: Set<T>): T[] {
    return Array.isArray(anArray) ? anArray.filter((x) => aSet.has(x)) : [];
}
