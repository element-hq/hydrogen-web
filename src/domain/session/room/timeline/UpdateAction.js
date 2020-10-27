/*
Copyright 2020 Bruno Windels <bruno@windels.cloud>

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

export class UpdateAction {
    constructor(remove, update, replace, updateParams) {
        this._remove = remove;
        this._update = update;
        this._replace = replace;
        this._updateParams = updateParams;
    }

    get shouldReplace() {
        return this._replace;
    }

    get shouldRemove() {
        return this._remove;
    }

    get shouldUpdate() {
        return this._update;
    }

    get updateParams() {
        return this._updateParams;
    }

    static Remove() {
        return new UpdateAction(true, false, false, null);
    }

    static Update(newParams) {
        return new UpdateAction(false, true, false, newParams);
    }

    static Nothing() {
        return new UpdateAction(false, false, false, null);
    }

    static Replace(params) {
        return new UpdateAction(false, false, true, params);
    }
}
