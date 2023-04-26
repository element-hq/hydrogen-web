## Integratation within the sync lifetime cycle

### session.prepareSync

Decrypt any device messages, and turn them into RoomKey instances.
Any rooms that are not in the sync response but for which we receive keys will be included in the rooms to sync.

Runs before any room.prepareSync, so the new room keys can be passed to each room prepareSync to use in decryption.

### room.prepareSync
    
    The session can start its own read/write transactions here, rooms only read from a shared transaction

    - rooms (with shared read txn)
        - megolm decryption read using any new keys decrypted by the session.

### room.afterPrepareSync

    - rooms    
        - megolm async decryption   
            - dispatch to worker

### room.writeSync

    - rooms (with shared readwrite txn)
        - megolm decryption write, yielding decrypted events
        - use decrypted events to write room summary

### session.writeSync

 - writes any room keys that were received

### room.afterSync

    - rooms
        - emit changes

### room.afterSyncCompleted

    - session
        - e2ee account
            - generate more otks if needed
            - upload new otks if needed or device keys if not uploaded before
        - device message handler:
            - fetch keys we don't know about yet for (call) to_device messages identity
            - pass signalling messages to call handler
    - rooms
        - share new room keys if needed
