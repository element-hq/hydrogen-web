Lots of classes here. The complexity comes from needing to offload decryption to a webworker, mainly for IE11. We can't keep a idb transaction open while waiting for the response from the worker, so need to batch decryption of multiple events and do decryption in multiple steps:

 1. Read all used inbound sessions for the batch of events, requires a read txn. This happens in `Decryption`. Sessions are loaded into `SessionInfo` objects, which are also kept in a `SessionCache` to prevent having to read and unpickle them all the time.
 2. Actually decrypt. No txn can stay open during this step, as it can be offloaded to a worker and is thus async. This happens in `DecryptionPreparation`, which delegates to `SessionDecryption` per session.
 3. Read and write for the replay detection, requires a read/write txn. This happens in `DecryptionChanges`
 4. Return the decrypted entries, and errors if any
