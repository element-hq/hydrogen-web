# Hydrogen

A minimal [Matrix](https://matrix.org/) chat client, focused on performance, offline functionality, and broad browser support. This is work in progress and not yet ready for primetime. Bug reports are welcome, but please don't file any feature requests or other missing things to be on par with Element Web.

## Goals

Hydrogen's goals are:
 - Work well on desktop as well as mobile browsers
 - UI components can be easily used in isolation
 - It is a standalone webapp, but can also be easily embedded into an existing website/webapp to add chat capabilities.
 - Loading (unused) parts of the application after initial page load should be supported

For embedded usage, see the [SDK instructions](doc/SDK.md).

If you find this interesting, come and discuss on [`#hydrogen:matrix.org`](https://matrix.to/#/#hydrogen:matrix.org).

# How to use

Hydrogen is deployed to [hydrogen.element.io](https://hydrogen.element.io). You can also deploy Hydrogen on your own web server:

 1. Download the [latest release package](https://github.com/vector-im/hydrogen-web/releases).
 1. Extract the package to the public directory of your web server.
 1. If this is your first deploy:
    1. copy `config.sample.json` to `config.json` and if needed, make any modifications (unless you've set up your own [sygnal](https://github.com/matrix-org/sygnal) instance, you don't need to change anything in the `push` section).
    1. Disable caching entirely on the server for:
        - `index.html`
        - `sw.js`
        - `config.json`
        - All theme manifests referenced in the `themeManifests` of `config.json`, these files are typically called `theme-{name}.json`.

        These resources will still be cached client-side by the service worker. Because of this; you'll still need to refresh the app twice before config.json changes are applied.

## Set up a dev environment

You can run Hydrogen locally by the following commands in the terminal:

 - `yarn install` (only the first time)
 - `yarn start` in the terminal

Now point your browser to `http://localhost:3000`. If you prefer, you can also [use docker](doc/docker.md).

PS: You need nodejs, running yarn on top of any other js platform is not supported.

# FAQ

Some frequently asked questions are answered [here](FAQ.md).


## Copyright & License

Copyright (c) 2015-2016 OpenMarket Ltd 

Copyright (c) 2019-2023 The Matrix.org Foundation C.I.C.

Copyright (c) 2025 New Vector Ltd

This software is multi licensed by New Vector Ltd (Element). It can be used either:

(1) for free under the terms of the GNU Affero General Public License (as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version); OR

(2) under the terms of a paid-for Element Commercial License agreement between you and Element (the terms of which may vary depending on what you and Element have agreed to).
Unless required by applicable law or agreed to in writing, software distributed under the Licenses is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the Licenses for the specific language governing permissions and limitations under the Licenses.