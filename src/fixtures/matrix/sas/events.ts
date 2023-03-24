/** 
    POSSIBLE STATES:
    (following are messages received, not messages sent)
    ready -> accept -> key -> mac -> done                                                                                                       
    ready -> start -> key -> mac -> done                                                                                                        
    ready -> start -> accept -> key -> mac -> done (when start resolved to use yours)                                                           
    element does not send you request!
    start -> key -> mac -> done                                                                                                      
    start -> accept -> key -> mac -> done                                                                                            
    accept -> key -> mac -> done          
*/

import {VerificationEventType} from "../../../matrix/verification/SAS/channel/types";

function generateResponses(userId: string, deviceId: string, txnId: string) {
    const readyMessage = {
        content: {
            methods: ["m.sas.v1", "m.qr_code.show.v1", "m.reciprocate.v1"],
            transaction_id: txnId,
            from_device: deviceId,
        },
        type: "m.key.verification.ready",
        sender: userId,
    };
    const startMessage = {
        content: {
            method: "m.sas.v1",
            from_device: deviceId,
            key_agreement_protocols: ["curve25519-hkdf-sha256", "curve25519"],
            hashes: ["sha256"],
            message_authentication_codes: [
                "hkdf-hmac-sha256.v2",
                "org.matrix.msc3783.hkdf-hmac-sha256",
                "hkdf-hmac-sha256",
                "hmac-sha256",
            ],
            short_authentication_string: ["decimal", "emoji"],
            transaction_id: txnId,
        },
        type: "m.key.verification.start",
        sender: userId,
    };
    const acceptMessage = {
        content: {
            key_agreement_protocol: "curve25519-hkdf-sha256",
            hash: "sha256",
            message_authentication_code: "hkdf-hmac-sha256.v2",
            short_authentication_string: ["decimal", "emoji"],
            commitment: "h2YJESkiXwoGF+i5luu0YmPAKuAsWVeC2VaZOwdzggE",
            transaction_id: txnId,
        },
        type: "m.key.verification.accept",
        sender: userId,
    };
    const keyMessage = {
        content: {
            key: "7XA92bSIAq14R69308U80wsJR0K4KAydFG1HtVRYBFA",
            transaction_id: txnId,
        },
        type: "m.key.verification.key",
        sender: userId,
    };
    const macMessage = {
        content: {
            mac: {
                "ed25519:FWKXUYUHTF":
                    "uMOgfISlZTGja2VHmdnK/xe1JNGi7irTzdaVAYSs6Q8",
                "ed25519:Ot8Y58PueQ7hJVpYWAJkg2qaREJAY/UhGZYOrsd52oo":
                    "SavNqO8PPcAp0+eoLwlU4JWpuMm8GdGuMopPFaS8alY",
            },
            keys: "cHnoX3rt9x86RUUb1nyFOa4U/dCJty+EmXCYPeNg6uU",
            transaction_id: txnId,
        },
        type: "m.key.verification.mac",
        sender: userId,
    };
    const doneMessage = {
        content: {
            transaction_id: txnId,
        },
        type: "m.key.verification.done",
        sender: userId,
    };
    const result = {};
    for (const message of [readyMessage, startMessage, keyMessage, macMessage, doneMessage, acceptMessage]) {
        result[message.type] = message;
    }
    return result;
}

const enum COMBINATIONS {
    YOU_SENT_REQUEST,
    YOU_SENT_START,
    THEY_SENT_START,
} 

export class SASFixtures {
    private order: COMBINATIONS[] = [];
    private _youWinConflict: boolean = false;

    constructor(private userId: string, private deviceId: string, private txnId: string) { }

    youSentRequest() {
        this.order.push(COMBINATIONS.YOU_SENT_REQUEST);
        return this;
    }

    youSentStart() {
        this.order.push(COMBINATIONS.YOU_SENT_START);
        return this;
    }

    theySentStart() {
        this.order.push(COMBINATIONS.THEY_SENT_START);
        return this;
    }

    youWinConflict() {
        this._youWinConflict = true;
        return this;
    }

    theyWinConflict() {
        this._youWinConflict = false;
        return this;
    }

    fixtures(): Map<VerificationEventType, any> {
        const responses = generateResponses(this.userId, this.deviceId, this.txnId);
        const array: any[] = [];
        const addToArray = (type) => array.push([type, responses[type]]);
        let i = 0;
        while(i < this.order.length) {
            const item = this.order[i];
            switch (item) {
                case COMBINATIONS.YOU_SENT_REQUEST:
                    addToArray(VerificationEventType.Ready);
                    break;
                case COMBINATIONS.THEY_SENT_START: {
                    addToArray(VerificationEventType.Start);
                    const nextItem = this.order[i+1];
                    if (nextItem === COMBINATIONS.YOU_SENT_START) {
                        if (this._youWinConflict) {
                            addToArray(VerificationEventType.Accept);
                            i = i + 2;
                            continue;
                        }
                    }
                    break;
                }
                case COMBINATIONS.YOU_SENT_START: {
                    const nextItem = this.order[i+1]
                    if (nextItem === COMBINATIONS.THEY_SENT_START) {
                        if (this._youWinConflict) {
                            addToArray(VerificationEventType.Accept);
                            
                        }
                        break;
                    }
                    if (this.order[i-1] === COMBINATIONS.THEY_SENT_START) {
                        break;
                    }
                    addToArray(VerificationEventType.Accept);
                    break;
                }
            }
            i = i + 1;
        } 
        addToArray(VerificationEventType.Key);
        addToArray(VerificationEventType.Mac);
        addToArray(VerificationEventType.Done);
        return new Map(array);
    }
}
