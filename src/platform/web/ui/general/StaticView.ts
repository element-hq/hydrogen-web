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

import {tag} from "./html";

export class StaticView <T> {
    private _root?: Element;
    render: (tag, T) => Element;
    constructor(value:any , render : any = undefined) {
        if (typeof value === "function" && !render) {
            render = value;
            value = null;
        }
        this._root= render ? render(tag, value) : this.render(tag, value);
    }

    mount() {
        return this._root;
    }

    root() {
        return this._root;
    }

    unmount() {}
    update() {}
}
