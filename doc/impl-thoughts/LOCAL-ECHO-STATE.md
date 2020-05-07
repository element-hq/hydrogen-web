# Local echo

## Remote vs local state for account_data, etc ...

For things like account data, and other requests that might fail, we could persist what we are sending next to the last remote version we have (with a flag for which one is remote and local, part of the key). E.g. for account data the key would be: [type, localOrRemoteFlag]

localOrRemoteFlag would be 1 of 3:
 - Remote
 - (Local)Unsent
 - (Local)Sent

although we only want 1 remote and 1 local value for a given key, perhaps a second field where localOrRemoteFlag is a boolean, and a sent=boolean field as well? We need this to know if we need to retry.

This will allow resending of these requests if needed. Once the request goes through, we remove the local version. 

then we can also see what the current value is with or without the pending local changes, and we don't have to wait for remote echo...
