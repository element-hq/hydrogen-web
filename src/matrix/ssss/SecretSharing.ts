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

import type {HomeServerApi} from "../net/HomeServerApi";
import type {Storage} from "../storage/idb/Storage";
import type {DeviceMessageHandler} from "../DeviceMessageHandler.js"
import type {DeviceTracker} from "../e2ee/DeviceTracker";
import type {ILogger, ILogItem} from "../../logging/types";
import type {Encryption as OlmEncryption} from "../e2ee/olm/Encryption";
import type {Crypto} from "../../platform/web/dom/Crypto.js";
import type {Encoding} from "../../platform/web/utils/Encoding.js";
import type {CrossSigning} from "../verification/CrossSigning";
import type {SecretFetcher} from "./SecretFetcher";
import type {ObservableValue} from "../../observable/value";
import {makeTxnId, formatToDeviceMessagesPayload} from "../common.js";
import {Deferred} from "../../utils/Deferred";
import {StoreNames} from "../storage/common";
import {SESSION_E2EE_KEY_PREFIX} from "../e2ee/common";

type Options = {
    hsApi: HomeServerApi;
    storage: Storage;
    deviceMessageHandler: DeviceMessageHandler;
    deviceTracker: DeviceTracker;
    ourUserId: string;
    olmEncryption: OlmEncryption;
    crypto: Crypto;
    encoding: Encoding;
    crossSigning: ObservableValue<CrossSigning | undefined>;
    logger: ILogger;
};

const enum EVENT_TYPE {
    REQUEST = "m.secret.request",
    SEND = "m.secret.send",
}

export class SecretSharing {
    private readonly hsApi: HomeServerApi;
    private readonly storage: Storage;
    private readonly deviceMessageHandler: DeviceMessageHandler;
    private readonly deviceTracker: DeviceTracker;
    private readonly ourUserId: string;
    private readonly olmEncryption: OlmEncryption;
    private readonly waitMap: Map<string, { deferred: Deferred<any>, name: string }> = new Map();
    private readonly crypto: Crypto;
    private readonly encoding: Encoding;
    private readonly aesEncryption: AESEncryption;
    private readonly crossSigning: ObservableValue<CrossSigning | undefined>;
    private readonly logger: ILogger;
    private secretFetcher: SecretFetcher;

    constructor(options: Options) {
        this.hsApi = options.hsApi;
        this.storage = options.storage;
        this.deviceMessageHandler = options.deviceMessageHandler;
        this.deviceTracker = options.deviceTracker;
        this.ourUserId = options.ourUserId;
        this.olmEncryption = options.olmEncryption;
        this.crypto = options.crypto;
        this.encoding = options.encoding;
        this.crossSigning = options.crossSigning;
        this.logger = options.logger;
        this.aesEncryption = new AESEncryption(this.storage, this.crypto, this.encoding);
        (window as any).foo = this;
        this.init();
    }

    private async init() {
        this.deviceMessageHandler.on("message", ({ encrypted }) => {
            const type: EVENT_TYPE = encrypted?.event.type;
            switch (type) {
                case EVENT_TYPE.REQUEST: {
                    this._respondToRequest(encrypted);
                }
                case EVENT_TYPE.SEND: {
                    const { request_id, secret } = encrypted.event.content;
                    const obj = this.waitMap.get(request_id);
                    if (obj) {
                        const { deferred, name } = obj;
                        deferred.resolve(encrypted);
                        this.waitMap.delete(request_id);
                        this.writeToStorage(name, secret);
                    }
                    break;
                }
            }
        });
        await this.aesEncryption.load();
    }

    private async _respondToRequest(request) {
        await this.logger.run("SharedSecret.respondToRequest", async (log) => {
            if (!this.shouldRespondToRequest(request, log)) {
                return;
            }
            const requestContent = request.event.content;
            const id = requestContent.request_id;
            const deviceId = requestContent.requesting_device_id;
            const name = requestContent.name;
            
            const secret = await this.secretFetcher.getSecret(name);
            if (!secret) {
                // Can't share a secret that we don't know about.
                log.log({ l: "Secret not available to share" });
                return;
            }

            const content = { secret, request_id: id };
            const device = await this.deviceTracker.deviceForId(this.ourUserId, deviceId, this.hsApi, log);
            if (!device) {
                log.log({ l: "Cannot find device", deviceId });
                return;
            }
            const messages = await log.wrap("olm encrypt", log => this.olmEncryption.encrypt(
                EVENT_TYPE.SEND, content, [device], this.hsApi, log));
            console.log("messages", messages);
            const payload = formatToDeviceMessagesPayload(messages);
            console.log("payload", payload);
            await this.hsApi.sendToDevice("m.room.encrypted", payload, makeTxnId(), {log}).response();
        });
    }

    private async shouldRespondToRequest(request: any, log: ILogItem): Promise<boolean> {
        return log.wrap("SecretSharing.shouldRespondToRequest", async () => {
            if (request.event.content.requesting_device_id === this.deviceTracker.ownDeviceId) {
                // This is the request that we sent, so ignore
                return false;
            }
            const crossSigning = this.crossSigning.get();
            if (!crossSigning) {
                // We're not in a position to respond to this request
                log.log({ crossSigningNotAvailable: true });
                return false;
            }

            const content = request.event.content;
            if (
                request.event.sender !== this.ourUserId ||
                !(
                    content.name &&
                    content.action &&
                    content.requesting_device_id &&
                    content.request_id
                ) ||
                content.action === "request_cancellation"
            ) {
                // 1. Ensure that the message came from the same user as us
                // 2. Validate message format
                // 3. Check if this is a cancellation 
                return false;
            } 

            // 3. Check that the device is verified
            const deviceId = content.requesting_device_id;
            const device = await this.deviceTracker.deviceForId(this.ourUserId, deviceId, this.hsApi, log);
            if (!device) {
                log.log({ l: "Device could not be acquired", deviceId });
                return false;
            }
            if (!await crossSigning.isOurUserDeviceTrusted(device, log)) {
                log.log({ l: "Device not trusted, returning" });
                return false;
            }
            return true;
        })

    }

    async getLocallyStoredSecret(name: string): Promise<any> {
        const txn = await this.storage.readTxn([
            this.storage.storeNames.sharedSecrets,
        ]);
        const storedSecret = await txn.sharedSecrets.get(name);
        if (storedSecret) {
            const secret = await this.aesEncryption.decrypt(storedSecret.encrypted);
            return secret;
        }
    }

    // todo: this will break if two different pieces of code call this method
    requestSecret(name: string, log: ILogItem): Promise<SecretRequest> {
        return log.wrap("SharedSecret.requestSecret", async (_log) => {
            const request_id = makeTxnId();
            const promise = this.trackSecretRequest(request_id, name);
            await this.sendRequestForSecret(name, request_id, _log);
            const request = new SecretRequest(promise);
            return request;
        });
    }

    private async writeToStorage(name:string, secret: any) {
        const encrypted = await this.aesEncryption.encrypt(secret);
        const txn = await this.storage.readWriteTxn([StoreNames.sharedSecrets]);
        txn.sharedSecrets.set(name, { encrypted });
    }

    private trackSecretRequest(request_id: string, name: string): Promise<any> {
        const deferred = new Deferred(); 
        this.waitMap.set(request_id, { deferred, name });
        return deferred.promise;
    }
    
    private async sendRequestForSecret(name: string, request_id: string, log: ILogItem) {
        const content = {
            action: "request",
            name,
            request_id,
            requesting_device_id: this.deviceTracker.ownDeviceId,
        }
        let devices = await this.deviceTracker.devicesForUsers([this.ourUserId], this.hsApi, log);
        devices = devices.filter(d => d.device_id !== this.deviceTracker.ownDeviceId);
        const messages = await log.wrap("olm encrypt", log => this.olmEncryption.encrypt(
            EVENT_TYPE.REQUEST, content, devices, this.hsApi, log));
        console.log("messages", messages);
        const payload = formatToDeviceMessagesPayload(messages);
        console.log("payload", payload);
        await this.hsApi.sendToDevice("m.room.encrypted", payload, makeTxnId(), {log}).response();
    } 

    setSecretFetcher(secretFetcher: SecretFetcher): void {
        this.secretFetcher = secretFetcher;
    }
}

class SecretRequest {
    constructor(private receivedSecretPromise: Promise<any>) {
    }

    /**
     * Wait for any of your device to respond to this secret request.
     * If you're going to await this method, make sure you do that within a try catch block.
     * @param timeout The max time (in seconds) that we will wait, after which the promise rejects
     */
    async waitForResponse(timeout: number = 30): Promise<string> {
        const timeoutPromise: Promise<string> = new Promise((_, reject) => {
            setTimeout(reject, timeout * 1000);
        });
        const response = await Promise.race([this.receivedSecretPromise, timeoutPromise]);
        return response.event.content.secret;
    }
}


/**
 * The idea is to encrypt the secret with AES before persisting to storage.
 * The AES key is also in storage so this isn't really that much more secure.
 * But it's a tiny bit better than storing the secret in plaintext.
 */
// todo: We could also encrypt the access-token using AES like element does
class AESEncryption {
    private key: JsonWebKey;
    private iv: Uint8Array;

    constructor(private storage: Storage, private crypto: Crypto, private encoding: Encoding) { };

    async load() {
        const storageKey = `${SESSION_E2EE_KEY_PREFIX}localAESKey`;
        // 1. Check if we're already storing the AES key
        const txn = await this.storage.readTxn([StoreNames.session]);
        let { key, iv } = await txn.session.get(storageKey) ?? {};

        // 2. If no key, create it and store in session store
        if (!key) {
            /**
             * Element creates the key as "non-extractable", meaning that it cannot
             * be exported through the crypto API. But since it is going
             * to end up in local-storage anyway, I don't see a reason to do that.
             */
            key = await this.crypto.aes.generateKey("jwk");
            iv = await this.crypto.aes.generateIV();
            const txn = await this.storage.readWriteTxn([StoreNames.session]);
            txn.session.set(storageKey, { key, iv });
        }

        // 3. Set props
        this.key = key;
        this.iv = iv;
    }

    async encrypt(secret: string): Promise<Uint8Array> {
        const data = this.encoding.utf8.encode(secret);
        const encrypted = await this.crypto.aes.encryptCTR({
            jwkKey: this.key,
            iv: this.iv,
            data,
        });
        return encrypted;
    }

    async decrypt(ciphertext: Uint8Array): Promise<string> {
        const buffer = await this.crypto.aes.decryptCTR({
            jwkKey: this.key,
            iv: this.iv,
            data: ciphertext,
        });
        const secret = this.encoding.utf8.decode(buffer);
        return secret;
    }
}
