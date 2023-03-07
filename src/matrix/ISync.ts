import {ObservableValue} from "../observable/value";
import {SyncStatus} from "./Sync";

export interface ISync {
    get status(): ObservableValue<SyncStatus>;
    get error(): Error | null;
    start(): Promise<void>;
    stop(): void;
}
