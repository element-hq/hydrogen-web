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

