/*
Copyright 2025 New Vector Ltd.
Copyright 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import type {HomeServerApi} from "../net/HomeServerApi.js";
import type {ILogItem} from "../../logging/types";

export interface IPusherDescription {
    kind: "http" | "email" | "null";
    lang: string;
    device_display_name: string;
    app_display_name: string;
    app_id: string;
    pushkey: string;
    data: IPusherData;
    append?: boolean;
    profile_tag?: string;
}

interface IPusherData {
    format?: string;
    url?: string;
    endpoint?: PushSubscriptionJSON["endpoint"];
    keys?: PushSubscriptionJSON["keys"];
}

export class Pusher {
    private readonly _description: IPusherDescription;

    constructor(description: IPusherDescription) {
        this._description = description;
    }

    static httpPusher(host: string, appId: string, pushkey: string, data: IPusherData): Pusher {
        return new Pusher({
            kind: "http",
            append: true,   // as pushkeys are shared between multiple users on one origin
            data: Object.assign({}, data, {url: host + "/_matrix/push/v1/notify"}),
            pushkey,
            app_id: appId,
            app_display_name: "Hydrogen",
            device_display_name: "Hydrogen",
            lang: "en"
        });
    }

    static webpushPusher(appId: string, pushkey: string, data: IPusherData): Pusher {
        return new Pusher({
            kind: "webpush",
            append: true,   // as pushkeys are shared between multiple users on one origin
            data,
            pushkey,
            app_id: appId,
            app_display_name: "Hydrogen",
            device_display_name: "Hydrogen",
            lang: "en"
        });
    }

    static createDefaultPayload(sessionId: string): {session_id: string} {
        return {session_id: sessionId};
    }

    async enable(hsApi: HomeServerApi, log: ILogItem): Promise<void> {
        try {
            log.set("endpoint", new URL(this._description.data.endpoint!).host);
        } catch {
            log.set("endpoint", null);
        }
        await hsApi.setPusher(this._description, {log}).response();
    }

    async disable(hsApi: HomeServerApi, log: ILogItem): Promise<void> {
        const deleteDescription = Object.assign({}, this._description, {kind: null});
        await hsApi.setPusher(deleteDescription, {log}).response();
    }

    serialize(): IPusherDescription {
        return this._description;
    }

    equals(pusher): boolean {
        if (this._description.app_id !== pusher._description.app_id) {
            return false;
        }
        if (this._description.pushkey !== pusher._description.pushkey) {
            return false;
        }
        return JSON.stringify(this._description.data) === JSON.stringify(pusher._description.data);
    }
}
