/*
Copyright 2025 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// polyfills needed for IE11
import Promise from "es6-promise/lib/es6-promise/promise.js";
import {checkNeedsSyncPromise} from "../../matrix/storage/idb/utils";

if (typeof window.Promise === "undefined") {
    window.Promise = Promise;
    // TODO: should be awaited before opening any session in the picker
    checkNeedsSyncPromise();
}
import "core-js/stable";
import "regenerator-runtime/runtime";
import "mdn-polyfills/Element.prototype.closest";
// olm.init needs utf-16le, and this polyfill was
// the only one I could find supporting it.
// TODO: because the library sees a commonjs environment,
// it will also include the file supporting *all* the encodings,
// weighing a good extra 500kb :-(
import "text-encoding";

// TODO: contribute this to mdn-polyfills
if (!Element.prototype.remove) {
    Element.prototype.remove = function remove() {
        this.parentNode.removeChild(this);
    };
}
