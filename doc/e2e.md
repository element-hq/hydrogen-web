# Implementing e2e encryption:
## Olm
 - implement MemberList as ObservableMap
    - make sure we have all members (as we're using lazy loading members), and store these somehow
        - do we need to update /members on every limited sync response or did we find a way around this?
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
                    - for outbound, see  file:///home/bwindels/Downloads/matrix-docs/End-to-End%20Encryption%20implementation%20guide%20%7C%20Matrix.org.html#starting-an-olm-session
                    - for inbound, see: file:///home/bwindels/Downloads/matrix-docs/End-to-End%20Encryption%20implementation%20guide%20|%20Matrix.org.html#handling-an-mroomencrypted-event
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
        - signing KP
        - identity KP
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
 - implement maintaining one-time keys on server
    - update account with new new keys when /sync responded with device_one_time_keys_count < MAX/2
    - upload new one-time keys to /keys/upload
    - mark them as published in account
    - update picked session in storage
 - implement encrypting olm messages
    - roughly file:///home/bwindels/Downloads/matrix-docs/End-to-End%20Encryption%20implementation%20guide%20|%20Matrix.org.html#encrypting-an-event-with-olm
    - packaging as m.room.encrypted event
 - implement decrypting olm messages
    - roughly file:///home/bwindels/Downloads/matrix-docs/End-to-End%20Encryption%20implementation%20guide%20|%20Matrix.org.html#handling-an-mroomencrypted-event
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

we'll need to pass an implementation of EventSender or something to SendQueue that does the actual requests to send a message, one implementation for non-e2ee rooms (upload attachment, send event OR redact, ...) and one for e2ee rooms that send the olm keys, etc ... encrypts the message before sending, reusing as much logic as possible. this will entail multiple sendScheduler.request slots, as we should only do one request per slot, making sure if we'd restart that steps completed in sending are stored so we don't run them again (advancing olm key, ...) or they are safe to rerun. The `E2eeEventSender` or so would then also be the thing that has a dependency on the memberlist for device tracking, which keeps the dependency tree clean (e.g. no setMembers on a class that does both e2ee and non-e2ee)

## Verifying devices
 - validate fingerprint
 - have a look at SAS?

## Encrypted attachments
 - use AES-CTR from https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto

## Notes
  - libolm api docs (also for js api) would be great
