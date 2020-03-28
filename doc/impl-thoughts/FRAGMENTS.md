 - DONE: write FragmentIndex
 - DONE: adapt SortKey ... naming! :
    - FragmentIdIndex (index as in db index)
        - compare(idA, idB)
    - SortKey
        - FragmentId
        - EventIndex
 - DONE: write fragmentStore
    - load all fragments
    - add a fragment (live on limited sync, or /context)
    - connect two fragments
    - update token on fragment (when filling gap or connecting two fragments)

    fragments can need connecting when filling a gap or creating a new /context fragment
 - DONE: adapt timelineStore

    how will fragments be exposed in timeline store?
        - all read operations are passed a fragment id
 - adapt persister
    - DONE: persist fragments in /sync
    - DONE: fill gaps / fragment filling
    - DONE: load n items before and after key,
        - DONE: need to add fragments as we come across boundaries
        - DONE: also cache fragments? not for now ...
        - DONE: not doing any of the above, just reloading and rebuilding for now

 - DONE: adapt Timeline
    - DONE: turn ObservableArray into ObservableSortedArray
        - upsert already sorted sections
        - DONE: upsert single entry
 - DONE: adapt TilesCollection & Tile to entry changes
 
 - add live fragment id optimization if we haven't done so already
 - lets try to not have to have the fragmentindex in memory if the timeline isn't loaded
    - could do this by only loading all fragments into index when filling gaps, backpaginating, ... and on persister load only load the last fragment. This wouldn't even need a FragmentIndex?

# Leftover items

implement SortedArray::setManySorted in a performant manner
implement FragmentIdComparator::add in a performant manner
there is some duplication (also in memory) between SortedArray and TilesCollection. Both keep a sorted list based on fragmentId/eventIndex... TilesCollection doesn't use the index in the event handlers at all. we could allow timeline to export a structure that just emits "these entries are a thing (now)" and not have to go through sorting twice. Timeline would have to keep track of the earliest key so it can use it in loadAtTop, but that should be easy. Hmmm. also, Timeline might want to be in charge of unloading parts of the loaded timeline, and for that it would need to know the order of entries. So maybe not ... we'll see.

check: do /sync events not have a room_id and /messages do???

so a gap is two connected fragments where either the first fragment has a nextToken and/or the second fragment has a previousToken. It can be both, so we can have a gap where you can fill in from the top, from the bottom (like when limited sync) or both.




also, filling gaps and storing /context, how do we find the fragment we could potentially merge with to look for overlapping events?

with /sync this is all fine and dandy, but with /context is there a way where we don't need to look up every event_id in the store to see if it's already there?
    we can do a anyOf(event_id) on timelineStore.index("by_index") by sorting the event ids according to IndexedDb.cmp and passing the next value to cursor.continue(nextId).

so we'll need to remove previous/nextEvent on the timeline store and come up with a method to find the first matched event in a list of eventIds.
    so we'll need to map all event ids to an event and return the first one that is not null. If we haven't read all events but we know that all the previous ones are null, then we can already return the result. 

    we can call this findFirstEventIn(roomId, [event ids])

thoughts:
    - ranges in timeline store with fragmentId might not make sense anymore as doing queries over multiple fragment ids doesn't make sense anymore ... still makes sense to have them part of SortKey though ...
    - we need a test for querytarget::lookup, or make sure it works well ...


# Reading the timeline with fragments

- what format does the persister return newEntries after persisting sync or a gap fill?
    - a new fragment can be created during a limited sync
    - when doing a /context or /messages call, we could have joined with another fragment
    - don't think we need to describe a result spanning multiple fragments here
    so:

    in case of limited sync, we just say there was a limited sync, this is the fragment that was created for it so we can show a gap in the timeline

    in case of a gap fill, we need to return what was changed to the fragment (was it joined with another fragment, what's the new token), and which events were actually added.

we return entries! fragmentboundaryentry(start or end) or evententry. so looks much like the gaps we had before, but now they are not stored in the timeline store, but based on fragments.

- where do we translate from fragments to gap entries? and back? in the timeline object?
    that would make sense, that seems to be the only place we need that translation

# SortKey

so, it feels simpler to store fragmentId and eventIndex as fields on the entry instead of an array/arraybuffer in the field sortKey. Currently, the tiles code somewhat relies on having sortKeys but nothing too hard to change.

so, what we could do:
    - we create EventKey(fragmentId, eventIndex) that has the nextKey methods.
    - we create a class EventEntry that wraps what is stored in the timeline store. This has a reference to the fragmentindex and has an opaque compare method. Tiles delegate to this method. EventEntry could later on also contain methods like MatrixEvent has in the riot js-sdk, e.g. something to safely dig into the event object.
