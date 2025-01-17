/*
Copyright 2025 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/


// polyfills needed for IE11
// just enough to run olm, have promises and async/await

// load this first just in case anything else depends on it
import Promise from "es6-promise/lib/es6-promise/promise.js";
// not calling checkNeedsSyncPromise from here as we don't do any idb in the worker,
// mainly because IE doesn't handle multiple concurrent connections well
self.Promise = Promise;

import "regenerator-runtime/runtime";
import "core-js/modules/es.math.imul";
import "core-js/modules/es.math.clz32";

import "core-js/modules/es.typed-array.from";
import "core-js/modules/es.typed-array.of";
import "core-js/modules/es.typed-array.copy-within";
import "core-js/modules/es.typed-array.every";
import "core-js/modules/es.typed-array.fill";
import "core-js/modules/es.typed-array.filter";
import "core-js/modules/es.typed-array.find";
import "core-js/modules/es.typed-array.find-index";
import "core-js/modules/es.typed-array.for-each";
import "core-js/modules/es.typed-array.includes";
import "core-js/modules/es.typed-array.index-of";
import "core-js/modules/es.typed-array.join";
import "core-js/modules/es.typed-array.last-index-of";
import "core-js/modules/es.typed-array.map";
import "core-js/modules/es.typed-array.reduce";
import "core-js/modules/es.typed-array.reduce-right";
import "core-js/modules/es.typed-array.reverse";
import "core-js/modules/es.typed-array.set";
import "core-js/modules/es.typed-array.slice";
import "core-js/modules/es.typed-array.some";
import "core-js/modules/es.typed-array.sort";
import "core-js/modules/es.typed-array.subarray";
import "core-js/modules/es.typed-array.to-locale-string";
import "core-js/modules/es.typed-array.to-string";
import "core-js/modules/es.typed-array.iterator";
import "core-js/modules/es.object.to-string";

