/*
Copyright 2020 Bruno Windels <bruno@windels.cloud>
Copyright 2020 The Matrix.org Foundation C.I.C.

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

// import {RecordRequester, ReplayRequester} from "./matrix/net/request/replay.js";
import {createFetchRequest} from "./matrix/net/request/fetch.js";
import {xhrRequest} from "./matrix/net/request/xhr.js";
import {SessionContainer} from "./matrix/SessionContainer.js";
import {StorageFactory} from "./matrix/storage/idb/StorageFactory.js";
import {SessionInfoStorage} from "./matrix/sessioninfo/localstorage/SessionInfoStorage.js";
import {RootViewModel} from "./domain/RootViewModel.js";
import {createNavigation, createRouter} from "./domain/navigation/index.js";
import {RootView} from "./ui/web/RootView.js";
import {Clock} from "./ui/web/dom/Clock.js";
import {ServiceWorkerHandler} from "./ui/web/dom/ServiceWorkerHandler.js";
import {History} from "./ui/web/dom/History.js";
import {OnlineStatus} from "./ui/web/dom/OnlineStatus.js";
import {CryptoDriver} from "./ui/web/dom/CryptoDriver.js";
import {WorkerPool} from "./utils/WorkerPool.js";
import {OlmWorker} from "./matrix/e2ee/OlmWorker.js";

function addScript(src) {
    return new Promise(function (resolve, reject) {
        var s = document.createElement("script");
        s.setAttribute("src", src );
        s.onload=resolve;
        s.onerror=reject;
        document.body.appendChild(s);
    });
}

async function loadOlm(olmPaths) {
    // make crypto.getRandomValues available without
    // a prefix on IE11, needed by olm to work
    if (window.msCrypto && !window.crypto) {
        window.crypto = window.msCrypto;
    }
    if (olmPaths) {
        if (window.WebAssembly) {
            await addScript(olmPaths.wasmBundle);
            await window.Olm.init({locateFile: () => olmPaths.wasm});
        } else {
            await addScript(olmPaths.legacyBundle);
            await window.Olm.init();
        }
        return window.Olm;
    }
    return null;
}

// make path relative to basePath,
// assuming it and basePath are relative to document
function relPath(path, basePath) {
    const idx = basePath.lastIndexOf("/");
    const dir = idx === -1 ? "" : basePath.slice(0, idx);
    const dirCount = dir.length ? dir.split("/").length : 0;
    return "../".repeat(dirCount) + path;
}

async function loadOlmWorker(paths) {
    const workerPool = new WorkerPool(paths.worker, 4);
    await workerPool.init();
    const path = relPath(paths.olm.legacyBundle, paths.worker);
    await workerPool.sendAll({type: "load_olm", path});
    const olmWorker = new OlmWorker(workerPool);
    return olmWorker;
}

// Don't use a default export here, as we use multiple entries during legacy build,
// which does not support default exports,
// see https://github.com/rollup/plugins/tree/master/packages/multi-entry
export async function main(container, paths, legacyExtras) {
    try {
        // TODO: add .legacy to .hydrogen (container) in (legacy)platform.createAndMountRootView; and use .hydrogen:not(.legacy) if needed for modern stuff
        const isIE11 = !!window.MSInputMethodContext && !!document.documentMode;
        if (isIE11) {
            document.body.className += " ie11";
        } else {
            document.body.className += " not-ie11";
        }
        // to replay:
        // const fetchLog = await (await fetch("/fetchlogs/constrainterror.json")).json();
        // const replay = new ReplayRequester(fetchLog, {delay: false});
        // const request = replay.request;

        // to record:
        // const recorder = new RecordRequester(createFetchRequest(clock.createTimeout));
        // const request = recorder.request;
        // window.getBrawlFetchLog = () => recorder.log();
        const clock = new Clock();
        let request;
        if (typeof fetch === "function") {
            request = createFetchRequest(clock.createTimeout);
        } else {
            request = xhrRequest;
        }
        const navigation = createNavigation();
        const sessionInfoStorage = new SessionInfoStorage("hydrogen_sessions_v1");
        let serviceWorkerHandler;
        if (paths.serviceWorker && "serviceWorker" in navigator) {
            serviceWorkerHandler = new ServiceWorkerHandler({navigation});
            serviceWorkerHandler.registerAndStart(paths.serviceWorker);
        }
        const storageFactory = new StorageFactory(serviceWorkerHandler);

        const olmPromise = loadOlm(paths.olm);
        // if wasm is not supported, we'll want
        // to run some olm operations in a worker (mainly for IE11)
        let workerPromise;
        if (!window.WebAssembly) {
            workerPromise = loadOlmWorker(paths);
        }
        const urlRouter = createRouter({navigation, history: new History()});
        urlRouter.attach();

        const vm = new RootViewModel({
            createSessionContainer: () => {
                return new SessionContainer({
                    random: Math.random,
                    onlineStatus: new OnlineStatus(),
                    storageFactory,
                    sessionInfoStorage,
                    request,
                    clock,
                    cryptoDriver: new CryptoDriver(legacyExtras?.crypto),
                    olmPromise,
                    workerPromise,
                });
            },
            sessionInfoStorage,
            storageFactory,
            clock,
            urlRouter,
            navigation,
            updateService: serviceWorkerHandler
        });
        window.__brawlViewModel = vm;
        await vm.load();
        // TODO: replace with platform.createAndMountRootView(vm, container);
        const view = new RootView(vm);
        container.appendChild(view.mount());
    } catch(err) {
        console.error(`${err.message}:\n${err.stack}dfdfdfdf`);
    }
}
