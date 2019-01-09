import {parseRooms} from "./common";
import {RequestAbortError} from "../network";
import {HomeServerError} from "../error";

const TIMEOUT = 30;

export class IncrementalSync {
	constructor(network, session, roomCreator) {
		this._network = network;
		this._session = session;
		this._roomCreator = roomCreator;
		this._isSyncing = false;
		this._currentRequest = null;
	}

	start() {
		if (this._isSyncing) {
			return;
		}
		this._isSyncing = true;
		try {
			this._syncLoop(session.syncToken);
		} catch(err) {
			//expected when stop is called
			if (err instanceof RequestAbortError) {

			} else if (err instanceof HomeServerError) {

			} else {
				// something threw something
			}
		}
	}

	async _syncLoop(syncToken) {
		while(this._isSyncing) {
			this._currentRequest = this._network.sync(TIMEOUT, syncToken);
			const response = await this._currentRequest.response;
			syncToken = response.next_batch;
			const txn = session.startSyncTransaction();
			const sessionPromise = session.applySync(syncToken, response.account_data);
			// to_device
			// presence
			const roomPromises = parseRooms(response.rooms, async (roomId, roomResponse, membership) => {
				let room = session.getRoom(roomId);
				if (!room) {
					room = await session.createRoom(roomId);
				}
				return room.applyIncrementalSync(roomResponse, membership);
			});
			try {
				await txn;
			} catch (err) {
				throw new StorageError("unable to commit sync tranaction", err);
			}
			await Promise.all(roomPromises.concat(sessionPromise));
		}
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