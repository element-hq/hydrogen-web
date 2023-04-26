If we were to render replies in a smart way (instead of relying on the fallback), we would
need to manually find entries that are pointed to be `in_reply_to`. Consulting the timeline
code, it seems appropriate to add a `_replyingTo` field to a `BaseEventEntry` (much like we
have `_pendingAnnotations` and `pendingRedactions`). We can then:
* use `TilesCollection`'s `_findTileIdx` to find the tile of the message being replied to,
  and put a reference to its tile into the new tile being created (?).
  * It doesn't seem appropriate to add an additional argument to TileCreator, but we may
    want to re-use tiles instead of creating duplicate ones. Otherwise, of course, `tileCreator`
    can create more than one tile from an entry's `_replyingTo` field.
* Resolve `_replyingTo` much like we resolve `redactingEntry` in timeline: search by `relatedTxnId`
  and `relatedEventId` if our entry is a reply (we can add an `isReply` flag there).
  * This works fine for local entries, which are loaded via an `AsyncMappedList`, but what
    about remote entries? They are not loaded asynchronously, and the fact that they are
    not a derived collection is used throughout `Timeline`.
* Entries that don't have replies that are loadeded (but that are replies) probably need
  to be tracked somehow?
  * Then, on timeline add, check new IDs and update corresponding entries
