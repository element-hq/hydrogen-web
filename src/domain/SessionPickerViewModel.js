import {SortedArray} from "./observables/index.js";

export default class SessionPickerViewModel {
    constructor({sessionStore, sessionCallback}) {
        this._sessionsStore = sessionStore;
        this._sessionCallback = sessionCallback;
        this._sessions = new SortedArray((s1, s2) => (s1.lastUsed || 0) - (s2.lastUsed || 0));
    }

    async load() {
        const sessions = await this._sessionsStore.getAll();
        this._sessions.setManyUnsorted(sessions);
    }

    pick(id) {
        const session = this._sessions.array.find(s => s.id === id);
        if (session) {
            this._sessionCallback(session);
        }
    }

    get sessions() {
        return this._sessions;
    }

    cancel() {
        this._sessionCallback();
    }
}
