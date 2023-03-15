 - add internal room ids (to support room versioning later, and make internal event ids smaller and not needing escaping, and not needing a migration later on) ... hm this might need some more though. how to address a logical room? last room id? also we might not need it for room versioning ... it would basically be to make the ids smaller, but as idb is compressing, not sure that's a good reason? Although as we keep all room summaries in memory, it would be easy to map between these... you'd get event ids like 0000E78A00000020000A0B3C with room id, fragment id and event index. The room summary would store:
```
rooms: {
    "!eKhOsgLidcrWMWnxOr:vector.modular.im": 0x0000E78A,
    ...
}
mostRecentRoom: 0x0000E78A
```
if this is not on an indexed field, how can we do a query to find the last room id and +1 to assign a new one?

how do we identify a logical room (consisting on a recent room and perhaps multiple outdated ones)?
