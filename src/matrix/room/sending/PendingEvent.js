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

export class PendingEvent {
    constructor(data) {
        this._data = data;
    }

    get roomId() { return this._data.roomId; }
    get queueIndex() { return this._data.queueIndex; }
    get eventType() { return this._data.eventType; }
    get txnId() { return this._data.txnId; }
    get remoteId() { return this._data.remoteId; }
    set remoteId(value) { this._data.remoteId = value; }
    get content() { return this._data.content; }
    get data() { return this._data; }
}
