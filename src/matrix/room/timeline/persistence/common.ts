/*
Copyright 2020 Bruno Windels <bruno@windels.cloud>

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

import { EventKey } from "../EventKey";
import type { Direction } from "../Direction";

type EventEnry = {
    fragmentId: number;
    eventIndex: number;
    roomId: string;
    event: any;
    displayName?: string;
    avatarUrl?: string;
};

export function createEventEntry(
    key: EventKey,
    roomId: string,
    event: any
): EventEnry {
    return {
        fragmentId: key.fragmentId,
        eventIndex: key.eventIndex,
        roomId,
        event: event,
    };
}

export function directionalAppend<T>(
    array: T[],
    value: T,
    direction: Direction
): void {
    if (direction.isForward) {
        array.push(value);
    } else {
        array.unshift(value);
    }
}

export function directionalConcat<T>(
    array: T[],
    otherArray: T[],
    direction: Direction
): T[] {
    if (direction.isForward) {
        return array.concat(otherArray);
    } else {
        return otherArray.concat(array);
    }
}
