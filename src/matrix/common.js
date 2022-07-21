/*
Copyright 2020 Bruno Windels <bruno@windels.cloud>
Copyright 2020 The Matrix.org Foundation C.I.C.

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

export function makeTxnId() {
    const n = Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);
    const str = n.toString(16);
    return "t" + "0".repeat(14 - str.length) + str;
}

export function isTxnId(txnId) {
    return txnId.startsWith("t") && txnId.length === 15;
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
