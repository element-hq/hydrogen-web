import {SortedArray} from "../observable/index.js";
import EventEmitter from "../EventEmitter.js";

class SessionItemViewModel extends EventEmitter {
    constructor(sessionInfo, pickerVM) {
        super();
        this._pickerVM = pickerVM;
        this._sessionInfo = sessionInfo;
        this._isDeleting = false;
        this._error = null;
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

    get isDeleting() {
        return this._isDeleting;
    }

    get id() {
        return this._sessionInfo.id;
    }

    get userId() {
        return this._sessionInfo.userId;
    }
    
    get lastUsed() {
        return this._sessionInfo.lastUsed;
    }
}

export default class SessionPickerViewModel {
    constructor({storageFactory, sessionStore, sessionCallback}) {
        this._storageFactory = storageFactory;
        this._sessionStore = sessionStore;
        this._sessionCallback = sessionCallback;
        this._sessions = new SortedArray((s1, s2) => (s1.lastUsed || 0) - (s2.lastUsed || 0));
    }

    async load() {
        const sessions = await this._sessionStore.getAll();
        this._sessions.setManyUnsorted(sessions.map(s => new SessionItemViewModel(s, this)));
    }

    pick(id) {
        const session = this._sessions.array.find(s => s.id === id);
        if (session) {
            this._sessionCallback(session);
        }
    }

    async delete(id) {
        const idx = this._sessions.array.findIndex(s => s.id === id);
        await this._sessionStore.delete(id);
        await this._storageFactory.delete(id);
        this._sessions.remove(idx);
    }

    get sessions() {
        return this._sessions;
    }

    cancel() {
        this._sessionCallback();
    }
}
