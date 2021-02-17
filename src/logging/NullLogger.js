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
import {LogLevel} from "./LogFilter.js";

export class NullLogger {
    constructor() {
        this._item = new NullLogItem();
    }

    run(_, callback) {
        return callback(this._item);    
    }

    async export() {
        return null;
    }

    get level() {
        return LogLevel;
    }
}

class NullLogItem {
    wrap(_, callback) {
        return callback(this);
    }
    log() {}
    set() {}
    anonymize() {}

    get level() {
        return LogLevel;
    }

    catch(err) {
        return err;
    }

    child() {
        return this;
    }

    finish() {}
}
