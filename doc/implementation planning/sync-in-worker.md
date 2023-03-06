# Sync in worker
Currently, it's not possible to have the same session open in multiple Hydrogen instances (i.e. in multiple tabs, windows or iframes) since this would result in having multiple ongoing syncs for the same session. Having multiple ongoing syncs could corrupt data in `indexedDB` and would also not make sense from a resource utilisation perspective.

To prevent that multiple syncs are ongoing for the same session, a session-closing mechanism is implemented in the service worker: when a session is opened in an instance, the service worker tells all other instances to close that session, if they have it open.

From the user's perspective, this results in Hydrogen going back to the session picker screen when the session that was open in one tab is opened in another tab.

In this document, we propose a solution to address this limitation, making it possible to have the same session simultaneously open in multiple Hydrogen instances, while maintaining a fully-featured experience for the user.

We would be making the changes behind a feature flag, which would allows us to spread the implementation across multiple PRs, and iterate on the feature until we're confident that it's stable.

This proposal would also pave the way for having simultaneous ongoing syncs for multiple sessions (i.e. multiple accounts) in the future, though that's not a use case we would focus on at this point.

## Offload sync to worker

The general idea would be to have sync running in a [Web Worker](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API) instead of the main thread, while making it **transparent to UI code** (i.e. code running in the main thread), which should not be aware of whether sync is running in a worker or in the main thread. Making it transparent to UI code is important since we need to fallback to non-worker sync in environments where Web Workers are not available (e.g. IE11).

The UI thread would communicate with the sync worker through messages, possibly leveraging [`BroadcastChannel`](https://developer.mozilla.org/en-US/docs/Web/API/BroadcastChannel).

The worker must be active for as long as there's at least one tab/window/iframe with the session open. This means the sync worker must not be owned by a specific tab/window/iframe, since otherwise it would cease to run when its owner would be closed. There would be two strategies to address this:

1. The sync worker is a [dedicated worker](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Using_web_workers#dedicated_workers) and is spawned by the service worker. The sync worker would remain active for as long as the service worker is active. Since the service worker is always active, the sync worker would be guaranteed to be running at all times.
2. The sync worker is a [`SharedWorker`](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Using_web_workers#shared_workers) and is spawned by the first window/tab/iframe that creates an instance of it. Subsequent attempts to spawn the worker will return the already running instance. The sync worker would cease to run when all windows/tabs/iframes are closed.

Since it must continue to be possible to run Hydrogen without a service worker, 1. is excluded, which leaves us with 2.: **sync worker is a `SharedWorker`**.

At time of writing, `SharedWorkers` are still not available on many mobile environments (e.g. Chrome for Android), but it's fair to assume support for it will be coming in the (near?) future. Whenever `SharedWorkers` are not available, we would fallback to non-worker sync.

## Gracefully closing sessions
When the user closes a session (i.e. by opening a new session in the session picker), we cannot simply terminate the sync worker and re-spawn it for the new session, since it might be in the middle of a sync, which could corrupt the data in `indexedDB`.

There would be ways to work around this on the UI side (i.e. by waiting for the sync to finish before opening the new session), but this would require the UI side to be aware of whether a sync is in progress, which ideally should not be necessary.

An alternative solution would be to have a dedicated `Worker` per `sessionId`, which would be spawned by the `SharedWorker` described above. This would work as follows:

1. There's a single "sync pool" `SharedWorker` that all UI instances get a reference to. Will run as long as there's a reference to it.
2. The `SharedWorker` spawns one sync `Worker` per `sessionId`. This is the worker that will run the actual sync.
3. UI communicates with the `SharedWorker` by sending messages to it's `port`, e.g. `startSync` for session X, `stopSync` for session Y, etc.
4. Sync `Worker` communicates sync changes with UI through a `BroadcastChannel` scoped to a given `sessionId`. The UI side can then subscribe to that session's `BroadcastChanel`.

Opting for this "double worker" solution would also automatically provide support for having multiple simultaneous sessions down the line.

## `SyncProxy` (UI side)

`SyncProxy` would be the equivalent of `Sync` but would be a thin layer that *proxies* method calls to the worker, something like the following:

```typescript
// SyncProxy.ts

// Here we're extending Sync but it would make more sense to extract an ISync
// interface that both Sync and SyncProxy implement.
export class SyncProxy extends Sync {
    // Not a full implementation, just showcasing a method call.
    // In the final implementation all public methods of Sync would need to
    // be proxied.
    async start(args: object): Promise<object> {
        const result = await sendAndWaitForReply("start", args);
        if (result.error) {
            throw result.error;
        }
        return result.data;
    }
}
```

In environments where Web Workers are available, and if the feature flag is enabled, we would *swap* `Sync` with `SyncProxy`:

```javascript
// Client.js

if (window.Worker && syncFeatureFlagEnabled) {
    this._sync = new SyncProxy({...});
} else {
    this._sync = new Sync({...});
}
```

## `SyncWorker` (Worker side)

The sync worker would react to incoming messages, and perform different actions according to the type of message. For example, when receiving the `start` message, the worker would bootstrap an instance of `Sync` and start it:

```typescript

// SyncInWorker.ts
export class SyncInWorker extends Sync {
    // The need for this class will become clear in the next section.
}

// SyncWorker.ts
export class SyncWorker {
    // ...

    async onStartMessage(sessionId: string): Promise<object> {
        this._sync = new SyncInWorker({...});
        this._sync.start();

        // This would result in a reply being sent to `SyncProxy` running in
        // the main thread.
        return {started: true};
    }
}
```

## Propagating sync changes

The sync process happens roughly as follows:

1. Persist data to `indexedDB`.
2. Update `Session` in memory so it reflects the latest changes.

Since workers do not share memory with the main thread, the sync worker will have its own instance of `Session`, so changes to it will not be reflected in the main thread's `Session`. So we need a mechanism to update the main thread's `Session` whenever there have been sync changes.

We would do this by having the sync worker send messages to `SyncProxy` notifying of changes, and the `SyncProxy` would update the main thread's instance of `Session`:

```typescript
// SyncInWorker.ts

export class SyncInWorker extends Sync {
    // ...

    // Override base class method.
    _afterSync(sessionState, inviteStates, roomStates, archivedRoomStates, log) {
        // Send message(s) representing the sync changes.
        sendMessage("syncChanges", ...);
    }
}
```

```typescript
// SyncProxy.ts

export class SyncProxy extends Sync {
    // ...

    onChanges(data: object) {
        const sessionState = data.sessionState;
        this.session.foo = sessionState.bar;
    }
}
```

## No need to send changes from main thread to worker
When an action happens in the main thread (sending a message, creating a room, etc), there is no need to communicate that change to the worker or other windows/tabs/iframe, as that change would be retrieved in the next sync, and then propagated as described in the previous section.
