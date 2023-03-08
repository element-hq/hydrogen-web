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
        this._worker = new SharedWorker(new URL("./sync-worker", import.meta.url));
        this._worker.port.onmessage = (event: MessageEvent) => {
            // TODO
            console.log(event);
        };
    }

    stop(): void {
        // TODO
    }
}
