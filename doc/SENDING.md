takes care of rate limiting,
and sending events from different rooms in parallel,
NO: txnIds are created inside room. ~~making txnIds? ... it's rooms though that will receive the event in their sync response~~

EventSender:
    // used for all kinds of events (state, redaction, ...)
    sendEvent(roomId, pendingEvent...Entry?)

how will we do local echo?
    a special kind of entry? will they be added to the same list?

how do we store pending events?
    separate store with:
        roomId
        txnId
        priority
        queueOrder
        partialEvent
        remoteEventId ? // once we've received a response, but haven't received the event through sync yet. would be nice if you refresh then, that the message doesn't disappear. Actually, we don't need the event id for that, just to only delete it when we receive something down the sync with the same transaction id?

// all the fields that might need to be sent to the server when posting a particular kind of event
PendingEvent
    queueOrder
    priority //high priority means it also takes precedence over events sent in other rooms ... but how will that scheduling work?
    txnId
    type
    stateKey
    redacts
    content
    blobUploadByteOffset: to support resumable uploads?
    blob: a blob that needs to be uploaded and turned into a mxc to put into the content.url field before sending the event
            there is also info.thumbnail_url

so when sending an event, we don't post a whole object, just the content, or a state key and content, or a redacts id.
however, it's somewhat interesting to pretend an event has the same structure before it is sent, then when it came down from the server, so all the logic can reuse the same structure...

we could potentially have a PendingEventEntry, that shares most of its API with EventEntry ... but is there a good reason to do so?
    PendingEvent would be a bit less hackish this way
    we could have a base class shared between PendingEventEntry and EventEntry to do most of the work, and only have things like getStateKey, getContent, ... in the subclasses? 

    wrt to pending events in the timeline, their entry would have a special fragmentId, always placing them behind the last "real" event, and the queueOrder could be the entryIndex.
    how will local echo work for:
        relations
            this would depend a lot on how relations work ... I guess the only relevant part is that aggregation can be undo, and redone
        redactions
            again, depends a lot on how redactions would be implemented. somehow 
        images (that are uploading)
            we could have a createUrl/destroyUrl method? returns local blob url for pending event
            and also an optional progress method?

how will the EventSender tell the rooms to start submitting events again when coming online again after being offline for a while?
we'll need to support some states for the UI:
    - offline
    - queued
    - uploading attachment ?
    - sending
    - sent

offline is an external factor ... we probably need to deal with it throughout the app / matrix level in some way ...
