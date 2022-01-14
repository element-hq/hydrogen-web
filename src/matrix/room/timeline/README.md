# Timeline

## Nomenclature

 - Entry: an element that can be part of the timeline. This is either an event or a gap. When they are part of the timeline, entries are sorted by their fragmentId first, then their event index.
 - Tile: a view model around one or more entries. A tile will be rendered by one view.

## How are timeline updates propagated?

Most timeline updates are caused by either sync or a gap fill. These happen in `Room` and will call `Timeline.addEntries` for now entries and `Timeline.replaceEntries` for entries that where previously known to Hydrogen and received some kind of update. They may or may not have been loaded into the timeline already. Examples of what causes an update is: a relation was added to the target event, the event was redacted, the event was decrypted where it couldn't be before, ...

Also events that haven't been sent yet are shown in the timeline, always below the remote messages. These updates are triggered in `SendQueue` and passed through the `pendingEvents` observable list.

`Timeline` exposes an observable list with all (sorted) entries under the `entries` property. Additions, updates and removals are emitted over this collection, once subscribed.

### Context entries

Some messages in the timeline require another message to be able to display themselves. The only example of this currently is replies. When an entry is added to the timeline, it's `contextEventId` property will be checked. If it returns an id, we'll try to get the matching entry, either from the loaded messages, storage or the /context endpoint from the server.

Note that /context entries are not stored because [currently it is not possible](https://github.com/vector-im/hydrogen-web/pull/491) to detect overlap between timeline fragments created by sync and fragments created by /context, and storing events presumes it will be in a fragment. This means they can't be updated by the relation writer, as it assumes an entry is in storage. Hence for relation and redaction support, we reuse the local echo infrastructure (`entry.addLocalRelation()`) used already for pending events.

When the context entry is updated through `replaceEntries`, an update event will also be emitted for every entry in the timeline that uses the updated entry as context. An example is when a replied-to message is redacted, the reply entry will also emit an update.
