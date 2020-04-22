import {LoadStatus} from "../matrix/SessionContainer.js";

export function loadLabel(loadStatus, loadError) {
    if (loadError || loadStatus.get() === LoadStatus.Error) {
        return `Something went wrong: ${loadError && loadError.message}.`;
    }
    if (loadStatus) {
        switch (loadStatus.get()) {
            case LoadStatus.NotLoading:
                return `Preparing…`;
            case LoadStatus.Login:
                return `Checking your login and password…`;
            case LoadStatus.Loading:
                return `Loading your conversations…`;
            case LoadStatus.FirstSync:
                return `Getting your conversations from the server…`;
            default:
                return this._sessionContainer.loadStatus.get();
        }
    }
    return `Preparing…`;
}
