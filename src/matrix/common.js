/*
Copyright 2025 New Vector Ltd.
Copyright 2020 Bruno Windels <bruno@windels.cloud>
Copyright 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import {groupBy} from "../utils/groupBy";


export function makeTxnId() {
    return makeId("t");
}

export function makeId(prefix) {
    const n = Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);
    const str = n.toString(16);
    return prefix + "0".repeat(14 - str.length) + str;
}

export function isTxnId(txnId) {
	return txnId.startsWith("t") && txnId.length === 15;
}

export function formatToDeviceMessagesPayload(messages) {
    const messagesByUser = groupBy(messages, message => message.device.user_id);
    const payload = {
        messages: Array.from(messagesByUser.entries()).reduce((userMap, [userId, messages]) => {
            userMap[userId] = messages.reduce((deviceMap, message) => {
                deviceMap[message.device.device_id] = message.content;
                return deviceMap;
            }, {});
            return userMap;
        }, {})
    };
    return payload;
}

export function tests() {
	return {
		"isTxnId succeeds on result of makeTxnId": assert => {
			assert(isTxnId(makeTxnId()));
		},
		"isTxnId fails on event id": assert => {
			assert(!isTxnId("$yS_n5n3cIO2aTtek0_2ZSlv-7g4YYR2zKrk2mFCW_rm"));
		},
	}
}
