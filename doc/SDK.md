# Hydrogen View SDK


The Hydrogen view SDK allows developers to integrate parts of the Hydrogen application into the UI of their own application. Hydrogen is written with the MVVM pattern, so to construct a view, you'd first construct a view model, which you then pass into the view. For most view models, you will first need a running client.

## Changelog
[See CHANGELOG.md](./CHANGELOG.md)  

## Example

The Hydrogen SDK requires some assets to be shipped along with your app for things like downloading attachments, and end-to-end encryption. A convenient way to make this happen is provided by the SDK (importing `hydrogen-view-sdk/paths/vite`) but depends on your build system. Currently, only [vite](https://vitejs.dev/) is supported, so that's what we'll be using in the example below.

You can create a vite project using the following commands:

```sh
# you can pick "vanilla-ts" here for project type if you're not using react or vue
yarn create vite
cd <your-project-name>
yarn
yarn add hydrogen-view-sdk
yarn add https://gitlab.matrix.org/api/v4/projects/27/packages/npm/@matrix-org/olm/-/@matrix-org/olm-3.2.14.tgz
```

You should see a `index.html` in the project root directory, containing an element with `id="app"`. Add the attribute `class="hydrogen"` to this element, as the CSS we'll include from the SDK assumes for now that the app is rendered in an element with this classname.

If you go into the `src` directory, you should see a `main.ts` file. If you put this code in there, you should see a basic timeline after login and initial sync have finished (might take a while before you see anything on the screen actually).

You'll need to provide the username and password of a user that is already in the [#element-dev:matrix.org](https://matrix.to/#/#element-dev:matrix.org) room (or change the room id).

```ts
import {
    Platform,
    Client,
    LoadStatus,
    createNavigation,
    createRouter,
    RoomViewModel,
    TimelineView,
    viewClassForTile,
    FeatureSet
} from "hydrogen-view-sdk";
import downloadSandboxPath from 'hydrogen-view-sdk/download-sandbox.html?url';
import workerPath from 'hydrogen-view-sdk/main.js?url';
import olmWasmPath from '@matrix-org/olm/olm.wasm?url';
import olmJsPath from '@matrix-org/olm/olm.js?url';
import olmLegacyJsPath from '@matrix-org/olm/olm_legacy.js?url';
const assetPaths = {
    downloadSandbox: downloadSandboxPath,
    worker: workerPath,
    olm: {
        wasm: olmWasmPath,
        legacyBundle: olmLegacyJsPath,
        wasmBundle: olmJsPath
    }
};
import "hydrogen-view-sdk/assets/theme-element-light.css";
// OR import "hydrogen-view-sdk/assets/theme-element-dark.css";

async function main() {
    const app = document.querySelector<HTMLDivElement>('#app')!
    const config = {};
    const platform = new Platform({container: app, assetPaths, config, options: { development: import.meta.env.DEV }});
    const navigation = createNavigation();
    platform.setNavigation(navigation);
    const urlRouter = createRouter({
        navigation: navigation,
        history: platform.history
    });
    urlRouter.attach();
    const client = new Client(platform);

    const loginOptions = await client.queryLogin("matrix.org").result;
    client.startWithLogin(loginOptions.password("username", "password"));

    await client.loadStatus.waitFor((status: string) => {
        return status === LoadStatus.Ready ||
            status === LoadStatus.Error ||
            status === LoadStatus.LoginFailed;
    }).promise;

    if (client.loginFailure) {
        alert("login failed: " + client.loginFailure);
    } else if (client.loadError) {
        alert("load failed: " + client.loadError.message);
    } else {
        const {session} = client;
        // looks for room corresponding to #element-dev:matrix.org, assuming it is already joined
        const room = session.rooms.get("!bEWtlqtDwCLFIAKAcv:matrix.org");
        const features = await FeatureSet.load(platform.settingsStorage);
        const vm = new RoomViewModel({
            room,
            ownUserId: session.userId,
            platform,
            urlRouter: urlRouter,
            navigation,
            features,
        });
        await vm.load();
        const view = new TimelineView(vm.timelineViewModel, viewClassForTile);
        app.appendChild(view.mount());
    }
}

main();
```

## Typescript support

Typescript support is not yet available while we're converting the Hydrogen codebase to Typescript.
In your `src` directory, you'll need to add a `.d.ts` (can be called anything, e.g. `deps.d.ts`)
containing this snippet to make Typescript not complain that `hydrogen-view-sdk` doesn't have types:

```ts
declare module "hydrogen-view-sdk";
```

## API Stability

This library follows semantic versioning; there is no API stability promised as long as the major version is still 0. Once 1.0.0 is released, breaking changes will be released with a change in major versioning.

## Third-party licenses

This package bundles the bs58 package ([license](https://github.com/cryptocoinjs/bs58/blob/master/LICENSE)), and the Inter font ([license](https://github.com/rsms/inter/blob/master/LICENSE.txt)).
