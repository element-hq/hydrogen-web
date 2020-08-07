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

// polyfills needed for IE11
import "core-js/stable";
import "regenerator-runtime/runtime";
import "mdn-polyfills/Element.prototype.closest";
// TODO: contribute this to mdn-polyfills
if (!Element.prototype.remove) {
    Element.prototype.remove = function remove() {
        this.parentNode.removeChild(this);
    };
}

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
