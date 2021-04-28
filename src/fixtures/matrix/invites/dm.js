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
                "type": "m.room.encryption",
                "state_key": "",
                "content": {
                    "algorithm": "m.megolm.v1.aes-sha2"
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
                "content": {
                    "avatar_url": "mxc://hs.tld/abc123",
                    "displayname": "Bob",
                    "is_direct": true,
                    "membership": "invite"
                },
                "sender": "@alice:hs.tld",
                "state_key": "@bob:hs.tld",
                "type": "m.room.member",
            }
        ]
    }
    };
export default inviteFixture;
