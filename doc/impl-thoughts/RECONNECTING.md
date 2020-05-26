# Reconnecting

`HomeServerApi` notifies `Reconnector` of network call failure

`Reconnector` listens for online/offline event

`Reconnector` polls `/versions` with a `RetryDelay` (implemented as ExponentialRetryDelay, also used by SendScheduler if no retry_after_ms is given)

`Reconnector` emits an event when sync and message sending should retry

`Sync` listen to `Reconnector`
`Sync` notifies when the catchup sync has happened

`Reconnector` has state:
    - disconnected (and retrying at x seconds from timestamp)
    - reconnecting (call /versions, and if successful /sync)
    - connected

`Reconnector` has a method to try to connect now

`SessionStatus` can be:
    - disconnected (and retrying at x seconds from timestamp)
    - reconnecting
    - connected (and syncing)

    - doing catchup sync
    - sending x / y messages

rooms should report how many messages they have queued up, and each time they sent one?

`SendReporter` (passed from `Session` to `Room`, passed down to `SendQueue`), with:
 - setPendingEventCount(roomId, count). This should probably use the generic Room updating mechanism, e.g. a pendingMessageCount on Room that is updated. Then session listens for this in `_roomUpdateCallback`.

`Session` listens to `Reconnector` to update it's status, but perhaps we wait to send messages until catchup sync is done


# TODO

 - DONE: finish (Base)ObservableValue 
    - put in own file
    - add waitFor (won't this leak if the promise never resolves?)
    - decide whether we want to inherit (no?)
 - DONE: cleanup Reconnector with recent changes, move generic code, make imports work
 - DONE: add SyncStatus as ObservableValue of enum in Sync
 - DONE: cleanup SessionContainer
 - DONE: move all imports to non-default
 - DONE: remove #ifdef
 - DONE: move EventEmitter to utils
 - DONE: move all lower-cased files
 - DONE: change main.js to pass in a creation function of a SessionContainer instead of everything it is replacing 
 - DONE: adjust BrawlViewModel, SessionPickViewModel and LoginViewModel to use a SessionContainer
 - DONE: show load progress in LoginView/SessionPickView and do away with loading screen
 - DONE: rename SessionsStore to SessionInfoStorage
 - make sure we've renamed all \*State enums and fields to \*Status
 - add pendingMessageCount prop to SendQueue and Room, aggregate this in Session
 - DONE: add completedFirstSync to Sync, so we can check if the catchup or initial sync is still in progress
 - DONE: update SyncStatusViewModel to use reconnector.connectionStatus, sync.completedFirstSync, session.syncToken (is initial sync?) and session.pendingMessageCount to show these messages:
    - DONE: disconnected, retrying in x seconds. [try now].
    - DONE: reconnecting...
    - DONE: doing catchup sync
    - syncing, sending x messages
    - DONE: syncing

    perhaps we will want to put this as an ObservableValue on the SessionContainer ?

    NO: When connected, syncing and not sending anything, just hide the thing for now? although when you send messages it will just pop in and out all the time.

 - see if it makes sense for SendScheduler to use the same RetryDelay as Reconnector
 - DONE: finally adjust all file names to their class names? e.g. camel case
 - see if we want more dependency injection
    - for classes from outside sdk
    - for internal sdk classes? probably not yet




thought: do we want to retry a request a couple of times when we can't reach the server before handing it over to the reconnector? Not that some requests may succeed while others may fail, like when matrix.org is really slow, some requests may timeout and others may not. Although starting a service like sync while it is still succeeding should be mostly fine. Perhaps we can pass a canRetry flag to the HomeServerApi that if we get a ConnectionError, we will retry. Only when the flag is not set, we'd call the Reconnector. The downside of this is that if 2 parts are doing requests, 1 retries and 1 does not, and the both requests fail, the other part of the code would still be retrying when the reconnector already kicked in. The HomeServerApi should perhaps tell the retryer if it should give up if a non-retrying request already caused the reconnector to kick in?

CatchupSync should also use timeout 0, in case there is nothing to report we spend 30s with a catchup spinner. Riot-web sync also says something about using a 0 timeout until there are no more to_device messages as they are queued up by the server and not all returned at once if there are a lot? This is needed for crypto to be aware of all to_device messages.

We should have a persisted observable value on Sync `syncCount` that just increments with every sync. This way would have other parts of the app, like account data, observe this and take action if something hasn't synced down within a number of syncs. E.g. account data could assume local changes that got sent to the server got subsequently overwritten by another client if the remote echo didn't arrive within 5 syncs, and we could attempt conflict resolution or give up. We could also show a warning that there is a problem with the server if our own messages don't come down the server in x syncs. We'd need to store the current syncCount with pieces of pending data like account data and pendingEvents.

Are overflows of this number a problem to take into account? Don't think so, because Number.MAX_SAFE_INTEGER is 9007199254740991, so if you sync on average once a second (which you won't, as you're offline often) it would take Number.MAX_SAFE_INTEGER/(3600*24*365) = 285616414.72415626 years to overflow.
