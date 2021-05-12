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

export class RoomStatus {
    constructor(joined, invited, archived) {
        this.joined = joined;
        this.invited = invited;
        this.archived = archived;
    }

    withInvited() {
        if (this.invited) {
            return this;
        } else if (this.archived) {
            return RoomStatus.invitedAndArchived;
        } else {
            return RoomStatus.invited;
        }
    }

    withoutInvited() {
        if (!this.invited) {
            return this;
        } else if (this.joined) {
            return RoomStatus.joined;
        } else if (this.archived) {
            return RoomStatus.archived;
        } else {
            return RoomStatus.none;
        }
    }

    withoutArchived() {
        if (!this.archived) {
            return this;
        } else if (this.invited) {
            return RoomStatus.invited;
        } else {
            return RoomStatus.none;
        }
    }
}

RoomStatus.joined = new RoomStatus(true, false, false);
RoomStatus.archived = new RoomStatus(false, false, true);
RoomStatus.invited = new RoomStatus(false, true, false);
RoomStatus.invitedAndArchived = new RoomStatus(false, true, true);
RoomStatus.none = new RoomStatus(false, false, false);
