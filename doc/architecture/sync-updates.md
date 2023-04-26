# persistance vs model update of a room

## persist first, return update object, update model with update object
 - we went with this
## update model first, return update object, persist with update object
 - not all models exist at all times (timeline only when room is "open"),
 	so model to create timeline update object might not exist for persistence need

## persist, update, each only based on sync data (independent of each other)
 - possible inconsistency between syncing and loading from storage as they are different code paths
 + storage code remains very simple and focussed

## updating model and persisting in one go
 - if updating model needs to do anything async, it needs to postpone it or the txn will be closed

## persist first, read from storage to update model
 + guaranteed consistency between what is on screen and in storage
 - slower as we need to reread what was just synced every time (big accounts with frequent updates)
