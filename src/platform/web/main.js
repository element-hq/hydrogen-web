/*
Copyright 2025 New Vector Ltd.
Copyright 2020 Bruno Windels <bruno@windels.cloud>
Copyright 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// import {RecordRequester, ReplayRequester} from "./matrix/net/request/replay";
import {RootViewModel} from "../../domain/RootViewModel.js";
import {createNavigation, createRouter} from "../../domain/navigation/index";
import {FeatureSet} from "../../features";

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
        const features = await FeatureSet.load(platform.settingsStorage);
        const navigation = createNavigation();
        platform.setNavigation(navigation);
        const urlRouter = createRouter({navigation, history: platform.history});
        urlRouter.attach();
        const vm = new RootViewModel({
            platform,
            // the only public interface of the router is to create urls,
            // so we call it that in the view models
            urlRouter: urlRouter,
            navigation,
            features
        });
        await vm.load();
        platform.createAndMountRootView(vm);
    } catch(err) {
        console.error(`${err.message}:\n${err.stack}`);
    }
}
