import {ISync} from "../../../matrix/ISync";
import {Sync} from "../../../matrix/Sync";
import {RequestScheduler} from "../../../matrix/net/RequestScheduler";
import {Session} from "../../../matrix/Session";
import {Logger} from "../../../logging/Logger";
import {Storage} from "../../../matrix/storage/idb/Storage";
import {FeatureSet} from "../../../features";
import {SyncProxy} from "./SyncProxy";

type Options = {
    logger: Logger;
    features: FeatureSet;
}

type MakeOptions = {
    scheduler: RequestScheduler;
    storage: Storage;
    session: Session;
}

export class SyncFactory {
    private readonly _logger: Logger;
    private readonly _features: FeatureSet;

    constructor(options: Options) {
        const {logger, features} = options;
        this._logger = logger;
        this._features = features;
    }

    make(options: MakeOptions): ISync {
        const {scheduler, storage, session} = options;
        let runSyncInWorker = this._features.sameSessionInMultipleTabs;

        if (typeof SharedWorker === "undefined") {
            runSyncInWorker = false;
        }

        if (runSyncInWorker) {
            return new SyncProxy({session});
        }

        return new Sync({
            logger: this._logger,
            hsApi: scheduler.hsApi,
            storage,
            session,
        });
    }
}
