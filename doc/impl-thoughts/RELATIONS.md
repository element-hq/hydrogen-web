Relations and redactions

events that refer to another event will need support in the SyncWriter, Timeline and SendQueue I think.
SyncWriter will need to resolve the related remote id to a [fragmentId, eventIndex] and persist that on the event that relates to some other. Same for SendQueue? If unknown remote id, not much to do. However, once the remote id comes in, how do we handle it correctly? We might need a index on m.relates_to/event_id?

The timeline can take incoming events from both the SendQueue and SyncWriter, and see if their related to fragmentId/eventIndex is in view, and then update it?

alternatively, SyncWriter/SendQueue could have a section with updatedEntries apart from newEntries?

SendQueue will need to pass the non-sent state (redactions & relations) about an event that has it's remote echo received to the SyncWriter so it doesn't flash while redactions and relations for it still have to be synced.

Also, related ids should be processed recursively. If event 3 is a redaction of event 2, a reaction to event 1, all 3 entries should be considered as updated.

As a UI for reactions, we could show (👍 14 + 1) where the + 1 is our own local echo (perhaps style it pulsating and/or in grey?). Clicking it again would just show 14 and when the remote echo comes in it would turn into 15.
