/*
Copyright 2025 New Vector Ltd.
Copyright 2020 Bruno Windels <bruno@windels.cloud>

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
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
    updateAccessToken(id: string, token: string): Promise<void>;
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

    async updateAccessToken(id: string, accessToken: string): Promise<void> {
        const sessions = await this.getAll();
        const session = sessions.find(session => session.id === id);
        if (!session) {
            throw Error('No session found');
        }
        session.accessToken = accessToken;
        localStorage.setItem(this._name, JSON.stringify(sessions));
    }

    async updateLastUsed(id: string, timestamp: number): Promise<void> {
        const sessions = await this.getAll();
        const session = sessions.find(session => session.id === id);
        if (session) {
            session.lastUsed = timestamp;
            localStorage.setItem(this._name, JSON.stringify(sessions));
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
