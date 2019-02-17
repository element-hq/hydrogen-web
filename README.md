# morpheusjs
A javascript matrix client prototype, trying to minize RAM usage by offloading as much as possible to IndexedDB

## Status

Syncing & storing rooms with state and timeline, next step is building minimal UI

## Troubleshooting

You need to disable the browser cache to see your updated code when refreshing

## Features that this approach would be well suited for

 - store all fetched messages, not just synced ones
 - fast local search (with words index)
 - scroll timeline with date tooltip?
 - jump to timestamp