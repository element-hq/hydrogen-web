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

export class SessionInfoStorage {
    constructor(name) {
        this._name = name;
    }

    _getAllSync() {
        const sessionsJson = localStorage.getItem(this._name);
        if (sessionsJson) {
            const sessions = JSON.parse(sessionsJson);
            if (Array.isArray(sessions)) {
                return sessions;
            }
        }
        return [];
    }

    async getAll() {
        return this._getAllSync();
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

    // Update to the session tokens are all done synchronousely to avoid data races
    updateAccessToken(id, accessToken) {
        const sessions = this._getAllSync();
        if (sessions) {
            const session = sessions.find(session => session.id === id);
            if (session) {
                session.accessToken = accessToken;
                localStorage.setItem(this._name, JSON.stringify(sessions));
            }
        }
    }

    updateAccessTokenExpiresAt(id, accessTokenExpiresAt) {
        const sessions = this._getAllSync();
        if (sessions) {
            const session = sessions.find(session => session.id === id);
            if (session) {
                session.accessTokenExpiresAt = accessTokenExpiresAt;
                localStorage.setItem(this._name, JSON.stringify(sessions));
            }
        }
    }

    updateRefreshToken(id, refreshToken) {
        const sessions = this._getAllSync();
        if (sessions) {
            const session = sessions.find(session => session.id === id);
            if (session) {
                session.refreshToken = refreshToken;
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
