export default class Logger {
    constructor(persister) {
        this._openItems = [];
        this._persister = persister;
        this._closing = false;
    }

    restore() {
        const items = this._persister.loadTempItems();
        return this._persister.persistItems(items);
    }

    start(label, logLevel) {
        const item = new LogItem(label, logLevel, this);
        this._openItems.push(item);
        return item;
    }

    _closeChild(item) {
        if (!this._closing) {
            this._persister.persistItems([item.serialize()]);
        }
    }

    close() {
        this._closing = true;
        for(const i of this._openItems) {
            i.finish();
        }
        this._closing = false;
        this._persister.persistTempItems(this._openItems.map(i => i.serialize()));
    }
}

class LogItem {
    constructor(label, logLevel, parent) {
        this._start = Date.now();
        this._end = null;
        this._values = {label};
        this._parent = parent;
        this._error = null;
        this._children = [];
        this._logLevel = logLevel;
    }

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

    finish() {
        if (this._end === null) {
            for(const c of this._children) {
                c.finish();
            }
            this._end = Date.now();
            if (this._parent) {
                this._parent._closeChild(this);
            }
        }
    }

    fail(err) {
        this._error = err.message;
        console.error(`log item ${this.values.label} failed: ${err.message}:\n${err.stack}`);
        this.finish();
    }

    serialize() {
        return {
            start: this._start,
            end: this._end,
            values: this._values,
            error: this._error,
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
