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
 - move all imports to non-default
 - remove #ifdef
 - move EventEmitter to utils
 - move all lower-cased files
 - change main.js to pass in a creation function of a SessionContainer instead of everything it is replacing 
 - show load progress in LoginView/SessionPickView and do away with loading screen
 - adjust BrawlViewModel, SessionPickViewModel and LoginViewModel to use a SessionContainer
 - DONE: rename SessionsStore to SessionInfoStorage
 - make sure we've renamed all \*State enums and fields to \*Status
 - add pendingMessageCount prop to SendQueue and Room, aggregate this in Session
 - add completedFirstSync to Sync, so we can check if the catchup or initial sync is still in progress
 - update SyncStatusViewModel to use reconnector.connectionStatus, sync.completedFirstSync, session.syncToken (is initial sync?) and session.pendingMessageCount to show these messages:
    - disconnected, retrying in x seconds. [try now].
    - reconnecting...
    - doing catchup sync
    - syncing, sending x messages
    - syncing

    perhaps we will want to put this as an ObservableValue on the SessionContainer ?

    NO: When connected, syncing and not sending anything, just hide the thing for now? although when you send messages it will just pop in and out all the time.

 - see if it makes sense for SendScheduler to use the same RetryDelay as Reconnector
 - finally adjust all file names to their class names? e.g. camel case
 - see if we want more dependency injection
    - for classes from outside sdk
    - for internal sdk classes? probably not yet
