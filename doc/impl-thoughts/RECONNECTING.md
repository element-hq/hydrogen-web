# Reconnecting

`HomeServerApi` notifies `Reconnecter` of network call failure

`Reconnecter` listens for online/offline event

`Reconnecter` polls `/versions` with a `RetryDelay` (implemented as ExponentialRetryDelay, also used by SendScheduler if no retry_after_ms is given)

`Reconnecter` emits an event when sync and message sending should retry

`Sync` listen to `Reconnecter`
`Sync` notifies when the catchup sync has happened

`Reconnecter` has state:
    - disconnected (and retrying at x seconds from timestamp)
    - reconnecting (call /versions, and if successful /sync)
    - connected

`Reconnecter` has a method to try to connect now

`SessionStatus` can be:
    - disconnected (and retrying at x seconds from timestamp)
    - reconnecting
    - connected (and syncing)

    - doing catchup sync
    - sending x / y messages

rooms should report how many messages they have queued up, and each time they sent one?

`SendReporter` (passed from `Session` to `Room`, passed down to `SendQueue`), with:
 - setPendingEventCount(roomId, count)

`Session` listens to `Reconnecter` to update it's status, but perhaps we wait to send messages until catchup sync is done
