import {directionalConcat, directionalAppend} from "./common.js";
import EventKey from "../EventKey.js";
import EventEntry from "../entries/EventEntry.js";
import FragmentBoundaryEntry from "../entries/FragmentBoundaryEntry.js";

export default class TimelineReader {
    constructor({roomId, storage, fragmentIdComparer}) {
        this._roomId = roomId;
        this._storage = storage;
        this._fragmentIdComparer = fragmentIdComparer;
    }

    async readFrom(eventKey, direction, amount) {
        const txn = this._storage.readTxn([
            this._storage.storeNames.timelineEvents,
            this._storage.storeNames.timelineFragments,
        ]);
        let entries = [];
        let loadedFragment = false;

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
                // append or prepend fragmentEntry, reuse func from GapPersister?
                directionalAppend(entries, fragmentEntry, direction);
                // don't count it in amount perhaps? or do?
                if (fragmentEntry.linkedFragmentId) {
                    const nextFragment = await fragmentStore.get(this._roomId, fragmentEntry.linkedFragmentId);
                    // this._fragmentIdComparer.addFragment(nextFragment);
                    const nextFragmentEntry = new FragmentBoundaryEntry(nextFragment, direction.isForward, this._fragmentIdComparer);
                    directionalAppend(entries, nextFragmentEntry, direction);
                    eventKey = new EventKey(nextFragmentEntry.fragmentId, nextFragmentEntry.eventIndex);
                    loadedFragment = true;
                } else {
                    eventKey = null;
                }
            }
        }

        // reload fragments
        if (loadedFragment) {
            const fragments = await fragmentStore.all(this._roomId);
            this._fragmentIdComparer.rebuild(fragments);
        }

        return entries;
    }
}
