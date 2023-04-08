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

import {ISync} from "../../../matrix/ISync";
import {ObservableValue} from "../../../observable/value";
import {SyncStatus} from "../../../matrix/Sync";
import {Session} from "../../../matrix/Session";

type Options = {
    session: Session;
}

export class SyncProxy implements ISync {
    private _session: Session;
    private readonly _status: ObservableValue<SyncStatus> = new ObservableValue(SyncStatus.Stopped);
    private _error: Error | null = null;
    private _worker?: SharedWorker;

    constructor(options: Options) {
        const {session} = options;
        this._session = session;
    }

    get status(): ObservableValue<SyncStatus> {
        return this._status;
    }

    get error(): Error | null {
        return this._error;
    }

    async start(): Promise<void> {
        this._worker = new SharedWorker(new URL("./sync-worker", import.meta.url), {
            type: "module",
        });
        this._worker.port.onmessage = (event: MessageEvent) => {
            // TODO
            console.log(event);
        };
    }

    stop(): void {
        // TODO
    }
}
