/*
Copyright 2020 The Matrix.org Foundation C.I.C.

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

import {Navigation, Segment} from "./Navigation.js";
import {URLRouter} from "./URLRouter.js";

export function createNavigation() {
    return new Navigation(function allowsChild(parent, child) {
        const {type} = child;
        switch (parent?.type) {
            case undefined:
                // allowed root segments
                return type === "login"  || type === "session";
            case "session":
                return type === "room" || type === "rooms" || type === "settings";
            case "rooms":
                // downside of the approach: both of these will control which tile is selected
                return type === "room" || type === "empty-grid-tile";
            default:
                return false;
        }
    });
}

export function createRouter({history, navigation}) {
    return new URLRouter({history, navigation, redirect});
}

function redirect(urlParts, navigation) {
    const {path} = navigation;
    const segments = urlParts.reduce((output, s) => {
        // redirect open-room action to grid/non-grid url
        if (s.type === "open-room") {
            const rooms = path.get("rooms");
            if (rooms) {
                output = output.concat(roomsSegmentWithRoom(rooms, s.value, path));
            }
            return rooms.concat(new Segment("room", s.value));
        }
        return output.concat(s);
    }, []);
    return navigation.pathFrom(segments);
}

function roomsSegmentWithRoom(rooms, roomId, path) {
    // find the index of either the current room,
    // or the current selected empty tile,
    // to put the new room in
    
    // TODO: is rooms.value a string or an array?
    const room = path.get("room");
    let index = 0;
    if (room) {
        index = rooms.value.indexOf(room.value);
    } else {
        const emptyGridTile = path.get("empty-grid-tile");
        if (emptyGridTile) {
            index = emptyGridTile.value;
        }
    } 
    const newRooms = rooms.slice();
    newRooms[index] = roomId;
    return new Segment("rooms", newRooms);
}

function parseUrlValue(type, iterator) {
    if (type === "rooms") {
        const roomIds = iterator.next().value.split(",");
        const selectedIndex = parseInt(iterator.next().value, 10);
        const roomId = roomIds[selectedIndex];
        if (roomId) {
            return [new Segment(type, roomIds), new Segment("room", roomId)];
        } else {
            return [new Segment(type, roomIds), new Segment("empty-grid-tile", selectedIndex)];
        }
    }
}
