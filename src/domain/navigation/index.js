/*
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

import {Navigation} from "./Navigation.js";

export function createNavigation() {
    return new Navigation(function allowsChild(parent, child) {
        const {type} = child;
        switch (parent?.type) {
            case undefined:
                // allowed root segments
                return type === "login"  || type === "session";
            case "session":
                return type === "room" || type === "rooms" || type === "settings";
            default:
                return false;
        }
    });
}
