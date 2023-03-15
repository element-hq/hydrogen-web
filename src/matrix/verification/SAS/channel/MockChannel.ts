import type {ILogItem} from "../../../../lib";
import {createCalculateMAC} from "../mac";
import {VerificationCancelledError} from "../VerificationCancelledError";
import {IChannel} from "./Channel";
import {CancelTypes, VerificationEventTypes} from "./types";
import anotherjson from "another-json";

interface ITestChannel extends IChannel {
    setOlmSas(olmSas): void;
}

export class MockChannel implements ITestChannel {
    public sentMessages: Map<string, any> = new Map();
    public receivedMessages: Map<string, any> = new Map();
    public initiatedByUs: boolean;
    public startMessage: any;
    public isCancelled: boolean = false;
    private olmSas: any;
    public ourUserDeviceId: string;

    constructor(
        public otherUserDeviceId: string,
        public otherUserId: string,
        public ourUserId: string,
        private fixtures: Map<string, any>,
        private deviceTracker: any,
        public id: string,
        private olm: any,
        startingMessage?: any,
    ) {
        if (startingMessage) {
            const eventType = startingMessage.content.method ? VerificationEventTypes.Start : VerificationEventTypes.Request;
            this.id = startingMessage.content.transaction_id;
            this.receivedMessages.set(eventType, startingMessage);
        }
    }

    async send(eventType: string, content: any, _: ILogItem) {
        if (this.isCancelled) {
            throw new VerificationCancelledError();
        }
        Object.assign(content, { transaction_id: this.id });
        this.sentMessages.set(eventType, {content});
    }

    async waitForEvent(eventType: string): Promise<any> {
        if (this.isCancelled) {
            throw new VerificationCancelledError();
        }
        const event = this.fixtures.get(eventType);
        if (event) {
            this.receivedMessages.set(eventType, event);
        }
        else {
            await new Promise(() => {});
        }
        if (eventType === VerificationEventTypes.Mac) {
            await this.recalculateMAC();
        }
        if(eventType === VerificationEventTypes.Accept && this.startMessage) {
        }
        return event;
    }

    private recalculateCommitment() {
        const acceptMessage = this.acceptMessage?.content;
        if (!acceptMessage) {
            return;
        }
        const {content} = this.startMessage;
        const {content: keyMessage} = this.fixtures.get(VerificationEventTypes.Key);
        const key = keyMessage.key;
        const commitmentStr = key + anotherjson.stringify(content);
        const olmUtil = new this.olm.Utility();
        const commitment = olmUtil.sha256(commitmentStr);
        olmUtil.free();
        acceptMessage.commitment = commitment;
    }

    private async recalculateMAC() {
        // We need to replace the mac with calculated mac
        const baseInfo =
            "MATRIX_KEY_VERIFICATION_MAC" +
            this.otherUserId +
            this.otherUserDeviceId +
            this.ourUserId +
            this.ourUserDeviceId +
            this.id;
        const { content: macContent } = this.receivedMessages.get(VerificationEventTypes.Mac);
        const macMethod = this.acceptMessage.content.message_authentication_code;
        const calculateMac = createCalculateMAC(this.olmSas, macMethod);
        const input = Object.keys(macContent.mac).sort().join(",");
        const properMac = calculateMac(input, baseInfo + "KEY_IDS");
        macContent.keys = properMac;
        for (const keyId of Object.keys(macContent.mac)) {
            const deviceId = keyId.split(":", 2)[1];
            const device = await this.deviceTracker.deviceForId(this.otherUserDeviceId, deviceId);
            if (device) {
                macContent.mac[keyId] = calculateMac(device.ed25519Key, baseInfo + keyId);
            }
            else {
                const {masterKey} = await this.deviceTracker.getCrossSigningKeysForUser(this.otherUserId);
                macContent.mac[keyId] = calculateMac(masterKey, baseInfo + keyId);
            }
        }
    }

    setStartMessage(event: any): void {
        this.startMessage = event;
        this.initiatedByUs = event.content.from_device === this.ourUserDeviceId;
        this.recalculateCommitment();
    }

    setOurDeviceId(id: string) {
        this.ourUserDeviceId = id;
    }

    async cancelVerification(_: CancelTypes): Promise<void> {
        console.log("MockChannel.cancelVerification()");
        this.isCancelled = true;
    }

    get acceptMessage(): any {
        return this.receivedMessages.get(VerificationEventTypes.Accept) ??
            this.sentMessages.get(VerificationEventTypes.Accept);
    }

    getReceivedMessage(event: VerificationEventTypes) {
        return this.receivedMessages.get(event);
    }

    getSentMessage(event: VerificationEventTypes) {
        return this.sentMessages.get(event);
    }

    setOlmSas(olmSas: any): void {
        this.olmSas = olmSas;
    }
}
