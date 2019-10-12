import HomeServerApi from "./matrix/hs-api.js";
import StorageFactory from "./matrix/storage/idb/create.js";
import SessionsStore from "./matrix/sessions-store/localstorage/SessionsStore.js";
import BrawlViewModel from "./domain/BrawlViewModel.js";
import BrawlView from "./ui/web/BrawlView.js";

export default async function main(container) {
    try {
        const vm = new BrawlViewModel({
            storageFactory: new StorageFactory(),
            createHsApi: (homeServer, accessToken = null) => new HomeServerApi(homeServer, accessToken),
            sessionStore: new SessionsStore("brawl_sessions_v1"),
            clock: Date //just for `now` fn
        });
        await vm.load();
        const view = new BrawlView(vm);
        container.appendChild(view.mount());
    } catch(err) {
        console.error(`${err.message}:\n${err.stack}`);
    }
}
