import HomeServerApi from "./matrix/hs-api.js";
// import {RecordRequester, ReplayRequester} from "./matrix/net/replay.js";
import fetchRequest from "./matrix/net/fetch.js";
import StorageFactory from "./matrix/storage/idb/create.js";
import SessionsStore from "./matrix/sessions-store/localstorage/SessionsStore.js";
import BrawlViewModel from "./domain/BrawlViewModel.js";
import BrawlView from "./ui/web/BrawlView.js";
import DOMClock from "./utils/DOMClock.js";

export default async function main(container) {
    try {
        // to replay:
        // const fetchLog = await (await fetch("/fetchlogs/constrainterror.json")).json();
        // const replay = new ReplayRequester(fetchLog, {delay: false});
        // const request = replay.request;

        // to record:
        // const recorder = new RecordRequester(fetchRequest);
        // const request = recorder.request;
        // window.getBrawlFetchLog = () => recorder.log();
        // normal network:
        const request = fetchRequest;
        const vm = new BrawlViewModel({
            storageFactory: new StorageFactory(),
            createHsApi: (homeServer, accessToken, reconnector) => new HomeServerApi({homeServer, accessToken, request, reconnector}),
            sessionStore: new SessionsStore("brawl_sessions_v1"),
            clock: new DOMClock(),
        });
        await vm.load();
        const view = new BrawlView(vm);
        container.appendChild(view.mount());
    } catch(err) {
        console.error(`${err.message}:\n${err.stack}`);
    }
}
