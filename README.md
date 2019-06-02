# morpheusjs
A javascript matrix client prototype, trying to minize RAM usage by offloading as much as possible to IndexedDB

## Status

Syncing & storing rooms with state and timeline, with a minimal UI syncing room list and timeline on screen. Filling gaps supported, detecting overlapping events. The `[0/1]` in the gif below is the local event key, consisting of a fragment id and event index. No sending yet. Using Fractal here to update the room name and send messages:

![Rooms and timeline syncing on-screen, gaps filling](https://bwindels.github.io/morpheusjs/images/morpheus-gaps.gif)

## Features that this approach would be well suited for

 - store all fetched messages, not just synced ones
 - fast local search (with words index)
 - scroll timeline with date tooltip?
 - jump to timestamp
 - multi-account
