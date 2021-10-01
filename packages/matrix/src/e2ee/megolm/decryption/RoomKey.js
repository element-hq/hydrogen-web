import {SessionInfo} from "./SessionInfo.js";

export class BaseRoomKey {
    constructor() {
        this._sessionInfo = null;
        this._isBetter = null;
        this._eventIds = null;
    }

    async createSessionInfo(olm, pickleKey, txn) {
        if (this._isBetter === false) {
            return;
        }
        const session = new olm.InboundGroupSession();
        try {
            this._loadSessionKey(session);
            this._isBetter = await this._isBetterThanKnown(session, olm, pickleKey, txn);
            if (this._isBetter) {
                const claimedKeys = {ed25519: this.claimedEd25519Key};
                this._sessionInfo = new SessionInfo(this.roomId, this.senderKey, session, claimedKeys);
                // retain the session so we don't have to create a new session during write.
                this._sessionInfo.retain();
                return this._sessionInfo;
            } else {
                session.free();
                return;
            }
        } catch (err) {
            this._sessionInfo = null;
            session.free();
            throw err;
        }
    }

    async _isBetterThanKnown(session, olm, pickleKey, txn) {
        let isBetter = true;
        // TODO: we could potentially have a small speedup here if we looked first in the SessionCache here...
        const existingSessionEntry = await txn.inboundGroupSessions.get(this.roomId, this.senderKey, this.sessionId);
        if (existingSessionEntry?.session) {
            const existingSession = new olm.InboundGroupSession();
            try {
                existingSession.unpickle(pickleKey, existingSessionEntry.session);
                isBetter = session.first_known_index() < existingSession.first_known_index();
            } finally {
                existingSession.free();
            }
        }
        // store the event ids that can be decrypted with this key
        // before we overwrite them if called from `write`.
        if (existingSessionEntry?.eventIds) {
            this._eventIds = existingSessionEntry.eventIds;
        }
        return isBetter;
    }

    async write(olm, pickleKey, txn) {
        // we checked already and we had a better session in storage, so don't write
        if (this._isBetter === false) {
            return false;
        }
        if (!this._sessionInfo) {
            await this.createSessionInfo(olm, pickleKey, txn);
        }
        if (this._sessionInfo) {
            const session = this._sessionInfo.session;
            const sessionEntry = {
                roomId: this.roomId,
                senderKey: this.senderKey,
                sessionId: this.sessionId,
                session: session.pickle(pickleKey),
                claimedKeys: this._sessionInfo.claimedKeys,
            };
            txn.inboundGroupSessions.set(sessionEntry);
            this.dispose();
            return true;
        }
        return false;
    }

    get eventIds() {
        return this._eventIds;
    }

    dispose() {
        if (this._sessionInfo) {
            this._sessionInfo.release();
            this._sessionInfo = null;
        }
    }
}

class DeviceMessageRoomKey extends BaseRoomKey {
    constructor(decryptionResult) {
        super();
        this._decryptionResult = decryptionResult;
    }

    get roomId() { return this._decryptionResult.event.content?.["room_id"]; }
    get senderKey() { return this._decryptionResult.senderCurve25519Key; }
    get sessionId() { return this._decryptionResult.event.content?.["session_id"]; }
    get claimedEd25519Key() { return this._decryptionResult.claimedEd25519Key; }

    _loadSessionKey(session) {
        const sessionKey = this._decryptionResult.event.content?.["session_key"];
        session.create(sessionKey);
    }
}

class BackupRoomKey extends BaseRoomKey {
    constructor(roomId, sessionId, backupInfo) {
        super();
        this._roomId = roomId;
        this._sessionId = sessionId;
        this._backupInfo = backupInfo;
    }

    get roomId() { return this._roomId; }
    get senderKey() { return this._backupInfo["sender_key"]; }
    get sessionId() { return this._sessionId; }
    get claimedEd25519Key() { return this._backupInfo["sender_claimed_keys"]?.["ed25519"]; }

    _loadSessionKey(session) {
        const sessionKey = this._backupInfo["session_key"];
        session.import_session(sessionKey);
    }
}

export function fromDeviceMessage(dr) {
    const roomId = dr.event.content?.["room_id"];
    const sessionId = dr.event.content?.["session_id"];
    const sessionKey = dr.event.content?.["session_key"];
    if (
        typeof roomId === "string" || 
        typeof sessionId === "string" || 
        typeof senderKey === "string" ||
        typeof sessionKey === "string"
    ) {
        return new DeviceMessageRoomKey(dr);
    }
}

/*
sessionInfo is a response from key backup and has the following keys:
    algorithm
    forwarding_curve25519_key_chain
    sender_claimed_keys
    sender_key
    session_key
 */
export function fromBackup(roomId, sessionId, sessionInfo) {
    const sessionKey = sessionInfo["session_key"];
    const senderKey = sessionInfo["sender_key"];
    // TODO: can we just trust this?
    const claimedEd25519Key = sessionInfo["sender_claimed_keys"]?.["ed25519"];

    if (
        typeof roomId === "string" && 
        typeof sessionId === "string" && 
        typeof senderKey === "string" &&
        typeof sessionKey === "string" &&
        typeof claimedEd25519Key === "string"
    ) {
        return new BackupRoomKey(roomId, sessionId, sessionInfo);
    }
}

