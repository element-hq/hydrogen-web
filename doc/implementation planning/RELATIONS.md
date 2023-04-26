Relations and redactions

events that refer to another event will need support in the SyncWriter, Timeline and SendQueue I think.
SyncWriter will need to resolve the related remote id to a [fragmentId, eventIndex] and persist that on the event that relates to some other. Same for SendQueue? If unknown remote id, not much to do. However, once the remote id comes in, how do we handle it correctly? We might need a index on m.relates_to/event_id? I'd rather avoid that if possible, as that becomes useless once we have the target event of the relationship (we store the relations on the target event (see "One fetch" below) and have the target event id on the relation so can go both ways). I'm not sure this index will be completely useless actually. For edits, we'll want to be able to list all edits. For reactions, we'll want to fetch the authors and timestamps. For replies, we want to render the origin event and not use the fallback text? It is true though that only a minority of the events will have a related_to event id, so I wonder if it is faster to put it in a different store? Perhaps a prototype can clarify ...

`event_relations` store could be this:

{
	sourceEventId:
	targetEventId:
	rel_type:
	roomId: 
}

`{"key": "!bEWtlqtDwCLFIAKAcv:matrix.org|$apmyieZOI5vm4DzjEFzjbRiZW9oeQQR21adM6A6eRwM|m.annotation|m.reaction|$jSisozR3is5XUuDZXD5cyaVMOQ5_BtFS3jKfcP89MOM"}`

or actually stored like `roomId|targetEventId|rel_type|sourceEventId`. How can we get the last edit? They are sorted by origin_server_ts IIRC? Should this be part of the key? Solved: we store the event id of a replacement on the target event

We should look into what part of the relationships will be present on the event once it is received from the server (e.g. m.replace might be evident, but not all the reaction events?). If not, we could add a object store with missing relation targets.

The timeline can take incoming events from both the SendQueue and SyncWriter, and see if their related to fragmentId/eventIndex is in view, and then update it?

alternatively, SyncWriter/SendQueue could have a section with updatedEntries apart from newEntries?

SendQueue will need to pass the non-sent state (redactions & relations) about an event that has it's remote echo received to the SyncWriter so it doesn't flash while redactions and relations for it still have to be synced.

Also, related ids should be processed recursively. If event 3 is a redaction of event 2, a reaction to event 1, all 3 entries should be considered as updated.

As a UI for reactions, we could show (👍 14 + 1) where the + 1 is our own local echo (perhaps style it pulsating and/or in grey?). Clicking it again would just show 14 and when the remote echo comes in it would turn into 15.

## One fetch for timeline reading

wrt to how to store relations in indexeddb, we could store all local ids of related events (per type?) on the related-to event, so we can fetch them in one query for *all* events that have related events that were fetched in a range, without needing another index that would slow down writes. So that would only add 1 query which we only need to do when there are relations in the TimelineReader. what do we do though if we receive the relating event before the related-to event? An index would fix this mostly ... or we need a temp store where we store unresolved relations...

Replies should definitely use this relation mechanism, so we can easily show the most up to date version of the replied-to event.

Redactions can de done separately

For replies (or references in general?), we do need to load the referred-to event in a second read. For reactions and edits, they will already be stored on the target event.


## Example events from the wild

### Reaction

```json
{
  "content": {
    "m.relates_to": {
      "event_id": "$apmyieZOI5vm4DzjEFzjbRiZW9oeQQR21adM6A6eRwM",
      "key": "👍️",
      "rel_type": "m.annotation"
    }
  },
  "origin_server_ts": 1621284357314,
  "sender": "@charly:matrix.org",
  "type": "m.reaction",
  "unsigned": {
    "age": 64140856
  },
  "event_id": "$jSisozR3is5XUuDZXD5cyaVMOQ5_BtFS3jKfcP89MOM",
  "room_id": "!bEWtlqtDwCLFIAKAcv:matrix.org"
}
```

### Edit

```json
{
  "content": {
    "body": " * ...",
    "m.new_content": {
      "body": "...",
      "msgtype": "m.text"
    },
    "m.relates_to": {
      "event_id": "$OXL0yk18y-VG3DuTybVh9j9cvdjjnnzWbBKY-QPXJ-0",
      "rel_type": "m.replace"
    },
    "msgtype": "m.text"
  },
  "origin_server_ts": 1621264902371,
  "room_id": "!bEWtlqtDwCLFIAKAcv:matrix.org",
  "sender": "@alice:matrix.org",
  "type": "m.room.message",
  "unsigned": {
    "age": 83636544
  },
  "event_id": "$Z7sFSKWtLTFoMMabkPFe0PSKWpkakjWUkYQeBU8IHVc",
  "user_id": "@alice:matrix.org",
  "age": 83636544
}
```

### Reply
```json
{
  "content": {
    "body": "...",
    "format": "org.matrix.custom.html",
    "formatted_body": "...",
    "m.relates_to": {
      "m.in_reply_to": {
        "event_id": "$rGD9iQ93UmopkkagJ0tW_FHATa8IrvABg9cM_tNUvu4"
      }
    },
    "msgtype": "m.text"
  },
  "origin_server_ts": 1621242338597,
  "room_id": "!bEWtlqtDwCLFIAKAcv:matrix.org",
  "sender": "@bob:matrix.org",
  "type": "m.room.message",
  "unsigned": {
    "age": 106408661,
    "m.relations": {
      "m.annotation": {
        "chunk": [
          {
            "type": "m.reaction",
            "key": "👍️",
            "count": 1
          }
        ]
      }
    }
  },
  "event_id": "$yS_n5n3cIO2aTtek0_2ZSlv-7g4YYR2zKrk2mFCW_q4",
  "user_id": "@bob:matrix.org",
  "age": 106408661
}
```

### Remaining spec issues

 - m.in_reply_to vs rel_type
 - reactions in unsigned can't be deduplicated
 - how to sort edits? for now we went with origin_server_ts
 - do we say anything about events of a different type replacing an event?
 - do we specify that replies should be to the original event, not the edit?

## What to store denormalized on the event itself?

```json
{
 	"reactions": {
 		"👍": {"count": 3, "me": true, "firstTimestamp": 2323989},
 		"👋": {"count": 1, "me": false, "firstTimestamp": 2323989}
 	},
 	"replacingEvent": {
 		"event_id": "$abc",
 		"origin_server_ts": ?,
 		"content": {}
 	}
}
```

we only need the m.new_content and event id of the replacing event, even timestamp we can load the event for on hover?


store the replacing event along the original event because we need to keep the original event along somewhere, but for displaying purposes, we'd use the content of the replacingEvent. Should we just store the content of the replacing event? Or even just the `m.new_content`? Could make sense, but perhaps also store the new timestamp along. How about whem somebody than the sender edits?

# Aggregation

what do we do with the aggregated timestamps? do we store them? if so, where?

when we hover reactions, we want to show the authors, rather than the timestamp, so we'll need to call /relations for that anyway. so no need to store the timestamp?

`/relations` is in fact a bit the server-side version of our `event_relations` store

## Dealing with gappy syncs

Doesn't look like synapse currently tells us which target events have outdates relations after a gappy sync. MSC 2675 proposes `stale_events`, but inspecting network traffic, that doesn't seem to be implemented right now.

So, if we locally would need to determine if relations are outdated, we could look if any of the fragments between an event and the last synced event have pagination tokens. Although we have no way to clear this "flag" if we were to fetch the relations after this.

As an initial cut it is probably fine if reactions and edits are outdated unless you scroll up all the way to an event (and hence back-fill), as this is what we'll always do (apart from permalinks).

### Permalinks

So once we do support permalinks, how do we solve this? Element solves this by not storing `/context` and the `/messages` requests around, hence it is always fresh.

We could store the live fragment id in events when we refresh their `/relations`, and if it is not the current live fragment id, you're outdated.

To accurately display anything not in the live fragment, we either need to:
 - backfill until there are no more gaps between the event fragment and the live fragment.
 	- --  there is no way to know how many events this would load.
 	- ++  that we know which gaps we've already filled
 	- ++  we need to do this for e2ee rooms anyway
 	- ++  we need to implement this anyway for non-gappy sync
 	- ++  we can only do this as an initial cut, especially as we don't support permalinks yet
 - Refetch the `/context` and `/messages` for what is on the screen and reconcile.
 	- ++  we know how much we'll fetch
 	- --  we need to fetch everything again if we have one small gap
 	- we store the current live fragment when doing this, so can know:
 		- if we need to refetch / if there is a gap
 		- how many gaps we need to fill
 	- could we fall back to this strategy if the first one takes too long/many events?
 	- we could pick a heuristic to pick either strategy (like time between syncs or try for x events and if the gap is not closed, give up)?
 - Refetch /aggregations for every event
 	- ++  we don't get the events (we dont need? edits?)
 	- --- need to do it for every event
 - use `stale_events` if we actually implement it one day
 	- this can work well with the first strategy, we'd store a "relationsStale" flag on the event, and refetch /relations immediately or  if scrolled into view.

# API

## Reactions

```js
const reaction = eventEntry.react("👍");
room.sendEvent("m.reaction", reaction);
```

```js
// this is an ObservableMap mapping the key to the count (or rather SortedArray?)
// probably fine to just use a SortedArray to sorts by count, then key
// actually, maybe better to do ObservableMap and store first timestamp so we can support https://github.com/vector-im/element-web/issues/9698 outside of SDK.
const reactions = eventEntry.reactions.sortValues((r1, r2) => r1.count - r2.count);
new ListView({list: reactions}, reaction => new ReactionView(reaction, room));
// reaction has:
reaction.key
reaction.hasMyReaction // how do we get this from the bundled events?
reaction.count
reaction.firstTimestamp
room.sendEvent("m.reaction", reaction.react());
// this won't work as we don't have the event id:
// room.sendRedaction(reaction.redact());
```

## Edits

```js
const replacement = eventEntry.replace({});
room.sendEvent(eventEntry.eventType, replacement);
```

## Replies

```js
const reply = eventEntry.createReplyContent({});
room.sendEvent("m.room.message", reply);
```

## Redactions

```js
const redaction = eventEntry.redact();
room.sendRedaction(redaction);
```

All off these reaction and edit entries should probably not be live, and at some point in the future if we need them to be live for some use case, we can add an additional api to make them live with an explicit release mechanism?
```js

// there is no api to get the reactions by sender though, so perhaps we need to load them all and then find our own?
const reactions = await eventEntry.getReactionEntries("👍");
const reaction = reactions.find(r => r.sender = ownUserId);
room.sendRedaction(reaction.redact());
```

```js
const edits = await eventEntry.getEdits();
room.sendRedaction(edits[1].redact());
```

```js
const lastEdit = await eventEntry.getLastEdit();
room.sendRedaction(lastEdit.redact());
```

