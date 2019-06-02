export function createEventEntry(key, roomId, event) {
    return {
        fragmentId: key.fragmentId,
        eventIndex: key.eventIndex,
        roomId,
        event: event,
    };
}

export function directionalAppend(array, value, direction) {
    if (direction.isForward) {
        array.push(value);
    } else {
        array.unshift(value);
    }
}

export function directionalConcat(array, otherArray, direction) {
    if (direction.isForward) {
        return array.concat(otherArray);
    } else {
        return otherArray.concat(array);
    }
}
