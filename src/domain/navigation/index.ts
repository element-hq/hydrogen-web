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

import {Navigation, Segment} from "./Navigation";
import {URLRouter} from "./URLRouter.js";
import type { Path } from "./Navigation";

type SegmentType = {
    "login": true;
    "session": string;
    "sso": string;
    "logout": true;
    "room": string;
    "rooms": string[];
    "settings": true;
    "create-room": true;
    "empty-grid-tile": number;
    "lightbox": string;
    "right-panel": true;
    "details": true;
    "members": true;
    "member": string;
};

export function createNavigation() {
    return new Navigation(allowsChild);
}

export function createRouter({history, navigation}) {
    return new URLRouter({history, navigation, stringifyPath, parseUrlPath});
}

function allowsChild(parent: {type: string, value: any} | undefined, child: {type: string, value: any}): boolean {
    const {type} = child;
    switch (parent?.type) {
        case undefined:
            // allowed root segments
            return type === "login"  || type === "session" || type === "sso" || type === "logout";
        case "session":
            return type === "room" || type === "rooms" || type === "settings" || type === "create-room";
        case "rooms":
            // downside of the approach: both of these will control which tile is selected
            return type === "room" || type === "empty-grid-tile";
        case "room":
            return type === "lightbox" || type === "right-panel";
        case "right-panel":
            return type === "details"|| type === "members" || type === "member";
        default:
            return false;
    }
}

export function removeRoomFromPath(path: Path<SegmentType>, roomId: string): Path<SegmentType> | null {
    let newPath: Path<SegmentType> | null = path;
    const rooms = newPath.get("rooms");
    let roomIdGridIndex = -1;
    // first delete from rooms segment
    if (rooms) {
        roomIdGridIndex = rooms.value.indexOf(roomId);
        if (roomIdGridIndex !== -1) {
            const idsWithoutRoom = rooms.value.slice();
            idsWithoutRoom[roomIdGridIndex] = "";
            newPath = newPath.replace(new Segment("rooms", idsWithoutRoom));
        }
    }
    const room = newPath!.get("room");
    // then from room (which occurs with or without rooms)
    if (room && room.value === roomId) {
        if (roomIdGridIndex !== -1) {
            newPath = newPath!.with(new Segment("empty-grid-tile", roomIdGridIndex));
        } else {
            newPath = newPath!.until("session");
        }
    }
    return newPath;
}

function roomsSegmentWithRoom(rooms: Segment<SegmentType, "rooms">, roomId: string, path: Path<SegmentType>): Segment<SegmentType, "rooms"> {
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

// todo-self: verify code change here is okay
function pushRightPanelSegment<T extends keyof SegmentType>(array: Segment<SegmentType>[], segment: T, ...value: SegmentType[T] extends true? [(undefined | true)?]: [SegmentType[T]]) {
    array.push(new Segment("right-panel"));
    array.push(new Segment(segment, ...value));
}

export function addPanelIfNeeded<T extends SegmentType>(navigation: Navigation<T>, path: Path<T>): Path<T> {
    const segments = navigation.path.segments;
    const i = segments.findIndex(segment => segment.type === "right-panel");
    let _path = path;
    if (i !== -1) {
        _path = path.until("room");
        _path = _path.with(segments[i])!;
        _path = _path.with(segments[i + 1])!;
    }
    return _path;
}

export function parseUrlPath(urlPath: string, currentNavPath: Path<SegmentType>, defaultSessionId: string): Segment<SegmentType>[] {
    // substr(1) to take of initial /
    const parts = urlPath.substring(1).split("/");
    const iterator = parts[Symbol.iterator]();
    const segments: Segment<SegmentType>[] = [];
    let next; 
    while (!(next = iterator.next()).done) {
        const type = next.value;
        if (type === "rooms") {
            const roomsValue = iterator.next().value;
            if (roomsValue === undefined) { break; }
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
            const openRoomPartIndex = parts.findIndex(part => part === "open-room");
            const hasOnlyRoomIdAfterPart = openRoomPartIndex >= parts.length - 2;
            if (hasOnlyRoomIdAfterPart) {
                // Copy right-panel segments from previous path only if there are no other parts after open-room
                // fixes memberlist -> member details closing/opening grid view
                const previousSegments = currentNavPath.segments;
                const i = previousSegments.findIndex(s => s.type === "right-panel");
                if (i !== -1) {
                    segments.push(...previousSegments.slice(i));
                }
            }
        } else if (type === "last-session") {
            let sessionSegment = currentNavPath.get("session");
            if (typeof sessionSegment?.value !== "string" && defaultSessionId) {
                sessionSegment = new Segment("session", defaultSessionId);
            }
            if (sessionSegment) {
                segments.push(sessionSegment);
            }
        } else if (type === "details" || type === "members") {
            pushRightPanelSegment(segments, type);
        } else if (type === "member") {
            const userId = iterator.next().value;
            if (!userId) { break; }
            pushRightPanelSegment(segments, type, userId);
        } else if (type.includes("loginToken")) {
            // Special case for SSO-login with query parameter loginToken=<token>
            const loginToken = type.split("=").pop();
            segments.push(new Segment("sso", loginToken));
        } else {
            // might be undefined, which will be turned into true by Segment 
            const value = iterator.next().value;
            segments.push(new Segment(type, value));
        }
    }
    return segments;
}

export function stringifyPath(path: Path<SegmentType>): string {
    let urlPath = "";
    let prevSegment: Segment<SegmentType> | undefined;
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
            case "right-panel":
            case "sso":
                // Do not put these segments in URL
                continue;
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

    function createEmptyPath() {
        const nav: Navigation<SegmentType> = new Navigation(allowsChild);
        const path = nav.pathFrom([]);
        return path;
    }

    return {
        "stringify grid url with focused empty tile": assert => {
            const nav: Navigation<SegmentType> = new Navigation(allowsChild);
            const path = nav.pathFrom([
                new Segment("session", 1),
                new Segment("rooms", ["a", "b", "c"]),
                new Segment("empty-grid-tile", 3)
            ]);
            const urlPath = stringifyPath(path);
            assert.equal(urlPath, "/session/1/rooms/a,b,c/3");
        },
        "stringify grid url with focused room": assert => {
            const nav: Navigation<SegmentType> = new Navigation(allowsChild);
            const path = nav.pathFrom([
                new Segment("session", 1),
                new Segment("rooms", ["a", "b", "c"]),
                new Segment("room", "b")
            ]);
            const urlPath = stringifyPath(path);
            assert.equal(urlPath, "/session/1/rooms/a,b,c/1");
        },
        "stringify url with right-panel and details segment": assert => {
            const nav: Navigation<SegmentType> = new Navigation(allowsChild);
            const path = nav.pathFrom([
                new Segment("session", 1),
                new Segment("rooms", ["a", "b", "c"]),
                new Segment("room", "b"),
                new Segment("right-panel"),
                new Segment("details")
            ]);
            const urlPath = stringifyPath(path);
            assert.equal(urlPath, "/session/1/rooms/a,b,c/1/details");
        },
        "Parse loginToken query parameter into SSO segment": assert => {
            const path = createEmptyPath();
            const segments = parseUrlPath("?loginToken=a1232aSD123", path, "");
            assert.equal(segments.length, 1);
            assert.equal(segments[0].type, "sso");
            assert.equal(segments[0].value, "a1232aSD123");
        },
        "parse grid url path with focused empty tile": assert => {
            const path = createEmptyPath();
            const segments = parseUrlPath("/session/1/rooms/a,b,c/3", path, "");
            assert.equal(segments.length, 3);
            assert.equal(segments[0].type, "session");
            assert.equal(segments[0].value, "1");
            assert.equal(segments[1].type, "rooms");
            assert.deepEqual(segments[1].value, ["a", "b", "c"]);
            assert.equal(segments[2].type, "empty-grid-tile");
            assert.equal(segments[2].value, 3);
        },
        "parse grid url path with focused room": assert => {
            const path = createEmptyPath();
            const segments = parseUrlPath("/session/1/rooms/a,b,c/1", path, "");
            assert.equal(segments.length, 3);
            assert.equal(segments[0].type, "session");
            assert.equal(segments[0].value, "1");
            assert.equal(segments[1].type, "rooms");
            assert.deepEqual(segments[1].value, ["a", "b", "c"]);
            assert.equal(segments[2].type, "room");
            assert.equal(segments[2].value, "b");
        },
        "parse empty grid url": assert => {
            const path = createEmptyPath();
            const segments = parseUrlPath("/session/1/rooms/", path, "");
            assert.equal(segments.length, 3);
            assert.equal(segments[0].type, "session");
            assert.equal(segments[0].value, "1");
            assert.equal(segments[1].type, "rooms");
            assert.deepEqual(segments[1].value, [""]);
            assert.equal(segments[2].type, "empty-grid-tile");
            assert.equal(segments[2].value, 0);
        },
        "parse empty grid url with focus": assert => {
            const path = createEmptyPath();
            const segments = parseUrlPath("/session/1/rooms//1", path, "");
            assert.equal(segments.length, 3);
            assert.equal(segments[0].type, "session");
            assert.equal(segments[0].value, "1");
            assert.equal(segments[1].type, "rooms");
            assert.deepEqual(segments[1].value, [""]);
            assert.equal(segments[2].type, "empty-grid-tile");
            assert.equal(segments[2].value, 1);
        },
        "parse open-room action replacing the current focused room": assert => {
            const nav: Navigation<SegmentType> = new Navigation(allowsChild);
            const path = nav.pathFrom([
                new Segment("session", 1),
                new Segment("rooms", ["a", "b", "c"]),
                new Segment("room", "b")
            ]);
            const segments = parseUrlPath("/session/1/open-room/d", path, "");
            assert.equal(segments.length, 3);
            assert.equal(segments[0].type, "session");
            assert.equal(segments[0].value, "1");
            assert.equal(segments[1].type, "rooms");
            assert.deepEqual(segments[1].value, ["a", "d", "c"]);
            assert.equal(segments[2].type, "room");
            assert.equal(segments[2].value, "d");
        },
        "parse open-room action changing focus to an existing room": assert => {
            const nav: Navigation<SegmentType> = new Navigation(allowsChild);
            const path = nav.pathFrom([
                new Segment("session", 1),
                new Segment("rooms", ["a", "b", "c"]),
                new Segment("room", "b")
            ]);
            const segments = parseUrlPath("/session/1/open-room/a", path, "");
            assert.equal(segments.length, 3);
            assert.equal(segments[0].type, "session");
            assert.equal(segments[0].value, "1");
            assert.equal(segments[1].type, "rooms");
            assert.deepEqual(segments[1].value, ["a", "b", "c"]);
            assert.equal(segments[2].type, "room");
            assert.equal(segments[2].value, "a");
        },
        "parse open-room action changing focus to an existing room with details open": assert => {
            const nav: Navigation<SegmentType> = new Navigation(allowsChild);
            const path = nav.pathFrom([
                new Segment("session", 1),
                new Segment("rooms", ["a", "b", "c"]),
                new Segment("room", "b"),
                new Segment("right-panel", true),
                new Segment("details", true)
            ]);
            const segments = parseUrlPath("/session/1/open-room/a", path, "");
            assert.equal(segments.length, 5);
            assert.equal(segments[0].type, "session");
            assert.equal(segments[0].value, "1");
            assert.equal(segments[1].type, "rooms");
            assert.deepEqual(segments[1].value, ["a", "b", "c"]);
            assert.equal(segments[2].type, "room");
            assert.equal(segments[2].value, "a");
            assert.equal(segments[3].type, "right-panel");
            assert.equal(segments[3].value, true);
            assert.equal(segments[4].type, "details");
            assert.equal(segments[4].value, true);
        },
        "open-room action should only copy over previous segments if there are no parts after open-room": assert => {
            const nav: Navigation<SegmentType> = new Navigation(allowsChild);
            const path = nav.pathFrom([
                new Segment("session", 1),
                new Segment("rooms", ["a", "b", "c"]),
                new Segment("room", "b"),
                new Segment("right-panel", true),
                new Segment("members", true)
            ]);
            const segments = parseUrlPath("/session/1/open-room/a/member/foo", path, "");
            assert.equal(segments.length, 5);
            assert.equal(segments[0].type, "session");
            assert.equal(segments[0].value, "1");
            assert.equal(segments[1].type, "rooms");
            assert.deepEqual(segments[1].value, ["a", "b", "c"]);
            assert.equal(segments[2].type, "room");
            assert.equal(segments[2].value, "a");
            assert.equal(segments[3].type, "right-panel");
            assert.equal(segments[3].value, true);
            assert.equal(segments[4].type, "member");
            assert.equal(segments[4].value, "foo");
        },
        "parse open-room action setting a room in an empty tile": assert => {
            const nav: Navigation<SegmentType> = new Navigation(allowsChild);
            const path = nav.pathFrom([
                new Segment("session", 1),
                new Segment("rooms", ["a", "b", "c"]),
                new Segment("empty-grid-tile", 4)
            ]);
            const segments = parseUrlPath("/session/1/open-room/d", path, "");
            assert.equal(segments.length, 3);
            assert.equal(segments[0].type, "session");
            assert.equal(segments[0].value, "1");
            assert.equal(segments[1].type, "rooms");
            assert.deepEqual(segments[1].value, ["a", "b", "c", , "d"]); //eslint-disable-line no-sparse-arrays
            assert.equal(segments[2].type, "room");
            assert.equal(segments[2].value, "d");
        },
        "parse session url path without id": assert => {
            const path = createEmptyPath();
            const segments = parseUrlPath("/session", path, "");
            assert.equal(segments.length, 1);
            assert.equal(segments[0].type, "session");
            assert.strictEqual(segments[0].value, true);
        },
        "remove active room from grid path turns it into empty tile": assert => {
            const nav: Navigation<SegmentType> = new Navigation(allowsChild);
            const path = nav.pathFrom([
                new Segment("session", 1),
                new Segment("rooms", ["a", "b", "c"]),
                new Segment("room", "b")
            ]);
            const newPath = removeRoomFromPath(path, "b");
            assert.equal(newPath?.segments.length, 3);
            assert.equal(newPath?.segments[0].type, "session");
            assert.equal(newPath?.segments[0].value, 1);
            assert.equal(newPath?.segments[1].type, "rooms");
            assert.deepEqual(newPath?.segments[1].value, ["a", "", "c"]);
            assert.equal(newPath?.segments[2].type, "empty-grid-tile");
            assert.equal(newPath?.segments[2].value, 1);
        },
        "remove inactive room from grid path": assert => {
            const nav: Navigation<SegmentType> = new Navigation(allowsChild);
            const path = nav.pathFrom([
                new Segment("session", 1),
                new Segment("rooms", ["a", "b", "c"]),
                new Segment("room", "b")
            ]);
            const newPath = removeRoomFromPath(path, "a");
            assert.equal(newPath?.segments.length, 3);
            assert.equal(newPath?.segments[0].type, "session");
            assert.equal(newPath?.segments[0].value, 1);
            assert.equal(newPath?.segments[1].type, "rooms");
            assert.deepEqual(newPath?.segments[1].value, ["", "b", "c"]);
            assert.equal(newPath?.segments[2].type, "room");
            assert.equal(newPath?.segments[2].value, "b");
        },
        "remove inactive room from grid path with empty tile": assert => {
            const nav: Navigation<SegmentType> = new Navigation(allowsChild);
            const path = nav.pathFrom([
                new Segment("session", 1),
                new Segment("rooms", ["a", "b", ""]),
                new Segment("empty-grid-tile", 3)
            ]);
            const newPath = removeRoomFromPath(path, "b");
            assert.equal(newPath?.segments.length, 3);
            assert.equal(newPath?.segments[0].type, "session");
            assert.equal(newPath?.segments[0].value, 1);
            assert.equal(newPath?.segments[1].type, "rooms");
            assert.deepEqual(newPath?.segments[1].value, ["a", "", ""]);
            assert.equal(newPath?.segments[2].type, "empty-grid-tile");
            assert.equal(newPath?.segments[2].value, 3);
        },
        "remove active room": assert => {
            const nav: Navigation<SegmentType> = new Navigation(allowsChild);
            const path = nav.pathFrom([
                new Segment("session", 1),
                new Segment("room", "b")
            ]);
            const newPath = removeRoomFromPath(path, "b");
            assert.equal(newPath?.segments.length, 1);
            assert.equal(newPath?.segments[0].type, "session");
            assert.equal(newPath?.segments[0].value, 1);
        },
        "remove inactive room doesn't do anything": assert => {
            const nav: Navigation<SegmentType> = new Navigation(allowsChild);
            const path = nav.pathFrom([
                new Segment("session", 1),
                new Segment("room", "b")
            ]);
            const newPath = removeRoomFromPath(path, "a");
            assert.equal(newPath?.segments.length, 2);
            assert.equal(newPath?.segments[0].type, "session");
            assert.equal(newPath?.segments[0].value, 1);
            assert.equal(newPath?.segments[1].type, "room");
            assert.equal(newPath?.segments[1].value, "b");
        },
        
    }
}
