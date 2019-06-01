import {directionalConcat, directionalAppend} from "./common.js";
import EventKey from "../EventKey.js";
import Direction from "../Direction.js";
import EventEntry from "../entries/EventEntry.js";
import FragmentBoundaryEntry from "../entries/FragmentBoundaryEntry.js";

export default class TimelineReader {
    constructor({roomId, storage, fragmentIdComparer}) {
        this._roomId = roomId;
        this._storage = storage;
        this._fragmentIdComparer = fragmentIdComparer;
    }

    _openTxn() {
        return this._storage.readTxn([
            this._storage.storeNames.timelineEvents,
            this._storage.storeNames.timelineFragments,
        ]);
    }

    async readFrom(eventKey, direction, amount) {
        const txn = await this._openTxn();
        return this._readFrom(eventKey, direction, amount, txn);
    }

    async _readFrom(eventKey, direction, amount, txn) {
        let entries = [];

        const timelineStore = txn.timelineEvents;
        const fragmentStore = txn.timelineFragments;
        
        while (entries.length < amount && eventKey) {
            let eventsWithinFragment;
            if (direction.isForward) {
                eventsWithinFragment = timelineStore.eventsAfter(eventKey, amount);
            } else {
                eventsWithinFragment = timelineStore.eventsBefore(eventKey, amount);
            }
            const eventEntries = eventsWithinFragment.map(e => new EventEntry(e, this._fragmentIdComparer));
            entries = directionalConcat(entries, eventEntries, direction);
            // prepend or append eventsWithinFragment to entries, and wrap them in EventEntry

            if (entries.length < amount) {
                const fragment = await fragmentStore.get(this._roomId, eventKey.fragmentId);
                // this._fragmentIdComparer.addFragment(fragment);
                let fragmentEntry = new FragmentBoundaryEntry(fragment, direction.isBackward, this._fragmentIdComparer);
                // append or prepend fragmentEntry, reuse func from GapWriter?
                directionalAppend(entries, fragmentEntry, direction);
                // don't count it in amount perhaps? or do?
                if (fragmentEntry.linkedFragmentId) {
                    const nextFragment = await fragmentStore.get(this._roomId, fragmentEntry.linkedFragmentId);
                    this._fragmentIdComparer.add(nextFragment);
                    const nextFragmentEntry = new FragmentBoundaryEntry(nextFragment, direction.isForward, this._fragmentIdComparer);
                    directionalAppend(entries, nextFragmentEntry, direction);
                    eventKey = new EventKey(nextFragmentEntry.fragmentId, nextFragmentEntry.eventIndex);
                } else {
                    eventKey = null;
                }
            }
        }

        return entries;
    }

    async readFromEnd(amount) {
        const txn = await this._openTxn();
        const liveFragment = await txn.timelineFragments.liveFragment(this._roomId);
        // room hasn't been synced yet
        if (!liveFragment) {
            return [];
        }
        this._fragmentIdComparer.add(liveFragment);
        const liveFragmentEntry = FragmentBoundaryEntry.end(liveFragment, this._fragmentIdComparer);
        const eventKey = new EventKey(liveFragmentEntry.fragmentId, liveFragmentEntry.eventIndex);
        const entries = this._readFrom(eventKey, Direction.Backward, amount, txn);
        entries.unshift(liveFragmentEntry);
        return entries;
    }

    // reads distance up and down from eventId
    // or just expose eventIdToKey?
    readAtEventId(eventId, distance) {
        return null;
    }
}
