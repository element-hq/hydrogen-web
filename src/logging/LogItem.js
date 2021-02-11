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

export class LogItem {
    constructor(label, parent, logLevel, clock) {
        this._clock = clock;
        this._start = clock.now();
        this._end = null;
        this._values = {label};
        this._parent = parent;
        this._error = null;
        this._children = [];
        this._logLevel = logLevel;
    }

    // should this handle errors in the same way as logger.descend/start?
    descend(label, logLevel = this._logLevel) {
        if (this._end !== null) {
            throw new Error("can't descend on finished item");
        }
        const item = new LogItem(label, logLevel);
        this._children.push(item);
        return item;
    }

    set(key, value) {
        if(typeof key === "object") {
            const values = key;
            Object.assign(this._values, values);
        } else {
            this._values[key] = value;
        }
    }

    // XXX: where will this be called? from wrapAsync?
    finish() {
        if (this._end === null) {
            for(const c of this._children) {
                c.finish();
            }
            this._end = this._clock.now();
            if (this._parent) {
                this._parent._closeChild(this);
            }
        }
    }

    catch(err) {
        this._error = err;
        console.error(`log item ${this.values.label} failed: ${err.message}:\n${err.stack}`);
    }

    serialize() {
        let error;
        if (this._error) {
            error = {
                message: this._error.message,
                stack: this._error.stack,
            };
        }
        return {
            start: this._start,
            end: this._end,
            values: this._values,
            error,
            children: this._children.map(c => c.serialize()),
            logLevel: this._logLevel
        };
    }

    async wrapAsync(fn) {
        try {
            const ret = await fn(this);
            this.finish();
            return ret;
        } catch (err) {
            this.fail(err);
            throw err;
        }
    }
}
