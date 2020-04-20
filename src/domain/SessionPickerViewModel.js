import {SortedArray} from "../observable/index.js";
import {EventEmitter} from "../utils/EventEmitter.js";
import {createNewSessionId} from "./BrawlViewModel.js"

class SessionItemViewModel extends EventEmitter {
    constructor(sessionInfo, pickerVM) {
        super();
        this._pickerVM = pickerVM;
        this._sessionInfo = sessionInfo;
        this._isDeleting = false;
        this._isClearing = false;
        this._error = null;
        this._exportDataUrl = null;
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

    get label() {
        const {userId, comment} =  this._sessionInfo;
        if (comment) {
            return `${userId} (${comment})`;
        } else {
            return userId;
        }
    }

    get sessionInfo() {
        return this._sessionInfo;
    }

    get exportDataUrl() {
        return this._exportDataUrl;
    }

    async export() {
        try {
            const data = await this._pickerVM._exportData(this._sessionInfo.id);
            const json = JSON.stringify(data, undefined, 2);
            const blob = new Blob([json], {type: "application/json"});
            this._exportDataUrl = URL.createObjectURL(blob);
            this.emit("change", "exportDataUrl");
        } catch (err) {
            alert(err.message);
            console.error(err);
        }
    }

    clearExport() {
        if (this._exportDataUrl) {
            URL.revokeObjectURL(this._exportDataUrl);
            this._exportDataUrl = null;
            this.emit("change", "exportDataUrl");
        }
    }
}

export class SessionPickerViewModel {
    constructor({storageFactory, sessionInfoStorage, sessionCallback}) {
        this._storageFactory = storageFactory;
        this._sessionInfoStorage = sessionInfoStorage;
        this._sessionCallback = sessionCallback;
        this._sessions = new SortedArray((s1, s2) => s1.id.localeCompare(s2.id));
    }

    async load() {
        const sessions = await this._sessionInfoStorage.getAll();
        this._sessions.setManyUnsorted(sessions.map(s => new SessionItemViewModel(s, this)));
    }

    pick(id) {
        const sessionVM = this._sessions.array.find(s => s.id === id);
        if (sessionVM) {
            this._sessionCallback(sessionVM.sessionInfo);
        }
    }

    async _exportData(id) {
        const sessionInfo = await this._sessionInfoStorage.get(id);
        const stores = await this._storageFactory.export(id);
        const data = {sessionInfo, stores};
        return data;
    }

    async import(json) {
        const data = JSON.parse(json);
        const {sessionInfo} = data;
        sessionInfo.comment = `Imported on ${new Date().toLocaleString()} from id ${sessionInfo.id}.`;
        sessionInfo.id = createNewSessionId();
        await this._storageFactory.import(sessionInfo.id, data.stores);
        await this._sessionInfoStorage.add(sessionInfo);
        this._sessions.set(new SessionItemViewModel(sessionInfo, this));
    }

    async delete(id) {
        const idx = this._sessions.array.findIndex(s => s.id === id);
        await this._sessionInfoStorage.delete(id);
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
