const inviteFixture = {
    "invite_state": {
        "events": [
            {
                "type": "m.room.create",
                "state_key": "",
                "content": {
                    "creator": "@alice:hs.tld",
                },
                "sender": "@alice:hs.tld"
            },
            {
                "type": "m.room.join_rules",
                "state_key": "",
                "content": {
                    "join_rule": "invite"
                },
                "sender": "@alice:hs.tld"
            },
            {
                "type": "m.room.member",
                "state_key": "@alice:hs.tld",
                "content": {
                    "avatar_url": "mxc://hs.tld/def456",
                    "displayname": "Alice",
                    "membership": "join"
                },
                "sender": "@alice:hs.tld"
            },
            {
                "type": "m.room.name",
                "state_key": "",
                "content": {
                    "name": "Invite example"
                },
                "sender": "@alice:hs.tld"
            },
            {
                "content": {
                    "avatar_url": "mxc://hs.tld/abc123",
                    "displayname": "Bob",
                    "membership": "invite"
                },
                "sender": "@alice:hs.tld",
                "state_key": "@bob:hs.tld",
                "type": "m.room.member",
            },
            {
                "content": {
                    "url": "mxc://hs.tld/roomavatar"
                },
                "sender": "@alice:hs.tld",
                "state_key": "",
                "type": "m.room.avatar",
            }
        ]
    }
};
export default inviteFixture;