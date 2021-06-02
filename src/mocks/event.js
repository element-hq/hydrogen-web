/*
Copyright 2021 The Matrix.org Foundation C.I.C.

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

export function event(type, id = null) {
    return {type, event_id: id};
}

export function withContent(event, content) {
    return Object.assign({}, event, {content});
}

export function withTextBody(event, body) {
    return withContent(event, {body, msgtype: "m.text"});
}

export function withTxnId(event, txnId) {
    return Object.assign({}, event, {unsigned: {transaction_id: txnId}});
}
