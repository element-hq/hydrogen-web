# Remaining stuffs
 - don't swallow send errors, they should probably appear in the room error?
    - not sure it makes sense to show them where the composer is,
      because they might get sent a long time after you enter them in brawl,
      so you don't neccessarily have the context of the composer anymore
 - local echo


takes care of rate limiting,
and sending events from different rooms in parallel,
NO: txnIds are created inside room. ~~making txnIds? ... it's rooms though that will receive the event in their sync response~~

EventSender:
    // used for all kinds of events (state, redaction, ...)
    sendEvent(roomId, pendingEvent...Entry?)

how will we do local echo?
    a special kind of entry? will they be added to the same list?

how do we store pending events?
    OBSOLETE, see PendingEvent below:
    separate store with:
        roomId
        txnId
        priority
        queueOrder
        partialEvent
        remoteEventId ? // once we've received a response, but haven't received the event through sync yet. would be nice if you refresh then, that the message doesn't disappear. Actually, we don't need the event id for that, just to only delete it when we receive something down the sync with the same transaction id?

// all the fields that might need to be sent to the server when posting a particular kind of event
PendingEvent
    queueOrder  //is this high enough to 
    priority //high priority means it also takes precedence over events sent in other rooms ... but how will that scheduling work?
    txnId
    type
    stateKey
    redacts
    content
    localRelatedId   //what's the id? queueOrder? e.g. this would be a local id that this event relates to. We might need an index on it to update the PendingEvent once the related PendingEvent is sent.
    blob: a blob that needs to be uploaded and turned into a mxc to put into the content.url field before sending the event
            there is also info.thumbnail_url
    blobMimeType? Or stored as part of blob?
    //blobUploadByteOffset: to support resumable uploads?

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
    - we could have callback on room for online/offline that is invoked by session, where they can start sending again?
        perhaps with a transaction already open on the pending_events store


How could the SendQueue update the timeline? By having an ObservableMap for it's entries in the queue
    Room
        SendQueue
        Timeline

steps of sending

```javascript
    //at some point:
    // sender is the thing that is shared across rooms to handle rate limiting.
    const sendQueue = new SendQueue({roomId, hsApi, sender, storage});
    await sendQueue.load();     //loads the queue?
                                //might need to load members for e2e rooms ...
                                //events should be encrypted before storing them though ...
 

    // terminology ...?
    // task: to let us wait for it to be our turn
    // given rate limiting
    class Sender {
        acquireSlot() {
            return new SendSlot();
        }
    }
    // terminology ...?
    // task: after waiting for it to be our turn given rate-limiting,
    // send the actual thing we want to send.
    // this should be used for all rate-limited apis... ? 
    class SendSlot {
        sendContent(content) {

        }

        sendRedaction() {

        }

        uploadMedia() {

        }
    }

    class SendQueue {
        // when trying to send
        enqueueEvent(pendingEvent) {
            // store event
            // if online and not running send loop
                // start sending loop
        }
        // send loop
        // findNextPendingEvent comes from memory or store?
        // if different object then in timeline, how to update timeline thingy?
        // by entryKey? update it?
        _sendLoop() {
            while (let pendingEvent = await findNextPendingEvent()) {
                pendingEvent.status = QUEUED;
                try {
                    const mediaSlot = await this.sender.acquireSlot();
                    const mxcUrl = await mediaSlot.uploadMedia(pendingEvent.blob);
                    pendingEvent.content.url = mxcUrl;
                    const contentSlot = await this.sender.acquireSlot();
                    contentSlot.sendContent(pendingEvent.content);
                    pendingEvent.status = SENDING;
                    await slot.sendContent(...);
                } catch (err) {
                    //offline
                }
                pendingEvent.status = SENT;
            }
        }

        resumeSending(online) {
            // start loop again when back online
        }

        // on sync, when received an event with transaction_id
        // the first is the transaction_id,
        // the second is the storage transaction to modify the pendingevent store if needed
        receiveRemoteEcho(txnId, txn) {

        }

        // returns entries? to be appended to timeline?
        // return an ObservableList here? Rather ObservableMap? what ID? queueOrder? that won't be unique over time?

        // wrt to relations and redactions, we will also need the list of current 
        // or we could just do a lookup of the local id to remote once
        // it's time to send an event ... perhaps we already have the txn open anyways.
        // so we will need to store the event_id returned from /send...
        // but by the time it's time to send an event, the one it relates to might already have been
        // remove from pendingevents?
        // maybe we should have an index on relatedId or something stored in pendingevents and that way
        // we can update it once the relatedto event is sent
        // ok, so we need an index on relatedId, not the full list for anything apart from timeline display? think so ...
        get entriesMap() {

        }

    }


    class Room {
        resumeSending(online) {
            if (online) {
                this.sendQueue.setOnline(online);
            }
        }
    }
```

we were thinking before of having a more lightweight structure to export from timeline, where we only keep a sorted list/set of keys in the collection, and we emit ranges of sorted keys that are either added, updated or removed. we could easily join this with the timeline and values are only stored by the TilesCollection. We do however need to peek into the queue to update local relatedTo ids.

probably best to keep send queue in memory.
so, persistence steps in sending:
    - get largest queueOrder + 1 as id/new queueOrder
        - the downside of this that when the last event is sent at the same time as adding a new event it would become an update? but the code paths being separate (receiveRemoteEcho and enqueueEvent) probably prevent this.
    - persist incoming pending event
    - update with remote id if relatedId for pending event
    - update once attachment(s) are sent
        - send in-memory updates of upload progress through pending event entry
        - if the media store supports resumable uploads, we *could* also periodically store how much was uploaded already. But the current REST API can't support this.
    - update once sent (we don't remove here until we've receive remote echo)
        - store the remote event id so events that will relate to this pending event can get the remote id through getRelateToId()
    - remove once remote echo is received

(Pending)EventEntry will need a method getRelateToId() that can return an instance of LocalId or something for unsent events

if we're not rate limited, we'll want to upload attachments in parallel with sending messages before attachee event.

so as long as not rate limited, we'd want several queues to send per room


```
   sender (room 1)
---------------------
  ^         ^
event1  attachment1
  ^         |
event2-------
```

later on we can make this possible, for now we just upload the attachments right before event.


so, we need to write:
RateLimitedSender
    all rate-limited rest api calls go through here so it can coordinate which ones should be prioritized and not
    do more requests than needed while rate limited. It will have a list of current requests and initially just go from first to last but later could implement prioritizing the current room, events before attachments, ... 
SendQueue (talks to store, had queue logic) for now will live under timeline as you can't send events for rooms you are not watching? could also live under Room so always available if needed
PendingEvent (what the store returns) perhaps doesn't even need a class? can all go in the entry
PendingEventEntry (conforms to Entry API)
    can have static helper functions to create given kind of events
        PendingEventEntry.stateEvent(type, stateKey, content)
        PendingEventEntry.event(type, content, {url: file, "info.thumbnail_url": thumb_file})
        PendingEventEntry.redaction(redacts)
PendingEventStore
    add()
    maxQueueOrder
    getAll()
    get()
    update()
    remove()

make sure to handle race between /sync and /send (e.g. /sync with sent event may come in before /send returns)
