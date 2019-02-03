Session
	properties:
		rooms -> Rooms

# storage
Storage
	key...() -> KeyRange
	start...Txn() -> Transaction
Transaction
	store(name) -> ObjectStore
	finish()
	rollback()
ObjectStore : QueryTarget
	index(name)
Index : QueryTarget

 
Rooms: EventEmitter, Iterator<RoomSummary>
	get(id) -> RoomSummary ?
InternalRoom: EventEmitter
	applySync(roomResponse, membership, txn)
		- this method updates the room summary
		- persists the room summary
		- persists room state & timeline with RoomPersister
		- updates the OpenRoom if present


		applyAndPersistSync(roomResponse, membership, txn) {
			this._summary.applySync(roomResponse, membership);
			this._summary.persist(txn);
			this._roomPersister.persist(roomResponse, membership, txn);
			if (this._openRoom) {
				this._openRoom.applySync(roomResponse);
			}
		}

RoomPersister
	RoomPersister	(persists timeline and room state)
	RoomSummary		(persists room summary)
RoomSummary : EventEmitter
	methods:
		async open()
		id
		name
		lastMessage
		unreadCount
		mentionCount
		isEncrypted
		isDirectMessage
		membership

		should this have a custom reducer for custom fields?

	events
		propChange(fieldName)

OpenRoom : EventEmitter
	properties:
		timeline
	events:


RoomState: EventEmitter
	[room_id, event_type, state_key] -> [sort_key, event]
Timeline: EventEmitter
	// should have a cache of recently lookup sender members?
	// can we disambiguate members like this?
	methods:
		lastEvents(amount)
		firstEvents(amount)
		eventsAfter(sortKey, amount)
		eventsBefore(sortKey, amount)
	events:
		eventsApppended

RoomMembers : EventEmitter, Iterator
	// no order, but need to be able to get all members somehow, needs to map to a ReactiveMap or something
	events:
		added(ids, values)
		removed(ids, values)
		changed(id, fieldName)
RoomMember: EventEmitter
	properties:
		id
		name
		powerLevel
		membership
		avatar
	events:
		propChange(fieldName)