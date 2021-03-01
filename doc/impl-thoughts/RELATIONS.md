Relations and redactions

events that refer to another event will need support in the SyncWriter, Timeline and SendQueue I think.
SyncWriter will need to resolve the related remote id to a [fragmentId, eventIndex] and persist that on the event that relates to some other. Same for SendQueue? If unknown remote id, not much to do. However, once the remote id comes in, how do we handle it correctly? We might need a index on m.relates_to/event_id? I'd rather avoid that if possible, as that becomes useless once we have the target event of the relationship (we store the relations on the target event (see "One fetch" below) and have the target event id on the relation so can go both ways). We should look into what part of the relationships will be present on the event once it is received from the server (e.g. m.replace might be evident, but not all the reaction events?). If not, we could add a object store with missing relation targets.

The timeline can take incoming events from both the SendQueue and SyncWriter, and see if their related to fragmentId/eventIndex is in view, and then update it?

alternatively, SyncWriter/SendQueue could have a section with updatedEntries apart from newEntries?

SendQueue will need to pass the non-sent state (redactions & relations) about an event that has it's remote echo received to the SyncWriter so it doesn't flash while redactions and relations for it still have to be synced.

Also, related ids should be processed recursively. If event 3 is a redaction of event 2, a reaction to event 1, all 3 entries should be considered as updated.

As a UI for reactions, we could show (👍 14 + 1) where the + 1 is our own local echo (perhaps style it pulsating and/or in grey?). Clicking it again would just show 14 and when the remote echo comes in it would turn into 15.

## One fetch for timeline reading

wrt to how to store relations in indexeddb, we could store all local ids of related events (per type?) on the related-to event, so we can fetch them in one query for *all* events that have related events that were fetched in a range, without needing another index that would slow down writes. So that would only add 1 query which we only need to do when there are relations in the TimelineReader. what do we do though if we receive the relating event before the related-to event? An index would fix this mostly ... or we need a temp store where we store unresolved relations...

Replies should definitely use this relation mechanism, so we can easily show the most up to date version of the replied-to event.

Redactions can de done separately
