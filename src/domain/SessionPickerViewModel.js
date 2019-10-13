import {SortedArray} from "../observable/index.js";
import EventEmitter from "../EventEmitter.js";

class SessionItemViewModel extends EventEmitter {
    constructor(sessionInfo, pickerVM) {
        super();
        this._pickerVM = pickerVM;
        this._sessionInfo = sessionInfo;
        this._isDeleting = false;
        this._isClearing = false;
        this._error = null;
        this._showJSON = false;
    }

    get error() {
        return this._error && this._error.message;
    }

    async delete() {
        this._isDeleting = true;
        this.emit("change", "isDeleting");
        try {
            await this._pickerVM.delete(this.id);
        } catch(err) {
            this._error = err;
            console.error(err);
            this.emit("change", "error");
        } finally {
            this._isDeleting = false;
            this.emit("change", "isDeleting");
        }
    }

    async clear() {
        this._isClearing = true;
        this._showJSON = true;
        this.emit("change");
        try {
            await this._pickerVM.clear(this.id);
        } catch(err) {
            this._error = err;
            console.error(err);
            this.emit("change", "error");
        } finally {
            this._isClearing = false;
            this.emit("change", "isClearing");
        }
    }

    get isDeleting() {
        return this._isDeleting;
    }

    get isClearing() {
        return this._isClearing;
    }

    get id() {
        return this._sessionInfo.id;
    }

    get userId() {
        return this._sessionInfo.userId;
    }

    get sessionInfo() {
        return this._sessionInfo;
    }

    get json() {
        if (this._showJSON) {
            return JSON.stringify(this._sessionInfo, undefined, 2);
        }
        return null;
    }
}

export default class SessionPickerViewModel {
    constructor({storageFactory, sessionStore, sessionCallback}) {
        this._storageFactory = storageFactory;
        this._sessionStore = sessionStore;
        this._sessionCallback = sessionCallback;
        this._sessions = new SortedArray((s1, s2) => s1.id.localeCompare(s2.id));
    }

    async load() {
        const sessions = await this._sessionStore.getAll();
        this._sessions.setManyUnsorted(sessions.map(s => new SessionItemViewModel(s, this)));
    }

    pick(id) {
        const sessionVM = this._sessions.array.find(s => s.id === id);
        if (sessionVM) {
            this._sessionCallback(sessionVM.sessionInfo);
        }
    }

    async import(json) {
        const sessionInfo = JSON.parse(json);
        const sessionId = (Math.floor(Math.random() * Number.MAX_SAFE_INTEGER)).toString();
        sessionInfo.id = sessionId;
        sessionInfo.lastUsed = sessionId;
        await this._sessionStore.add(sessionInfo);
        this._sessions.set(new SessionItemViewModel(sessionInfo, this));
    }

    async delete(id) {
        const idx = this._sessions.array.findIndex(s => s.id === id);
        await this._sessionStore.delete(id);
        await this._storageFactory.delete(id);
        this._sessions.remove(idx);
    }

    async clear(id) {
        await this._storageFactory.delete(id);
    }

    get sessions() {
        return this._sessions;
    }

    cancel() {
        this._sessionCallback();
    }
}
