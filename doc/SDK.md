# How to use Hydrogen as an SDK

If you want to use end-to-end encryption, it is recommended to use a [supported build system](../src/sdk/paths/) (currently only vite) to be able to locate the olm library files.

**NOTE**: For now, these instructions will only work at development time, support when building (e.g. `vite build`) is being worked on and tracked in [#529](https://github.com/vector-im/hydrogen-web/issues/529).

You can create a project using the following commands

```sh
# you can pick "vanilla-ts" here for project type if you're not using react or vue
yarn create vite
cd <your-project-name>
yarn
yarn add https://github.com/vector-im/hydrogen-web.git
```

If you go into the `src` directory, you should see a `main.ts` file. If you put this code in there, you should see a basic timeline after login and initial sync have finished.

```ts
import {
    Platform,
    SessionContainer,
    LoadStatus,
    createNavigation,
    createRouter,
    RoomViewModel,
    TimelineView
} from "hydrogen-web";
import {olmPaths, downloadSandboxPath} from "hydrogen-web/src/sdk/paths/vite";

const app = document.querySelector<HTMLDivElement>('#app')!

// bootstrap a session container
const platform = new Platform(app, {
    downloadSandbox: downloadSandboxPath,
    olm: olmPaths,
}, null, { development: true });
const navigation = createNavigation();
platform.setNavigation(navigation);
const urlRouter = createRouter({
    navigation: navigation,
    history: platform.history
});
urlRouter.attach();
const sessionContainer = new SessionContainer({
    platform,
    olmPromise: platform.loadOlm(),
    workerPromise: platform.loadOlmWorker()
});

// wait for login and first sync to finish
const loginOptions = await sessionContainer.queryLogin("matrix.org").result;
sessionContainer.startWithLogin(loginOptions.password("user", "password"));
await sessionContainer.loadStatus.waitFor((status: string) => {
    return status === LoadStatus.Ready ||
        status === LoadStatus.Error ||
        status === LoadStatus.LoginFailed;
}).promise;
// check the result
if (sessionContainer.loginFailure) {
    alert("login failed: " + sessionContainer.loginFailure);
} else if (sessionContainer.loadError) {
    alert("load failed: " + sessionContainer.loadError.message);
} else {
    // we're logged in, we can access the room now
    const {session} = sessionContainer;
    // room id for #element-dev:matrix.org
    const room = session.rooms.get("!bEWtlqtDwCLFIAKAcv:matrix.org");
    const vm = new RoomViewModel({
        room,
        ownUserId: session.userId,
        platform,
        urlCreator: urlRouter,
        navigation,
    });
    await vm.load();
    const view = new TimelineView(vm.timelineViewModel);
    app.appendChild(view.mount());
}
```
