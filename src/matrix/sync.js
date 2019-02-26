import {
	RequestAbortError,
	HomeServerError,
	StorageError
} from "./error.js";
import EventEmitter from "../EventEmitter.js";

const INCREMENTAL_TIMEOUT = 30000;
const SYNC_EVENT_LIMIT = 10;

function parseRooms(roomsSection, roomCallback) {
	if (!roomsSection) {
		return;
	}
	const allMemberships = ["join", "invite", "leave"];
	for(const membership of allMemberships) {
		const membershipSection = roomsSection[membership];
		if (membershipSection) {
			const rooms = Object.entries(membershipSection)
			for (const [roomId, roomResponse] of rooms) {
				roomCallback(roomId, roomResponse, membership);
			}
		}
	}
}

export default class Sync extends EventEmitter {
	constructor(hsApi, session, storage) {
		super();
		this._hsApi = hsApi;
		this._session = session;
		this._storage = storage;
		this._isSyncing = false;
		this._currentRequest = null;
	}
	// returns when initial sync is done
	async start() {
		if (this._isSyncing) {
			return;
		}
		this._isSyncing = true;
		let syncToken = this._session.syncToken;
		// do initial sync if needed
		if (!syncToken) {
			// need to create limit filter here
			syncToken = await this._syncRequest();
		}
		this._syncLoop(syncToken);
	}

	async _syncLoop(syncToken) {
		// if syncToken is falsy, it will first do an initial sync ... 
		while(this._isSyncing) {
			try {
				console.log(`starting sync request with since ${syncToken} ...`);
				syncToken = await this._syncRequest(syncToken, INCREMENTAL_TIMEOUT);
			} catch (err) {
				this._isSyncing = false;
				if (!(err instanceof RequestAbortError)) {
					console.warn("stopping sync because of error");
					this.emit("error", err);
				}
			}
		}
		this.emit("stopped");
	}

	async _syncRequest(syncToken, timeout) {
		this._currentRequest = this._hsApi.sync(syncToken, undefined, timeout);
		const response = await this._currentRequest.response();
		syncToken = response.next_batch;
		const storeNames = this._storage.storeNames;
		const syncTxn = await this._storage.readWriteTxn([
			storeNames.session,
			storeNames.roomSummary,
			storeNames.roomTimeline,
			storeNames.roomState,
		]);
		try {
			this._session.applySync(syncToken, response.account_data, syncTxn);
			// to_device
			// presence
			if (response.rooms) {
				parseRooms(response.rooms, (roomId, roomResponse, membership) => {
					let room = this._session.rooms.get(roomId);
					if (!room) {
						room = this._session.createRoom(roomId);
					}
					console.log(` * applying sync response to room ${roomId} ...`);
					room.applySync(roomResponse, membership, syncTxn);
				});
			}
		} catch(err) {
			console.warn("aborting syncTxn because of error");
			// avoid corrupting state by only
			// storing the sync up till the point
			// the exception occurred
			syncTxn.abort();
			throw err;
		}
		try {
			await syncTxn.complete();
			console.info("syncTxn committed!!");
		} catch (err) {
			throw new StorageError("unable to commit sync tranaction", err);
		}
		return syncToken;
	}

	stop() {
		if (!this._isSyncing) {
			return;
		}
		this._isSyncing = false;
		if (this._currentRequest) {
			this._currentRequest.abort();
			this._currentRequest = null;
		}
	}
}
