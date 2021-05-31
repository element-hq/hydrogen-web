/*
Copyright 2021 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

export class PowerLevels {
    constructor({powerLevelEvent, createEvent, ownUserId}) {
        this._plEvent = powerLevelEvent;
        this._createEvent = createEvent;
        this._ownUserId = ownUserId;
    }

    canRedactFromSender(userId) {
        if (userId === this._ownUserId) {
            return true;
        } else {
            return this.canRedact;
        }
    }

    get canRedact() {
        return this._getUserLevel(this._ownUserId) >= this._getActionLevel("redact");
    }

    _getUserLevel(userId) {
        if (this._plEvent) {
            let userLevel = this._plEvent.content?.users?.[userId];
            if (typeof userLevel !== "number") {
                userLevel = this._plEvent.content?.users_default;
            }
            if (typeof userLevel === "number") {
                return userLevel;
            }
        } else if (this._createEvent) {
            if (userId === this._createEvent.content?.creator) {
                return 100;
            }
        }
        return 0;
    }

    /** @param {string} action either "invite", "kick", "ban" or "redact". */
    _getActionLevel(action) {
        const level = this._plEvent?.content[action];
        if (typeof level === "number") {
            return level;
        } else {
            return 50;
        }
    }
}

export function tests() {
    const alice = "@alice:hs.tld";
    const bob = "@bob:hs.tld";
    const createEvent = {content: {creator: alice}};
    const powerLevelEvent = {content: {
        redact: 50,
        users: {
            [alice]: 50
        },
        users_default: 0
    }};

    return {
        "redact somebody else event with power level event": assert => {
            const pl1 = new PowerLevels({powerLevelEvent, ownUserId: alice});
            assert.equal(pl1.canRedact, true);
            const pl2 = new PowerLevels({powerLevelEvent, ownUserId: bob});
            assert.equal(pl2.canRedact, false);
        },
        "redact somebody else event with create event": assert => {
            const pl1 = new PowerLevels({createEvent, ownUserId: alice});
            assert.equal(pl1.canRedact, true);
            const pl2 = new PowerLevels({createEvent, ownUserId: bob});
            assert.equal(pl2.canRedact, false);
        },
        "redact own event": assert => {
            const pl = new PowerLevels({ownUserId: alice});
            assert.equal(pl.canRedactFromSender(alice), true);
            assert.equal(pl.canRedactFromSender(bob), false);
        },
    }
}