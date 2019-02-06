
/*
idb stores:
all in one database per stored session:
	- session (store all sessions in localStorage object?)
		- device id
		- last sync token
		- access token
		- home server
		- user id
		- user name
		- avatar
		- filter(s)?
	- room_summaries
		- room_id
		- heroes
		- room_name
		- room_avatar (just the url)
		- tags (account_data?)
		- is_direct
		- unread_message_count ?
		- unread_message_with_mention ?
	- roomstate_{room_id}

		we only really need historical roomstate for historical display names?
			so we can get away without doing this to begin with ...

		how about every state event gets a revision number
		for each state event, we store the min and max revision number where they form part of the room state
		then we "just" do a where revision_range includes revision, and every state event event/gap in the timeline we store the revision number, and we have an index on it? so we can easily look for the nearest one 

	
		it's like every state event we know about has a range where it is relevant
		we want the intersection of a revision with all ranges
        1           2 3      *   4  5       6
		|   topic   |     oth*er topic     |
		|     power levels   *   |
		| member a'1  | membe*r a'2 |
							 *-------- get intersection for all or some type & state_keys for revision 3 (forward) or 4 (backwards)

		tricky to do a > && < in indexeddb
		we'll need to do either > or < for min or max revision and iterate through the cursor and apply the rest of the conditions in code ...

		all current state for last event would have max revision of some special value to indicate it hasn't been replaced yet.

		the idea is that we can easily load just the state for a given event in the timeline,
		can be the last synced event, or a permalink event
	- members_{room_id}
		historical?
	- timeline_{room_id}
		how to store timeline events in order they should be shown?
		what's the key they should be sorted by?

		start with origin_server_ts of first event as 0 and add / subtract from there
		in case of gaps, take the max(last_ts + 1000, origin_server_ts) again to get an idea of how many
		numbers are in between, and go down/up one again for events filling the gap
		
		when closing the gap, we notice there are not enough numbers between the PK
		of both sides of the gap (because more than 1 event / millisecond was sent, or server clocks were off),
		what do we do? floating point?

	- search?

where to store avatars?
	we could cache the requested ones in a table ...
	or service worker, but won't work on my phone
*/

class Credentials {
	accessToken,
	deviceId
}

class LoginFlow {

	constructor(network) {

	}
//differentiate between next stage and Credentials?
	async next(stage) {}

	static async attemptPasswordLogin(username, password) {

	}
}

class LoginStage {
	get type() {}
	serialize() {} 	//called by LoginFlow::next
}

class PasswordStage extends LoginStage {
	set password() {

	}

	set username() {

	}

	serialize() {
		return {
			identifier: {
				type: "m.id.user",
				user: this._username
			},
			password: this._password
		};
	}
}