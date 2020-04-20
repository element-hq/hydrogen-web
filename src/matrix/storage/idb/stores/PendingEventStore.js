import { encodeUint32, decodeUint32 } from "../utils.js";
import {Platform} from "../../../../Platform.js";

function encodeKey(roomId, queueIndex) {
    return `${roomId}|${encodeUint32(queueIndex)}`;
}

function decodeKey(key) {
    const [roomId, encodedQueueIndex] = key.split("|");
    const queueIndex = decodeUint32(encodedQueueIndex);
    return {roomId, queueIndex};
}

export class PendingEventStore {
    constructor(eventStore) {
        this._eventStore = eventStore;
    }

    async getMaxQueueIndex(roomId) {
        const range = IDBKeyRange.bound(
            encodeKey(roomId, Platform.minStorageKey),
            encodeKey(roomId, Platform.maxStorageKey),
            false,
            false,
        );
        const maxKey = await this._eventStore.findMaxKey(range);
        if (maxKey) {
            return decodeKey(maxKey).queueIndex;
        }
    }

    remove(roomId, queueIndex) {
        const keyRange = IDBKeyRange.only(encodeKey(roomId, queueIndex));
        this._eventStore.delete(keyRange);
    }

    async exists(roomId, queueIndex) {
        const keyRange = IDBKeyRange.only(encodeKey(roomId, queueIndex));
        let key;
        if (this._eventStore.supports("getKey")) {
            key = await this._eventStore.getKey(keyRange);
        } else {
            const value = await this._eventStore.get(keyRange);
            key = value && value.key;
        }
        return !!key;
    }
    
    add(pendingEvent) {
        pendingEvent.key = encodeKey(pendingEvent.roomId, pendingEvent.queueIndex);
        return this._eventStore.add(pendingEvent);
    }

    update(pendingEvent) {
        return this._eventStore.put(pendingEvent);
    }

    getAll() {
        return this._eventStore.selectAll();
    }
}
