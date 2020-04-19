export default class SessionInfoStorage {
    constructor(name) {
        this._name = name;
    }

    getAll() {
        const sessionsJson = localStorage.getItem(this._name);
        if (sessionsJson) {
            const sessions = JSON.parse(sessionsJson);
            if (Array.isArray(sessions)) {
                return Promise.resolve(sessions);
            }
        }
        return Promise.resolve([]);
    }

    async hasAnySession() {
        const all = await this.getAll();
        return all && all.length > 0;
    }

    async updateLastUsed(id, timestamp) {
        const sessions = await this.getAll();
        if (sessions) {
            const session = sessions.find(session => session.id === id);
            if (session) {
                session.lastUsed = timestamp;
                localStorage.setItem(this._name, JSON.stringify(sessions));
            }
        }
    }

    async get(id) {
        const sessions = await this.getAll();
        if (sessions) {
            return sessions.find(session => session.id === id);
        }
    }

    async add(sessionInfo) {
        const sessions = await this.getAll();
        sessions.push(sessionInfo);
        localStorage.setItem(this._name, JSON.stringify(sessions));
    }

    async delete(sessionId) {
        let sessions = await this.getAll();
        sessions = sessions.filter(s => s.id !== sessionId);
        localStorage.setItem(this._name, JSON.stringify(sessions));
    }
    
}
