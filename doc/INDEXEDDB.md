## Promises, async/await and indexedDB

Doesn't indexedDB close your transaction if you don't queue more requests from an idb event handler?
So wouldn't that mean that you can't use promises and async/await when using idb?

It used to be like this, and for IE11 on Win7 (not on Windows 10 strangely enough), it still is like this.
Here we manually flush the promise queue synchronously at the end of an idb event handler.

In modern browsers, indexedDB transactions should only be closed after flushing the microtask queue of the event loop,
which is where promises run.

Keep in mind that indexedDB events, just like any other DOM event, are fired as macro tasks.
Promises queue micro tasks, of which the queue is drained before proceeding to the next macro task.
This also means that if a transaction is completed, you will only receive the event once you are ready to process the next macro tasks.
That doesn't prevent any placed request from throwing TransactionInactiveError though.

## TransactionInactiveError in Safari

Safari doesn't fully follow the rules above, in that if you open a transaction,
you need to "use" (not sure if this means getting a store or actually placing a request) it straight away,
without waiting for any *micro*tasks. See comments about Safari at https://github.com/dfahlander/Dexie.js/issues/317#issue-178349994.

Another failure mode perceived in Hydrogen on Safari is that when the (readonly) prepareTxn in sync wasn't awaited to be completed before opening and using the syncTxn.
I haven't found any documentation online about this at all. Awaiting prepareTxn.complete() fixed the issue below. It's strange though the put does not fail.

## Diagnose of problem

What is happening below is:
 - in the sync loop:
    - we first open a readonly txn on inboundGroupSessions, which we don't use in the example below
    - we then open a readwrite txn on session, ... (does not overlap with first txn)
        - first the first incremental sync on a room (!YxKeAxtNcDZDrGgaMF:matrix.org) it seems to work well
        - on a second incremental sync for that same room, the first get throws TransactionInactiveError for some reason.
        - the put in the second incremental sync somehow did not throw.

So it looks like safari doesn't like (some) transactions still being active while a second one is being openened, even with non-overlapping stores.
For now I haven't awaited every read txn in the app, as this was the only place it fails, but if this pops up again in safari, we might have to do that.

Keep in mind that the `txn ... inactive` logs are only logged when the "complete" or "abort" events are processed,
which happens in a macro task, as opposed to all of our promises, which run in a micro task.
So the transaction is likely to have closed before it appears in the logs.

```
[Log] txn 4504181722375185 active on inboundGroupSessions
[Log] txn 861052256474256 active on session, roomSummary, roomState, roomMembers, timelineEvents, timelineFragments, pendingEvents, userIdentities, groupSessionDecryptions, deviceIdentities, outboundGroupSessions, operations, accountData
[Info] hydrogen_session_5286139994689036.session.put({"key":"sync","value":{"token":"s1572540047_757284957_7660701_602588550_435736037_1567300_101589125_347651623_132704","filterId":"2"}})
[Info] hydrogen_session_5286139994689036.userIdentities.get("@bwindels:matrix.org")
[Log] txn 4504181722375185 inactive
[Log]  * applying sync response to room !YxKeAxtNcDZDrGgaMF:matrix.org ...
[Info] hydrogen_session_5286139994689036.roomMembers.put({"roomId":"!YxKeAxtNcDZDrGgaMF:matrix.org","userId":"@bwindels:matrix.org","membership":"join","avatarUrl":"mxc://matrix.org/aerWVfICBMcyFcEyREcivLuI","displayName":"Bruno","key":"!YxKeAxtNcDZDrGgaMF:matrix.org|@bwindels:matrix.org"})
[Info] hydrogen_session_5286139994689036.roomMembers.get("!YxKeAxtNcDZDrGgaMF:matrix.org|@bwindels:matrix.org")
[Info] hydrogen_session_5286139994689036.timelineEvents.add({"fragmentId":0,"eventIndex":2147483658,"roomId":"!YxKeAxtNcDZDrGgaMF:matrix.org","event":{"content":{"body":"haha","msgtype":"m.text"},"origin_server_ts":1601457573756,"sender":"@bwindels:matrix.org","type":"m.room.message","unsigned":{"age":8360},"event_id":"$eD9z73-lCpXBVby5_fKqzRZzMVHiPzKbE_RSZzqRKx0"},"displayName":"Bruno","avatarUrl":"mxc://matrix.org/aerWVfICBMcyFcEyREcivLuI","key":"!YxKeAxtNcDZDrGgaMF:matrix.org|00000000|8000000a","eventIdKey":"!YxKeAxtNcDZDrGgaMF:matrix.org|$eD9z73-lCpXBVby5_fKqzRZzMVHiPzKbE_RSZzqRKx0"})
[Info] hydrogen_session_5286139994689036.roomSummary.put({"roomId":"!YxKeAxtNcDZDrGgaMF:matrix.org","name":"!!!test8!!!!!!","lastMessageBody":"haha","lastMessageTimestamp":1601457573756,"isUnread":true,"encryption":null,"lastDecryptedEventKey":null,"isDirectMessage":false,"membership":"join","inviteCount":0,"joinCount":2,"heroes":null,"hasFetchedMembers":false,"isTrackingMembers":false,"avatarUrl":null,"notificationCount":5,"highlightCount":0,"tags":{"m.lowpriority":{}}})
[Log] txn 861052256474256 inactive
[Info] syncTxn committed!!

... two more unrelated sync responses ...

[Log] starting sync request with since s1572540191_757284957_7660742_602588567_435736063_1567300_101589126_347651632_132704 ...
[Log] txn 8104296957004707 active on inboundGroupSessions
[Log] txn 2233038992157489 active on session, roomSummary, roomState, roomMembers, timelineEvents, timelineFragments, pendingEvents, userIdentities, groupSessionDecryptions, deviceIdentities, outboundGroupSessions, operations, accountData
[Info] hydrogen_session_5286139994689036.session.put({"key":"sync","value":{"token":"s1572540223_757284957_7660782_602588579_435736078_1567300_101589130_347651633_132704","filterId":"2"}})
[Log]  * applying sync response to room !YxKeAxtNcDZDrGgaMF:matrix.org ...
[Info] hydrogen_session_5286139994689036.roomMembers.get("!YxKeAxtNcDZDrGgaMF:matrix.org|@bwindels:matrix.org")
[Warning] stopping sync because of error
[Error] StorageError: get("!YxKeAxtNcDZDrGgaMF:matrix.org|@bwindels:matrix.org") failed on txn with stores accountData, deviceIdentities, groupSessionDecryptions, operations, outboundGroupSessions, pendingEvents, roomMembers, roomState, roomSummary, session, timelineEvents, timelineFragments, userIdentities on hydrogen_session_5286139994689036.roomMembers: (name: TransactionInactiveError) (code: 0) Failed to execute 'get' on 'IDBObjectStore': The transaction is inactive or finished.
    (anonymous function)
    asyncFunctionResume
    (anonymous function)
    promiseReactionJobWithoutPromise
    promiseReactionJob
[Log] newStatus – "SyncError"
[Log] txn 8104296957004707 inactive
[Log] txn 2233038992157489 inactive
```
