/*
Copyright 2025 New Vector Ltd.
Copyright 2020 Bruno Windels <bruno@windels.cloud>
Copyright 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { StorageError } from "../common";

function _sourceName(source: IDBIndex | IDBObjectStore): string {
    return "objectStore" in source ?
        `${source.objectStore.name}.${source.name}` :
        source.name;
}

function _sourceDatabase(source: IDBIndex | IDBObjectStore): string {
    return "objectStore" in source ?
        source.objectStore?.transaction?.db?.name :
        source.transaction?.db?.name;
}

export class IDBError extends StorageError {
    storeName: string;
    databaseName: string;

    constructor(message: string, sourceOrCursor: IDBIndex | IDBCursor | IDBObjectStore | null, cause: DOMException | null = null) {
        const source = (sourceOrCursor && "source" in sourceOrCursor) ? sourceOrCursor.source : sourceOrCursor;
        const storeName = source ? _sourceName(source) : "";
        const databaseName = source ? _sourceDatabase(source) : "";
        let fullMessage = `${message} on ${databaseName}.${storeName}`;
        if (cause) {
            fullMessage += ": ";
            if (typeof cause.name === "string") {
                fullMessage += `(name: ${cause.name}) `;
            }
            if (typeof cause.code === "number") {
                fullMessage += `(code: ${cause.code}) `;
            }
        }
        if (cause) {
            fullMessage += cause.message;
        }
        super(fullMessage, cause);
        this.storeName = storeName;
        this.databaseName = databaseName;
    }
}

export class IDBRequestError extends IDBError {
    private errorEvent: Event;

    constructor(errorEvent: Event) {
        const request = errorEvent.target as IDBRequest;
        const source = request.source;
        const cause = request.error;
        super("IDBRequest failed", source, cause);
        this.errorEvent = errorEvent;
    }

    preventTransactionAbort() {
        this.errorEvent.preventDefault();
    }
}

export class IDBRequestAttemptError extends IDBError {
    constructor(method: string, source: IDBIndex | IDBObjectStore, cause: DOMException, params: any[]) {
        super(`${method}(${params.map(p => JSON.stringify(p)).join(", ")}) failed`, source, cause);
    }
}
