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
    return new Navigation(allowsChild);
}

export function createRouter({history, navigation}) {
    return new URLRouter({history, navigation, stringifyPath, parseUrlPath});
}

function allowsChild(parent, child) {
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
}

function roomsSegmentWithRoom(rooms, roomId, path) {
    if(!rooms.value.includes(roomId)) {
        const emptyGridTile = path.get("empty-grid-tile");
        const oldRoom = path.get("room");
        let index = 0;
        if (emptyGridTile) {
            index = emptyGridTile.value;
        } else if (oldRoom) {
            index = rooms.value.indexOf(oldRoom.value);
        }
        const roomIds = rooms.value.slice();
        roomIds[index] = roomId;
        return new Segment("rooms", roomIds);
    } else {
        return rooms;
    }
}

export function parseUrlPath(urlPath, currentNavPath) {
    // substr(1) to take of initial /
    const parts = urlPath.substr(1).split("/");
    const iterator = parts[Symbol.iterator]();
    const segments = [];
    let next; 
    while (!(next = iterator.next()).done) {
        const type = next.value;
        if (type === "rooms") {
            const roomsValue = iterator.next().value;
            if (!roomsValue) { break; }
            const roomIds = roomsValue.split(",");
            segments.push(new Segment(type, roomIds));
            const selectedIndex = parseInt(iterator.next().value || "0", 10);
            const roomId = roomIds[selectedIndex];
            if (roomId) {
                segments.push(new Segment("room", roomId));
            } else {
                segments.push(new Segment("empty-grid-tile", selectedIndex));
            }
        } else if (type === "open-room") {
            const roomId = iterator.next().value;
            if (!roomId) { break; }
            const rooms = currentNavPath.get("rooms");
            if (rooms) {
                segments.push(roomsSegmentWithRoom(rooms, roomId, currentNavPath));
            }
            segments.push(new Segment("room", roomId));
        } else {
            // might be undefined, which will be turned into true by Segment 
            const value = iterator.next().value;
            segments.push(new Segment(type, value));
        }
    }
    return segments;
}

export function stringifyPath(path) {
    let urlPath = "";
    let prevSegment;
    for (const segment of path.segments) {
        switch (segment.type) {
            case "rooms":
                urlPath += `/rooms/${segment.value.join(",")}`;
                break;
            case "empty-grid-tile":
                urlPath += `/${segment.value}`;
                break;
            case "room":
                if (prevSegment?.type === "rooms") {
                    const index = prevSegment.value.indexOf(segment.value);
                    urlPath += `/${index}`;
                } else {
                    urlPath += `/${segment.type}/${segment.value}`;
                }
                break;
            default:
                urlPath += `/${segment.type}`;
                if (segment.value && segment.value !== true) {
                    urlPath += `/${segment.value}`;
                }
        }
        prevSegment = segment;
    }
    return urlPath;
}

export function tests() {
    return {
        "stringify grid url with focused empty tile": assert => {
            const nav = new Navigation(allowsChild);
            const path = nav.pathFrom([
                new Segment("session", 1),
                new Segment("rooms", ["a", "b", "c"]),
                new Segment("empty-grid-tile", 3)
            ]);
            const urlPath = stringifyPath(path);
            assert.equal(urlPath, "/session/1/rooms/a,b,c/3");
        },
        "stringify grid url with focused room": assert => {
            const nav = new Navigation(allowsChild);
            const path = nav.pathFrom([
                new Segment("session", 1),
                new Segment("rooms", ["a", "b", "c"]),
                new Segment("room", "b")
            ]);
            const urlPath = stringifyPath(path);
            assert.equal(urlPath, "/session/1/rooms/a,b,c/1");
        },
        "parse grid url path with focused empty tile": assert => {
            const segments = parseUrlPath("/session/1/rooms/a,b,c/3");
            assert.equal(segments.length, 3);
            assert.equal(segments[0].type, "session");
            assert.equal(segments[0].value, "1");
            assert.equal(segments[1].type, "rooms");
            assert.deepEqual(segments[1].value, ["a", "b", "c"]);
            assert.equal(segments[2].type, "empty-grid-tile");
            assert.equal(segments[2].value, 3);
        },
        "parse grid url path with focused room": assert => {
            const segments = parseUrlPath("/session/1/rooms/a,b,c/1");
            assert.equal(segments.length, 3);
            assert.equal(segments[0].type, "session");
            assert.equal(segments[0].value, "1");
            assert.equal(segments[1].type, "rooms");
            assert.deepEqual(segments[1].value, ["a", "b", "c"]);
            assert.equal(segments[2].type, "room");
            assert.equal(segments[2].value, "b");
        },
        "parse open-room action replacing the current focused room": assert => {
            const nav = new Navigation(allowsChild);
            const path = nav.pathFrom([
                new Segment("session", 1),
                new Segment("rooms", ["a", "b", "c"]),
                new Segment("room", "b")
            ]);
            const segments = parseUrlPath("/session/1/open-room/d", path);
            assert.equal(segments.length, 3);
            assert.equal(segments[0].type, "session");
            assert.equal(segments[0].value, "1");
            assert.equal(segments[1].type, "rooms");
            assert.deepEqual(segments[1].value, ["a", "d", "c"]);
            assert.equal(segments[2].type, "room");
            assert.equal(segments[2].value, "d");
        },
        "parse open-room action setting a room in an empty tile": assert => {
            const nav = new Navigation(allowsChild);
            const path = nav.pathFrom([
                new Segment("session", 1),
                new Segment("rooms", ["a", "b", "c"]),
                new Segment("empty-grid-tile", 4)
            ]);
            const segments = parseUrlPath("/session/1/open-room/d", path);
            assert.equal(segments.length, 3);
            assert.equal(segments[0].type, "session");
            assert.equal(segments[0].value, "1");
            assert.equal(segments[1].type, "rooms");
            assert.deepEqual(segments[1].value, ["a", "b", "c", , "d"]); //eslint-disable-line no-sparse-arrays
            assert.equal(segments[2].type, "room");
            assert.equal(segments[2].value, "d");
        },
        "parse session url path without id": assert => {
            const segments = parseUrlPath("/session");
            assert.equal(segments.length, 1);
            assert.equal(segments[0].type, "session");
            assert.strictEqual(segments[0].value, true);
        }
    }
}
