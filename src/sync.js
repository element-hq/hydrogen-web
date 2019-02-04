import {RequestAbortError} from "./network.js";
import {HomeServerError, StorageError} from "./error.js";

const INCREMENTAL_TIMEOUT = 30;

function parseRooms(responseSections, roomMapper) {
	return ["join", "invite", "leave"].map(membership => {
		const membershipSection = responseSections[membership];
		const results = Object.entries(membershipSection).map(([roomId, roomResponse]) => {
			const room = roomMapper(roomId, membership);
			return room.processInitialSync(roomResponse);
		});
		return results;
	}).reduce((allResults, sectionResults) => allResults.concat(sectionResults), []);
}

export class Sync {
	constructor(network, session, storage) {
		this._network = network;
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
		try {
			let syncToken = session.syncToken;
			// do initial sync if needed
			if (!syncToken) {
				syncToken = await this._syncRequest();
			}
		} catch(err) {
			//expected when stop is called
			if (err instanceof RequestAbortError) {

			} else if (err instanceof HomeServerError) {

			} else {
				// something threw something
			}
		}
		this._syncLoop(syncToken);
	}

	async _syncLoop(syncToken) {
		// if syncToken is falsy, it will first do an initial sync ... 
		while(this._isSyncing) {
			try {
				syncToken = await this._syncRequest(INCREMENTAL_TIMEOUT, syncToken);
			} catch (err) {
				this.emit("error", err);
			}
		}
	}

	async _syncRequest(timeout, syncToken) {
		this._currentRequest = this._network.sync(timeout, syncToken);
		const response = await this._currentRequest.response;
		syncToken = response.next_batch;
		const txn = this._storage.startSyncTxn();
		try {
			session.applySync(syncToken, response.account_data, txn);
			// to_device
			// presence
			parseRooms(response.rooms, async (roomId, roomResponse, membership) => {
				let room = session.getRoom(roomId);
				if (!room) {
					room = session.createRoom(roomId, txn);
				}
				room.applySync(roomResponse, membership, txn);
			});
		} catch(err) {
			// avoid corrupting state by only
			// storing the sync up till the point
			// the exception occurred
			txn.abort();
			throw err;
		}
		try {
			await txn.complete();
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