# Implementing e2e encryption:
## Olm
 - implement MemberList as ObservableMap
    - make sure we have all members (as we're using lazy loading members), and store these somehow
        - keep in mind that the server might not support lazy loading? E.g. we should store in a memberlist all the membership events passed by sync, perhaps with a flag if we already attempted to fetch all. We could also check if the server announces lazy loading support in the version response (I think r0.6.0).
        - do we need to update /members on every limited sync response or did we find a way around this?
            - I don't think we need to ... we get all state events that were sent during the gap in `room.state`
            - I tested this with riot and synapse, and indeed, we get membership events from the gap on a limited sync. This could be clearer in the spec though.
        - fields:
            - user id
            - room id
            - membership (invite, join, leave, ban)
            - display name
            - avatar url
            - needs disambiguation in member list? (e.g. display name is not unique)
            - device tracking status
        - key [room id, user id] so we can easily get who is in a room by looking at [room id, min] -> [room id, max]
            should the display name also be part of the key so the list is sorted by name? or have a sorting field of some sort
        - index on:
            - [user_id, room_id] to see which rooms a user is in, e.g. to recalculate trust on key changes
            - [room id, display name] to determine disambiguation?
        - for just e2ee without showing the list in the UI, we can do with only some of these things.
 - implement creating/loading an olm account
    - add libolm as dependency
    - store pickled account
    - load pickled account
    - update pickled account
    - add initial one-time keys
    - publish keys with /keys/upload
 - implement creating/loading an olm session for (userid, deviceid)
    - get olm session for [(userid, deviceid), ...]  (array so they can all go out in one /keys/claim call?)
        - create if not exists
            - claim one-time key with /keys/claim
            - verify signature on key
            - ??? what about inbound/outbound sessions? do they require multiple OlmSession objects?
                - doesn't look like it, more like a way to start the session but once started (type=1), they are equivalent?
                    - for outbound, see  https://matrix.org/docs/guides/end-to-end-encryption-implementation-guide#starting-an-olm-session
                    - for inbound, see: https://matrix.org/docs/guides/end-to-end-encryption-implementation-guide#handling-an-mroomencrypted-event
                - so in this case, it would the session would be created as an outbound session.
            - store pickled, index by curve25519 identity key?
        - get from storage if exists and unpickle
 - implement device tracking
    - store users?
        - needs_update (riot has status with 4 states: not tracked, pending download, downloading, up to date)
            - set during sync for users that appear in device_lists.changed
    - store devices
        - id
        - userid
        - signing PK
        - identity PK
        - algorithms
        - device name
        - verified
        - known? riot has this ... what does it mean exactly?
    - handle device_lists.changed in /sync response
        - call /keys/changed to get updated devices and store them
    - handle device_lists.left in /sync response
        - we can keep verified devices we don't share a room with anymore around perhaps, but
            shouldn't update them ... which we won't do anyway as they won't appear in changed anymore
    - when e2e is enabled, start tracking:
        - call /keys/query for all members in MemberList
        - verify signature on device keys
        - store devices
    - track which e2ee rooms a user is in? This so we don't need to load the member list when figuring out for which rooms a device changes has an effect. Maybe not yet needed here but we will need it to recalculate room trust. Perhaps we can also reuse the membership store if we have an index on (only) userid so we can ask with one query which rooms a user is in.
 - implement maintaining one-time keys on server
    - update account with new new keys when /sync responded with device_one_time_keys_count < MAX/2
    - upload new one-time keys to /keys/upload
    - mark them as published in account
    - update picked session in storage
 - implement encrypting olm messages
    - roughly https://matrix.org/docs/guides/end-to-end-encryption-implementation-guide#encrypting-an-event-with-olm
    - packaging as m.room.encrypted event
 - implement decrypting olm messages
    - roughly https://matrix.org/docs/guides/end-to-end-encryption-implementation-guide#handling-an-mroomencrypted-event
    - decrypt with libolm
    - verify signature
    - check message index, etc to detect replay attacks
  - handling wedged olm sessions
    - ???


## Megolm
 - ??? does every sender in a room have their own megolm session (to send)? I suppose so, yes
 - we need to pickle inbound and outbound sessions separately ... are they different entities?
    - they are: OutboundGroupSession and InboundGroupSession
    - should they be in different stores?
        - e.g. we have a store for outbound sessions (to send ourselves) and one for inbound
        - NO! the e2e implementation guide says specifically:
            "It should store these details as an inbound session, just as it would when receiving them via an m.room_key event."
        - wait, we probably have to store the session as BOTH an inbound and outbound session?
            - the outbound one so we can keep using it to encrypt
            - the inbound one to be able to decrypt our own messages? as we won't send a m.room_key to our own device
        - so yes, we'll store our own outbound sessions. Riot doesn't do this and just starts new ones when starting the client,
            but keeping this would probably give us better offline support/less network usage as we wouldn't have to create new megolm session most of the time
        - and we store the inbound sessions (including the ones derived from our own outbound sessions) to be able to decrypt all messages
 - create new megolm session
     - create new outbound group session
     - get megolm session id and key, put in m.room_key event
     - store megolm session
     - encrypt using olm and send as m.room.encrypted device message
 - receiving new megolm session
    - listen for m.room_key device message
    - decrypt using olm
    - create inbound group session
    - store megolm session
 - encrypt megolm message
 - decrypt megolm message
 - rotate megolm session
    - ??? does this happen automatically?
 - deactive sessions when members leave the room
 
## SendQueue

we'll need to pass an implementation of EventSender or something to SendQueue that does the actual requests to send a message, one implementation for non-e2ee rooms (upload attachment, send event OR redact, ...) and one for e2ee rooms that send the olm keys, etc ... encrypts the message before sending, reusing as much logic as possible. this will entail multiple sendScheduler.request slots, as we should only do one request per slot, making sure if we'd restart that steps completed in sending are stored so we don't run them again (advancing olm key, ...) or they are safe to rerun. The `E2eeEventSender` or so would then also be the thing that has a dependency on the memberlist for device tracking, which keeps the dependency tree clean (e.g. no setMembers on a class that does both e2ee and non-e2ee). We would also need to be able to encrypt non-megolm events with Olm, like 4S gossiping, etc ...

## Verifying devices
 - validate fingerprint
 - have a look at SAS?

## Encrypted attachments
 - use AES-CTR from https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto

## Notes
  - libolm api docs (also for js api) would be great. Found something that could work:
    https://gitlab.matrix.org/matrix-org/olm/-/blob/master/javascript/index.d.ts


## OO Design

e2ee/MemberList
    // changes user tracking and returns changed members
    // this probably needs to be run after updates to the rooms have been written 
    // to the txn so that if encryption was enabled in the same sync,
    // or maybe not as we probably don't get device updates for a room we just joined/enabled encryption in.

    async writeSync(txn)
    emitSync(changes)
    async addRoom(roomId, userIds, txn)
    async addMember(roomId, userId, txn)
    async removeMember(roomId, userId, txn)

    async getMember(userId, txn)

    // where would we use this? to encrypt?
    // - does that need to be observable? well, at least updatable
    // - to derive room trust from ... but how will this work with central emit point for room updates?
        // check observablevalue trust before and after sync and detect change ourselves?
        // set flag on room when observablevalue trust value emitted update and then reemit in emitSync?
        // ALSO, we need to show trust for all rooms but don't want to have to load all EncryptionUsers and their devices for all e2ee rooms.
        // can we build trust incrementally?
            // trusted + new unverified device = untrusted
            // trusted + some device got verified = ?? //needs a full recheck, but could be ok to do this after verification / cross signing by other party
            // trusted + some device/user got unverified = untrusted (not supported yet, but should be possible)
            // so sounds possible, but depends on how/if we can build decryption without needing all members

    async openMembersForRoom(roomId) : ObservableMap<userId, EncryptionUser>`

    // can we easily prevent redundancy between e2ee rooms that share the same member?

e2ee/EncryptionUser
    get trackingStatus()
    get roomIds()

    // how to represent we only keep these in memory for e2ee rooms?
    // for non-e2ee we would need to load them from storage, so needing an async method,
    // but for e2ee we probably don't want to await a Promise.resolve for every member when encrypting, decrypting, ... ? or would it be that bad?
    // should we index by sender key here and assume Device is only used for e2ee? Sounds reasonable ...
    `get devices() : ObservableMap<senderKey, Device>`

    would be nice if we could expose the devices of a member as an observable list on the member
    at the same time, we need to know if any member needs updating devices before sending a message... but this state would actually be kept on the member, so that works.

    we do need to aggregate all the trust in a room though for shields... how would trust be added to this?

    ```js
    // do we need the map here?
    const roomTrust = memberList.members.map(m => m.trust).reduce((minTrust, trust) => {
        if (!minTrust || minTrust.compare(trust) < 0) {
            return trust;
        }
        return minTrust;
    });
    ```

e2ee/Device
    // the session we should use to encrypt with, or null if none exists
    get outboundSession()
    // should this be on device or something more specific to crypto? Although Device is specific to crypto ...
    createOutboundSession()

    // gets the matching session, or creates one if needed/allowed
    async getInboundSessionForMessage()


e2ee/olm/OutboundSession
    encrypt(type, content, txn) (same txn should be used that will add the message to pendingEvents, here used to advance ratchet)


e2ee/olm/InboundSession
    decrypt(payload, txn)

e2ee/olm/Account
    // for everything in crypto, we should have a method to persist the intent
    createOTKs(txn)
    // ... an another one to upload it, persisting that we have in fact uploaded it
    uploadOTKs(txn)

DeviceList
    writeSync(txn)
    emitSync()
    queryPending()


actually, we need two member stores:
    - (Member) one for members per room with userid, avatar url, display name, power level, ... (most recent message timestamp)?
    - (EncryptionUser) one per unique member id for e2ee, with device tracking status, and e2ee rooms the member is in? If we duplicate this over every room the user is in, we complicate device tracking.

the e2ee rooms an EncryptionUser is in needs to be notified of device (tracking) changes to update its trust shield. The fact that the device list is outdated or that we will need to create a new olm session when sending a message should not emit an event.

requirements:
 - Members need to be able to exists without EncryptionUser
 - Members need to be able to map to an EncryptionUser (by userId) 
 - Member needs to have trust property derived from their EncryptionUser, with updates triggered somehow in central point, e.g. by Room.emitSync
    - also, how far do we want to take this central update point thing? I guess any update that will cascade in a room (summary) update ... so here adding a device would cascade into the room trust changing, which we want to emit from Room.emitSync.
    - hmm, I wonder if it makes sense to do this over member, or rather expose a second ObservableMap on the room for EncryptionUser where we can monitor trust
        - PROs separate observablemap:
            - don't need to load member list to display shields of user in timeline ... this might be fine though as e2ee rooms tend to be smaller rooms, and this is only for the room that is open.
        - CONs separate observablemap:
            - more clunky api, would need a join operator on ObservableMap to join the trust and Member into one ObservableMap to be able to display member list.
 - See if it is doable to sync e2ee rooms without having all their encryptionUsers and devices in memory:
     - Be able to decrypt *without* having all EncryptionUsers of a room and their devices in memory, but rather use indices on storage to load just what we need. Finding a matching inbound olm session is something we need to think how to do best. We'll need to see this one.
     - Be able to encrypt may require having all EncryptionUsers of a room and their devices in memory, as we typically only send in the room we are looking at (but not always, so forwarding an event, etc... might then require to "load" some of the machinery for that room, but that should be fine)
     - Be able to send EncryptionUser updates *without* having all EncryptionUsers and their devices in memory

other:
 - when populating EncryptionUsers for an e2ee room, we'll also populate Members as we need to fetch them from the server anyway.
 - Members can also be populated for other reasons (showing member list in non-e2ee room)


we should adjust the session store to become a key value store rather than just a single value, we can split up in:
    - syncData (filterId, syncToken, syncCount)
    - serverConfig (/versions response)
    - serialized olm Account
so we don't have write all of that on every sync to update the sync token

new stores:

room-members
e2ee-users
e2ee-devices
inbound-olm-sessions
outbound-olm-sessions
//tdb:
inbound-megolm-sessions
outbound-megolm-sessions

we should create constants with sets of store names that are needed for certain use cases, like write timeline will require [timeline, fragments, inbound-megolm-sessions] which we can reuse when filling the gap, writing timeline sync, ...

room summary should gain a field tracking if members have been loaded or not?

main things to figure out:
    - how to decrypt? what indices do we need? is it reasonable to do this without having all EncryptionUser/devices in memory?
        - big part of this is how we can find the matching olm session for an incoming event/create a new olm session
            - can we mark some olm sessions as "spent" once they are too old/have used max messages? or do we need to look into all past olm sessions for a senderKey/device?
