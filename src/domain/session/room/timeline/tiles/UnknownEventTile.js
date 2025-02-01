/*
Copyright 2024 Mirian Margiani <mixosaurus+ichthyo@pm.me>

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

import {SimpleTile} from "./SimpleTile";

export class UnknownEventTile extends SimpleTile {

    get shape() {
        return "unknown-event";
    }

    get announcement() {
        return this.i18n`You received a message that this app cannot display (event “${this._entry.eventType}”). Please report this issue.`
    }
}
