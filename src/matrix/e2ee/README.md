## Integratation within the sync lifetime cycle

### prepareSync
    
    The session can start its own read/write transactions here, rooms only read from a shared transaction

    - session
        - device handler
            - txn
                - write pending encrypted
            - txn
                - olm decryption read
            - olm async decryption
                - dispatch to worker
            - txn
                - olm decryption write / remove pending encrypted
    - rooms (with shared read txn)
        - megolm decryption read

### afterPrepareSync

    - rooms    
        - megolm async decryption   
            - dispatch to worker

### writeSync

    - rooms (with shared readwrite txn)
        - megolm decryption write, yielding decrypted events
        - use decrypted events to write room summary

### afterSync

    - rooms
        - emit changes

### afterSyncCompleted

    - session
        - e2ee account
            - generate more otks if needed
            - upload new otks if needed or device keys if not uploaded before
    - rooms
        - share new room keys if needed
