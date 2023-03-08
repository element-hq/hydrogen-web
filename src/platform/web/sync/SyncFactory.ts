import {ISync} from "../../../matrix/ISync";
import {Sync} from "../../../matrix/Sync";
import {RequestScheduler} from "../../../matrix/net/RequestScheduler";
import {Session} from "../../../matrix/Session";
import {Logger} from "../../../logging/Logger";
import {Storage} from "../../../matrix/storage/idb/Storage";

type Options = {
    logger: Logger;
}

type MakeOptions = {
    scheduler: RequestScheduler;
    storage: Storage;
    session: Session;
}

export class SyncFactory {
    private readonly _logger: Logger;

    constructor(options: Options) {
        const {logger} = options;
        this._logger = logger;
    }

    make(options: MakeOptions): ISync {
        const {scheduler, storage, session} = options;

        return new Sync({
            logger: this._logger,
            hsApi: scheduler.hsApi,
            storage,
            session,
        });
    }
}
