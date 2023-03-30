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
import {SendRequestVerificationStage} from "./stages/SendRequestVerificationStage";
import type {ILogItem} from "../../../logging/types";
import type {BaseSASVerificationStage} from "./stages/BaseSASVerificationStage";
import type {Account} from "../../e2ee/Account.js";
import type {DeviceTracker} from "../../e2ee/DeviceTracker.js";
import type * as OlmNamespace from "@matrix-org/olm";
import type {IChannel} from "./channel/Channel";
import type {HomeServerApi} from "../../net/HomeServerApi";
import type {Timeout} from "../../../platform/types/types";
import type {Clock} from "../../../platform/web/dom/Clock.js";
import {CancelReason, VerificationEventType} from "./channel/types";
import {SendReadyStage} from "./stages/SendReadyStage";
import {SelectVerificationMethodStage} from "./stages/SelectVerificationMethodStage";
import {VerificationCancelledError} from "./VerificationCancelledError";
import {EventEmitter} from "../../../utils/EventEmitter";
import {SASProgressEvents} from "./types";
import type {CrossSigning} from "../CrossSigning";

type Olm = typeof OlmNamespace;

type Options = {
    olm: Olm;
    olmUtil: Olm.Utility;
    ourUserId: string;
    ourUserDeviceId: string;
    otherUserId: string;
    channel: IChannel;
    log: ILogItem;
    e2eeAccount: Account;
    deviceTracker: DeviceTracker;
    hsApi: HomeServerApi;
    clock: Clock;
    crossSigning: CrossSigning
}

export class SASVerification extends EventEmitter<SASProgressEvents> {
    private startStage: BaseSASVerificationStage;
    private olmSas: Olm.SAS;
    public finished: boolean = false;
    public readonly channel: IChannel;
    private timeout: Timeout;
   
    constructor(options: Options) {
        super();
        const { olm, channel, clock } = options;
        const olmSas = new olm.SAS();
        this.olmSas = olmSas;
        this.channel = channel;
        this.setupCancelAfterTimeout(clock);
        const stageOptions = {...options, olmSas, eventEmitter: this};
        if (channel.getReceivedMessage(VerificationEventType.Start)) {
            this.startStage = new SelectVerificationMethodStage(stageOptions);
        }
        else if (channel.getReceivedMessage(VerificationEventType.Request)) {
            this.startStage = new SendReadyStage(stageOptions);
        }
        else {
            this.startStage = new SendRequestVerificationStage(stageOptions);
        }
    }

    private async setupCancelAfterTimeout(clock: Clock) {
        try {
            const tenMinutes = 10 * 60 * 1000;
            this.timeout = clock.createTimeout(tenMinutes);
            await this.timeout.elapsed();
            await this.channel.cancelVerification(CancelReason.TimedOut);
        }
        catch {
            // Ignore errors
        }
    }

    async abort() {
        await this.channel.cancelVerification(CancelReason.UserCancelled);
    }

    async start() {
        try {
            let stage = this.startStage;
            do {
                await stage.completeStage();
                stage = stage.nextStage;
            } while (stage);
        }
        catch (e) {
            if (!(e instanceof VerificationCancelledError)) {
                throw e; 
            }
        }
        finally {
            if (this.channel.isCancelled) {
                this.emit("VerificationCancelled", this.channel.cancellation);
            }
            this.olmSas.free();
            this.timeout.abort();
            this.finished = true;
        }
    }
}

import {HomeServer} from "../../../mocks/HomeServer.js";
import Olm from "@matrix-org/olm/olm.js";
import {MockChannel} from "./channel/MockChannel";
import {Clock as MockClock} from "../../../mocks/Clock.js";
import {NullLogger} from "../../../logging/NullLogger";
import {SASFixtures} from "../../../fixtures/matrix/sas/events";
import {SendKeyStage} from "./stages/SendKeyStage";
import {CalculateSASStage} from "./stages/CalculateSASStage";
import {SendMacStage} from "./stages/SendMacStage";
import {VerifyMacStage} from "./stages/VerifyMacStage";
import {SendDoneStage} from "./stages/SendDoneStage";
import {SendAcceptVerificationStage} from "./stages/SendAcceptVerificationStage";

export function tests() {
    async function createSASRequest(
        ourUserId: string,
        ourDeviceId: string,
        theirUserId: string,
        theirDeviceId: string,
        txnId: string,
        receivedMessages,
        startingMessage?: any
    ) {
        const homeserverMock = new HomeServer();
        const hsApi = homeserverMock.api;
        const olm = Olm;
        await olm.init();
        const olmUtil = new Olm.Utility();
        const e2eeAccount = {
            getUnsignedDeviceKey: () => {
                return {
                    keys: {
                        [`ed25519:${ourDeviceId}`]:
                            "srsWWbrnQFIOmUSdrt3cS/unm03qAIgXcWwQg9BegKs",
                    },
                };
            },
        };
        const deviceTracker = {
            getCrossSigningKeyForUser: (userId, __, _hsApi, _) => {
                let masterKey =
                    userId === ourUserId
                        ? "5HIrEawRiiQioViNfezPDWfPWH2pdaw3pbQNHEVN2jM"
                        : "Ot8Y58PueQ7hJVpYWAJkg2qaREJAY/UhGZYOrsd52oo";
                return {
                    user_id: userId,
                    usage: ["master"],
                    keys: {
                        [`ed25519:${masterKey}`]: masterKey,
                    }
                };
            },
            deviceForId: (_userId, deviceId, _hsApi, _log) => {
                return {
                    device_id: deviceId,
                    keys: {
                        [`ed25519:${deviceId}`]: "D8w9mrokGdEZPdPgrU0kQkYi4vZyzKEBfvGyZsGK7+Q",
                    },
                    unsigned: {
                        device_display_name: "lala10",
                    }
                };
            },
        };
        const channel = new MockChannel(
            theirDeviceId,
            theirUserId,
            ourUserId,
            ourDeviceId,
            receivedMessages,
            deviceTracker,
            txnId,
            olm,
            startingMessage,
        );
        const crossSigning = new MockCrossSigning() as unknown as CrossSigning;
        const clock = new MockClock();
        const logger = new NullLogger();
        return logger.run("log", (log) => {
            // @ts-ignore
            const sas = new SASVerification({
                channel,
                clock,
                hsApi,
            // @ts-ignore
                deviceTracker,
                e2eeAccount,
                olm,
                olmUtil,
                otherUserId: theirUserId!,
                ourUserId,
                ourUserDeviceId: ourDeviceId,
                log,
                crossSigning
            });
            // @ts-ignore
            channel.setOlmSas(sas.olmSas);
            sas.on("EmojiGenerated", async (stage) => {
                await stage?.setEmojiMatch(true);
            });
            return { sas, clock, logger };
        });
    }

    class MockCrossSigning {
        signDevice(deviceId: string, log: ILogItem) {
            return Promise.resolve({}); // device keys, means signing succeeded
        }

        signUser(userId: string, log: ILogItem) {
            return Promise.resolve({}); // cross-signing keys, means signing succeeded
        }
    }

    return {
        "Order of stages created matches expected order when I sent request, they sent start": async (assert) => {
            const ourDeviceId = "ILQHOACESQ";
            const ourUserId = "@foobaraccount:matrix.org";
            const theirUserId = "@foobaraccount3:matrix.org";
            const theirDeviceId = "FWKXUYUHTF";
            const txnId = "t150836b91a7bed";
            const receivedMessages = new SASFixtures(theirUserId, theirDeviceId, txnId)
                .youSentRequest()
                .theySentStart()
                .fixtures();
            const { sas } = await createSASRequest(
                ourUserId,
                ourDeviceId,
                theirUserId,
                theirDeviceId,
                txnId, 
                receivedMessages
            );
            await sas.start();
            const expectedOrder = [
                SendRequestVerificationStage,
                SelectVerificationMethodStage,
                SendAcceptVerificationStage,
                SendKeyStage,
                CalculateSASStage,
                SendMacStage,
                VerifyMacStage,
                SendDoneStage
            ]
            //@ts-ignore
            let stage = sas.startStage;
            for (const stageClass of expectedOrder) {
                assert.strictEqual(stage instanceof stageClass, true);
                stage = stage.nextStage;
            }
            assert.strictEqual(sas.finished, true);
        },
        "Order of stages created matches expected order when I sent request, I sent start": async (assert) => {
            const ourDeviceId = "ILQHOACESQ";
            const ourUserId = "@foobaraccount:matrix.org";
            const theirUserId = "@foobaraccount3:matrix.org";
            const theirDeviceId = "FWKXUYUHTF";
            const txnId = "t150836b91a7bed";
            const receivedMessages = new SASFixtures(theirUserId, theirDeviceId, txnId)
                .youSentRequest()
                .youSentStart()
                .fixtures();
            const { sas, logger } = await createSASRequest(
                ourUserId,
                ourDeviceId,
                theirUserId,
                theirDeviceId,
                txnId, 
                receivedMessages
            );
            sas.on("SelectVerificationStage", (stage) => {
                logger.run("send start", async (log) => {
                    await stage?.selectEmojiMethod(log);
                });
            });
            await sas.start();
            const expectedOrder = [
                SendRequestVerificationStage,
                SelectVerificationMethodStage,
                SendKeyStage,
                CalculateSASStage,
                SendMacStage,
                VerifyMacStage,
                SendDoneStage
            ]
            //@ts-ignore
            let stage = sas.startStage;
            for (const stageClass of expectedOrder) {
                assert.strictEqual(stage instanceof stageClass, true);
                stage = stage.nextStage;
            }
            assert.strictEqual(sas.finished, true);
        },
        "Order of stages created matches expected order when request is received": async (assert) => {
            const ourDeviceId = "ILQHOACESQ";
            const ourUserId = "@foobaraccount:matrix.org";
            const theirUserId = "@foobaraccount3:matrix.org";
            const theirDeviceId = "FWKXUYUHTF";
            const txnId = "t150836b91a7bed";
            const receivedMessages = new SASFixtures(theirUserId, theirDeviceId, txnId)
                .theySentStart()
                .fixtures();
            const startingMessage = receivedMessages.get(VerificationEventType.Start);
            const { sas } = await createSASRequest(
                ourUserId,
                ourDeviceId,
                theirUserId,
                theirDeviceId,
                txnId, 
                receivedMessages,
                startingMessage,
            );
            await sas.start();
            const expectedOrder = [
                SelectVerificationMethodStage,
                SendAcceptVerificationStage,
                SendKeyStage,
                CalculateSASStage,
                SendMacStage,
                VerifyMacStage,
                SendDoneStage
            ]
            //@ts-ignore
            let stage = sas.startStage;
            for (const stageClass of expectedOrder) {
                assert.strictEqual(stage instanceof stageClass, true);
                stage = stage.nextStage;
            }
            assert.strictEqual(sas.finished, true);
        },
        "Order of stages created matches expected order when request is sent with start conflict (they win)": async (assert) => {
            const ourDeviceId = "ILQHOACESQ";
            const ourUserId = "@foobaraccount:matrix.org";
            const theirUserId = "@foobaraccount3:matrix.org";
            const theirDeviceId = "FWKXUYUHTF";
            const txnId = "t150836b91a7bed";
            const receivedMessages = new SASFixtures(theirUserId, theirDeviceId, txnId)
                .youSentRequest()
                .theySentStart()
                .youSentStart()
                .theyWinConflict()
                .fixtures();
            const { sas } = await createSASRequest(
                ourUserId,
                ourDeviceId,
                theirUserId,
                theirDeviceId,
                txnId, 
                receivedMessages
            );
            await sas.start();
            const expectedOrder = [
                SendRequestVerificationStage,
                SelectVerificationMethodStage,
                SendAcceptVerificationStage,
                SendKeyStage,
                CalculateSASStage,
                SendMacStage,
                VerifyMacStage,
                SendDoneStage
            ]
            //@ts-ignore
            let stage = sas.startStage;
            for (const stageClass of expectedOrder) {
                assert.strictEqual(stage instanceof stageClass, true);
                stage = stage.nextStage;
            }
            assert.strictEqual(sas.finished, true);
        },
        "Order of stages created matches expected order when request is sent with start conflict (I win)": async (assert) => {
            const ourDeviceId = "ILQHOACESQ";
            const ourUserId = "@foobaraccount3:matrix.org";
            const theirUserId = "@foobaraccount:matrix.org";
            const theirDeviceId = "FWKXUYUHTF";
            const txnId = "t150836b91a7bed";
            const receivedMessages = new SASFixtures(theirUserId, theirDeviceId, txnId)
                .youSentRequest()
                .theySentStart()
                .youSentStart()
                .youWinConflict()
                .fixtures();
            const { sas, logger } = await createSASRequest(
                ourUserId,
                ourDeviceId,
                theirUserId,
                theirDeviceId,
                txnId, 
                receivedMessages
            );
            sas.on("SelectVerificationStage", (stage) => {
                logger.run("send start", async (log) => {
                    await stage?.selectEmojiMethod(log);
                });
            });
            await sas.start();
            const expectedOrder = [
                SendRequestVerificationStage,
                SelectVerificationMethodStage,
                SendKeyStage,
                CalculateSASStage,
                SendMacStage,
                VerifyMacStage,
                SendDoneStage
            ]
            //@ts-ignore
            let stage = sas.startStage;
            for (const stageClass of expectedOrder) {
                assert.strictEqual(stage instanceof stageClass, true);
                stage = stage.nextStage;
            }
            assert.strictEqual(sas.finished, true);
        },
        "Order of stages created matches expected order when request is received with start conflict (they win)": async (assert) => {
            const ourDeviceId = "ILQHOACESQ";
            const ourUserId = "@foobaraccount:matrix.org";
            const theirUserId = "@foobaraccount3:matrix.org";
            const theirDeviceId = "FWKXUYUHTF";
            const txnId = "t150836b91a7bed";
            const receivedMessages = new SASFixtures(theirUserId, theirDeviceId, txnId)
                .theySentStart()
                .youSentStart()
                .theyWinConflict()
                .fixtures();
            const startingMessage = receivedMessages.get(VerificationEventType.Start);
            console.log(receivedMessages);
            const { sas } = await createSASRequest(
                ourUserId,
                ourDeviceId,
                theirUserId,
                theirDeviceId,
                txnId, 
                receivedMessages,
                startingMessage,
            );
            await sas.start();
            const expectedOrder = [
                SelectVerificationMethodStage,
                SendAcceptVerificationStage,
                SendKeyStage,
                CalculateSASStage,
                SendMacStage,
                VerifyMacStage,
                SendDoneStage
            ]
            //@ts-ignore
            let stage = sas.startStage;
            for (const stageClass of expectedOrder) {
                console.log("Checking", stageClass.constructor.name, stage.constructor.name);
                assert.strictEqual(stage instanceof stageClass, true);
                stage = stage.nextStage;
            }
            assert.strictEqual(sas.finished, true);
        },
        "Order of stages created matches expected order when request is received with start conflict (I win)": async (assert) => {
            const ourDeviceId = "ILQHOACESQ";
            const ourUserId = "@foobaraccount3:matrix.org";
            const theirUserId = "@foobaraccount:matrix.org";
            const theirDeviceId = "FWKXUYUHTF";
            const txnId = "t150836b91a7bed";
            const receivedMessages = new SASFixtures(theirUserId, theirDeviceId, txnId)
                .theySentStart()
                .youSentStart()
                .youWinConflict()
                .fixtures();
            const startingMessage = receivedMessages.get(VerificationEventType.Start);
            console.log(receivedMessages);
            const { sas, logger } = await createSASRequest(
                ourUserId,
                ourDeviceId,
                theirUserId,
                theirDeviceId,
                txnId, 
                receivedMessages,
                startingMessage,
            );
            sas.on("SelectVerificationStage", (stage) => {
                logger.run("send start", async (log) => {
                    await stage?.selectEmojiMethod(log);
                });
            });
            await sas.start();
            const expectedOrder = [
                SelectVerificationMethodStage,
                SendKeyStage,
                CalculateSASStage,
                SendMacStage,
                VerifyMacStage,
                SendDoneStage
            ]
            //@ts-ignore
            let stage = sas.startStage;
            for (const stageClass of expectedOrder) {
                console.log("Checking", stageClass.constructor.name, stage.constructor.name);
                assert.strictEqual(stage instanceof stageClass, true);
                stage = stage.nextStage;
            }
            assert.strictEqual(sas.finished, true);
        },
        "Order of stages created matches expected order when request is sent with start conflict (I win), same user": async (assert) => {
            const ourDeviceId = "FWKXUYUHTF";
            const ourUserId = "@foobaraccount3:matrix.org";
            const theirUserId = "@foobaraccount3:matrix.org";
            const theirDeviceId = "ILQHOACESQ";
            const txnId = "t150836b91a7bed";
            const receivedMessages = new SASFixtures(theirUserId, theirDeviceId, txnId)
                .youSentRequest()
                .theySentStart()
                .youSentStart()
                .youWinConflict()
                .fixtures();
            const { sas, logger } = await createSASRequest(
                ourUserId,
                ourDeviceId,
                theirUserId,
                theirDeviceId,
                txnId, 
                receivedMessages
            );
            sas.on("SelectVerificationStage", (stage) => {
                logger.run("send start", async (log) => {
                    await stage?.selectEmojiMethod(log);
                });
            });
            await sas.start();
            const expectedOrder = [
                SendRequestVerificationStage,
                SelectVerificationMethodStage,
                SendKeyStage,
                CalculateSASStage,
                SendMacStage,
                VerifyMacStage,
                SendDoneStage
            ]
            //@ts-ignore
            let stage = sas.startStage;
            for (const stageClass of expectedOrder) {
                assert.strictEqual(stage instanceof stageClass, true);
                stage = stage.nextStage;
            }
            assert.strictEqual(sas.finished, true);
        },
        "Order of stages created matches expected order when request is sent with start conflict (they win), same user": async (assert) => {
            const ourDeviceId = "ILQHOACESQ";
            const ourUserId = "@foobaraccount3:matrix.org";
            const theirUserId = "@foobaraccount3:matrix.org";
            const theirDeviceId = "FWKXUYUHTF";
            const txnId = "t150836b91a7bed";
            const receivedMessages = new SASFixtures(theirUserId, theirDeviceId, txnId)
                .youSentRequest()
                .theySentStart()
                .youSentStart()
                .theyWinConflict()
                .fixtures();
            const { sas } = await createSASRequest(
                ourUserId,
                ourDeviceId,
                theirUserId,
                theirDeviceId,
                txnId, 
                receivedMessages
            );
            await sas.start();
            const expectedOrder = [
                SendRequestVerificationStage,
                SelectVerificationMethodStage,
                SendAcceptVerificationStage,
                SendKeyStage,
                CalculateSASStage,
                SendMacStage,
                VerifyMacStage,
                SendDoneStage
            ]
            //@ts-ignore
            let stage = sas.startStage;
            for (const stageClass of expectedOrder) {
                assert.strictEqual(stage instanceof stageClass, true);
                stage = stage.nextStage;
            }
            assert.strictEqual(sas.finished, true);
        },
        "Verification is cancelled after 10 minutes": async (assert) => {
            const ourDeviceId = "ILQHOACESQ";
            const ourUserId = "@foobaraccount:matrix.org";
            const theirUserId = "@foobaraccount3:matrix.org";
            const theirDeviceId = "FWKXUYUHTF";
            const txnId = "t150836b91a7bed";
            const receivedMessages = new SASFixtures(theirUserId, theirDeviceId, txnId)
                .youSentRequest()
                .theySentStart()
                .fixtures();
            console.log("receivedMessages", receivedMessages);
            const { sas, clock } = await createSASRequest(
                ourUserId,
                ourDeviceId,
                theirUserId,
                theirDeviceId,
                txnId, 
                receivedMessages
            );
            const promise = sas.start();
            clock.elapse(10 * 60 * 1000);
            try {
                await promise;
            }
            catch (e) {
                assert.strictEqual(e instanceof VerificationCancelledError, true);
            }
            assert.strictEqual(sas.finished, true);
        },
        "Verification is cancelled when there's no common hash algorithm": async (assert) => {
            const ourDeviceId = "ILQHOACESQ";
            const ourUserId = "@foobaraccount:matrix.org";
            const theirUserId = "@foobaraccount3:matrix.org";
            const theirDeviceId = "FWKXUYUHTF";
            const txnId = "t150836b91a7bed";
            const receivedMessages = new SASFixtures(theirUserId, theirDeviceId, txnId)
                .youSentRequest()
                .theySentStart()
                .fixtures();
            receivedMessages.get(VerificationEventType.Start).content.key_agreement_protocols = ["foo"];
            const { sas } = await createSASRequest(
                ourUserId,
                ourDeviceId,
                theirUserId,
                theirDeviceId,
                txnId, 
                receivedMessages
            );
            try {
                await sas.start()
            }
            catch (e) {
                assert.strictEqual(e instanceof VerificationCancelledError, true);
            }
            assert.strictEqual(sas.finished, true);
        },
    }
}
