we should automatically fill gaps (capped at a certain (large) amount of events, 5000?) after a limited sync for a room

## E2EE rooms

during these fills (once supported), we should calculate push actions and trigger notifications, as we would otherwise have received this through sync.

we could also trigger notifications when just backfilling on initial sync up to a certain amount of time in the past?


we also need to backfill if we didn't receive any m.room.message in a limited sync for an encrypted room, as it's possible the room summary hasn't seen the last message in the room and is now out of date. this is also true for a non-encrypted room actually, although wrt to the above, here notifications would work well though.

a room should request backfills in needsAfterSyncCompleted and do them in afterSyncCompleted.
