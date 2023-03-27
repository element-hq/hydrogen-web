/*
different room types create different kind of "sync listeners", who implement the sync lifecycle handlers

they would each have a factory, 
*/

interface IRoomSyncHandler {
    prepareSync()
    afterPrepareSync()
    writeSync()
    afterSync()
    afterSyncCompleted()
}

interface IRoom extends IRoomSyncHandler {
    start(): void;
    load(): void;
    get id(): string;
}

interface IRoomFactory<T extends IRoom> {
    createRoom(type, roomId, syncResponse): T
    createSchema(db, txn, oldVersion, version, log)
    get storesForSync(): string[];
    get rooms(): ObservableMap<string, T>
}

class InstantMessageRoom implements IRoom {
}

class InstantMessageRoomFactory implements IRoomFactory<InstantMessageRoom>{
    loadLastMessages(): Promise<void>
    /*
        get all room ids and sort them according to idb sorting order
        open cursor 'f' on `timelineFragments`
        open a cursor 'e' on `timelineEvents`
        for each room:
            with cursor 'f', go to last fragment id and go up from there to find live fragment
            with cursor 'e', go to last event index for fragment id and room id and go up until we have acceptable event type
        for encrypted rooms:
            decrypt message if needed (m.room.encrypted is likely something we want to display)
    */
}

class SpaceRoom implements IRoom {}

class SpaceRoomFactory implements IRoomFactory<SpaceRoom> {
    createRoom(type, roomId, syncResponse): IRoomSyncHandler
}

class Session {
    constructor(roomFactoriesByType: Map<string, IRoomFactory>) {

    }
}
