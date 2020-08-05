// polyfills needed for IE11
import "core-js/stable";
import "regenerator-runtime/runtime";

import {xhrRequest} from "./matrix/net/request/xhr.js";
import {SessionContainer} from "./matrix/SessionContainer.js";
import {StorageFactory} from "./matrix/storage/idb/StorageFactory.js";
import {SessionInfoStorage} from "./matrix/sessioninfo/localstorage/SessionInfoStorage.js";
import {BrawlViewModel} from "./domain/BrawlViewModel.js";
import {BrawlView} from "./ui/web/BrawlView.js";
import {Clock} from "./ui/web/dom/Clock.js";
import {OnlineStatus} from "./ui/web/dom/OnlineStatus.js";

export default async function main(container) {
    try {
        const request = xhrRequest;
        const sessionInfoStorage = new SessionInfoStorage("brawl_sessions_v1");
        const clock = new Clock();
        const storageFactory = new StorageFactory();

        const vm = new BrawlViewModel({
            createSessionContainer: () => {
                return new SessionContainer({
                    random: Math.random,
                    onlineStatus: new OnlineStatus(),
                    storageFactory,
                    sessionInfoStorage,
                    request,
                    clock,
                });
            },
            sessionInfoStorage,
            storageFactory,
            clock,
        });
        window.__brawlViewModel = vm;
        await vm.load();
        const view = new BrawlView(vm);
        container.appendChild(view.mount());
    } catch(err) {
        console.error(`${err.message}:\n${err.stack}`);
    }
}
