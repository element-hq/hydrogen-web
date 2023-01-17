remaining problems to resolve:

how to store timelime fragments that we don't yet know how they should be sorted wrt the other events and gaps. the case with event permalinks and showing the replied to event when rendering a reply (anything from /context).
    
    either we could put timeline pieces that were the result of /context in something that is not the timeline. Gaps also don't really make sense there ... You can just paginate backwards and forwards. Or maybe still in the timeline but in a different scope not part of the sortKey, scope: live, or scope: piece-1204. While paginating, we could keep the start and end event_id of all the scopes in memory, and set a marker on them to stitch them together?

    Hmmm, I can see the usefullness of the concept of timeline set with multiple timelines in it for this. for the live timeline it's less convenient as you're not bothered so much by the stitching up, but for /context pieces that run into the live timeline while paginating it seems more useful... we could have a marker entry that refers to the next or previous scope ... this way we could also use gap entries for /context timelines, just one on either end.

    the start and end event_id of a scope, keeping that in memory, how do we make sure this is safe taking transactions into account? our preferred strategy so far has been to read everything from store inside a txn to make sure we don't have any stale caches or races. Would be nice to keep this.

    so while paginating, you'd check the event_id of the event against the start/end event_id of every scope to see if stitching is in order, and add marker entries if so. Perhaps marker entries could also be used to stitch up rooms that have changed versioning?

    What does all of this mean for using sortKey as an identifier? Will we need to take scope into account as well everywhere?

    we'll need to at least contemplate how room state will be handled with all of the above.
    
how do we deal with the fact that an event can be rendered (and updated) multiple times in the timeline as part of replies. 

room state... 
