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

interface ISessionInfo {
    id: string;
    deviceId: string;
    userId: string;
    homeserver: string;
    homeServer: string; // deprecate this over time
    accessToken: string;
    lastUsed: number;
    /**
     * If true, then this session will not be used for sending
     * encrypted messages.
     * OTK uploads will be disabled when this is true.
     * 
     * Encrypted messages can still be decrypted and key backups
     * can also be restored.
     */
    isReadOnly: boolean;
}

// todo: this should probably be in platform/types?
interface ISessionInfoStorage {
    getAll(): Promise<ISessionInfo[]>;
    updateLastUsed(id: string, timestamp: number): Promise<void>;
    get(id: string): Promise<ISessionInfo | undefined>;
    add(sessionInfo: ISessionInfo): Promise<void>;
    delete(sessionId: string): Promise<void>;
}

export class SessionInfoStorage implements ISessionInfoStorage {
    private readonly _name: string;

    constructor(name: string) {
        this._name = name;
    }

    getAll(): Promise<ISessionInfo[]> {
        const sessionsJson = localStorage.getItem(this._name);
        if (sessionsJson) {
            const sessions = JSON.parse(sessionsJson);
            if (Array.isArray(sessions)) {
                return Promise.resolve(sessions);
            }
        }
        return Promise.resolve([]);
    }

    async updateLastUsed(id: string, timestamp: number): Promise<void> {
        const sessions = await this.getAll();
        if (sessions) {
            const session = sessions.find(session => session.id === id);
            if (session) {
                session.lastUsed = timestamp;
                localStorage.setItem(this._name, JSON.stringify(sessions));
            }
        }
    }

    async get(id: string): Promise<ISessionInfo | undefined> {
        const sessions = await this.getAll();
        if (sessions) {
            return sessions.find(session => session.id === id);
        }
    }

    async add(sessionInfo: ISessionInfo): Promise<void> {
        const sessions = await this.getAll();
        sessions.push(sessionInfo);
        localStorage.setItem(this._name, JSON.stringify(sessions));
    }

    async delete(sessionId: string): Promise<void> {
        let sessions = await this.getAll();
        sessions = sessions.filter(s => s.id !== sessionId);
        localStorage.setItem(this._name, JSON.stringify(sessions));
    }
    
}
