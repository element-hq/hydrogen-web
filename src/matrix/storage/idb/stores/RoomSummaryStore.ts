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

/**
store contains:
	roomId
	name
	lastMessage
	unreadCount
	mentionCount
	isEncrypted
	isDirectMessage
	membership
	inviteCount
	joinCount
*/
import {Store} from "../Store";
import {SummaryData} from "../../../room/RoomSummary";

/** Used for both roomSummary and archivedRoomSummary stores */
export class RoomSummaryStore {
    private _summaryStore: Store<SummaryData>;

    constructor(summaryStore: Store<SummaryData>) {
        this._summaryStore = summaryStore;
    }

    getAll(): Promise<SummaryData[]> {
        return this._summaryStore.selectAll();
    }

    set(summary: SummaryData): void {
        this._summaryStore.put(summary);
    }

    get(roomId: string): Promise<SummaryData | null> {
        return this._summaryStore.get(roomId);
    }

    async has(roomId: string): Promise<boolean> {
        const fetchedKey = await this._summaryStore.getKey(roomId);
        return roomId === fetchedKey;
    }

    remove(roomId: string): void {
        this._summaryStore.delete(roomId);
    }
}
