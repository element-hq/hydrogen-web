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
 - create new megolm session
     - create new outbound group session
     - get megolm session id and key, put in m.room_key event
     - store megolm session
     - encrypt using olm and send as m.room.encrypted device message
 - receiving new megolm session
    - listen for m.room_key device message
    - decrypt using olm
    - store megolm session
 - encrypt megolm message
 - decrypt megolm message
 - rotate megolm session
    - ??? does this happen automatically?
 - deactive sessions when members leave the room

## Verifying devices
 - validate fingerprint
 - have a look at SAS?

## Encrypted attachments
 - use AES-CTR from https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto

## Notes
  - libolm api docs (also for js api) would be great
