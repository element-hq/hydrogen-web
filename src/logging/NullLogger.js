/*
Copyright 2021 The Matrix.org Foundation C.I.C.

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
import {LogLevel} from "./LogFilter.js";

function noop () {}


export class NullLogger {
    constructor() {
        this.item = new NullLogItem(this);
    }

    log() {}

    run(_, callback) {
        return callback(this.item);    
    }

    wrapOrRun(item, _, callback) {
        if (item) {
            return item.wrap(null, callback);
        } else {
            return this.run(null, callback);
        }
    }

    runDetached(_, callback) {
        new Promise(r => r(callback(this.item))).then(noop, noop);
    }

    async export() {
        return null;
    }

    get level() {
        return LogLevel;
    }
}

export class NullLogItem {
    constructor(logger) {
        this.logger = logger;
    }

    wrap(_, callback) {
        return callback(this);
    }
    log() {}
    set() {}

    runDetached(_, callback) {
        new Promise(r => r(callback(this))).then(noop, noop);
    }

    wrapDetached(_, callback) {
        return this.refDetached(null, callback);
    }

    run(callback) {
        return callback(this);
    }

    refDetached() {}

    ensureRefId() {}

    get level() {
        return LogLevel;
    }

    get duration() {
        return 0;
    }

    catch(err) {
        return err;
    }

    child() {
        return this;
    }

    finish() {}
}

export const Instance = new NullLogger(); 
