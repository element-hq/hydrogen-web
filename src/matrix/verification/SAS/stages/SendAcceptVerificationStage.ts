/*
Copyright 2025 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/
import anotherjson from "another-json";
import {BaseSASVerificationStage} from "./BaseSASVerificationStage";
import {HASHES_LIST, MAC_LIST, SAS_SET, KEY_AGREEMENT_LIST} from "./constants";
import {CancelReason, VerificationEventType} from "../channel/types";
import {SendKeyStage} from "./SendKeyStage";

// from element-web
function intersection<T>(anArray: T[], aSet: Set<T>): T[] {
    return Array.isArray(anArray) ? anArray.filter((x) => aSet.has(x)) : [];
}

export class SendAcceptVerificationStage extends BaseSASVerificationStage {
    async completeStage() {
        await this.log.wrap("SendAcceptVerificationStage.completeStage", async (log) => {
            const {content: startMessage} = this.channel.startMessage;
            const keyAgreement = intersection(KEY_AGREEMENT_LIST, new Set(startMessage.key_agreement_protocols))[0];
            const hashMethod = intersection(HASHES_LIST, new Set(startMessage.hashes))[0];
            const macMethod = intersection(MAC_LIST, new Set(startMessage.message_authentication_codes))[0];
            const sasMethod = intersection(startMessage.short_authentication_string, SAS_SET);
            if (!keyAgreement || !hashMethod || !macMethod || !sasMethod.length) {
                await this.channel.cancelVerification(CancelReason.UnknownMethod);
                return;
            }
            const ourPubKey = this.olmSAS.get_pubkey();
            const commitmentStr = ourPubKey + anotherjson.stringify(startMessage);
            const content = {
                key_agreement_protocol: keyAgreement,
                hash: hashMethod,
                message_authentication_code: macMethod,
                short_authentication_string: sasMethod,
                commitment: this.olmUtil.sha256(commitmentStr),
            };
            await this.channel.send(VerificationEventType.Accept, content, log);
            await this.channel.waitForEvent(VerificationEventType.Key);
            this.setNextStage(new SendKeyStage(this.options));
        });
    }
}
