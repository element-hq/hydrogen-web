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