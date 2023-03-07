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
        // TODO
    }

    stop(): void {
        // TODO
    }
}
