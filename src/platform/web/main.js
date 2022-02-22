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

// import {RecordRequester, ReplayRequester} from "./matrix/net/request/replay";
import {RootViewModel} from "../../domain/RootViewModel.js";
import {createNavigation, createRouter} from "../../domain/navigation/index";
// Don't use a default export here, as we use multiple entries during legacy build,
// which does not support default exports,
// see https://github.com/rollup/plugins/tree/master/packages/multi-entry
export async function main(platform) {
    try {
        // to replay:
        // const fetchLog = await (await fetch("/fetchlogs/constrainterror.json")).json();
        // const replay = new ReplayRequester(fetchLog, {delay: false});
        // const request = replay.request;

        // to record:
        // const recorder = new RecordRequester(createFetchRequest(clock.createTimeout));
        // const request = recorder.request;
        // window.getBrawlFetchLog = () => recorder.log();
        await platform.init();
        const navigation = createNavigation();
        platform.setNavigation(navigation);
        const urlRouter = createRouter({navigation, history: platform.history});
        urlRouter.attach();
        const vm = new RootViewModel({
            platform,
            // the only public interface of the router is to create urls,
            // so we call it that in the view models
            urlCreator: urlRouter,
            navigation,
        });
        await vm.load();
        platform.createAndMountRootView(vm);
    } catch(err) {
        console.error(`${err.message}:\n${err.stack}`);
    }
}
