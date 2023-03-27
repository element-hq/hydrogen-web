# TODO

## Member list

 - support migrations in StorageFactory
 - migrate all stores from key to key_path
 - how to deal with members coming from backfill? do we even need to store them?

# How to store members?

All of this is assuming we'll use lazy loading of members.

Things we need to persist per member

 - (user id)
 - (room id)
 - avatar url
 - display name

## Historical members

store name: historical_members

### Without include_redundant_members

To show the correct (historical) display name and avatar next to a message, we need to manage historical members. If we don't set include_redundant_members as a filter, we'll need to track members per fragment, backwards and forwards looking, so we can find out which member to use for redundant members not included in the /messages response. E.g., if we have this timeline:
```
    ] gap #1 ]
    [ messages ]
    [ gap #2 ]
    [ live messages ]
```

When expanding gap #1, we store the members. After that, we expand gap #2.
How do we know if the members already present are from gap #1 (and thus we need to replace them as gap #2 is later)
or live member changes at the bottom of the timeline (not to be overwritten as gap #2 comes before it).

We can store the fragmentId with a member? This is not enough, as somebody can change their display name in the middle of a fragment. We'd need a forward and backward pointing member per fragment.

```
room_id
fragment_id
forward
avatar_url
display_name
```
It would be good not to duplicate events too much.
We just need these for the extremities though... 

I'm assuming `/context` will contain all members, as chronological relation with other chunks can't be assumed by clients? Looking at the riot code, this indeed seems to be the case.


#### Avoiding duplication of members

Ideally, historical_members would fall back on members to not duplicate all the member events. So the forward members for the sync fragment would be taking from the `members` store. Anytime we have a limited sync, this would be put in the backwards look members for the new sync fragment. If we then backpaginate, we can get our members from there. But we also don't want to duplicate the members between forward and backward looking members per fragment, so if they are the same, we only store it as forward. If the fragment is live, it comes from the `members` store.

This would mean that for fragments in the sync island:
    - for members that change within a fragment
        - we store the old member as backwards member,
        - we store the new member as forward if not live fragment or if live in `members`
    - when the live fragment changes, the old fragment forward looking members still need to point to the `members`? but those will change over time ... so need to be duplicated at the time of limited sync response? hmmmm

### With include_redundant_members

More data in response

we just set `include_redundant_members` and `/messages` and `/context` contain all their own members, which can be written to the event, and we track a partial member list from /sync, that can later be completed with /joined_members. This is *a lot* simpler.

If we go for this, we might want to think of a migration step to remove include_redundant_members? Well, maybe not before 1.0

IMPORTANT: I'm not sure that with `include_redundant_members` all the member state events will be included in the sync response, we need to test this.

## Member list

store name: members

We need to be able to get a list of all most recent members, and are not interested in historical members. We need it for:
 - tracking devices for sending e2ee messages
 - showing the member list
 - member auto-completion from the composer

Once we decide to start tracking all members (when any of the above cases is triggered for the first time), we load all members with `/members?at=`, and keep updating it with the state and timeline state events of incoming /sync responses. Any member already stored should be replaced. We should have an index on roomId, and on [roomId, userId].


We need historical members (only) for the timeline, so either:
 - we store the avatar url and display name on each event
 - we need to store all versions of a member (and keep an in-memory cache to not have to read from yet another store while loading the timeline)

## General room state

We won't store `m.room.members` as room state. Any other state events should be stored in a separate store indexed by [roomId, eventType, stateKey].


----



Note that with lazy loading, we don't need all members to show the timeline, as the relevant state is passed in /sync and /messages (not true without include_redundant_members?). This state can be persisted in the members table, and we'll need a flag in room summary whether *all* members have been loaded. We'd insert in two ways:
 - appending timeline, replace any members already there
 - prepending timeline, don't touch members already there...    
    this won't work with multiple gaps though, if we have this timeline:

    ] gap #1 ]
    [ messages ]
    [ gap #2 ]
    [ live messages ]

    when expanding gap #1, we store the members. After that, we expand gap #2.
    How do we know if the members already present are from gap #1 (and thus we need to replace them as gap #2 is later)
    or live member changes at the bottom of the timeline (not to be overwritten as gap #2 comes before it).

    We can store the fragmentId with a member? This is not enough, as somebody can change their display name in the middle of a fragment. We'd need a forward and backward pointing member per fragment.
    We still have a problem with /context/{eventId} (permalinks) then, but could not store members in this case? As we would store the avatar and display name on the event anyway, we would only have less members in the store when filling permalinks, but if we need all members, we 

    Should we just bite the bullet and store historical members





# How to track members to add to incoming events

## for /sync
 - have most-recently-used cache of *n* members per room
 - cache takes members from ... ? persisted members? how do we get most recent members?

## for /messages
 - everything will be in the response itself (is that also true without include_redundant_members?)
   without include_redundant_members it does look like some members for which events are being returned
   will not be included. So when back-paginating, we can take any member we know of with the same fragmentId, or one
   that comes after (so we would need to load all membership events for a given userid, and filter them in memory using the fragmentidcomparer)

## for /context/{eventId}
 - everything will be in the response itself (is that also true without include_redundant_members?)
   I'm guessing include_redundant_members doesn't apply to /context because the client doesn't know
   whether it comes before or after some part of the timeline it previously fetched.
