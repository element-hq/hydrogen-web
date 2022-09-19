/*
Copyright 2020 Bruno Windels <bruno@windels.cloud>

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
import {AbortError} from "../../../utils/error";
import {REDACTION_TYPE} from "../common";
import {getRelationFromContent, getRelationTarget, setRelationTarget} from "../timeline/relations.js";
import type {PendingEntry} from "../../storage/idb/stores/PendingEventStore";
import type {AttachmentUpload} from "../AttachmentUpload";
import type {HomeServerApi} from "../../net/HomeServerApi";
import type {IHomeServerRequest} from "../../net/HomeServerRequest";
import type {Content} from "../../storage/types";
import type {EncryptedContent} from "../../e2ee/megolm/Encryption";
import type {ILogItem} from "../../../logging/types";


export enum SendStatus {
    "Waiting",
    "EncryptingAttachments",
    "UploadingAttachments",
    "Encrypting",
    "Sending",
    "Sent",
    "Error",
}

const unencryptedContentFields = [ "m.relates_to" ];

export type PendingEventData = PendingEntry & {
    remoteId: string | null;
    encryptedEventType?: string;
    encryptedContent?: EncryptedContent
};

type PendingEventOptions = {
    data: PendingEventData;
    remove: VoidFunction;
    emitUpdate: (params: any) => void;
    attachments: Record<string, AttachmentUpload> | null;
}

export class PendingEvent {
    private _data: PendingEventData;
    private _attachments: Record<string, AttachmentUpload> | null;
    private _emitUpdate: (params: any) => void;
    private _removeFromQueueCallback: VoidFunction;
    private _error: any;
    private _aborted = false;
    private _status = SendStatus.Waiting;
    private _sendRequest: IHomeServerRequest | null = null;
    private _attachmentsTotalBytes = 0;

    constructor({data, remove, emitUpdate, attachments}: PendingEventOptions) {
        this._data = data;
        this._attachments = attachments;
        this._emitUpdate = emitUpdate;
        this._removeFromQueueCallback = remove;
        this._sendRequest = null;
        this._attachmentsTotalBytes = 0;
        if (this._attachments) {
            this._attachmentsTotalBytes = Object.values(this._attachments).reduce((t: number, a: AttachmentUpload) => t + a.size, 0) as number;
        }
    }

    get roomId(): string { return this._data.roomId; }
    get queueIndex(): number { return this._data.queueIndex; }
    get eventType(): string { return this._data.eventType; }
    get txnId(): string | undefined { return this._data.txnId; }
    get remoteId(): string | null { return this._data.remoteId; }
    get content(): Content { return this._data.content; }
    get relatedTxnId(): string | null { return this._data.relatedTxnId; }
    get relatedEventId(): string | null {
        const relation = getRelationFromContent(this.content);
        if (relation) {
            // may be null when target is not sent yet, is intended
            return getRelationTarget(relation);
        } else {
            return this._data.relatedEventId;
        }
    }

    setRelatedEventId(eventId: string): void {
        const relation = getRelationFromContent(this.content);
        if (relation) {
            setRelationTarget(relation, eventId);
        } else {
            this._data.relatedEventId = eventId;
        }
    }

    get data(): PendingEntry { return this._data; }

    getAttachment(key: string): AttachmentUpload | undefined {
        return this._attachments && this._attachments[key];
    }

    get needsSending(): boolean {
        return !this.remoteId && !this.aborted;
    }

    get needsEncryption(): boolean {
        return this._data.needsEncryption && !this.aborted;
    }

    get needsUpload(): boolean {
        return this._data.needsUpload && !this.aborted;
    }

    get isMissingAttachments(): boolean {
        return this.needsUpload && !this._attachments;
    }

    setEncrypting(): void {
        this._status = SendStatus.Encrypting;
        this._emitUpdate("status");
    }

    get contentForEncryption(): Omit<Content, "m.relates_to"> {
        const content = Object.assign({}, this._data.content);
        for (const field of unencryptedContentFields) {
            delete content[field];
        }
        return content;
    }

    _preserveContentFields(into): void {
        const content = this._data.content;
        for (const field of unencryptedContentFields) {
            if (content[field] !== undefined) {
                into[field] = content[field];
            }
        }
    }

    setEncrypted(type: string, content: EncryptedContent): void {
        this._preserveContentFields(content);
        this._data.encryptedEventType = type;
        this._data.encryptedContent = content;
        this._data.needsEncryption = false;
    }

    setError(error: any): void {
        this._status = SendStatus.Error;
        this._error = error;
        this._emitUpdate("status");
    }

    setWaiting(): void {
        this._status = SendStatus.Waiting;
        this._emitUpdate("status");
    }

    get status(): SendStatus { return this._status; }
    get error(): any { return this._error; }

    get hasStartedSending(): boolean {
        return this._status === SendStatus.Sending || this._status === SendStatus.Sent;
    }

    get attachmentsTotalBytes(): number {
        return this._attachmentsTotalBytes;
    }

    get attachmentsSentBytes(): any {
        return this._attachments && Object.values(this._attachments).reduce((t, a) => t + a.sentBytes, 0);
    }

    async uploadAttachments(hsApi, log): Promise<void> {
        if (!this.needsUpload) {
            return;
        }
        if (!this._attachments) {
            throw new Error("attachments missing");
        }
        if (this.needsEncryption) {
            this._status = SendStatus.EncryptingAttachments;
            this._emitUpdate("status");
            for (const attachment of Object.values(this._attachments)) {
                await log.wrap("encrypt", () => {
                    log.set("size", attachment.size);
                    return attachment.encrypt();
                });
                if (this.aborted) {
                    throw new AbortError();
                }
            }
        }
        this._status = SendStatus.UploadingAttachments;
        this._emitUpdate("status");
        const entries = Object.entries(this._attachments);
        // upload smallest attachments first
        entries.sort(([, a1], [, a2]) => a1.size - a2.size);
        for (const [urlPath, attachment] of entries) {
            await log.wrap("upload", log => {
                log.set("size", attachment.size);
                return attachment.upload(hsApi, () => {
                    this._emitUpdate("attachmentsSentBytes");
                }, log);
            });
            attachment.applyToContent(urlPath, this.content);
        }
        this._data.needsUpload = false;
    }

    async abort(): Promise<void> {
        if (!this._aborted) {
            this._aborted = true;
            if (this._attachments) {
                for (const attachment of Object.values(this._attachments)) {
                    attachment.abort();
                }
            }
            this._sendRequest?.abort();
            await this._removeFromQueueCallback();
        }
    }

    get aborted(): boolean {
        return this._aborted;
    }

    async send(hsApi: HomeServerApi, log: ILogItem): Promise<void> {
        this._status = SendStatus.Sending;
        this._emitUpdate("status");
        const eventType = this._data.encryptedEventType || this._data.eventType;
        const content = this._data.encryptedContent || this._data.content;
        if (eventType === REDACTION_TYPE) {
            this._sendRequest = hsApi.redact(
                    this.roomId,
                    this._data.relatedEventId!,
                    this.txnId!,
                    content,
                    {log}
                );
        } else {
            this._sendRequest = hsApi.send(
                    this.roomId,
                    eventType,
                    this.txnId!,
                    content,
                    {log}
                );
        }
        const response = await this._sendRequest.response();
        this._sendRequest = null;
        // both /send and /redact have the same response format
        this._data.remoteId = response.event_id;
        log.set("id", this._data.remoteId);
        this._status = SendStatus.Sent;
        this._emitUpdate("status");
    }

    dispose(): void {
        if (this._attachments) {
            for (const attachment of Object.values(this._attachments)) {
                attachment.dispose();
            }
        }
    }
}
